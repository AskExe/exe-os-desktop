#!/usr/bin/env python3
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def parse_target(spec: str) -> tuple[Path, tuple[int, int]]:
    try:
        path_part, size_part = spec.split(":", 1)
        width_str, height_str = size_part.lower().split("x", 1)
        return Path(path_part), (int(width_str), int(height_str))
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"Invalid target '{spec}'. Use /path/to/output.png:WIDTHxHEIGHT",
        ) from exc


def is_chroma(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    return a > 0 and g >= 150 and g >= r + 90 and g >= b + 90


def detect_components(img: Image.Image, min_size: int) -> list[tuple[int, int, int, int]]:
    rgba = img.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    mask = [[False] * width for _ in range(height)]
    visited = [[False] * width for _ in range(height)]

    for y in range(height):
        for x in range(width):
            pixel = pixels[x, y]
            if pixel[3] == 0:
                continue
            if not is_chroma(pixel):
                mask[y][x] = True

    boxes: list[tuple[int, int, int, int]] = []
    for y in range(height):
        for x in range(width):
            if not mask[y][x] or visited[y][x]:
                continue
            queue = deque([(x, y)])
            visited[y][x] = True
            min_x = max_x = x
            min_y = max_y = y
            while queue:
                cur_x, cur_y = queue.popleft()
                for next_x, next_y in (
                    (cur_x + 1, cur_y),
                    (cur_x - 1, cur_y),
                    (cur_x, cur_y + 1),
                    (cur_x, cur_y - 1),
                ):
                    if (
                        0 <= next_x < width
                        and 0 <= next_y < height
                        and mask[next_y][next_x]
                        and not visited[next_y][next_x]
                    ):
                        visited[next_y][next_x] = True
                        queue.append((next_x, next_y))
                        min_x = min(min_x, next_x)
                        max_x = max(max_x, next_x)
                        min_y = min(min_y, next_y)
                        max_y = max(max_y, next_y)

            if (max_x - min_x + 1) >= min_size and (max_y - min_y + 1) >= min_size:
                boxes.append((min_x, min_y, max_x + 1, max_y + 1))

    return sorted(boxes, key=lambda box: (box[1], box[0]))


def strip_chroma(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            pixel = pixels[x, y]
            if is_chroma(pixel):
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def crop_to_square(img: Image.Image, box: tuple[int, int, int, int], padding: int) -> Image.Image:
    crop = img.crop(box)
    side = max(crop.width, crop.height) + padding * 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    offset_x = (side - crop.width) // 2
    offset_y = (side - crop.height) // 2
    canvas.paste(crop, (offset_x, offset_y))
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract isolated sprites from an Image 2.0 chroma-key sheet.",
    )
    parser.add_argument("--source", required=True, help="Source PNG/WebP with #00ff00 chroma.")
    parser.add_argument(
        "--target",
        action="append",
        type=parse_target,
        required=True,
        help="Output mapping in the form /path/to/file.png:WIDTHxHEIGHT",
    )
    parser.add_argument(
        "--padding",
        type=int,
        default=0,
        help="Extra transparent padding around each cropped sprite before resize.",
    )
    parser.add_argument(
        "--min-size",
        type=int,
        default=40,
        help="Minimum connected-component width/height to keep.",
    )
    parser.add_argument(
        "--resample",
        choices=("nearest", "lanczos"),
        default="nearest",
        help="Resize filter to use when normalizing extracted sprites.",
    )
    args = parser.parse_args()

    source = Path(args.source)
    img = strip_chroma(Image.open(source))
    boxes = detect_components(img, args.min_size)
    resample = (
        Image.Resampling.NEAREST
        if args.resample == "nearest"
        else Image.Resampling.LANCZOS
    )

    if len(boxes) < len(args.target):
        raise SystemExit(
            f"Only found {len(boxes)} sprite components in {source}, but {len(args.target)} targets were requested.",
        )

    for (output_path, size), box in zip(args.target, boxes):
        sprite = crop_to_square(img, box, args.padding)
        resized = sprite.resize(size, resample)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        resized.save(output_path)
        print(f"wrote {output_path} from box {box} -> {size[0]}x{size[1]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
