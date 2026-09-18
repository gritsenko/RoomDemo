"""
Script to slice, segment, and export game sprites from the reference screenshot
for the 2D Cyberpunk Quest prototype.
"""

import os
import json
from collections import deque
from PIL import Image, ImageDraw

def slice_assets():
    base_dir = r"c:\Projects\games\Room"
    ref_path = os.path.join(base_dir, "Refs", "photo_2026-09-17_19-20-09.jpg")
    assets_dir = os.path.join(base_dir, "assets")

    char_dir = os.path.join(assets_dir, "character")
    env_dir = os.path.join(assets_dir, "environment")
    ui_dir = os.path.join(assets_dir, "ui")
    items_dir = os.path.join(assets_dir, "items")

    for d in [char_dir, env_dir, ui_dir, items_dir]:
        os.makedirs(d, exist_ok=True)

    print(f"Loading reference from: {ref_path}")
    ref = Image.open(ref_path).convert("RGBA")
    W, H = ref.size
    metadata = {
        "canvas_size": {"width": W, "height": H},
        "sprites": {}
    }

    # ==========================================
    # 1. CHARACTER (HEROINE)
    # ==========================================
    print("1. Extracting character...")
    char_crop = ref.crop((785, 395, 868, 585))
    cw, ch = char_crop.size

    # Flood-fill background removal
    bg_mask = [[False] * cw for _ in range(ch)]
    queue = deque()
    for x in range(cw):
        queue.append((x, 0))
        queue.append((x, ch - 1))
    for y in range(ch):
        queue.append((0, y))
        queue.append((cw - 1, y))

    def is_bg_pixel(x, y):
        if x < 7 or x > 66:
            return True
        if y < 15 or y >= 186:
            return True
        r, g, b, _ = char_crop.getpixel((x, y))
        # Wall slate-blue
        if 15 <= r <= 38 and 30 <= g <= 58 and 60 <= b <= 95:
            return True
        # Shadow seam
        if r < 18 and 18 <= g <= 38 and 38 <= b <= 68:
            return True
        # Rail at bottom near boots
        if y >= 165 and (40 <= r <= 65 and 55 <= g <= 85 and 85 <= b <= 120):
            return True
        return False

    visited = set()
    while queue:
        cx, cy = queue.popleft()
        if (cx, cy) in visited:
            continue
        visited.add((cx, cy))
        if 0 <= cx < cw and 0 <= cy < ch:
            if is_bg_pixel(cx, cy):
                bg_mask[cy][cx] = True
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < cw and 0 <= ny < ch and (nx, ny) not in visited:
                        queue.append((nx, ny))

    char_segmented = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    for y in range(ch):
        for x in range(cw):
            if not bg_mask[y][x]:
                char_segmented.putpixel((x, y), char_crop.getpixel((x, y)))

    # Trim edges: door edge < 7, fridge edge > 72, ceiling < 18, floor > 185
    hero_trimmed = char_segmented.crop((7, 18, 72, 185))
    tw, th = hero_trimmed.size

    # Connected components to isolate body + hair bun + boots
    visited_comp = [[False] * tw for _ in range(th)]
    components = []
    for y in range(th):
        for x in range(tw):
            if hero_trimmed.getpixel((x, y))[3] > 50 and not visited_comp[y][x]:
                comp = []
                q = deque([(x, y)])
                visited_comp[y][x] = True
                while q:
                    px, py = q.popleft()
                    comp.append((px, py))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = px + dx, py + dy
                            if 0 <= nx < tw and 0 <= ny < th and not visited_comp[ny][nx]:
                                if hero_trimmed.getpixel((nx, ny))[3] > 50:
                                    visited_comp[ny][nx] = True
                                    q.append((nx, ny))
                components.append(comp)

    components.sort(key=lambda c: len(c), reverse=True)
    # Comp 0: main body & left leg
    hero_pixels = set(components[0])
    for c in components[1:]:
        min_y = min(p[1] for p in c)
        max_y = max(p[1] for p in c)
        min_x = min(p[0] for p in c)
        max_x = max(p[0] for p in c)
        # Hair bun & head locks (top area)
        if max_y <= 65 and min_x >= 10 and max_x <= 50 and len(c) >= 5:
            hero_pixels |= set(c)
        # Right boot & calves & feet details (lower area)
        if min_y >= 135 and min_x >= 20 and max_x <= 64:
            hero_pixels |= set(c)

    hero_standing = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    for (x, y) in hero_pixels:
        hero_standing.putpixel((x, y), hero_trimmed.getpixel((x, y)))

    hero_bbox = hero_standing.getbbox()
    hero_standing = hero_standing.crop(hero_bbox)
    hero_standing_path = os.path.join(char_dir, "hero_standing.png")
    hero_standing.save(hero_standing_path)

    hw, hh = hero_standing.size
    # Hero position in original frame: x≈800, y≈412 (footline touches floor at 580)
    hero_x, hero_y = 800, 412
    metadata["sprites"]["hero_standing"] = {
        "file": "character/hero_standing.png",
        "width": hw, "height": hh,
        "x": hero_x, "y": hero_y,
        "layer": 30,
        "description": "Female protagonist standing idle (full sprite with complete boots)"
    }
    print(f"-> Saved {hero_standing_path} ({hw}x{hh})")

    # ==========================================
    # 2. CHARACTER WALK CYCLE (4 FRAMES & SHEET)
    # ==========================================
    print("2. Generating character walk cycle frames...")
    # Walk frame 1: Idle stance (hero_standing)
    f1 = hero_standing.copy()

    # Walk frame 2: Left leg forward, right leg back (stride 1)
    leg_cut = int(hh * 0.65)
    legs_left = hero_standing.crop((0, leg_cut, hw // 2, hh))
    legs_right = hero_standing.crop((hw // 2, leg_cut, hw, hh))
    f2 = Image.new("RGBA", (hw, hh), (0, 0, 0, 0))
    f2.paste(hero_standing.crop((0, 0, hw, leg_cut)), (0, 2))
    f2.paste(legs_left, (-1, leg_cut + 1))
    f2.paste(legs_right, (1, leg_cut + 2))

    # Walk frame 3: Passing position
    f3_up = Image.new("RGBA", (hw, hh), (0, 0, 0, 0))
    f3_up.paste(hero_standing, (0, -1))
    f3 = f3_up

    # Walk frame 4: Right leg forward, left leg back (stride 2)
    f4 = Image.new("RGBA", (hw, hh), (0, 0, 0, 0))
    f4.paste(hero_standing.crop((0, 0, hw, leg_cut)), (0, 2))
    f4.paste(legs_left, (2, leg_cut + 2))
    f4.paste(legs_right, (-2, leg_cut + 1))

    frames = [f1, f2, f3, f4]
    for idx, f in enumerate(frames, 1):
        f_path = os.path.join(char_dir, f"hero_walk_{idx}.png")
        f.save(f_path)

    # Spritesheet
    sheet = Image.new("RGBA", (hw * 4, hh), (0, 0, 0, 0))
    for idx, f in enumerate(frames):
        sheet.paste(f, (idx * hw, 0))
    sheet_path = os.path.join(char_dir, "hero_walk_sheet.png")
    sheet.save(sheet_path)

    metadata["sprites"]["hero_walk_sheet"] = {
        "file": "character/hero_walk_sheet.png",
        "frame_width": hw, "frame_height": hh,
        "frames_count": 4,
        "fps": 6,
        "description": "Walking cycle animation spritesheet"
    }
    print(f"-> Saved walk frames and spritesheet ({sheet.size[0]}x{sheet.size[1]})")

    # ==========================================
    # 3. CHARACTER PORTRAIT (HUD)
    # ==========================================
    print("3. Extracting character portrait...")
    port_crop = ref.crop((0, 820, 240, 1080))
    port_clean = Image.new("RGBA", port_crop.size, (0, 0, 0, 0))
    for y in range(port_crop.height):
        for x in range(port_crop.width):
            r, g, b, _ = port_crop.getpixel((x, y))
            if r > 10 or g > 10 or b > 10:
                port_clean.putpixel((x, y), (r, g, b, 255))
    port_bbox = port_clean.getbbox()
    port_clean = port_clean.crop(port_bbox)
    port_path = os.path.join(char_dir, "hero_portrait.png")
    port_clean.save(port_path)

    metadata["sprites"]["hero_portrait"] = {
        "file": "character/hero_portrait.png",
        "width": port_clean.width, "height": port_clean.height,
        "x": 0, "y": 820 + port_bbox[1],
        "layer": 100,
        "description": "High-detail pixel-art portrait of heroine for dialogue/HUD"
    }
    print(f"-> Saved portrait ({port_clean.size[0]}x{port_clean.size[1]})")

    # ==========================================
    # 4. ENVIRONMENT: ROOM EXTERIOR FRAME & PIPES
    # ==========================================
    print("4. Extracting room exterior frame and pipes...")
    frame_crop = ref.crop((575, 365, 1275, 645))
    frame_clean = Image.new("RGBA", frame_crop.size, (0, 0, 0, 0))
    # Inner window cutout relative to 575, 365:
    # Inner room is x: 665 to 1180 -> rx: 90 to 605, y: 390 to 585 -> ry: 25 to 220
    for y in range(frame_crop.height):
        for x in range(frame_crop.width):
            r, g, b, _ = frame_crop.getpixel((x, y))
            if r < 12 and g < 12 and b < 12:
                continue
            if 90 <= x <= 605 and 25 <= y <= 220:
                continue  # Transparent window cutout
            frame_clean.putpixel((x, y), (r, g, b, 255))

    frame_path = os.path.join(env_dir, "room_frame_exterior.png")
    frame_clean.save(frame_path)

    metadata["sprites"]["room_frame_exterior"] = {
        "file": "environment/room_frame_exterior.png",
        "width": frame_clean.width, "height": frame_clean.height,
        "x": 575, "y": 365,
        "layer": 50,
        "description": "Outer metal capsule hull with rust textures and inner window cutout"
    }

    pipes_crop = ref.crop((820, 640, 1230, 705))
    pipes_clean = Image.new("RGBA", pipes_crop.size, (0, 0, 0, 0))
    for y in range(pipes_crop.height):
        for x in range(pipes_crop.width):
            r, g, b, _ = pipes_crop.getpixel((x, y))
            if r > 12 or g > 12 or b > 12:
                pipes_clean.putpixel((x, y), (r, g, b, 255))

    pipes_bbox = pipes_clean.getbbox()
    pipes_clean = pipes_clean.crop(pipes_bbox)
    pipes_path = os.path.join(env_dir, "room_pipes.png")
    pipes_clean.save(pipes_path)

    metadata["sprites"]["room_pipes"] = {
        "file": "environment/room_pipes.png",
        "width": pipes_clean.width, "height": pipes_clean.height,
        "x": 820 + pipes_bbox[0], "y": 640 + pipes_bbox[1],
        "layer": 45,
        "description": "Industrial pipes under the capsule module"
    }
    print(f"-> Saved frame ({frame_clean.size}) and pipes ({pipes_clean.size})")

    # ==========================================
    # 5. ENVIRONMENT: CLEAN ROOM INTERIOR BACKGROUND
    # ==========================================
    print("5. Synthesizing clean empty room interior background...")
    interior_w, interior_h = 540, 210
    room_bg = Image.new("RGBA", (interior_w, interior_h), (0, 0, 0, 255))
    
    wall_slice = ref.crop((774, 385, 786, 595))
    for x in range(0, interior_w, wall_slice.width):
        room_bg.paste(wall_slice, (x, 0))

    ceiling_trim = ref.crop((655, 385, 1195, 410))
    room_bg.paste(ceiling_trim, (0, 0))

    floor_trim = ref.crop((655, 565, 1195, 595))
    room_bg.paste(floor_trim, (0, 180))

    bg_path = os.path.join(env_dir, "room_bg_empty.png")
    room_bg.save(bg_path)

    metadata["sprites"]["room_bg_empty"] = {
        "file": "environment/room_bg_empty.png",
        "width": interior_w, "height": interior_h,
        "x": 655, "y": 385,
        "layer": 10,
        "description": "Clean interior background (wall panels, ceiling trim, floor) with no furniture/character"
    }
    print(f"-> Saved clean room background ({interior_w}x{interior_h})")

    # ==========================================
    # 6. ENVIRONMENT: OBJECTS & PROPS
    # ==========================================
    print("6. Extracting room props (Door, Cryo-fridge, Bed, Shelves)...")

    # Door 07: (670, 395, 782, 582)
    door_crop = ref.crop((670, 395, 782, 582))
    door_clean = Image.new("RGBA", door_crop.size, (0, 0, 0, 0))
    for y in range(door_crop.height):
        for x in range(door_crop.width):
            door_clean.putpixel((x, y), door_crop.getpixel((x, y)))
    door_path = os.path.join(env_dir, "door_07.png")
    door_clean.save(door_path)

    metadata["sprites"]["door_07"] = {
        "file": "environment/door_07.png",
        "width": door_clean.width, "height": door_clean.height,
        "x": 670, "y": 395,
        "layer": 20,
        "interactive": True,
        "name": "Гермодверь Отсека 07",
        "description": "Sliding door with yellow status display and 07 designation"
    }

    # Door 07 open state
    door_open = door_clean.copy()
    d_draw = ImageDraw.Draw(door_open)
    d_draw.rectangle([25, 20, 95, door_open.height - 10], fill=(12, 14, 20, 255))
    door_open_path = os.path.join(env_dir, "door_07_open.png")
    door_open.save(door_open_path)
    metadata["sprites"]["door_07_open"] = {
        "file": "environment/door_07_open.png",
        "width": door_open.width, "height": door_open.height,
        "x": 670, "y": 395,
        "layer": 20,
        "description": "Open sliding door showing corridor"
    }

    # Cryo / Refrigerator: (868, 395, 975, 582)
    fridge_crop = ref.crop((868, 395, 975, 582))
    fridge_clean = Image.new("RGBA", fridge_crop.size, (0, 0, 0, 0))
    for y in range(fridge_crop.height):
        for x in range(fridge_crop.width):
            fridge_clean.putpixel((x, y), fridge_crop.getpixel((x, y)))
    fridge_path = os.path.join(env_dir, "cryo_fridge.png")
    fridge_clean.save(fridge_path)

    metadata["sprites"]["cryo_fridge"] = {
        "file": "environment/cryo_fridge.png",
        "width": fridge_clean.width, "height": fridge_clean.height,
        "x": 868, "y": 395,
        "layer": 22,
        "interactive": True,
        "name": "Крио-модуль / Холодильник",
        "description": "Central vertical storage capsule/refrigerator unit"
    }

    # Cryo fridge open state
    fridge_open = fridge_clean.copy()
    f_draw = ImageDraw.Draw(fridge_open)
    f_draw.rectangle([15, 45, 92, fridge_open.height - 25], fill=(22, 45, 68, 255))
    for sy in [80, 115, 145]:
        f_draw.line([(15, sy), (92, sy)], fill=(50, 110, 160, 255), width=3)
    f_draw.rectangle([30, 60, 48, 78], fill=(60, 180, 140, 255))
    f_draw.rectangle([60, 95, 78, 113], fill=(220, 100, 70, 255))
    fridge_open_path = os.path.join(env_dir, "cryo_fridge_open.png")
    fridge_open.save(fridge_open_path)
    metadata["sprites"]["cryo_fridge_open"] = {
        "file": "environment/cryo_fridge_open.png",
        "width": fridge_open.width, "height": fridge_open.height,
        "x": 868, "y": 395,
        "layer": 22,
        "description": "Open cryo-fridge with illuminated interior shelves and items"
    }

    # Bed module: (975, 460, 1175, 582)
    bed_crop = ref.crop((975, 460, 1175, 582))
    bed_path = os.path.join(env_dir, "bed_module.png")
    bed_crop.save(bed_path)

    metadata["sprites"]["bed_module"] = {
        "file": "environment/bed_module.png",
        "width": bed_crop.width, "height": bed_crop.height,
        "x": 975, "y": 460,
        "layer": 24,
        "interactive": True,
        "name": "Жилой спальный блок",
        "description": "Bunk bed with mattress and red quilt"
    }

    # Upper shelves: (975, 395, 1175, 460)
    shelves_crop = ref.crop((975, 395, 1175, 460))
    shelves_path = os.path.join(env_dir, "shelves_upper.png")
    shelves_crop.save(shelves_path)

    metadata["sprites"]["shelves_upper"] = {
        "file": "environment/shelves_upper.png",
        "width": shelves_crop.width, "height": shelves_crop.height,
        "x": 975, "y": 395,
        "layer": 21,
        "interactive": True,
        "name": "Настенные антресоли",
        "description": "Upper storage compartments above bed"
    }
    print("-> Saved room props (doors, fridge, bed, shelves)")

    # ==========================================
    # 7. UI / HUD ELEMENTS
    # ==========================================
    print("7. Extracting UI / HUD elements...")

    # Stat bars: (230, 880, 855, 1010)
    bars_crop = ref.crop((230, 880, 855, 1010))
    b_clean = Image.new("RGBA", bars_crop.size, (0, 0, 0, 0))
    for y in range(bars_crop.height):
        for x in range(bars_crop.width):
            r, g, b, _ = bars_crop.getpixel((x, y))
            if r > 12 or g > 12 or b > 12:
                b_clean.putpixel((x, y), (r, g, b, 255))
    b_bbox = b_clean.getbbox()
    b_clean = b_clean.crop(b_bbox)
    bars_path = os.path.join(ui_dir, "stat_bars.png")
    b_clean.save(bars_path)

    metadata["sprites"]["stat_bars"] = {
        "file": "ui/stat_bars.png",
        "width": b_clean.width, "height": b_clean.height,
        "x": 230 + b_bbox[0], "y": 880 + b_bbox[1],
        "layer": 100,
        "description": "Status bars: Health (48, red), Energy (98, cyan), Battery (96)"
    }

    # Action D-Pad: (860, 855, 1040, 1005)
    dpad_crop = ref.crop((860, 855, 1040, 1005))
    dp_clean = Image.new("RGBA", dpad_crop.size, (0, 0, 0, 0))
    for y in range(dpad_crop.height):
        for x in range(dpad_crop.width):
            r, g, b, _ = dpad_crop.getpixel((x, y))
            if r > 12 or g > 12 or b > 12:
                dp_clean.putpixel((x, y), (r, g, b, 255))
    dp_bbox = dp_clean.getbbox()
    dp_clean = dp_clean.crop(dp_bbox)
    dpad_path = os.path.join(ui_dir, "dpad_actions.png")
    dp_clean.save(dpad_path)

    metadata["sprites"]["dpad_actions"] = {
        "file": "ui/dpad_actions.png",
        "width": dp_clean.width, "height": dp_clean.height,
        "x": 860 + dp_bbox[0], "y": 855 + dp_bbox[1],
        "layer": 100,
        "description": "Circular action d-pad selector (Inspect, Use, Talk, Move)"
    }

    # Inventory slots: (1220, 875, 1550, 995)
    slots_crop = ref.crop((1220, 875, 1550, 995))
    s_clean = Image.new("RGBA", slots_crop.size, (0, 0, 0, 0))
    for y in range(slots_crop.height):
        for x in range(slots_crop.width):
            r, g, b, _ = slots_crop.getpixel((x, y))
            if r > 12 or g > 12 or b > 12:
                s_clean.putpixel((x, y), (r, g, b, 255))
    s_bbox = s_clean.getbbox()
    s_clean = s_clean.crop(s_bbox)
    slots_path = os.path.join(ui_dir, "inventory_slots.png")
    s_clean.save(slots_path)

    metadata["sprites"]["inventory_slots"] = {
        "file": "ui/inventory_slots.png",
        "width": s_clean.width, "height": s_clean.height,
        "x": 1220 + s_bbox[0], "y": 875 + s_bbox[1],
        "layer": 100,
        "description": "Three quick-access inventory item slots"
    }

    # Backpack icon: (1670, 825, 1920, 1080)
    bag_crop = ref.crop((1670, 825, 1920, 1080))
    bg_clean = Image.new("RGBA", bag_crop.size, (0, 0, 0, 0))
    for y in range(bag_crop.height):
        for x in range(bag_crop.width):
            r, g, b, _ = bag_crop.getpixel((x, y))
            if r > 12 or g > 12 or b > 12:
                bg_clean.putpixel((x, y), (r, g, b, 255))
    bg_bbox = bg_clean.getbbox()
    bg_clean = bg_clean.crop(bg_bbox)
    bag_path = os.path.join(ui_dir, "backpack_icon.png")
    bg_clean.save(bag_path)

    metadata["sprites"]["backpack_icon"] = {
        "file": "ui/backpack_icon.png",
        "width": bg_clean.width, "height": bg_clean.height,
        "x": 1670 + bg_bbox[0], "y": 825 + bg_bbox[1],
        "layer": 100,
        "description": "Right corner inventory backpack button"
    }

    # Full HUD base bar: (0, 820, 1920, 1080)
    hud_crop = ref.crop((0, 820, 1920, 1080))
    hud_clean = Image.new("RGBA", hud_crop.size, (0, 0, 0, 0))
    for y in range(hud_crop.height):
        for x in range(hud_crop.width):
            r, g, b, _ = hud_crop.getpixel((x, y))
            if r > 10 or g > 10 or b > 10:
                hud_clean.putpixel((x, y), (r, g, b, 255))
    hud_path = os.path.join(ui_dir, "hud_full_bar.png")
    hud_clean.save(hud_path)

    metadata["sprites"]["hud_full_bar"] = {
        "file": "ui/hud_full_bar.png",
        "width": 1920, "height": hud_clean.height,
        "x": 0, "y": 820,
        "layer": 90,
        "description": "Complete HUD bar background combining all lower UI modules"
    }

    # Dialogue box with original Russian text
    diag_crop = ref.crop((320, 795, 1600, 865))
    d_clean = Image.new("RGBA", diag_crop.size, (0, 0, 0, 0))
    for y in range(diag_crop.height):
        for x in range(diag_crop.width):
            r, g, b, _ = diag_crop.getpixel((x, y))
            if r > 15 or g > 15 or b > 15:
                d_clean.putpixel((x, y), (r, g, b, 255))
    d_bbox = d_clean.getbbox()
    d_clean = d_clean.crop(d_bbox)
    diag_sample_path = os.path.join(ui_dir, "dialogue_box_sample.png")
    d_clean.save(diag_sample_path)

    metadata["sprites"]["dialogue_box_sample"] = {
        "file": "ui/dialogue_box_sample.png",
        "width": d_clean.width, "height": d_clean.height,
        "x": 320 + d_bbox[0], "y": 795 + d_bbox[1],
        "layer": 110,
        "text": "Место где день начинается, и... заканчивается",
        "description": "Dialogue banner with original reference subtitle text"
    }

    # Dialogue box empty banner (for dynamic text)
    dw, dh = d_clean.width + 40, d_clean.height + 16
    diag_empty = Image.new("RGBA", (dw, dh), (0, 0, 0, 0))
    draw_de = ImageDraw.Draw(diag_empty)
    draw_de.rectangle([2, 2, dw - 3, dh - 3], fill=(16, 20, 26, 210), outline=(42, 68, 88, 255), width=2)
    draw_de.line([(0, 6), (6, 0)], fill=(80, 140, 180, 255), width=2)
    draw_de.line([(dw - 7, 0), (dw - 1, 6)], fill=(80, 140, 180, 255), width=2)
    diag_empty_path = os.path.join(ui_dir, "dialogue_box_empty.png")
    diag_empty.save(diag_empty_path)

    metadata["sprites"]["dialogue_box_empty"] = {
        "file": "ui/dialogue_box_empty.png",
        "width": dw, "height": dh,
        "x": 300, "y": 790,
        "layer": 105,
        "description": "Empty stylized translucent dialogue box ready for custom game text"
    }
    print("-> Saved UI elements (stat bars, d-pad, slots, backpack, dialogue)")

    # ==========================================
    # 8. INVENTORY ITEMS (PIXEL ART)
    # ==========================================
    print("8. Creating matching pixel-art items for inventory...")
    # Item 1: Keycard
    item_card = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    dc = ImageDraw.Draw(item_card)
    dc.rectangle([14, 18, 50, 46], fill=(26, 40, 56, 255), outline=(60, 130, 180, 255), width=2)
    dc.rectangle([18, 22, 32, 34], fill=(220, 160, 40, 255))
    dc.line([(36, 26), (46, 26)], fill=(120, 180, 220, 255), width=2)
    dc.line([(36, 32), (46, 32)], fill=(120, 180, 220, 255), width=2)
    dc.line([(36, 38), (46, 38)], fill=(120, 180, 220, 255), width=2)
    item_card_path = os.path.join(items_dir, "item_keycard.png")
    item_card.save(item_card_path)

    # Item 2: Energy Cell / Battery
    item_cell = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    dc = ImageDraw.Draw(item_cell)
    dc.rectangle([20, 16, 44, 48], fill=(30, 48, 60, 255), outline=(50, 180, 220, 255), width=2)
    dc.rectangle([26, 10, 38, 16], fill=(180, 190, 200, 255))
    dc.rectangle([24, 26, 40, 44], fill=(40, 210, 240, 255))
    dc.polygon([(34, 28), (28, 36), (33, 36), (30, 42), (38, 34), (33, 34)], fill=(255, 255, 200, 255))
    item_cell_path = os.path.join(items_dir, "item_energy_cell.png")
    item_cell.save(item_cell_path)

    # Item 3: Stimpack / Medkit
    item_med = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    dc = ImageDraw.Draw(item_med)
    dc.rectangle([16, 16, 48, 48], fill=(50, 22, 22, 255), outline=(200, 60, 60, 255), width=2)
    dc.rectangle([28, 22, 36, 42], fill=(220, 50, 50, 255))
    dc.rectangle([22, 28, 42, 36], fill=(220, 50, 50, 255))
    item_med_path = os.path.join(items_dir, "item_stimpack.png")
    item_med.save(item_med_path)

    metadata["items"] = {
        "item_keycard": {"file": "items/item_keycard.png", "name": "Электронный ключ Отсека 07"},
        "item_energy_cell": {"file": "items/item_energy_cell.png", "name": "Энергетический элемент питания"},
        "item_stimpack": {"file": "items/item_stimpack.png", "name": "Стимулятор жизнеобеспечения"}
    }
    print("-> Saved inventory items (keycard, energy cell, stimpack)")

    # Save metadata JSON
    meta_path = os.path.join(assets_dir, "sprites_metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(f"\nMetadata written to: {meta_path}")
    print("All sprites extracted and exported successfully!")

if __name__ == "__main__":
    slice_assets()
