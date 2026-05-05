#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "public" / "virtual-office" / "assets"
LEVEL_PATH = ROOT / "src" / "views" / "officeLevel.json"
OUTPUT_BACKGROUND = ROOT / "public" / "virtual-office" / "scene-background.png"
OUTPUT_FOREGROUND = ROOT / "public" / "virtual-office" / "scene-foreground.png"


def load_level() -> dict:
    with LEVEL_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


LEVEL = load_level()
CANVAS_SIZE = (LEVEL["canvas"]["width"], LEVEL["canvas"]["height"])


def rgba(hex_color: str) -> tuple[int, int, int, int]:
    value = hex_color.lstrip("#")
    if len(value) == 6:
        return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4, 6))


def load_asset(path: str) -> Image.Image:
    return Image.open(ASSET_ROOT / path).convert("RGBA")


def place_sprite(
    dst: Image.Image,
    asset_path: str,
    x: int,
    y: int,
    scale: float,
    *,
    mirror: bool = False,
    split: float | None = None,
    part: str = "full",
    shadow: bool = True,
) -> None:
    image = load_asset(asset_path)
    if mirror:
        image = ImageOps.mirror(image)

    size = (
        max(1, int(image.width * scale)),
        max(1, int(image.height * scale)),
    )
    image = image.resize(size, Image.Resampling.NEAREST)

    if split is not None:
        cutoff = int(image.height * split)
        if part == "back":
            image = image.crop((0, 0, image.width, cutoff))
        elif part == "front":
            image = image.crop((0, cutoff, image.width, image.height))
            y = y - (size[1] - image.height)

    if shadow:
        alpha = image.getchannel("A").point(lambda pixel: 130 if pixel > 0 else 0)
        shadow_image = Image.new("RGBA", image.size, (0, 0, 0, 0))
        shadow_image.putalpha(alpha)
        shadow_image = shadow_image.filter(ImageFilter.GaussianBlur(max(2, int(scale * 1.2))))
        dst.alpha_composite(shadow_image, (int(x - image.width / 2 + 18), int(y - image.height + 26)))

    dst.alpha_composite(image, (int(x - image.width / 2), int(y - image.height)))


