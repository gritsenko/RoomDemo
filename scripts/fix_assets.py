"""
Re-cuts the assets that were damaged by the first pass of slice_assets.py:

1. character/hero_standing.png  - full body incl. both legs and boots
   (the old crop stopped at y=585 and the flood fill ate holes into the body)
2. character/hero_walk_*.png    - walk cycle rebuilt from the fixed sprite
3. environment/room_bg_empty.png- real interior plate instead of a tiled wall
   slice, with the heroine painted out (her legs used to stay on the wall)
4. environment/room_frame_exterior.png - same plate, so the hull no longer
   keeps the heroine's boots baked into its lower band
5. ui/hud_full_bar.png          - baked-in subtitle banner and the baked
   HP / EN bar fills + digits removed so the game can drive them
"""

import json
import os
from collections import deque

from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_PATH = os.path.join(BASE_DIR, "Refs", "photo_2026-09-17_19-20-09.jpg")
ASSETS = os.path.join(BASE_DIR, "assets")

# --- geometry of the heroine inside the reference frame ---------------------
# Clean wall/floor columns immediately left of her, used as per-row background.
DONOR = range(792, 797)
# Alcove band that has to be repainted when she is removed from the plate.
ALCOVE_X0, ALCOVE_X1 = 792, 866
ALCOVE_Y0, ALCOVE_Y1 = 426, 608
# Search box for the cutout itself.
CUT_X0, CUT_X1 = 793, 863
CUT_Y0, CUT_Y1 = 430, 605
# Colour distance (sum of |dR|+|dG|+|dB|) still counted as background.
BG_TOLERANCE = 55


