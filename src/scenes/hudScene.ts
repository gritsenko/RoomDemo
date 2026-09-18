import { Container, Sprite, Graphics, Text, TextStyle } from 'pixi.js';
import { GameAssets } from '../atlas/assetLoader';
import { GameStateManager } from '../state/gameState';
import { ActionType, CardItem } from '../types/game';
import { Sound } from '../core/audio';

export class HudScene extends Container {
  private assets: GameAssets;
  private stateManager: GameStateManager;

  // Visual containers
  private hudBackground: Sprite;
  private portraitSprite: Sprite;
  private statBarsSprite: Sprite;
  private dpadSprite: Sprite;
  private slotsSprite: Sprite;
  private backpackSprite: Sprite;

  // Dynamic overlays
  private hpFillGraphics: Graphics;
  private hpText: Text;
  private energyFillGraphics: Graphics;
  private energyText: Text;

  // D-Pad action indicators
  private dpadHighlights: Map<ActionType, Graphics> = new Map();

  // Inventory slots
  private slotSprites: Sprite[] = [];
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

    // 1. Full HUD bottom background bar (0, 820)
    this.hudBackground = new Sprite(this.assets.hudFullBar);
    this.hudBackground.position.set(0, 820);
    this.addChild(this.hudBackground);

    // 2. Subtitle Banner positioned directly covering the HUD subtitle slot (x: 315, y: 868)
    this.dialogueContainer = new Container();
    this.dialogueContainer.position.set(315, 868);

    this.dialogueBg = new Graphics();
    this.dialogueBg.beginFill(0x0a141e, 1.0);
    this.dialogueBg.lineStyle(1, 0x1c3548);
    this.dialogueBg.drawRoundedRect(0, 0, 1290, 58, 3);
    this.dialogueBg.endFill();
    this.dialogueContainer.addChild(this.dialogueBg);