def build_background() -> Image.Image:
    width, height = CANVAS_SIZE
    image = Image.new("RGBA", CANVAS_SIZE, rgba("#0b0d12"))
    draw = ImageDraw.Draw(image)

    for y in range(height):
        t = y / height
        color = (int(8 + 10 * t), int(10 + 12 * t), int(16 + 18 * t), 255)
        draw.line((0, y, width, y), fill=color)

    panel_top = 120
    panel_bottom = 560
    for index in range(8):
        x0 = 140 + index * 250
        x1 = x0 + 210
        draw.rounded_rectangle(
            (x0, panel_top, x1, panel_bottom),
            radius=14,
            fill=(14, 18, 26, 235),
            outline=(56, 61, 76, 180),
            width=2,
        )

    screen_boxes = [
        (380, 165, 950, 470),
        (1180, 150, 1835, 468),
        (1885, 175, 2095, 455),
    ]
    for index, box in enumerate(screen_boxes):
        draw.rounded_rectangle(box, radius=18, fill=(13, 16, 24, 255), outline=(85, 80, 67, 120), width=3)
        inset = (box[0] + 16, box[1] + 16, box[2] - 16, box[3] - 16)
        draw.rounded_rectangle(inset, radius=12, fill=(20, 24, 34, 255), outline=(35, 42, 56, 255), width=2)

        for line_y in range(inset[1] + 12, inset[3], 14):
            draw.line((inset[0] + 12, line_y, inset[2] - 12, line_y), fill=(27, 34, 45, 90))

        if index < 2:
            points = (
                [(0.1, 0.45), (0.18, 0.28), (0.28, 0.25), (0.34, 0.36), (0.3, 0.54), (0.2, 0.6)]
                if index == 0
                else [(0.48, 0.35), (0.64, 0.22), (0.79, 0.28), (0.82, 0.43), (0.73, 0.57), (0.57, 0.55)]
            )
            polygon = [
                (
                    inset[0] + (inset[2] - inset[0]) * px,
                    inset[1] + (inset[3] - inset[1]) * py,
                )
                for px, py in points
            ]
            draw.polygon(polygon, fill=(104, 111, 121, 220))

            for dot_x, dot_y in [(0.16, 0.41), (0.24, 0.47), (0.56, 0.39), (0.69, 0.31), (0.74, 0.47)]:
                cx = inset[0] + (inset[2] - inset[0]) * dot_x
                cy = inset[1] + (inset[3] - inset[1]) * dot_y
                draw.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=(216, 177, 93, 220))

        for column_x in (inset[0] + 28, inset[2] - 70):
            for slot in range(8):
                line_y = inset[1] + 24 + slot * 24
                draw.rounded_rectangle(
                    (column_x, line_y, column_x + 46, line_y + 9),
                    radius=4,
                    fill=(76 + 12 * (slot % 2), 96 + 10 * (slot % 3), 120, 180),
                )

    floor_polygon = [(150, 620), (2100, 620), (2180, 1330), (90, 1330)]
    draw.polygon(floor_polygon, fill=(32, 37, 49, 255))

    for step in range(14):
        t = step / 13
        x0 = 150 * (1 - t) + 90 * t
        y0 = 620 * (1 - t) + 1330 * t
        x1 = 2100 * (1 - t) + 2180 * t
        y1 = 620 * (1 - t) + 1330 * t
        draw.line((x0, y0, x1, y1), fill=(84, 92, 110, 70), width=2)

    for step in range(12):
        t = step / 11
        x0 = 150 * (1 - t) + 2100 * t
        y0 = 620
        x1 = 90 * (1 - t) + 2180 * t
        y1 = 1330
        draw.line((x0, y0, x1, y1), fill=(84, 92, 110, 55), width=2)

    for points in (
        ((650, 930), (1200, 930), (1500, 1110), (900, 1110)),
        ((900, 760), (1490, 760), (1710, 905), (1120, 905)),
    ):
        draw.line(points, fill=(184, 143, 64, 120), width=4)

    platform = (1740, 1010, 2055, 1200)
    draw.ellipse(platform, fill=(27, 34, 46, 240), outline=(92, 101, 118, 160), width=5)
    draw.ellipse((1786, 1042, 2010, 1170), outline=(119, 197, 255, 180), width=4)
    for radius, alpha in ((70, 90), (48, 120), (20, 150)):
        draw.ellipse((1898 - radius, 1088 - radius, 1898 + radius, 1088 + radius), outline=(120, 205, 255, alpha), width=3)
    for index in range(6):
        draw.line((1898 - 52, 1088 - index * 8, 1898 + 52, 1088 - index * 8), fill=(120, 205, 255, 50))

    renderable_objects = sorted(
        (scene_object for scene_object in LEVEL["objects"] if scene_object.get("render")),
        key=lambda scene_object: scene_object.get("zLayer", scene_object["anchor"]["y"]),
    )
    for scene_object in renderable_objects:
        render = scene_object["render"]
        split = render.get("split")
        place_sprite(
            image,
            render["assetPath"],
            render["x"],
            render["y"],
            render["scale"],
            mirror=render.get("mirror", False),
            split=split,
            part="back" if split else "full",
        )

    glow = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((820, 710, 1620, 1170), fill=(65, 122, 185, 40))
    glow_draw.ellipse((1680, 930, 2080, 1210), fill=(100, 180, 255, 35))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    image.alpha_composite(glow)

    for rail_x in (150, 2100):
        draw.rounded_rectangle((rail_x - 5, 620, rail_x + 5, 1330), radius=4, fill=(178, 135, 64, 55))

    return image


def build_foreground() -> Image.Image:
    foreground = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    renderable_objects = sorted(
        (scene_object for scene_object in LEVEL["objects"] if scene_object.get("render")),
        key=lambda scene_object: scene_object.get("zLayer", scene_object["anchor"]["y"]),
    )
    for scene_object in renderable_objects:
        render = scene_object["render"]
        split = render.get("split")
        if not split or not scene_object.get("occludesAgents", False):
            continue
        place_sprite(
            foreground,
            render["assetPath"],
            render["x"],
            render["y"],
            render["scale"],
            mirror=render.get("mirror", False),
            split=split,
            part="front",
            shadow=False,
        )
    return foreground


def main() -> None:
    OUTPUT_BACKGROUND.parent.mkdir(parents=True, exist_ok=True)
    build_background().save(OUTPUT_BACKGROUND)
    build_foreground().save(OUTPUT_FOREGROUND)
    print(f"Wrote {OUTPUT_BACKGROUND}")
    print(f"Wrote {OUTPUT_FOREGROUND}")


if __name__ == "__main__":
    main()
