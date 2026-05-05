#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
import random
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = ROOT / "public"
LEVEL_PATH = ROOT / "src" / "views" / "officeLevel.json"
OUTPUT_BACKGROUND = ROOT / "public" / "virtual-office" / "scene-background.png"
OUTPUT_FOREGROUND = ROOT / "public" / "virtual-office" / "scene-foreground.png"
OUTPUT_OCCLUDERS = ROOT / "public" / "virtual-office" / "occluders"
WRITE_OCCLUDERS = os.environ.get("OFFICE_WRITE_OCCLUDERS") == "1"

AA = 2
SCREEN_GOLD = (226, 172, 64, 255)
BLUE = (93, 182, 255, 255)
CYAN = (120, 225, 255, 255)
PANEL = (12, 16, 24, 255)
PANEL_2 = (18, 23, 33, 255)
INK = (5, 8, 13, 255)
METAL = (27, 32, 42, 255)
METAL_LIGHT = (52, 60, 76, 255)
LINE = (108, 125, 148, 165)
GOLD_LINE = (198, 147, 48, 210)


def load_level() -> dict:
    with LEVEL_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


LEVEL = load_level()
BASE_W = int(LEVEL["canvas"]["width"])
BASE_H = int(LEVEL["canvas"]["height"])
CANVAS_SIZE = (BASE_W * AA, BASE_H * AA)


def s(value: float) -> int:
    return int(round(value * AA))


def pt(point: dict[str, float]) -> tuple[int, int]:
    return (s((point["x"] / 100) * BASE_W), s((point["y"] / 100) * BASE_H))


def pct(x: float, y: float) -> tuple[int, int]:
    return (s((x / 100) * BASE_W), s((y / 100) * BASE_H))


def rect_pct(x0: float, y0: float, x1: float, y1: float) -> tuple[int, int, int, int]:
    return (*pct(x0, y0), *pct(x1, y1))


