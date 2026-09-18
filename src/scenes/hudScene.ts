import { Container, Sprite, Graphics, Text, TextStyle } from 'pixi.js';
import { GameAssets } from '../atlas/assetLoader';
import { GameStateManager } from '../state/gameState';
import { ActionType, CardItem } from '../types/game';
import { Sound } from '../core/audio';
import { centerTextInBox } from '../ui/textLayout';

/**
 * ui/hud_full_bar.png already contains every HUD module (portrait, stat frame,
 * d-pad, quick slots, backpack), so the bar is drawn once and everything below
 * is positioned against pixel coordinates measured inside that artwork rather
 * than re-drawing the modules as separate, slightly offset sprites.
 */
const HUD_TOP = 820;

// Stat bars: both channels share the same horizontal run inside the frame.
const BAR_X = 404;
const BAR_W = 236;
const HP_BAR_Y = HUD_TOP + 212;
const EN_BAR_Y = HUD_TOP + 236;
const BAR_H = 6;

// Numeric readouts sit in the two etched boxes flanking the bars.
const HP_READOUT = { x: 284, y: HUD_TOP + 206, w: 52, h: 40 };
const EN_READOUT = { x: 734, y: HUD_TOP + 206, w: 54, h: 40 };

// Quick inventory: three 108px slots, 114px apart.
const SLOT_X = 1236;
const SLOT_STEP = 114;
const SLOT_Y = HUD_TOP + 140;
const SLOT_SIZE = 108;
const SLOT_ICON = 60;

// D-pad buttons, clockwise from the top.
const DPAD_RADIUS = 27;
const DPAD_BUTTONS: Array<{ action: ActionType; x: number; y: number; label: string }> = [
  { action: 'inspect', x: 957, y: HUD_TOP + 135, label: 'ОСМОТР' },
  { action: 'use', x: 1010, y: HUD_TOP + 180, label: 'ИСПОЛЬЗ.' },
  { action: 'disassemble', x: 957, y: HUD_TOP + 229, label: 'РАЗОБРАТЬ' },
  { action: 'hack', x: 904, y: HUD_TOP + 180, label: 'ВЗЛОМ' }
];

// Hit zones over modules that are only present as baked artwork.
const PORTRAIT_HIT = { x: 6, y: HUD_TOP + 64, w: 232, h: 196 };
const BACKPACK_HIT = { x: 1714, y: HUD_TOP + 92, w: 196, h: 168 };

// Subtitle panel floats in the empty band between the capsule and the HUD.
const SUB_W = 1280;
const SUB_X = Math.round((1920 - SUB_W) / 2);
const SUB_BOTTOM = 900;
const SUB_PAD_X = 28;
const SUB_PAD_Y = 18;
const SUB_LINE_H = 36;
const SUB_MIN_H = SUB_PAD_Y * 2 + SUB_LINE_H;

export class HudScene extends Container {
  private assets: GameAssets;
  private stateManager: GameStateManager;

  private hudBackground: Sprite;

  // Dynamic overlays
  private hpFillGraphics: Graphics;
  private hpText: Text;
  private energyFillGraphics: Graphics;
  private energyText: Text;

  // D-Pad action indicators
  private dpadHighlights: Map<ActionType, Graphics> = new Map();

  // Inventory slots
  private slotIcons: Sprite[] = [];
  private slotHighlightGraphics: Graphics;

  // Subtitle / dialogue box
  private dialogueContainer: Container;
  private dialogueBg: Graphics;
  private dialogueText: Text;
  private typewriterTimer: number = 0;
  private fullTargetText: string = '';
  private currentDisplayedText: string = '';
  private typewriterIndex: number = 0;

