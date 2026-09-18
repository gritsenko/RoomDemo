import { Texture, Assets, Graphics, IRenderer } from 'pixi.js';

export interface GameAssets {
  // Character
  heroStanding: Texture;
  heroWalk: Texture[];
  heroPortrait: Texture;

  // Environment
  roomBg: Texture;
  roomPipes: Texture;
  door: Texture;
  doorOpen: Texture;
  cryoFridge: Texture;
  cryoFridgeOpen: Texture;
  bed: Texture;
  shelves: Texture;
  roomFrame: Texture;

  // UI
  hudFullBar: Texture;
  statBars: Texture;
  dpadActions: Texture;
  inventorySlots: Texture;
  backpackIcon: Texture;
  dialogueBox: Texture;

  // Items
  itemKeycard: Texture;
  itemEnergyCell: Texture;
  itemStimpack: Texture;
}

/**
 * Single-file build inlines every public asset as a data: URI and publishes the
 * map on window.__INLINE_ASSETS__. Otherwise the path is resolved against the
 * build base, so the game also works when served from a subdirectory
 * (e.g. gritsenko.biz/RoomDemo/).
 */
function resolveAssetUrl(assetPath: string): string {
  const inlined = (globalThis as Record<string, any>).__INLINE_ASSETS__ as
    | Record<string, string>
    | undefined;
  if (inlined?.[assetPath]) return inlined[assetPath];

  const base = import.meta.env.BASE_URL ?? '/';
  return base.replace(/\/$/, '') + assetPath;
}

export class AssetLoader {
  private static createFallbackTexture(
    renderer: IRenderer,
    width: number,
    height: number,
    color: number,
    border: number = 0x2cdbf0
  ): Texture {
    const g = new Graphics();
    g.beginFill(color);
    g.lineStyle(2, border);
    g.drawRect(0, 0, width, height);
    g.endFill();
    return renderer.generateTexture(g);
  }

  public static async loadAll(renderer: IRenderer): Promise<GameAssets> {
    const tryLoad = async (path: string, fallbackW: number, fallbackH: number, color: number): Promise<Texture> => {
      try {
        const tex = await Assets.load<Texture>(resolveAssetUrl(path));
        return tex;
      } catch (err) {
        console.warn(`Asset failed to load: ${path}, using procedural fallback.`, err);
        return this.createFallbackTexture(renderer, fallbackW, fallbackH, color);
      }
    };

    // Parallel asset loading
    const [
      heroStanding,
      heroWalk1,
      heroWalk2,
      heroWalk3,
      heroWalk4,
      heroPortrait,
      roomBg,
      roomPipes,
      door,
      doorOpen,
      cryoFridge,
      cryoFridgeOpen,
      bed,
      shelves,
      roomFrame,
      hudFullBar,
      statBars,
      dpadActions,
      inventorySlots,
      backpackIcon,
      dialogueBox,
      itemKeycard,
      itemEnergyCell,
      itemStimpack
    ] = await Promise.all([
      tryLoad('/character/hero_standing.png', 60, 167, 0x3a5f78),
      tryLoad('/character/hero_walk_1.png', 60, 167, 0x3a5f78),
      tryLoad('/character/hero_walk_2.png', 60, 167, 0x3a5f78),
      tryLoad('/character/hero_walk_3.png', 60, 167, 0x3a5f78),
      tryLoad('/character/hero_walk_4.png', 60, 167, 0x3a5f78),
      tryLoad('/character/hero_portrait.png', 240, 196, 0x1d3345),

      tryLoad('/environment/room_bg_empty.png', 540, 210, 0x162432),
      tryLoad('/environment/room_pipes.png', 402, 55, 0x223647),
      tryLoad('/environment/door_07.png', 112, 187, 0x354b5f),
      tryLoad('/environment/door_07_open.png', 112, 187, 0x111c26),
      tryLoad('/environment/cryo_fridge.png', 107, 187, 0x2e4456),
      tryLoad('/environment/cryo_fridge_open.png', 107, 187, 0x39657f),
      tryLoad('/environment/bed_module.png', 200, 122, 0x482329),
      tryLoad('/environment/shelves_upper.png', 200, 65, 0x1f2e3d),
      tryLoad('/environment/room_frame_exterior.png', 700, 280, 0x442f2b),

      tryLoad('/ui/hud_full_bar.png', 1920, 260, 0x101a24),
      tryLoad('/ui/stat_bars.png', 625, 130, 0x182633),
      tryLoad('/ui/dpad_actions.png', 180, 141, 0x24394a),
      tryLoad('/ui/inventory_slots.png', 330, 120, 0x1b2c3a),
      tryLoad('/ui/backpack_icon.png', 250, 181, 0x2a3e50),
      tryLoad('/ui/dialogue_box_empty.png', 1200, 70, 0x0c151e),

      tryLoad('/items/item_keycard.png', 48, 48, 0x2cdbf0),
      tryLoad('/items/item_energy_cell.png', 48, 48, 0x48cae4),
      tryLoad('/items/item_stimpack.png', 48, 48, 0xe63946)
    ]);

    return {
      heroStanding,
      heroWalk: [heroWalk1, heroWalk2, heroWalk3, heroWalk4],
      heroPortrait,
      roomBg,
      roomPipes,
      door,
      doorOpen,
      cryoFridge,
      cryoFridgeOpen,
      bed,
      shelves,
      roomFrame,
      hudFullBar,
      statBars,
      dpadActions,
      inventorySlots,
      backpackIcon,
      dialogueBox,
      itemKeycard,
      itemEnergyCell,
      itemStimpack
    };
  }
}
