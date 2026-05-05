#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

# Fallback authoring utility for Meta's original Segment Anything repo.
# The primary office segmentation path is scripts/segment_office_with_sam3.py;
# keep this only for local CPU/MPS experiments when SAM3 checkpoint access is unavailable.


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = ROOT / "public"
LEVEL_PATH = ROOT / "src" / "views" / "officeLevel.json"
DEFAULT_OUTPUT_DIR = PUBLIC_ROOT / "virtual-office" / "occluders"
DEFAULT_ARTIFACT_DIR = ROOT / ".codex-artifacts" / "office-sam"
DEFAULT_CHECKPOINT = ROOT / ".codex-artifacts" / "sam" / "sam_vit_b_01ec64.pth"


def load_level() -> dict[str, Any]:
    with LEVEL_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def public_asset_path(public_url: str) -> Path:
    return PUBLIC_ROOT / public_url.removeprefix("/")


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
    epsilon = max(2.0, perimeter * 0.006)
    simplified = cv2.approxPolyDP(contour, epsilon, True)
    points = [(int(point[0][0]), int(point[0][1])) for point in simplified]
    return normalize_polygon(points, width, height)


def choose_device(device: str) -> str:
    if device != "auto":
        return device

    import torch

    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def dependency_error() -> str:
    return (
        "Missing SAM dependencies. Install them into a local venv, then rerun this script:\n"
        "  python3 -m venv .codex-artifacts/sam-venv\n"
        "  . .codex-artifacts/sam-venv/bin/activate\n"
        "  python -m pip install --upgrade pip\n"
        "  python -m pip install torch torchvision numpy opencv-python-headless 'git+https://github.com/facebookresearch/segment-anything.git'\n"
        "Download the lightweight ViT-B checkpoint:\n"
        "  mkdir -p .codex-artifacts/sam\n"
        "  curl -L -o .codex-artifacts/sam/sam_vit_b_01ec64.pth https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"
    )


def run(args: argparse.Namespace) -> None:
    try:
        import numpy as np
        import torch
        from segment_anything import SamPredictor, sam_model_registry
    except Exception as exc:
        raise SystemExit(f"{dependency_error()}\n\nImport error: {exc}") from exc

    checkpoint = Path(args.checkpoint)
    if not checkpoint.exists():
        raise SystemExit(f"Missing checkpoint: {checkpoint}\n\n{dependency_error()}")

    level = load_level()
    width = int(level["canvas"]["width"])
    height = int(level["canvas"]["height"])
    source_url = level["assets"].get("sourceBackground", level["assets"]["background"])
    source = Image.open(public_asset_path(source_url)).convert("RGBA")
    if source.size != (width, height):
        source = source.resize((width, height), Image.Resampling.LANCZOS)

    output_dir = Path(args.output_dir)
    artifact_dir = Path(args.artifact_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_dir.mkdir(parents=True, exist_ok=True)

    device = choose_device(args.device)
    sam = sam_model_registry[args.model_type](checkpoint=str(checkpoint))
    sam.to(device=device)
    predictor = SamPredictor(sam)
    predictor.set_image(np.array(source.convert("RGB")))

    preview = source.copy()
    preview_overlay = Image.new("RGBA", source.size, (0, 0, 0, 0))
    preview_draw = ImageDraw.Draw(preview_overlay)
    suggestions: list[dict[str, Any]] = []

    for index, obj in enumerate(level["objects"]):
        if not obj.get("occludesAgents"):
            continue

        points = pixel_points(object_prompt_points(obj), width, height)
        box = prompt_box(points, width, height, args.box_padding_px)
        masks, scores, _ = predictor.predict(
            box=np.array(box),
            multimask_output=True,
        )
        best_index = int(np.argmax(scores))
        mask = masks[best_index]

        box_mask = np.zeros(mask.shape, dtype=bool)
        box_mask[box[1]:box[3] + 1, box[0]:box[2] + 1] = True
        mask = np.logical_and(mask, box_mask)

        alpha = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
        occluder = Image.new("RGBA", source.size, (0, 0, 0, 0))
        occluder.alpha_composite(source)
        occluder.putalpha(alpha)
        occluder_path = output_dir / f"{obj['id']}.png"
        occluder.save(occluder_path, optimize=True, compress_level=9)

        color = (
            80 + (index * 47) % 150,
            100 + (index * 71) % 130,
            130 + (index * 37) % 110,
            84,
        )
        preview_draw.bitmap((0, 0), alpha, fill=color)
        polygon = mask_to_polygon(mask, width, height)
        suggestions.append({
            "id": obj["id"],
            "score": round(float(scores[best_index]), 5),
            "maskAreaPx": int(mask.sum()),
            "promptBoxPx": box,
            "suggestedVisualPolygon": polygon,
            "occluderAsset": f"/virtual-office/occluders/{obj['id']}.png",
        })
        print(f"Wrote {occluder_path} score={scores[best_index]:.4f} area={int(mask.sum())}")

    preview.alpha_composite(preview_overlay)
    preview_path = artifact_dir / "office-sam-preview.png"
    suggestions_path = artifact_dir / "office-sam-suggestions.json"
    preview.save(preview_path)
    with suggestions_path.open("w", encoding="utf-8") as handle:
        json.dump({
            "source": source_url,
            "modelType": args.model_type,
            "checkpoint": str(checkpoint),
            "suggestions": suggestions,
        }, handle, indent=2)

    print(f"Wrote {preview_path}")
    print(f"Wrote {suggestions_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Use Segment Anything to generate detailed per-object occluder masks for the virtual office.",
    )
    parser.add_argument("--checkpoint", default=str(DEFAULT_CHECKPOINT))
    parser.add_argument("--model-type", default="vit_b", choices=["vit_b", "vit_l", "vit_h"])
    parser.add_argument("--device", default="auto", help="auto, cpu, cuda, or mps")
    parser.add_argument("--box-padding-px", type=int, default=18)
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--artifact-dir", default=str(DEFAULT_ARTIFACT_DIR))
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