def rgba(color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = color.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if mono:
        candidates.extend([
            "/System/Library/Fonts/Menlo.ttc",
            "/Library/Fonts/Menlo.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        ])
    if bold:
        candidates.extend([
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ])
    candidates.extend([
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ])
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, s(size))
        except OSError:
            continue
    return ImageFont.load_default()


def new_layer(fill: tuple[int, int, int, int] = (0, 0, 0, 0)) -> Image.Image:
    return Image.new("RGBA", CANVAS_SIZE, fill)


def finish(image: Image.Image) -> Image.Image:
    return image.resize((BASE_W, BASE_H), Image.Resampling.LANCZOS)


def public_asset_path(public_url: str) -> Path:
    return PUBLIC_ROOT / public_url.removeprefix("/")


def poly(points: Sequence[dict[str, float]]) -> list[tuple[int, int]]:
    return [pt(point) for point in points]


def bounds(points: Sequence[tuple[int, int]]) -> tuple[int, int, int, int]:
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return (min(xs), min(ys), max(xs), max(ys))


def offset(points: Sequence[tuple[int, int]], dx: float, dy: float) -> list[tuple[int, int]]:
    return [(x + s(dx), y + s(dy)) for x, y in points]


def draw_glow(
    dst: Image.Image,
    shape: str,
    box: tuple[int, int, int, int],
    color: tuple[int, int, int, int],
    blur: int,
) -> None:
    layer = new_layer()
    draw = ImageDraw.Draw(layer)
    if shape == "ellipse":
        draw.ellipse(box, fill=color)
    else:
        draw.rounded_rectangle(box, radius=s(16), fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(s(blur)))
    dst.alpha_composite(layer)


def draw_line_glow(
    dst: Image.Image,
    points: Sequence[tuple[int, int]],
    color: tuple[int, int, int, int],
    width: int,
    blur: int = 4,
) -> None:
    glow = new_layer()
    draw = ImageDraw.Draw(glow)
    draw.line(points, fill=color, width=s(width), joint="curve")
    glow = glow.filter(ImageFilter.GaussianBlur(s(blur)))
    dst.alpha_composite(glow)
    ImageDraw.Draw(dst).line(points, fill=color, width=s(max(1, width // 2)), joint="curve")


def draw_beveled_poly(
    dst: Image.Image,
    points: Sequence[tuple[int, int]],
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int] = LINE,
    shadow: bool = True,
) -> None:
    draw = ImageDraw.Draw(dst)
    if shadow:
        shadow_layer = new_layer()
        shadow_draw = ImageDraw.Draw(shadow_layer)
        shadow_draw.polygon(offset(points, 16, 22), fill=(0, 0, 0, 115))
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(s(12)))
        dst.alpha_composite(shadow_layer)
    draw.polygon(points, fill=fill)
    draw.line([*points, points[0]], fill=outline, width=s(2), joint="curve")
    inner = [
        (int(x * 0.988 + sum(px for px, _ in points) / len(points) * 0.012),
         int(y * 0.988 + sum(py for _, py in points) / len(points) * 0.012))
        for x, y in points
    ]
    draw.line([*inner, inner[0]], fill=(255, 255, 255, 22), width=s(1), joint="curve")


def draw_world_map(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], seed: int) -> None:
    rng = random.Random(seed)
    x0, y0, x1, y1 = box
    w = x1 - x0
    h = y1 - y0
    regions = [
        (0.20, 0.36, 0.13, 0.16),
        (0.32, 0.45, 0.08, 0.22),
        (0.49, 0.34, 0.12, 0.13),
        (0.54, 0.49, 0.10, 0.17),
        (0.68, 0.37, 0.18, 0.18),
        (0.78, 0.55, 0.08, 0.11),
    ]
    for cx, cy, rw, rh in regions:
        for _ in range(260):
            angle = rng.random() * math.tau
            radius = math.sqrt(rng.random())
            px = x0 + (cx + math.cos(angle) * rw * radius) * w
            py = y0 + (cy + math.sin(angle) * rh * radius) * h
            if rng.random() < 0.08:
                color = (245, 194, 76, 220)
                dot = s(1.35)
            else:
                color = (146, 151, 150, 165)
                dot = s(0.95)
            draw.ellipse((px - dot, py - dot, px + dot, py + dot), fill=color)
    for _ in range(60):
        px = rng.randint(x0 + s(20), x1 - s(20))
        py = rng.randint(y0 + s(18), y1 - s(18))
        draw.ellipse((px - s(1.6), py - s(1.6), px + s(1.6), py + s(1.6)), fill=(230, 176, 58, 185))


def draw_screen(
    dst: Image.Image,
    box: tuple[int, int, int, int],
    title: str,
    seed: int,
    map_screen: bool = True,
) -> None:
    draw = ImageDraw.Draw(dst)
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=s(14), fill=(9, 13, 20, 246), outline=(93, 91, 72, 170), width=s(2))
    inset = (x0 + s(16), y0 + s(16), x1 - s(16), y1 - s(16))
    draw.rounded_rectangle(inset, radius=s(10), fill=(12, 17, 26, 255), outline=(48, 63, 82, 210), width=s(2))
    draw.text((inset[0] + s(18), inset[1] + s(12)), title.upper(), font=font(10, bold=True), fill=(226, 190, 84, 220))
    for yy in range(inset[1] + s(38), inset[3] - s(8), s(22)):
        draw.line((inset[0] + s(12), yy, inset[2] - s(12), yy), fill=(53, 67, 83, 76), width=s(1))
    if map_screen:
        draw_world_map(draw, (inset[0] + s(84), inset[1] + s(50), inset[2] - s(86), inset[3] - s(35)), seed)
    rng = random.Random(seed + 31)
    for side_x in (inset[0] + s(18), inset[2] - s(92)):
        for row in range(9):
            yy = inset[1] + s(50 + row * 24)
            color = (73, 98, 119, 200) if row % 3 else (219, 164, 56, 220)
            draw.rounded_rectangle((side_x, yy, side_x + s(rng.randint(38, 72)), yy + s(5)), radius=s(2), fill=color)
            draw.rounded_rectangle((side_x, yy + s(10), side_x + s(rng.randint(24, 58)), yy + s(13)), radius=s(2), fill=(130, 148, 163, 130))


def draw_wall_system(dst: Image.Image) -> None:
    draw = ImageDraw.Draw(dst)
    wall = new_layer()
    wall_draw = ImageDraw.Draw(wall)
    for y in range(CANVAS_SIZE[1]):
        t = y / CANVAS_SIZE[1]
        color = (int(5 + 12 * t), int(8 + 14 * t), int(13 + 18 * t), 255)
        wall_draw.line((0, y, CANVAS_SIZE[0], y), fill=color)
    dst.alpha_composite(wall)

    for x in range(s(120), s(BASE_W - 70), s(210)):
        draw.rounded_rectangle((x, s(88), x + s(176), s(560)), radius=s(8), fill=(11, 16, 24, 235), outline=(65, 75, 91, 110), width=s(2))
        draw.rectangle((x + s(8), s(98), x + s(168), s(112)), fill=(32, 39, 51, 160))
        for row in range(5):
            yy = s(145 + row * 72)
            draw.rounded_rectangle((x + s(18), yy, x + s(152), yy + s(42)), radius=s(4), fill=(14, 20, 30, 240), outline=(47, 57, 70, 120), width=s(1))
            for line in range(4):
                draw.rectangle((x + s(28), yy + s(8 + line * 8), x + s(80 + 16 * ((row + line) % 3)), yy + s(10 + line * 8)), fill=(200, 150, 50, 125))

    draw_screen(dst, (s(360), s(150), s(980), s(505)), "global operations", 12, True)
    draw_screen(dst, (s(1210), s(130), s(1880), s(490)), "strategic theatre", 44, True)
    draw_screen(dst, (s(1918), s(170), s(2148), s(462)), "live telemetry", 88, False)

    for x in (s(980), s(1038), s(1888)):
        draw.rectangle((x, s(0), x + s(8), s(620)), fill=(4, 7, 12, 255))
        draw.rectangle((x + s(10), s(0), x + s(22), s(620)), fill=(29, 36, 47, 190))
    draw.line((s(0), s(590), s(BASE_W), s(590)), fill=(77, 92, 113, 170), width=s(3))
    draw.line((s(0), s(616), s(BASE_W), s(616)), fill=(190, 139, 44, 120), width=s(2))


def draw_floor(dst: Image.Image) -> None:
    draw = ImageDraw.Draw(dst)
    floor_points = poly(LEVEL["walkableZones"][0]["points"])
    mask = Image.new("L", CANVAS_SIZE, 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.polygon(floor_points, fill=255)

    floor = new_layer()
    floor_draw = ImageDraw.Draw(floor)
    floor_draw.polygon(floor_points, fill=(27, 33, 44, 255))
    for y in range(s(615), s(1345), s(68)):
        floor_draw.line((s(40), y, s(2220), y), fill=(96, 112, 134, 95), width=s(2))
    for x in range(s(95), s(2160), s(170)):
        floor_draw.line((x, s(612), x - s(72), s(1360)), fill=(96, 112, 134, 86), width=s(2))
    for x in range(s(370), s(2110), s(210)):
        floor_draw.line((x, s(620), x + s(245), s(1332)), fill=(42, 53, 70, 72), width=s(1))
    floor.putalpha(mask)
    dst.alpha_composite(floor)

    for path in (
        [pct(12, 63), pct(31, 63), pct(45, 70), pct(71, 70), pct(86, 62), pct(93, 62)],
        [pct(21, 77), pct(47, 77), pct(57, 68), pct(70, 68)],
        [pct(15, 50), pct(33, 50), pct(45, 60), pct(63, 60), pct(77, 48)],
    ):
        draw_line_glow(dst, path, (219, 159, 44, 160), 4, 3)
    for path in (
        [pct(28, 50), pct(54, 50), pct(64, 56), pct(78, 56)],
        [pct(37, 88), pct(51, 88), pct(63, 82), pct(78, 82)],
    ):
        draw_line_glow(dst, path, (154, 207, 255, 115), 3, 3)


def draw_planter(dst: Image.Image, obj: dict, foreground: bool = False) -> None:
    points = poly(obj["footprint"])
    x0, y0, x1, y1 = bounds(points)
    if foreground:
        draw_beveled_poly(dst, points, (11, 16, 21, 245), (88, 102, 96, 160), shadow=False)
        return
    draw_beveled_poly(dst, points, (15, 20, 24, 255), (83, 91, 84, 170), shadow=True)
    draw = ImageDraw.Draw(dst)
    rng = random.Random(obj["id"])
    for _ in range(26):
        cx = rng.randint(x0 + s(8), max(x0 + s(9), x1 - s(8)))
        cy = rng.randint(y0 + s(4), max(y0 + s(5), y1 - s(8)))
        length = rng.randint(s(18), s(44))
        angle = rng.uniform(-1.35, -0.2)
        end = (cx + int(math.cos(angle) * length), cy + int(math.sin(angle) * length))
        color = (62, rng.randint(112, 158), 80, 220)
        draw.line((cx, cy, *end), fill=color, width=s(3))
        draw.ellipse((end[0] - s(4), end[1] - s(3), end[0] + s(4), end[1] + s(3)), fill=color)
    for _ in range(9):
        cx = rng.randint(x0 + s(10), max(x0 + s(11), x1 - s(10)))
        cy = rng.randint(y0 + s(6), max(y0 + s(7), y1 - s(8)))
        draw_glow(dst, "ellipse", (cx - s(5), cy - s(5), cx + s(5), cy + s(5)), (236, 194, 92, 130), 9)
        draw.ellipse((cx - s(2), cy - s(2), cx + s(2), cy + s(2)), fill=(250, 219, 126, 230))


def draw_console(dst: Image.Image, obj: dict, foreground: bool = False) -> None:
    points = poly(obj["occlusionFootprint"] if foreground and obj.get("occlusionFootprint") else obj["footprint"])
    x0, y0, x1, y1 = bounds(points)
    draw = ImageDraw.Draw(dst)
    if foreground:
        face = points
        draw_beveled_poly(dst, face, (11, 14, 20, 248), (91, 95, 95, 145), shadow=False)
        draw.line((x0 + s(8), y0 + s(8), x1 - s(8), y0 + s(8)), fill=(222, 168, 54, 95), width=s(2))
        return

    draw_beveled_poly(dst, points, (19, 23, 30, 255), (97, 104, 111, 150), shadow=True)
    top = [
        (x0 + s(14), y0 + s(13)),
        (x1 - s(15), y0 + s(10)),
        (x1 - s(22), y1 - s(30)),
        (x0 + s(22), y1 - s(24)),
    ]
    draw.polygon(top, fill=(25, 31, 40, 255))
    draw.line([*top, top[0]], fill=(123, 134, 145, 95), width=s(2))
    width = max(1, x1 - x0)
    monitor_count = max(2, min(7, width // s(90)))
    for index in range(monitor_count):
        mx = x0 + s(25) + int((width - s(70)) * (index + 0.4) / monitor_count)
        my = y0 + s(18 + (index % 2) * 5)
        draw.rounded_rectangle((mx, my, mx + s(42), my + s(33)), radius=s(3), fill=(8, 12, 18, 255), outline=(85, 103, 124, 170), width=s(1))
        draw.rectangle((mx + s(5), my + s(5), mx + s(37), my + s(25)), fill=(11, 22, 33, 255))
        for line in range(3):
            color = SCREEN_GOLD if (index + line) % 3 == 0 else BLUE
            draw.rectangle((mx + s(8), my + s(8 + line * 6), mx + s(18 + 9 * ((line + index) % 3)), my + s(10 + line * 6)), fill=color)
        draw.line((mx + s(21), my + s(33), mx + s(21), my + s(45)), fill=(92, 97, 106, 160), width=s(2))
    for index in range(5):
        cx = x0 + s(30) + int((width - s(90)) * index / max(1, 4))
        cy = y1 - s(28)
        draw.rounded_rectangle((cx, cy, cx + s(54), cy + s(12)), radius=s(3), fill=(31, 38, 48, 255), outline=(89, 100, 111, 120), width=s(1))
        draw.rectangle((cx + s(6), cy + s(4), cx + s(30), cy + s(6)), fill=(218, 166, 52, 150))
    draw.line((x0 + s(14), y1 - s(18), x1 - s(14), y1 - s(18)), fill=(228, 171, 50, 90), width=s(2))


def draw_table(dst: Image.Image, obj: dict, foreground: bool = False) -> None:
    points = poly(obj["occlusionFootprint"] if foreground and obj.get("occlusionFootprint") else obj["footprint"])
    x0, y0, x1, y1 = bounds(points)
    draw = ImageDraw.Draw(dst)
    if foreground:
        draw_beveled_poly(dst, points, (12, 15, 20, 250), (87, 96, 106, 150), shadow=False)
        draw.line((x0 + s(18), y0 + s(12), x1 - s(18), y0 + s(12)), fill=(111, 190, 255, 100), width=s(2))
        return
    draw_beveled_poly(dst, points, (17, 21, 28, 255), (110, 119, 130, 160), shadow=True)
    top = [
        (x0 + s(22), y0 + s(18)),
        (x1 - s(26), y0 + s(16)),
        (x1 - s(38), y1 - s(42)),
        (x0 + s(34), y1 - s(34)),
    ]
    draw.polygon(top, fill=(27, 34, 44, 255))
    draw.line([*top, top[0]], fill=(129, 147, 165, 120), width=s(2))
    display = (
        x0 + int((x1 - x0) * 0.26),
        y0 + int((y1 - y0) * 0.30),
        x0 + int((x1 - x0) * 0.77),
        y0 + int((y1 - y0) * 0.62),
    )
    draw.rounded_rectangle(display, radius=s(6), fill=(8, 22, 34, 230), outline=(66, 161, 230, 150), width=s(2))
    for row in range(7):
        yy = display[1] + s(12 + row * 11)
        draw.line((display[0] + s(18), yy, display[2] - s(18), yy), fill=(88, 194, 255, 62), width=s(1))
    for _ in range(24):
        rx = random.randint(display[0] + s(18), display[2] - s(18))
        ry = random.randint(display[1] + s(12), display[3] - s(12))
        draw.rectangle((rx, ry, rx + s(random.randint(5, 18)), ry + s(2)), fill=(217, 171, 65, 120))
    draw_glow(dst, "rounded", display, (67, 161, 255, 36), 18)


def draw_server(dst: Image.Image, obj: dict, foreground: bool = False) -> None:
    points = poly(obj["footprint"])
    x0, y0, x1, y1 = bounds(points)
    draw = ImageDraw.Draw(dst)
    if foreground:
        draw.rounded_rectangle((x0, y0, x1, y1), radius=s(5), fill=(6, 9, 14, 225), outline=(80, 95, 111, 110), width=s(1))
        return
    draw.rounded_rectangle((x0, y0, x1, y1), radius=s(6), fill=(12, 16, 23, 255), outline=(82, 93, 108, 150), width=s(2))
    draw.rectangle((x0 + s(8), y0 + s(12), x1 - s(8), y0 + s(32)), fill=(33, 40, 50, 190))
    for row in range(7):
        yy = y0 + s(50 + row * 20)
        if yy > y1 - s(18):
            break
        draw.rectangle((x0 + s(12), yy, x1 - s(12), yy + s(10)), fill=(10, 21, 30, 250))
        draw.rectangle((x0 + s(18), yy + s(3), x0 + s(34), yy + s(6)), fill=(48, 150, 212, 160))
        draw.rectangle((x1 - s(38), yy + s(3), x1 - s(18), yy + s(6)), fill=(228, 174, 62, 165))


def draw_chair(dst: Image.Image, obj: dict, foreground: bool = False) -> None:
    points = poly(obj["footprint"])
    x0, y0, x1, y1 = bounds(points)
    draw = ImageDraw.Draw(dst)
    if foreground:
        draw.rounded_rectangle((x0, y0, x1, y1), radius=s(5), fill=(8, 10, 15, 210), outline=(86, 90, 95, 90), width=s(1))
        return
    draw.rounded_rectangle((x0, y0, x1, y1), radius=s(6), fill=(19, 22, 28, 245), outline=(91, 93, 94, 120), width=s(1))
    draw.rounded_rectangle((x0 + s(5), y0 + s(6), x1 - s(5), y0 + s(18)), radius=s(4), fill=(35, 39, 48, 255))
    draw.line((x0 + s(8), y1 - s(4), x0 - s(4), y1 + s(10)), fill=(181, 135, 45, 130), width=s(2))
    draw.line((x1 - s(8), y1 - s(4), x1 + s(4), y1 + s(10)), fill=(181, 135, 45, 130), width=s(2))


def draw_terminal(dst: Image.Image, obj: dict) -> None:
    points = poly(obj["footprint"])
    x0, y0, x1, y1 = bounds(points)
    draw = ImageDraw.Draw(dst)
    draw.rounded_rectangle((x0, y0, x1, y1), radius=s(3), fill=(8, 13, 19, 245), outline=(75, 94, 112, 130), width=s(1))
    draw.rectangle((x0 + s(4), y0 + s(5), x1 - s(4), y0 + s(18)), fill=(8, 25, 38, 255))
    draw.rectangle((x0 + s(7), y0 + s(9), x1 - s(12), y0 + s(11)), fill=BLUE)
    draw.rectangle((x0 + s(7), y0 + s(14), x0 + s(18), y0 + s(16)), fill=SCREEN_GOLD)


def draw_holo(dst: Image.Image, foreground: bool = False) -> None:
    draw = ImageDraw.Draw(dst)
    base = rect_pct(76.5, 68.8, 91.0, 83.5)
    if foreground:
        draw.arc(base, start=0, end=180, fill=(137, 211, 255, 180), width=s(4))
        return
    draw_glow(dst, "ellipse", rect_pct(74.5, 64.5, 93.5, 86.5), (80, 177, 255, 45), 30)
    draw.ellipse(base, fill=(24, 32, 45, 230), outline=(116, 137, 158, 190), width=s(4))
    for inset, alpha in ((1.2, 185), (3.4, 160), (5.8, 125)):
        draw.ellipse(rect_pct(76.5 + inset, 68.8 + inset, 91.0 - inset, 83.5 - inset), outline=(121, 205, 255, alpha), width=s(3))
    cx0, cy0 = pct(83.8, 67.8)
    cx1, cy1 = pct(83.8, 50.3)
    draw.line((cx0, cy0, cx1, cy1), fill=(135, 219, 255, 130), width=s(3))
    draw.ellipse((cx1 - s(72), cy1 - s(18), cx1 + s(72), cy1 + s(18)), outline=(128, 219, 255, 130), width=s(3))
    draw.ellipse((cx1 - s(74), cy0 - s(18), cx1 + s(74), cy0 + s(18)), outline=(128, 219, 255, 90), width=s(3))
    for index in range(10):
        y = cy1 + int((cy0 - cy1) * index / 10)
        draw.ellipse((cx1 - s(74), y - s(18), cx1 + s(74), y + s(18)), outline=(128, 219, 255, 38), width=s(1))


def draw_object(dst: Image.Image, obj: dict, foreground: bool = False) -> None:
    source = obj.get("sourceAssetId") or ""
    oid = obj["id"]
    if oid == "holo-platform":
        draw_holo(dst, foreground)
    elif "PLANT" in source:
        draw_planter(dst, obj, foreground)
    elif "SERVER_STACK" in source:
        draw_server(dst, obj, foreground)
    elif "BRIEFING_TABLE" in source:
        draw_table(dst, obj, foreground)
    elif "OPS_CONSOLE" in source:
        draw_console(dst, obj, foreground)
    elif "WOODEN_CHAIR" in source or "BENCH" in source:
        draw_chair(dst, obj, foreground)
    elif "ANALYST_TERMINAL" in source:
        if not foreground:
            draw_terminal(dst, obj)
    elif "BIN" in source:
        draw_server(dst, obj, foreground)


def draw_atmosphere(dst: Image.Image) -> None:
    vignette = new_layer()
    draw = ImageDraw.Draw(vignette)
    draw.rectangle((0, 0, CANVAS_SIZE[0], CANVAS_SIZE[1]), fill=(0, 0, 0, 80))
    for box, color, blur in [
        (rect_pct(39, 37, 77, 78), (85, 126, 190, 64), 65),
        (rect_pct(13, 30, 48, 62), (219, 164, 60, 32), 52),
        (rect_pct(71, 54, 96, 90), (92, 183, 255, 48), 45),
    ]:
        draw.ellipse(box, fill=color)
    vignette = vignette.filter(ImageFilter.GaussianBlur(s(42)))
    dst.alpha_composite(vignette)
    grain = new_layer()
    pixels = grain.load()
    rng = random.Random(806)
    for _ in range(12000):
        x = rng.randrange(0, CANVAS_SIZE[0])
        y = rng.randrange(0, CANVAS_SIZE[1])
        value = rng.randrange(18, 54)
        pixels[x, y] = (255, 255, 255, value)
    dst.alpha_composite(grain)


def build_plate_background() -> Image.Image:
    source_url = LEVEL["assets"].get("sourceBackground", LEVEL["assets"]["background"])
    source = Image.open(public_asset_path(source_url)).convert("RGBA")
    if source.size != (BASE_W, BASE_H):
        source = source.resize((BASE_W, BASE_H), Image.Resampling.LANCZOS)
    return source


def build_plate_foreground() -> Image.Image:
    source = build_plate_background()
    foreground = Image.new("RGBA", (BASE_W, BASE_H), (0, 0, 0, 0))
    mask = Image.new("L", (BASE_W, BASE_H), 0)
    mask_draw = ImageDraw.Draw(mask)
    if WRITE_OCCLUDERS:
        OUTPUT_OCCLUDERS.mkdir(parents=True, exist_ok=True)
    for obj in LEVEL["objects"]:
        if not obj.get("occludesAgents"):
            continue
        points = [
            (
                int(round((point["x"] / 100) * BASE_W)),
                int(round((point["y"] / 100) * BASE_H)),
            )
            for point in obj.get("occlusionFootprint", obj["footprint"])
        ]
        mask_draw.polygon(points, fill=255)
        if WRITE_OCCLUDERS:
            object_mask = Image.new("L", (BASE_W, BASE_H), 0)
            object_mask_draw = ImageDraw.Draw(object_mask)
            object_mask_draw.polygon(points, fill=255)
            occluder = Image.new("RGBA", (BASE_W, BASE_H), (0, 0, 0, 0))
            occluder.alpha_composite(source)
            occluder.putalpha(object_mask)
            occluder.save(OUTPUT_OCCLUDERS / f"{obj['id']}.png", optimize=True, compress_level=9)
    foreground.alpha_composite(source)
    foreground.putalpha(mask)
    return foreground


def build_vector_background() -> Image.Image:
    image = new_layer((5, 8, 13, 255))
    draw_wall_system(image)
    draw_floor(image)
    for obj in sorted(LEVEL["objects"], key=lambda item: item.get("zLayer", item["anchor"]["y"])):
        draw_object(image, obj, foreground=False)
    draw_atmosphere(image)
    return finish(image)


def build_vector_foreground() -> Image.Image:
    foreground = new_layer()
    for obj in sorted(LEVEL["objects"], key=lambda item: item.get("zLayer", item["anchor"]["y"])):
        if not obj.get("occludesAgents"):
            continue
        draw_object(foreground, obj, foreground=True)
    return finish(foreground)


def build_background() -> Image.Image:
    if LEVEL.get("renderMode") == "hd-plate":
        return build_plate_background()
    return build_vector_background()


def build_foreground() -> Image.Image:
    if LEVEL.get("renderMode") == "hd-plate":
        return build_plate_foreground()
    return build_vector_foreground()


def main() -> None:
    OUTPUT_BACKGROUND.parent.mkdir(parents=True, exist_ok=True)
    build_background().save(OUTPUT_BACKGROUND)
    build_foreground().save(OUTPUT_FOREGROUND)
    print(f"Wrote {OUTPUT_BACKGROUND}")
    print(f"Wrote {OUTPUT_FOREGROUND}")
    if WRITE_OCCLUDERS and OUTPUT_OCCLUDERS.exists():
        print(f"Wrote occluders to {OUTPUT_OCCLUDERS}")


if __name__ == "__main__":
    main()