  constructor(assets: GameAssets, stateManager: GameStateManager) {
    super();
    this.assets = assets;
    this.stateManager = stateManager;

    // 1. The complete HUD artwork
    this.hudBackground = new Sprite(this.assets.hudFullBar);
    this.hudBackground.position.set(0, HUD_TOP);
    this.addChild(this.hudBackground);

    // 2. Stat bar fills and readouts
    this.hpFillGraphics = new Graphics();
    this.addChild(this.hpFillGraphics);

    this.energyFillGraphics = new Graphics();
    this.addChild(this.energyFillGraphics);

    this.hpText = new Text('48', new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 26,
      fill: '#ff3b2f',
      letterSpacing: 1
    }));
    this.addChild(this.hpText);

    this.energyText = new Text('96', new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 26,
      fill: '#f5843c',
      letterSpacing: 1
    }));
    this.addChild(this.energyText);

    // 3. Interactive zones layered over the baked artwork
    this.setupPortraitZone();
    this.setupDpadZones();

    this.slotHighlightGraphics = new Graphics();
    this.addChild(this.slotHighlightGraphics);
    this.setupInventorySlots();

    this.setupBackpackZone();

    // 4. Subtitle panel (added last so it stays above the bar)
    this.dialogueContainer = new Container();
    this.dialogueBg = new Graphics();
    this.dialogueContainer.addChild(this.dialogueBg);

    this.dialogueText = new Text('', new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 26,
      fill: '#ffeedd',
      letterSpacing: 1.0,
      lineHeight: SUB_LINE_H,
      wordWrap: true,
      wordWrapWidth: SUB_W - SUB_PAD_X * 2,
      breakWords: false,
      dropShadow: true,
      dropShadowColor: '#050a10',
      dropShadowBlur: 2,
      dropShadowDistance: 1
    }));
    this.dialogueText.position.set(SUB_PAD_X, SUB_PAD_Y);
    this.dialogueContainer.addChild(this.dialogueText);

    // Fast-forward text output on click
    this.dialogueContainer.eventMode = 'static';
    this.dialogueContainer.cursor = 'pointer';
    this.dialogueContainer.on('pointerdown', () => {
      if (this.typewriterIndex < this.fullTargetText.length) {
        this.typewriterIndex = this.fullTargetText.length;
        this.currentDisplayedText = this.fullTargetText;
        this.dialogueText.text = this.fullTargetText;
      }
    });
    this.addChild(this.dialogueContainer);

    this.setupStateSubscriptions();
    this.setText(this.stateManager.getState().logMessage);
  }

  private addHitZone(x: number, y: number, w: number, h: number, onTap: () => void): Graphics {
    const zone = new Graphics();
    zone.beginFill(0xffffff, 0.001);
    zone.drawRect(x, y, w, h);
    zone.endFill();
    zone.eventMode = 'static';
    zone.cursor = 'pointer';
    zone.on('pointerdown', onTap);
    this.addChild(zone);
    return zone;
  }

  private setupPortraitZone() {
    this.addHitZone(PORTRAIT_HIT.x, PORTRAIT_HIT.y, PORTRAIT_HIT.w, PORTRAIT_HIT.h, () => {
      Sound.playClick();
      const s = this.stateManager.getState();
      if (s.flags.matrixRevealed) {
        this.stateManager.setLog('Лилит: «Всё это... код. Моя память, комната... я должна разорвать цикл.»');
      } else if (s.flags.systemGlitchLevel > 1) {
        this.stateManager.setLog('Лилит: «Я чувствую, как реальность трещит по швам. Нужно выбраться.»');
      } else {
        this.stateManager.setLog('Лилит: «Энергия тает. Проверь инструменты в инвентаре и замок двери.»');
      }
    });
  }

  private setupBackpackZone() {
    this.addHitZone(BACKPACK_HIT.x, BACKPACK_HIT.y, BACKPACK_HIT.w, BACKPACK_HIT.h, () => {
      Sound.playClick();
      const s = this.stateManager.getState();
      const itemsList = s.inventory.map(i => i.name).join(', ');
      this.stateManager.setLog(`Инвентарь [${s.inventory.length}/6]: ${itemsList}`);
    });
  }

  private setupDpadZones() {
    DPAD_BUTTONS.forEach(button => {
      const highlight = new Graphics();
      highlight.lineStyle(2, 0x2cdbf0, 0.9);
      highlight.beginFill(0x2cdbf0, 0.22);
      highlight.drawCircle(button.x, button.y, DPAD_RADIUS);
      highlight.endFill();
      highlight.visible = false;
      this.addChild(highlight);
      this.dpadHighlights.set(button.action, highlight);

      const zone = new Graphics();
      zone.beginFill(0xffffff, 0.001);
      zone.drawCircle(button.x, button.y, DPAD_RADIUS);
      zone.endFill();
      zone.eventMode = 'static';
      zone.cursor = 'pointer';
      zone.on('pointerdown', () => {
        Sound.playClick();
        this.stateManager.setActiveAction(button.action);
        this.stateManager.setLog(`Режим действия: [${button.label}]`);
      });
      this.addChild(zone);
    });

    this.updateDpadActive(this.stateManager.getState().activeAction);
  }

  private updateDpadActive(activeAction: ActionType) {
    this.dpadHighlights.forEach((highlight, action) => {
      highlight.visible = action === activeAction;
    });
  }

  private slotRect(index: number) {
    return { x: SLOT_X + index * SLOT_STEP, y: SLOT_Y, w: SLOT_SIZE, h: SLOT_SIZE };
  }

  private setupInventorySlots() {
    const s = this.stateManager.getState();
    s.inventory.slice(0, 3).forEach((item, index) => {
      const rect = this.slotRect(index);

      let iconTex = this.assets.itemKeycard;
      if (item.id === 'tape') iconTex = this.assets.itemEnergyCell;
      if (item.id === 'stimpack') iconTex = this.assets.itemStimpack;
      if (item.id === 'energy_cell') iconTex = this.assets.itemEnergyCell;

      const icon = new Sprite(iconTex);
      icon.width = SLOT_ICON;
      icon.height = SLOT_ICON;
      icon.anchor.set(0.5);
      icon.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
      this.addChild(icon);
      this.slotIcons.push(icon);

      this.addHitZone(rect.x, rect.y, rect.w, rect.h, () => {
        Sound.playClick();
        this.stateManager.selectCard(item);
        if (this.stateManager.getState().selectedCard?.id === item.id) {
          this.stateManager.setLog(`Выбран предмет: [${item.name}] — ${item.description}`);
        } else {
          this.stateManager.setLog('Предмет отменён.');
        }
      });
    });
  }

  private updateSlotHighlight(selectedCard: CardItem | null) {
    this.slotHighlightGraphics.clear();
    if (!selectedCard) return;

    const s = this.stateManager.getState();
    const idx = s.inventory.findIndex(i => i.id === selectedCard.id);
    if (idx >= 0 && idx < 3) {
      const rect = this.slotRect(idx);
      this.slotHighlightGraphics.lineStyle(2, 0x2cdbf0);
      this.slotHighlightGraphics.beginFill(0x2cdbf0, 0.18);
      this.slotHighlightGraphics.drawRect(rect.x, rect.y, rect.w, rect.h);
      this.slotHighlightGraphics.endFill();
    }
  }

  /**
   * Lays the panel out for the *complete* line so the frame does not jump
   * around while the typewriter is still revealing characters.
   */
  private setText(text: string) {
    this.fullTargetText = text;
    this.currentDisplayedText = '';
    this.typewriterIndex = 0;

    this.dialogueText.text = text;
    const contentH = Math.max(SUB_LINE_H, this.dialogueText.height);
    const panelH = Math.max(SUB_MIN_H, Math.round(contentH + SUB_PAD_Y * 2));
    this.dialogueText.text = '';

    this.dialogueContainer.position.set(SUB_X, SUB_BOTTOM - panelH);

    this.dialogueBg.clear();
    this.dialogueBg.beginFill(0x0a141e, 0.94);
    this.dialogueBg.lineStyle(1, 0x1c3548);
    this.dialogueBg.drawRoundedRect(0, 0, SUB_W, panelH, 4);
    this.dialogueBg.endFill();
    // Tech bracket on the leading edge
    this.dialogueBg.lineStyle(2, 0x2cdbf0, 0.7);
    this.dialogueBg.moveTo(0, 14);
    this.dialogueBg.lineTo(0, 0);
    this.dialogueBg.lineTo(14, 0);
    this.dialogueBg.moveTo(SUB_W - 14, panelH);
    this.dialogueBg.lineTo(SUB_W, panelH);
    this.dialogueBg.lineTo(SUB_W, panelH - 14);
  }

  private setupStateSubscriptions() {
    this.stateManager.subscribe((state, changeType) => {
      if (changeType === 'log' || changeType === 'init' || changeType === 'cycleReboot') {
        this.setText(state.logMessage);
      }

      if (changeType === 'action' || changeType === 'init') {
        this.updateDpadActive(state.activeAction);
      }

      if (changeType === 'card' || changeType === 'init' || changeType === 'cycleReboot') {
        this.updateSlotHighlight(state.selectedCard);
      }

      this.hpText.text = `${state.hp}`;
      centerTextInBox(this.hpText, HP_READOUT.x, HP_READOUT.y, HP_READOUT.w, HP_READOUT.h);

      this.energyText.text = `${state.energy}`;
      centerTextInBox(this.energyText, EN_READOUT.x, EN_READOUT.y, EN_READOUT.w, EN_READOUT.h);

      this.hpFillGraphics.clear();
      const hpWidth = Math.round(Math.max(0, Math.min(1, state.hp / state.maxHp)) * BAR_W);
      if (hpWidth > 0) {
        this.hpFillGraphics.beginFill(0x92200a);
        this.hpFillGraphics.drawRect(BAR_X, HP_BAR_Y, hpWidth, BAR_H);
        this.hpFillGraphics.endFill();
      }

      this.energyFillGraphics.clear();
      const enWidth = Math.round(Math.max(0, Math.min(1, state.energy / state.maxEnergy)) * BAR_W);
      if (enWidth > 0) {
        this.energyFillGraphics.beginFill(0xd45734);
        this.energyFillGraphics.drawRect(BAR_X, EN_BAR_Y, enWidth, BAR_H);
        this.energyFillGraphics.endFill();
      }
    });
  }

  public update(delta: number) {
    // Typewriter effect (rapid and crisp)
    if (this.typewriterIndex < this.fullTargetText.length) {
      this.typewriterTimer += delta;
      if (this.typewriterTimer >= 0.4) {
        this.typewriterTimer = 0;
        const charsToAdd = Math.min(2, this.fullTargetText.length - this.typewriterIndex);
        for (let i = 0; i < charsToAdd; i++) {
          this.currentDisplayedText += this.fullTargetText[this.typewriterIndex];
          this.typewriterIndex++;
        }
        this.dialogueText.text = this.currentDisplayedText;
        if (this.typewriterIndex % 4 === 0) {
          Sound.playTypewriter();
        }
      }
    }
  }
}
