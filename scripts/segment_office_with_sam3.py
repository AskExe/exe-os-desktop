#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = ROOT / "public"
LEVEL_PATH = ROOT / "src" / "views" / "officeLevel.json"
DEFAULT_OUTPUT_DIR = PUBLIC_ROOT / "virtual-office" / "occluders"
DEFAULT_ARTIFACT_DIR = ROOT / ".codex-artifacts" / "office-sam3"

PROMPT_OVERRIDES = {
    "north-ops-console-bank": "long computer workstation desk with monitors and chairs",
    "center-analyst-island": "central analyst desk island with monitors",
    "east-command-desk": "command desk with monitors",
    "east-garden-desk": "desk and planter workstation",
    "west-support-console": "computer console desk with monitors",
    "central-command-table": "large central command table",
    "hologram-platform": "round hologram platform with screens",
    "south-monitor-bank": "front monitor bank desk",
    "southeast-ops-desk": "south east operations desk",
    "west-garden-planter": "large indoor planter",
    "west-front-plant-rail": "front planter rail",
    "southwest-garden-terrace": "southwest garden planter terrace",
    "southeast-garden-terrace": "southeast garden planter terrace",
    "lower-left-railing": "lower left railing and platform edge",
}


def load_level() -> dict[str, Any]:
    with LEVEL_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def public_asset_path(public_url: str) -> Path:
    return PUBLIC_ROOT / public_url.removeprefix("/")


def prompt_for_object(obj: dict[str, Any]) -> str:
    if obj.get("sam3Prompt"):
        return obj["sam3Prompt"]
    if obj["id"] in PROMPT_OVERRIDES:
        return PROMPT_OVERRIDES[obj["id"]]
    return obj["label"].lower()


def object_prompt_points(obj: dict[str, Any]) -> list[dict[str, float]]:
    return obj.get("samPromptFootprint") or obj.get("occlusionFootprint") or obj["footprint"]


def pixel_points(points: list[dict[str, float]], width: int, height: int) -> list[tuple[int, int]]:
    return [
        (
            int(round((point["x"] / 100) * width)),
            int(round((point["y"] / 100) * height)),
        )
        for point in points
    ]


def prompt_box(points: list[tuple[int, int]], width: int, height: int, padding: int) -> list[int]:
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return [
        max(0, min(xs) - padding),
        max(0, min(ys) - padding),
        min(width - 1, max(xs) + padding),
        min(height - 1, max(ys) + padding),
    ]


def normalize_polygon(points: list[tuple[int, int]], width: int, height: int) -> list[dict[str, float]]:
    return [
        {
            "x": round((x / width) * 100, 2),
            "y": round((y / height) * 100, 2),
        }
        for x, y in points
    ]