def color_dist(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def row_background(px, y):
    """Median colour of the clean donor columns for one scanline."""
    cols = sorted((px[x, y] for x in DONOR), key=sum)
    return cols[len(cols) // 2]


def extract_hero(ref):
    """Cut the heroine out of the reference with a border flood fill.

    Flooding the background inward from the frame border (instead of testing
    every pixel on its own) keeps dark clothing that happens to resemble the
    wall, because such pixels are never reachable from outside the silhouette.
    """
    px = ref.load()
    w, h = CUT_X1 - CUT_X0 + 1, CUT_Y1 - CUT_Y0 + 1

    bglike = [[False] * w for _ in range(h)]
    for j in range(h):
        y = CUT_Y0 + j
        bg = row_background(px, y)
        for i in range(w):
            bglike[j][i] = color_dist(px[CUT_X0 + i, y], bg) <= BG_TOLERANCE

    reached = [[False] * w for _ in range(h)]
    queue = deque()

    def seed(i, j):
        if bglike[j][i] and not reached[j][i]:
            reached[j][i] = True
            queue.append((i, j))

    for i in range(w):
        seed(i, 0)
        seed(i, h - 1)
    for j in range(h):
        seed(0, j)
        seed(w - 1, j)

    while queue:
        ci, cj = queue.popleft()
        for di, dj in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ni, nj = ci + di, cj + dj
            if 0 <= ni < w and 0 <= nj < h:
                seed(ni, nj)

    # Keep only the largest blob: wall details (a red lamp, a panel seam) sit
    # left of her head and would otherwise travel with the sprite.
    seen = [[False] * w for _ in range(h)]
    components = []
    for j in range(h):
        for i in range(w):
            if reached[j][i] or seen[j][i]:
                continue
            stack = deque([(i, j)])
            seen[j][i] = True
            blob = []
            while stack:
                ci, cj = stack.popleft()
                blob.append((ci, cj))
                for dj in (-1, 0, 1):
                    for di in (-1, 0, 1):
                        ni, nj = ci + di, cj + dj
                        if 0 <= ni < w and 0 <= nj < h and not seen[nj][ni] and not reached[nj][ni]:
                            seen[nj][ni] = True
                            stack.append((ni, nj))
            components.append(blob)
    components.sort(key=len, reverse=True)

    hero = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for (i, j) in components[0]:
        hero.putpixel((i, j), px[CUT_X0 + i, CUT_Y0 + j] + (255,))

    bbox = hero.getbbox()
    hero = hero.crop(bbox)
    origin_x = CUT_X0 + bbox[0]
    origin_y = CUT_Y0 + bbox[1]
    return hero, origin_x, origin_y


def build_clean_plate(ref):
    """Reference frame with the heroine's alcove repainted as bare wall."""
    plate = ref.copy()
    px = plate.load()
    for y in range(ALCOVE_Y0, ALCOVE_Y1 + 1):
        bg = row_background(px, y)
        for x in range(ALCOVE_X0, ALCOVE_X1 + 1):
            px[x, y] = bg
    return plate


def build_walk_frames(hero):
    """Four-frame walk cycle derived from the idle pose.

    The torso and both leg halves share one vertical offset per frame, so the
    body never tears open at the hip line — only the legs slide sideways.
    """
    w, h = hero.size
    leg_cut = int(h * 0.62)
    torso = hero.crop((0, 0, w, leg_cut))
    legs_left = hero.crop((0, leg_cut, w // 2, h))
    legs_right = hero.crop((w // 2, leg_cut, w, h))

    def stride(left_dx, right_dx, body_dy):
        frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        frame.paste(torso, (0, body_dy))
        frame.paste(legs_left, (left_dx, leg_cut + body_dy))
        frame.paste(legs_right, (w // 2 + right_dx, leg_cut + body_dy))
        return frame

    return [
        hero.copy(),            # contact
        stride(-2, 2, 1),       # stride out
        stride(0, 0, -1),       # passing
        stride(2, -2, 1),       # stride back
    ]


# --- HUD bar geometry (local to ui/hud_full_bar.png, which sits at y=820) ----
BANNER = (324, 44, 1596, 110)          # baked subtitle strip
HP_CHANNEL = (404, 212, 640, 218)      # baked red fill
EN_CHANNEL = (404, 236, 640, 242)      # baked orange fill
HP_DIGITS = (284, 206, 336, 246)       # baked "48"
EN_DIGITS = (734, 206, 788, 246)       # baked "96"
HP_DIGITS_BG = (58, 11, 2, 255)
EN_DIGITS_BG = (8, 26, 48, 255)


def clean_hud(hud):
    px = hud.load()

    def clear(rect, color=(0, 0, 0, 0)):
        x0, y0, x1, y1 = rect
        for y in range(y0, y1):
            for x in range(x0, x1):
                px[x, y] = color

    clear(BANNER)
    clear(HP_CHANNEL)
    clear(EN_CHANNEL)
    clear(HP_DIGITS, HP_DIGITS_BG)
    clear(EN_DIGITS, EN_DIGITS_BG)
    return hud


def main():
    ref = Image.open(REF_PATH).convert("RGB")

    print("1. Cutting the heroine out of the reference...")
    hero, hero_x, hero_y = extract_hero(ref)
    hero.save(os.path.join(ASSETS, "character", "hero_standing.png"))
    hw, hh = hero.size
    print(f"   -> hero_standing.png {hw}x{hh} at ({hero_x}, {hero_y}), feet at y={hero_y + hh}")

    print("2. Rebuilding the walk cycle...")
    frames = build_walk_frames(hero)
    for idx, frame in enumerate(frames, 1):
        frame.save(os.path.join(ASSETS, "character", f"hero_walk_{idx}.png"))
    sheet = Image.new("RGBA", (hw * 4, hh), (0, 0, 0, 0))
    for idx, frame in enumerate(frames):
        sheet.paste(frame, (idx * hw, 0))
    sheet.save(os.path.join(ASSETS, "character", "hero_walk_sheet.png"))

    print("3. Repainting the alcove and re-cutting the interior plate...")
    plate = build_clean_plate(ref)

    bg_box = (655, 385, 1195, 606)
    room_bg = plate.crop(bg_box).convert("RGBA")
    room_bg.save(os.path.join(ASSETS, "environment", "room_bg_empty.png"))
    print(f"   -> room_bg_empty.png {room_bg.width}x{room_bg.height}")

    print("4. Re-cutting the hull frame from the same plate...")
    frame_crop = plate.crop((575, 365, 1275, 645))
    hull = Image.new("RGBA", frame_crop.size, (0, 0, 0, 0))
    fpx = frame_crop.load()
    for y in range(frame_crop.height):
        for x in range(frame_crop.width):
            r, g, b = fpx[x, y]
            if r < 12 and g < 12 and b < 12:
                continue
            if 90 <= x <= 605 and 25 <= y <= 220:
                continue  # interior window stays transparent
            hull.putpixel((x, y), (r, g, b, 255))
    hull.save(os.path.join(ASSETS, "environment", "room_frame_exterior.png"))

    print("5. Stripping the baked subtitle and stat readouts off the HUD bar...")
    hud_path = os.path.join(ASSETS, "ui", "hud_full_bar.png")
    clean_hud(Image.open(hud_path).convert("RGBA")).save(hud_path)

    print("6. Updating sprites_metadata.json...")
    meta_path = os.path.join(ASSETS, "sprites_metadata.json")
    with open(meta_path, "r", encoding="utf-8") as fh:
        meta = json.load(fh)

    meta["sprites"]["hero_standing"].update(
        {"width": hw, "height": hh, "x": hero_x, "y": hero_y}
    )
    meta["sprites"]["hero_walk_sheet"].update(
        {"frame_width": hw, "frame_height": hh}
    )
    meta["sprites"]["room_bg_empty"].update(
        {"width": room_bg.width, "height": room_bg.height, "x": bg_box[0], "y": bg_box[1]}
    )
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)

    print("Done.")


if __name__ == "__main__":
    main()