    const dialogueStyle = new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 24,
      fill: '#ffeedd',
      letterSpacing: 1.0,
      dropShadow: true,
      dropShadowColor: '#050a10',
      dropShadowBlur: 2,
      dropShadowDistance: 1
    });
    this.dialogueText = new Text('', dialogueStyle);
    this.dialogueText.anchor.set(0, 0.5);
    this.dialogueText.position.set(20, Math.round(58 / 2));
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

    // 3. Hero Portrait (0, 884)
    this.portraitSprite = new Sprite(this.assets.heroPortrait);
    this.portraitSprite.position.set(0, 884);
    this.portraitSprite.eventMode = 'static';
    this.portraitSprite.cursor = 'pointer';
    this.portraitSprite.on('pointerdown', () => {
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
    this.addChild(this.portraitSprite);

    // 4. Stat Bars (230, 880)
    this.statBarsSprite = new Sprite(this.assets.statBars);
    this.statBarsSprite.position.set(230, 880);
    this.addChild(this.statBarsSprite);

    // Dynamic HP and Energy Bar overlays
    this.hpFillGraphics = new Graphics();
    this.addChild(this.hpFillGraphics);

    this.energyFillGraphics = new Graphics();
    this.addChild(this.energyFillGraphics);

    const monoSmall = new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 16,
      fill: '#e63946'
    });
    this.hpText = new Text('HP: 48', monoSmall);
    this.hpText.position.set(385, 908);
    this.addChild(this.hpText);

    const monoCyan = new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 16,
      fill: '#2cdbf0'
    });
    this.energyText = new Text('EN: 96', monoCyan);
    this.energyText.position.set(385, 944);
    this.addChild(this.energyText);

    // 5. D-Pad Action Selector (860, 864)
    this.dpadSprite = new Sprite(this.assets.dpadActions);
    this.dpadSprite.position.set(860, 864);
    this.addChild(this.dpadSprite);

    this.setupDpadZones();

    // 6. Quick Inventory Slots (1220, 875)
    this.slotsSprite = new Sprite(this.assets.inventorySlots);
    this.slotsSprite.position.set(1220, 875);
    this.addChild(this.slotsSprite);

    this.slotHighlightGraphics = new Graphics();
    this.addChild(this.slotHighlightGraphics);

    this.setupInventorySlots();

    // 7. Backpack Icon (1670, 899)
    this.backpackSprite = new Sprite(this.assets.backpackIcon);
    this.backpackSprite.position.set(1670, 899);
    this.backpackSprite.eventMode = 'static';
    this.backpackSprite.cursor = 'pointer';
    this.backpackSprite.on('pointerdown', () => {
      Sound.playClick();
      const s = this.stateManager.getState();
      const itemsList = s.inventory.map(i => i.name).join(', ');
      this.stateManager.setLog(`Инвентарь [${s.inventory.length}/6]: ${itemsList}`);
    });
    this.addChild(this.backpackSprite);
    this.addChild(this.dialogueContainer);

    // Setup state subscriptions
    this.setupStateSubscriptions();

    // Set initial text
    this.setText(this.stateManager.getState().logMessage);
  }

  private setupDpadZones() {
    // 4 clickable quadrants for D-pad actions:
    // Center is (860 + 90, 864 + 70) = (950, 934)
    const actions: Array<{ action: ActionType; x: number; y: number; w: number; h: number; label: string }> = [
      { action: 'inspect', x: 860 + 45, y: 864, w: 90, h: 45, label: 'ОСМОТР' },
      { action: 'use', x: 860 + 95, y: 864 + 45, w: 85, h: 50, label: 'ИСПОЛЬЗ.' },
      { action: 'disassemble', x: 860 + 45, y: 864 + 95, w: 90, h: 46, label: 'РАЗОБРАТЬ' },
      { action: 'hack', x: 860, y: 864 + 45, w: 85, h: 50, label: 'ВЗЛОМ' }
    ];

    actions.forEach(item => {
      const g = new Graphics();
      g.beginFill(0x2cdbf0, 0.25);
      g.drawRoundedRect(item.x, item.y, item.w, item.h, 4);
      g.endFill();
      g.visible = false;
      this.addChild(g);
      this.dpadHighlights.set(item.action, g);

      const btnZone = new Graphics();
      btnZone.beginFill(0xffffff, 0.001); // invisible hit zone
      btnZone.drawRect(item.x, item.y, item.w, item.h);
      btnZone.endFill();
      btnZone.eventMode = 'static';
      btnZone.cursor = 'pointer';
      btnZone.on('pointerdown', () => {
        this.stateManager.setActiveAction(item.action);
        this.stateManager.setLog(`Режим действия: [${item.label}]`);
      });
      this.addChild(btnZone);
    });

    this.updateDpadActive(this.stateManager.getState().activeAction);
  }

  private updateDpadActive(activeAction: ActionType) {
    this.dpadHighlights.forEach((highlight, action) => {
      highlight.visible = action === activeAction;
    });
  }

  private setupInventorySlots() {
    // 3 slots spaced horizontally inside 330px width:
    // Slot width is ~86px, slot height is ~106px
    const slotXPositions = [1235, 1340, 1445];
    const slotY = 882;

    const s = this.stateManager.getState();
    s.inventory.slice(0, 3).forEach((item, index) => {
      const x = slotXPositions[index];
      const slotContainer = new Container();
      slotContainer.position.set(x, slotY);

      // Icon
      let iconTex = this.assets.itemKeycard;
      if (item.id === 'multitool') iconTex = this.assets.itemKeycard; // or custom
      if (item.id === 'tape') iconTex = this.assets.itemEnergyCell;
      if (item.id === 'stimpack') iconTex = this.assets.itemStimpack;
      if (item.id === 'energy_cell') iconTex = this.assets.itemEnergyCell;

      const iconSprite = new Sprite(iconTex);
      iconSprite.width = 44;
      iconSprite.height = 44;
      iconSprite.position.set(20, 30);
      slotContainer.addChild(iconSprite);

      slotContainer.eventMode = 'static';
      slotContainer.cursor = 'pointer';

      slotContainer.on('pointerdown', () => {
        this.stateManager.selectCard(item);
        if (this.stateManager.getState().selectedCard?.id === item.id) {
          this.stateManager.setLog(`Выбран предмет: [${item.name}] — ${item.description}`);
        } else {
          this.stateManager.setLog(`Предмет отменен.`);
        }
      });

      this.addChild(slotContainer);
      this.slotSprites.push(iconSprite);
    });
  }

  private updateSlotHighlight(selectedCard: CardItem | null) {
    this.slotHighlightGraphics.clear();
    if (!selectedCard) return;

    const slotXPositions = [1235, 1340, 1445];
    const s = this.stateManager.getState();
    const idx = s.inventory.findIndex(i => i.id === selectedCard.id);
    if (idx >= 0 && idx < 3) {
      const x = slotXPositions[idx];
      const y = 882;
      this.slotHighlightGraphics.lineStyle(2, 0x2cdbf0);
      this.slotHighlightGraphics.beginFill(0x2cdbf0, 0.18);
      this.slotHighlightGraphics.drawRoundedRect(x, y, 84, 104, 3);
      this.slotHighlightGraphics.endFill();
    }
  }

  private setText(text: string) {
    this.fullTargetText = text;
    this.currentDisplayedText = '';
    this.typewriterIndex = 0;
    this.dialogueText.text = '';
  }

  private setupStateSubscriptions() {
    this.stateManager.subscribe((state, changeType) => {
      // 1. Update text if log changed
      if (changeType === 'log' || changeType === 'init' || changeType === 'cycleReboot') {
        this.setText(state.logMessage);
      }

      // 2. Update D-pad
      if (changeType === 'action' || changeType === 'init') {
        this.updateDpadActive(state.activeAction);
      }

      // 3. Update Slot highlight
      if (changeType === 'card' || changeType === 'init' || changeType === 'cycleReboot') {
        this.updateSlotHighlight(state.selectedCard);
      }

      // 4. Update Stats (HP / Energy)
      this.hpText.text = `HP: ${state.hp}`;
      this.energyText.text = `EN: ${state.energy}`;

      // Progress bars
      this.hpFillGraphics.clear();
      const hpWidth = Math.max(0, (state.hp / state.maxHp) * 120);
      this.hpFillGraphics.beginFill(0xe63946);
      this.hpFillGraphics.drawRect(450, 912, hpWidth, 10);
      this.hpFillGraphics.endFill();

      this.energyFillGraphics.clear();
      const enWidth = Math.max(0, (state.energy / state.maxEnergy) * 120);
      this.energyFillGraphics.beginFill(0x2cdbf0);
      this.energyFillGraphics.drawRect(450, 948, enWidth, 10);
      this.energyFillGraphics.endFill();
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