def mask_to_polygon(mask: Any, width: int, height: int) -> list[dict[str, float]]:
    import cv2
    import numpy as np

    mask_u8 = (mask.astype(np.uint8) * 255)
    contours, _ = cv2.findContours(mask_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []

    contour = max(contours, key=cv2.contourArea)
    perimeter = cv2.arcLength(contour, True)
    epsilon = max(2.0, perimeter * 0.005)
    simplified = cv2.approxPolyDP(contour, epsilon, True)
    points = [(int(point[0][0]), int(point[0][1])) for point in simplified]
    return normalize_polygon(points, width, height)


def box_mask(shape: tuple[int, int], box: list[int]) -> Any:
    import numpy as np

    mask = np.zeros(shape, dtype=bool)
    mask[box[1]:box[3] + 1, box[0]:box[2] + 1] = True
    return mask


def mask_score(mask: Any, box: list[int], score: float) -> float:
    import numpy as np

    prompt_region = box_mask(mask.shape, box)
    intersection = np.logical_and(mask, prompt_region).sum()
    area = mask.sum()
    if area == 0:
        return -1.0
    overlap_ratio = float(intersection / area)
    return score + overlap_ratio


def tensor_to_numpy(value: Any) -> Any:
    if hasattr(value, "detach"):
        value = value.detach()
    if hasattr(value, "cpu"):
        value = value.cpu()
    if hasattr(value, "numpy"):
        return value.numpy()
    return value


def dependency_error() -> str:
    return (
        "Missing SAM3 dependencies or checkpoint access. SAM3 uses gated Hugging Face checkpoints.\n"
        "Recommended setup:\n"
        "  python3 -m venv .codex-artifacts/sam3-venv\n"
        "  . .codex-artifacts/sam3-venv/bin/activate\n"
        "  python -m pip install --upgrade pip\n"
        "  git clone https://github.com/facebookresearch/sam3.git .codex-artifacts/sam3-src\n"
        "  python -m pip install -e .codex-artifacts/sam3-src\n"
        "Then request access to the SAM3 Hugging Face checkpoints and run `hf auth login`."
    )


def run(args: argparse.Namespace) -> None:
    try:
        import numpy as np
        import torch
        from sam3.model.sam3_image_processor import Sam3Processor
        from sam3.model_builder import build_sam3_image_model
    except Exception as exc:
        raise SystemExit(f"{dependency_error()}\n\nImport error: {exc}") from exc

    level = load_level()
    width = int(level["canvas"]["width"])
    height = int(level["canvas"]["height"])
    source_url = level["assets"].get("sourceBackground", level["assets"]["background"])
    source = Image.open(public_asset_path(source_url)).convert("RGBA")
    if source.size != (width, height):
        source = source.resize((width, height), Image.Resampling.LANCZOS)

    device = args.device
    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"

    output_dir = Path(args.output_dir)
    artifact_dir = Path(args.artifact_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_dir.mkdir(parents=True, exist_ok=True)

    model = build_sam3_image_model()
    model.to(device=device)
    processor = Sam3Processor(model)
    state = processor.set_image(source.convert("RGB"))

    preview = source.copy()
    preview_overlay = Image.new("RGBA", source.size, (0, 0, 0, 0))
    preview_draw = ImageDraw.Draw(preview_overlay)
    suggestions: list[dict[str, Any]] = []

    for index, obj in enumerate(level["objects"]):
        if not obj.get("occludesAgents"):
            continue

        prompt = prompt_for_object(obj)
        points = pixel_points(object_prompt_points(obj), width, height)
        box = prompt_box(points, width, height, args.box_padding_px)
        output = processor.set_text_prompt(state=state, prompt=prompt)

        masks = tensor_to_numpy(output["masks"])
        scores = tensor_to_numpy(output["scores"])
        if masks.ndim == 4:
            masks = masks[:, 0, :, :]
        if masks.ndim == 2:
            masks = masks[None, :, :]

        ranked = sorted(
            range(len(masks)),
            key=lambda candidate: mask_score(masks[candidate].astype(bool), box, float(scores[candidate])),
            reverse=True,
        )
        if not ranked:
            print(f"No masks for {obj['id']} prompt={prompt!r}")
            continue

        best_index = ranked[0]
        mask = masks[best_index].astype(bool)
        mask = np.logical_and(mask, box_mask(mask.shape, box))
        if int(mask.sum()) == 0:
            print(f"Empty clipped mask for {obj['id']} prompt={prompt!r}")
            continue

        alpha = Image.fromarray((mask.astype("uint8") * 255), mode="L")
        occluder = Image.new("RGBA", source.size, (0, 0, 0, 0))
        occluder.alpha_composite(source)
        occluder.putalpha(alpha)
        occluder_path = output_dir / f"{obj['id']}.png"
        occluder.save(occluder_path, optimize=True, compress_level=9)

        color = (
            80 + (index * 47) % 150,
            100 + (index * 71) % 130,
            130 + (index * 37) % 110,
            86,
        )
        preview_draw.bitmap((0, 0), alpha, fill=color)
        suggestions.append({
            "id": obj["id"],
            "prompt": prompt,
            "score": round(float(scores[best_index]), 5),
            "maskAreaPx": int(mask.sum()),
            "promptBoxPx": box,
            "suggestedVisualPolygon": mask_to_polygon(mask, width, height),
            "occluderAsset": f"/virtual-office/occluders/{obj['id']}.png",
        })
        print(f"Wrote {occluder_path} prompt={prompt!r} score={float(scores[best_index]):.4f} area={int(mask.sum())}")

    preview.alpha_composite(preview_overlay)
    preview_path = artifact_dir / "office-sam3-preview.png"
    suggestions_path = artifact_dir / "office-sam3-suggestions.json"
    preview.save(preview_path)
    with suggestions_path.open("w", encoding="utf-8") as handle:
        json.dump({
            "source": source_url,
            "suggestions": suggestions,
        }, handle, indent=2)

    print(f"Wrote {preview_path}")
    print(f"Wrote {suggestions_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Use SAM3 text-prompt segmentation to generate detailed virtual-office occluder masks.",
    )
    parser.add_argument("--device", default="auto", help="auto, cpu, or cuda")
    parser.add_argument("--box-padding-px", type=int, default=22)
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--artifact-dir", default=str(DEFAULT_ARTIFACT_DIR))
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
