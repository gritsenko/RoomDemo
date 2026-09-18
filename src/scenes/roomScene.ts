import { Container, Sprite, Graphics, Text, TextStyle, AnimatedSprite } from 'pixi.js';
import { GameAssets } from '../atlas/assetLoader';
import { GameStateManager } from '../state/gameState';
import { MatrixFinaleEffect } from '../effects/matrixFinale';
import { Sound } from '../core/audio';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: string;
  isDanger?: boolean;
  isPrimary?: boolean;
  onSelect: () => void;
}

export class RoomScene extends Container {
  private assets: GameAssets;
  private stateManager: GameStateManager;

  // Visual display objects
  private roomContainer: Container;
  private roomBgSprite: Sprite;
  private pipesSprite: Sprite;
  private doorSprite: Sprite;
  private matrixBehindDoor: MatrixFinaleEffect;
  private fridgeSprite: Sprite;
  private shelvesSprite: Sprite;
  private bedSprite: Sprite;
  private hullSprite: Sprite;

  // Hero
  private heroContainer: Container;
  private heroStandingSprite: Sprite;
  private heroWalkAnim: AnimatedSprite;
  public heroX: number = 800;
  public heroTargetX: number = 800;
  public heroFacing: 'left' | 'right' = 'right';
  public isWalking: boolean = false;
  private heroSpeed: number = 4.5;
  private readonly minX: number = 740;
  private readonly maxX: number = 1040;

  // Floor waypoint reticle
  private waypointGraphics: Graphics;
  private waypointAnim: { x: number; y: number; life: number; maxLife: number } | null = null;

  // Particle effects
  private sparkGraphics: Graphics;
  private sparks: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number }> = [];

  // Hover hint tooltip
  private tooltipText: Text;
  private tooltipBg: Graphics;
  private tooltipContainer: Container;

  // Cyberpunk Action Menu (варианты действия при клике по объекту)
  private actionMenuContainer: Container;

  constructor(assets: GameAssets, stateManager: GameStateManager) {
    super();
    this.assets = assets;
    this.stateManager = stateManager;

    // Room root at (575, 365) to match metadata
    this.roomContainer = new Container();
    this.roomContainer.position.set(575, 365);
    this.addChild(this.roomContainer);

    // 1. Room background: (655 - 575 = 80, 385 - 365 = 20)
    this.roomBgSprite = new Sprite(this.assets.roomBg);
    this.roomBgSprite.position.set(80, 20);
    this.roomBgSprite.eventMode = 'static';
    this.roomBgSprite.cursor = 'pointer';
    this.roomContainer.addChild(this.roomBgSprite);

    // Click on floor to walk
    this.roomBgSprite.on('pointerdown', (e) => {
      const localPos = e.getLocalPosition(this.roomContainer);
      const targetGlobalX = 575 + localPos.x;
      this.hideActionMenu();
      this.setHeroTargetX(targetGlobalX);
      this.triggerFloorWaypoint(targetGlobalX, 580);
      Sound.playClick();
    });

    // 2. Lower pipes: (822 - 575 = 247, 642 - 365 = 277)
    this.pipesSprite = new Sprite(this.assets.roomPipes);
    this.pipesSprite.position.set(247, 277);
    this.roomContainer.addChild(this.pipesSprite);

    // 3. Matrix void effect (behind door)
    this.matrixBehindDoor = new MatrixFinaleEffect(112, 187);
    this.matrixBehindDoor.position.set(95, 30);
    this.matrixBehindDoor.visible = false;
    this.roomContainer.addChild(this.matrixBehindDoor);

    // 4. Door 07: (670 - 575 = 95, 395 - 365 = 30)
    this.doorSprite = new Sprite(this.assets.door);
    this.doorSprite.position.set(95, 30);
    this.doorSprite.eventMode = 'static';
    this.doorSprite.cursor = 'pointer';
    this.roomContainer.addChild(this.doorSprite);

    // 5. Cryo fridge: (868 - 575 = 293, 395 - 365 = 30)
    this.fridgeSprite = new Sprite(this.assets.cryoFridge);
    this.fridgeSprite.position.set(293, 30);
    this.fridgeSprite.eventMode = 'static';
    this.fridgeSprite.cursor = 'pointer';
    this.roomContainer.addChild(this.fridgeSprite);

    // 6. Shelves: (975 - 575 = 400, 395 - 365 = 30)
    this.shelvesSprite = new Sprite(this.assets.shelves);
    this.shelvesSprite.position.set(400, 30);
    this.shelvesSprite.eventMode = 'static';
    this.shelvesSprite.cursor = 'pointer';
    this.roomContainer.addChild(this.shelvesSprite);

    // 7. Bed: (975 - 575 = 400, 460 - 365 = 95)
    this.bedSprite = new Sprite(this.assets.bed);
    this.bedSprite.position.set(400, 95);
    this.bedSprite.eventMode = 'static';
    this.bedSprite.cursor = 'pointer';
    this.roomContainer.addChild(this.bedSprite);

    // 8. Outer hull armor: (0, 0)
    this.hullSprite = new Sprite(this.assets.roomFrame);
    this.hullSprite.position.set(0, 0);
    this.hullSprite.eventMode = 'none';
    this.roomContainer.addChild(this.hullSprite);

    // 9. Spark particles
    this.sparkGraphics = new Graphics();
    this.roomContainer.addChild(this.sparkGraphics);

    // 10. Floor waypoint reticle graphics
    this.waypointGraphics = new Graphics();
    this.addChild(this.waypointGraphics);

    // 11. Hero setup (height 167px, top at y=413 so boots touch floor at y=580)
    this.heroContainer = new Container();
    this.heroContainer.position.set(this.heroX, 413);

    this.heroStandingSprite = new Sprite(this.assets.heroStanding);
    this.heroStandingSprite.anchor.set(0.5, 0);

    this.heroWalkAnim = new AnimatedSprite(this.assets.heroWalk);
    this.heroWalkAnim.anchor.set(0.5, 0);
    this.heroWalkAnim.animationSpeed = 0.12;
    this.heroWalkAnim.play();
    this.heroWalkAnim.visible = false;

    this.heroContainer.addChild(this.heroStandingSprite);
    this.heroContainer.addChild(this.heroWalkAnim);
    this.heroContainer.eventMode = 'static';
    this.heroContainer.cursor = 'pointer';

    this.addChild(this.heroContainer);

    // 12. Tooltip setup (larger font)
    this.tooltipContainer = new Container();
    this.tooltipContainer.visible = false;
    this.tooltipBg = new Graphics();
    this.tooltipText = new Text('', new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 16,
      fill: '#2cdbf0'
    }));
    this.tooltipText.position.set(10, 5);
    this.tooltipContainer.addChild(this.tooltipBg);
    this.tooltipContainer.addChild(this.tooltipText);
    this.addChild(this.tooltipContainer);

    // 13. Cyberpunk Action Menu setup
    this.actionMenuContainer = new Container();
    this.actionMenuContainer.visible = false;
    this.addChild(this.actionMenuContainer);

    this.setupInteractions();
    this.setupStateSubscriptions();
  }

  public setHeroTargetX(targetX: number) {
    this.heroTargetX = Math.max(this.minX, Math.min(this.maxX, targetX));
    if (this.heroTargetX < this.heroX) {
      this.heroFacing = 'left';
    } else {
      this.heroFacing = 'right';
    }
  }

  public triggerFloorWaypoint(x: number, y: number) {
    this.waypointAnim = {
      x,
      y,
      life: 0,
      maxLife: 20
    };
  }

  private showTooltip(text: string, x: number, y: number) {
    this.tooltipText.text = text;
    const w = this.tooltipText.width + 20;
    const h = this.tooltipText.height + 10;
    this.tooltipBg.clear();
    this.tooltipBg.beginFill(0x0c1622, 0.94);
    this.tooltipBg.lineStyle(1.5, 0x2cdbf0);
    this.tooltipBg.drawRect(0, 0, w, h);
    this.tooltipBg.endFill();

    this.tooltipContainer.position.set(x - w / 2, y - h - 10);
    this.tooltipContainer.visible = true;
  }

  private hideTooltip() {
    this.tooltipContainer.visible = false;
  }

  /**
   * Opens the Cyberpunk Action Menu with options for the clicked hotspot/prop.
   * Positioned centered in the free area above the room (Y < 365) with doubled dimensions.
   */
  public openActionMenu(title: string, _anchorX: number, _anchorY: number, items: ActionMenuItem[]) {
    this.hideTooltip();
    this.actionMenuContainer.removeChildren();

    // Include selected card quick-action if one is selected
    const s = this.stateManager.getState();
    const allItems: ActionMenuItem[] = [...items];
    if (s.selectedCard && !allItems.some(i => i.id === s.selectedCard!.id)) {
      allItems.unshift({
        id: `use_selected_${s.selectedCard.id}`,
        label: `Применить [${s.selectedCard.name}]`,
        icon: '⭐',
        isPrimary: true,
        onSelect: () => {
          this.applyCardToObject(title, s.selectedCard!.id);
        }
      });
    }

    // Doubled popup sizing
    const menuW = 760;
    const padding = 16;
    const headerH = 50;
    const itemH = 46;
    const itemGap = 8;
    const menuH = headerH + padding + allItems.length * (itemH + itemGap);

    // Center horizontally above room (room spans X: 575..1275, center = 925)
    const menuX = Math.round(925 - menuW / 2);

    // Center vertically in the free area above the room (Y: 10..355) so it never touches room (Y >= 365)
    const menuY = Math.max(12, Math.min(365 - menuH - 8, Math.round((365 - menuH) / 2)));

    this.actionMenuContainer.position.set(menuX, menuY);

    // Outer cyber-frame & translucent backdrop
    const bg = new Graphics();
    bg.beginFill(0x060f17, 0.97);
    bg.lineStyle(2, 0x2cdbf0);
    bg.drawRoundedRect(0, 0, menuW, menuH, 6);
    bg.endFill();

    // Outer glow rim / tech corner brackets
    bg.lineStyle(3, 0xf09235, 0.8);
    bg.moveTo(0, 16); bg.lineTo(0, 0); bg.lineTo(16, 0);
    bg.moveTo(menuW - 16, 0); bg.lineTo(menuW, 0); bg.lineTo(menuW, 16);
    bg.moveTo(menuW, menuH - 16); bg.lineTo(menuW, menuH); bg.lineTo(menuW - 16, menuH);
    bg.moveTo(16, menuH); bg.lineTo(0, menuH); bg.lineTo(0, menuH - 16);

    // Header bar
    bg.beginFill(0x0c2030, 0.95);
    bg.lineStyle(1.5, 0x1d4763);
    bg.drawRoundedRect(4, 4, menuW - 8, headerH - 6, 4);
    bg.endFill();
    this.actionMenuContainer.addChild(bg);

    // Header title (vertically centered)
    const headerText = new Text(`[ ${title.toUpperCase()} ]`, new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 19,
      fill: '#f09235',
      letterSpacing: 1.2
    }));
    headerText.anchor.set(0, 0.5);
    headerText.position.set(20, Math.round(headerH / 2));
    this.actionMenuContainer.addChild(headerText);

    // Subtitle indicator (vertically centered)
    const subHint = new Text('— ВЫБОР ДЕЙСТВИЯ —', new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 12,
      fill: '#2cdbf0',
      letterSpacing: 1.0
    }));
    subHint.anchor.set(1, 0.5);
    subHint.position.set(menuW - 56, Math.round(headerH / 2));
    this.actionMenuContainer.addChild(subHint);

    // Close button [✕] (32x32px, vertically centered in header bar)
    const closeBtn = new Container();
    closeBtn.position.set(menuW - 44, Math.round((headerH - 32) / 2));
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';

    const closeBg = new Graphics();
    closeBg.beginFill(0x162c3e, 0.85);
    closeBg.lineStyle(1, 0x2cdbf0);
    closeBg.drawRoundedRect(0, 0, 32, 32, 4);
    closeBg.endFill();
    closeBtn.addChild(closeBg);

    const closeTxt = new Text('✕', new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 18,
      fill: '#8da8be'
    }));
    closeTxt.anchor.set(0.5, 0.5);
    closeTxt.position.set(16, 16);
    closeBtn.addChild(closeTxt);

    closeBtn.on('pointerover', () => {
      closeBg.clear();
      closeBg.beginFill(0xe63946, 0.95);
      closeBg.lineStyle(1, 0xff7b87);
      closeBg.drawRoundedRect(0, 0, 32, 32, 4);
      closeBg.endFill();
      closeTxt.style.fill = '#ffffff';
    });
    closeBtn.on('pointerout', () => {
      closeBg.clear();
      closeBg.beginFill(0x162c3e, 0.85);
      closeBg.lineStyle(1, 0x2cdbf0);
      closeBg.drawRoundedRect(0, 0, 32, 32, 4);
      closeBg.endFill();
      closeTxt.style.fill = '#8da8be';
    });
    closeBtn.on('pointerdown', (e) => {
      e.stopPropagation();
      Sound.playClick();
      this.hideActionMenu();
    });
    this.actionMenuContainer.addChild(closeBtn);

    // Action items (large, doubled buttons)
    const btnW = menuW - padding * 2;
    allItems.forEach((item, idx) => {
      const btnY = headerH + 8 + idx * (itemH + itemGap);
      const btn = new Container();
      btn.position.set(padding, btnY);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const btnG = new Graphics();

      const drawBtnState = (isHover: boolean) => {
        btnG.clear();
        if (item.isDanger) {
          if (isHover) {
            btnG.beginFill(0x4a121a, 0.96);
            btnG.lineStyle(2, 0xe63946);
          } else {
            btnG.beginFill(0x220c12, 0.92);
            btnG.lineStyle(1.5, 0x6e252e);
          }
        } else if (item.isPrimary) {
          if (isHover) {
            btnG.beginFill(0x18486b, 0.96);
            btnG.lineStyle(2, 0x2cdbf0);
          } else {
            btnG.beginFill(0x0e2d42, 0.92);
            btnG.lineStyle(1.5, 0x206085);
          }
        } else {
          if (isHover) {
            btnG.beginFill(0x18374e, 0.96);
            btnG.lineStyle(2, 0x2cdbf0);
          } else {
            btnG.beginFill(0x0d202e, 0.92);
            btnG.lineStyle(1.5, 0x1b3c56);
          }
        }
        btnG.drawRoundedRect(0, 0, btnW, itemH, 4);
        btnG.endFill();
      };

      drawBtnState(false);
      btn.addChild(btnG);

      // Icon & Label Text (vertically centered in button)
      const labelText = item.icon ? `${item.icon}  ${item.label}` : item.label;
      const txt = new Text(labelText, new TextStyle({
        fontFamily: ['Pixel', 'Share Tech Mono'],
        fontSize: 17,
        fill: item.isDanger ? '#ff858d' : (item.isPrimary ? '#6be5f6' : '#d6e6f5'),
        letterSpacing: 0.6
      }));
      txt.anchor.set(0, 0.5);
      txt.position.set(18, Math.round(itemH / 2));
      btn.addChild(txt);

      // Optional danger tag (vertically centered, right-aligned with safety margin)
      let tag: Text | null = null;
      if (item.isDanger) {
        tag = new Text('[ ОПАСНО ]', new TextStyle({
          fontFamily: ['Pixel', 'Share Tech Mono'],
          fontSize: 14,
          fill: '#ff5c68',
          letterSpacing: 0.6
        }));
        tag.anchor.set(1, 0.5);
        tag.position.set(btnW - 18, Math.round(itemH / 2));
        btn.addChild(tag);

        // Safety guard: guarantee label text never overlaps danger tag
        const tagLeftEdge = btnW - 18 - tag.width - 20;
        const availableWidth = tagLeftEdge - 18;
        if (txt.width > availableWidth && availableWidth > 50) {
          txt.scale.x = availableWidth / txt.width;
        }
      }

      btn.on('pointerover', () => {
        drawBtnState(true);
        txt.style.fill = '#ffffff';
        if (tag) tag.style.fill = '#ffffff';
      });
      btn.on('pointerout', () => {
        drawBtnState(false);
        txt.style.fill = item.isDanger ? '#ff858d' : (item.isPrimary ? '#6be5f6' : '#d6e6f5');
        if (tag) tag.style.fill = '#ff5c68';
      });
      btn.on('pointerdown', (e) => {
        e.stopPropagation();
        Sound.playClick();
        this.hideActionMenu();
        item.onSelect();
      });

      this.actionMenuContainer.addChild(btn);
    });

    this.actionMenuContainer.visible = true;
  }

  public hideActionMenu() {
    this.actionMenuContainer.visible = false;
  }

  private applyCardToObject(objectName: string, cardId: string) {
    if (objectName.includes('Гермодверь')) {
      this.handleDoorCardAction(cardId);
    } else if (objectName.includes('Крио-синтезатор')) {
      this.handleFridgeCardAction(cardId);
    } else if (objectName.includes('Вентиляция') || objectName.includes('Полки')) {
      this.handleShelvesCardAction(cardId);
    } else {
      this.stateManager.setLog(`Предмет не применим к объекту [${objectName}].`);
    }
  }

  private setupInteractions() {
    // 1. Door 07
    this.doorSprite.on('pointerover', () => {
      this.showTooltip('Гермодверь [07]', 575 + 95 + 56, 365 + 30);
    });
    this.doorSprite.on('pointerout', () => this.hideTooltip());
    this.doorSprite.on('pointerdown', (e) => {
      e.stopPropagation();
      this.handleDoorClick();
    });

    // 2. Cryo Fridge
    this.fridgeSprite.on('pointerover', () => {
      this.showTooltip('Пищевой крио-синтезатор', 575 + 293 + 53, 365 + 30);
    });
    this.fridgeSprite.on('pointerout', () => this.hideTooltip());
    this.fridgeSprite.on('pointerdown', (e) => {
      e.stopPropagation();
      this.handleFridgeClick();
    });

    // 3. Bed
    this.bedSprite.on('pointerover', () => {
      this.showTooltip('Спальный модуль', 575 + 400 + 100, 365 + 95);
    });
    this.bedSprite.on('pointerout', () => this.hideTooltip());
    this.bedSprite.on('pointerdown', (e) => {
      e.stopPropagation();
      this.handleBedClick();
    });

    // 4. Shelves
    this.shelvesSprite.on('pointerover', () => {
      this.showTooltip('Вентиляция / Сервисный люк', 575 + 400 + 100, 365 + 30);
    });
    this.shelvesSprite.on('pointerout', () => this.hideTooltip());
    this.shelvesSprite.on('pointerdown', (e) => {
      e.stopPropagation();
      this.handleShelvesClick();
    });

    // 5. Hero
    this.heroContainer.on('pointerdown', (e) => {
      e.stopPropagation();
      this.handleHeroClick();
    });
  }

  private handleDoorClick() {
    this.setHeroTargetX(780);
    const s = this.stateManager.getState();
    const items: ActionMenuItem[] = [];

    // 1. Inspect
    items.push({
      id: 'inspect',
      label: 'Осмотреть замок и шлейф',
      icon: '👁️',
      onSelect: () => {
        this.stateManager.setActiveAction('inspect');
        if (!s.flags.wiresInsulated) {
          this.stateManager.setLog('Замок обесточен и заклинил. Оголенный шлейф искрит под напряжением (10 кВ)!');
        } else if (!s.flags.doorUnlocked) {
          this.stateManager.setLog('Шлейф надежно изолирован. Замок ожидает авторизацию ключ-картой [07].');
        } else {
          this.stateManager.setLog('Замок разблокирован. Шлюз открыт.');
        }
      }
    });

    // 2. Wire insulation / item handling
    if (!s.flags.wiresInsulated) {
      const hasTape = s.inventory.some(i => i.id === 'tape') || s.selectedCard?.id === 'tape';
      items.push({
        id: 'tape',
        label: hasTape ? 'Заизолировать шлейф [Лента]' : 'Заизолировать шлейф (нужен изолятор)',
        icon: '🩹',
        isPrimary: hasTape,
        onSelect: () => {
          this.stateManager.setActiveAction('use');
          if (hasTape) {
            this.stateManager.setWiresInsulated(true);
            Sound.playSuccess();
            this.stateManager.setLog('Вы тщательно обмотали оголенные провода термоизолятором. Искрение прекратилось!');
          } else {
            this.stateManager.setLog('Шлейф искрит 10 кВ! Прикосновение опасно. Найдите изолятор в вентиляции.');
          }
        }
      });

      items.push({
        id: 'short_circuit',
        label: 'Замкнуть контакты [Мультитул]',
        icon: '⚡',
        isDanger: true,
        onSelect: () => {
          this.stateManager.setActiveAction('disassemble');
          this.stateManager.triggerDeath('СМЕРТЕЛЬНЫЙ УДАР ТОКОМ: Мультитул замкнул оголенный шлейф 10 кВ');
        }
      });
    }

    // 3. Authorization if insulated
    if (s.flags.wiresInsulated && !s.flags.doorUnlocked) {
      const hasKeycard = s.inventory.some(i => i.id === 'keycard') || s.selectedCard?.id === 'keycard';
      items.push({
        id: 'keycard',
        label: hasKeycard ? 'Авторизовать [Ключ-карта 07]' : 'Авторизовать доступ (нужна карта)',
        icon: '💳',
        isPrimary: hasKeycard,
        onSelect: () => {
          this.stateManager.setActiveAction('use');
          if (hasKeycard) {
            this.stateManager.setDoorUnlocked(true);
            this.stateManager.toggleDoor();
            Sound.playSuccess();
            if (s.iteration >= 4) {
              this.stateManager.revealMatrix();
              this.stateManager.setLog('КРИТИЧЕСКИЙ СБОЙ: Симуляция рассеивается... Реальность не обнаружена!');
            } else {
              this.stateManager.setLog('Доступ подтвержден! Гермодверь [07] со шипением распахнулась.');
            }
          } else {
            this.stateManager.setLog('Консоль ожидает ключ-карту доступа [07].');
          }
        }
      });
    }

    // 4. Hack console
    items.push({
      id: 'hack',
      label: 'Взломать консоль двери',
      icon: '💻',
      isDanger: !s.flags.wiresInsulated,
      onSelect: () => {
        this.stateManager.setActiveAction('hack');
        if (!s.flags.wiresInsulated) {
          this.stateManager.triggerDeath('ФАТАЛЬНЫЙ РАЗРЯД: Попытка взлома искрящей консоли замка без изоляции');
          return;
        }
        if (s.iteration >= 2 || s.flags.systemGlitchLevel >= 2) {
          this.stateManager.setDoorUnlocked(true);
          this.stateManager.revealMatrix();
          this.stateManager.setLog('ВЗЛОМ УСПЕШЕН: Оболочка комнаты рушится! Доступ к системному ядру...');
        } else {
          this.stateManager.setLog('Брандмауэр блокирует взлом. Нужна ключ-карта или перегрузка циклов.');
        }
      }
    });

    // 5. Door Open / Close if unlocked
    if (s.flags.doorUnlocked) {
      items.push({
        id: 'toggle_door',
        label: s.flags.doorOpen ? 'Закрыть шлюз [07]' : 'Открыть шлюз [07]',
        icon: '🚪',
        isPrimary: true,
        onSelect: () => {
          this.stateManager.toggleDoor();
        }
      });
    }

    this.openActionMenu('Гермодверь [07]', 575 + 95 + 56, 365 + 30, items);
  }

  private handleDoorCardAction(cardId: string) {
    const s = this.stateManager.getState();
    if (cardId === 'tape') {
      if (!s.flags.wiresInsulated) {
        this.stateManager.setWiresInsulated(true);
        Sound.playSuccess();
        this.stateManager.setLog('Вы тщательно обмотали оголенные провода термоизолятором. Искрение прекратилось!');
      } else {
        this.stateManager.setLog('Провода уже надежно изолированы.');
      }
    } else if (cardId === 'multitool') {
      if (!s.flags.wiresInsulated) {
        this.stateManager.triggerDeath('СМЕРТЕЛЬНЫЙ УДАР ТОКОМ: Мультитул замкнул оголенный шлейф 10 кВ');
      } else {
        this.stateManager.setLog('Шлейф уже заизолирован. Требуется авторизовать доступ ключ-картой.');
      }
    } else if (cardId === 'keycard') {
      if (!s.flags.wiresInsulated) {
        this.stateManager.triggerDeath('ЭЛЕКТРИЧЕСКИЙ ПРОБОЙ: Дуга с оголенного шлейфа пробила чип ключа в руку');
      } else {
        this.stateManager.setDoorUnlocked(true);
        this.stateManager.toggleDoor();
        Sound.playSuccess();
        if (s.iteration >= 4) {
          this.stateManager.revealMatrix();
          this.stateManager.setLog('КРИТИЧЕСКИЙ СБОЙ: Симуляция рассеивается... Реальность не обнаружена!');
        } else {
          this.stateManager.setLog('Доступ подтвержден! Гермодверь [07] с шипением распахнулась.');
        }
      }
    } else {
      this.stateManager.setLog('Этот предмет не взаимодействует с консолью двери.');
    }
  }

  private handleFridgeClick() {
    this.setHeroTargetX(890);
    const s = this.stateManager.getState();
    const items: ActionMenuItem[] = [];

    // 1. Inspect
    items.push({
      id: 'inspect',
      label: 'Диагностика синтезатора',
      icon: '👁️',
      onSelect: () => {
        this.stateManager.setActiveAction('inspect');
        if (!s.flags.synthCleaned) {
          this.stateManager.setLog('Картридж забит токсичным био-осадком. Употребление пайка смертельно.');
        } else {
          this.stateManager.setLog('Картридж очищен. Синтезатор готов выдавать питательный белковый концентрат.');
        }
      }
    });

    // 2. Clean
    if (!s.flags.synthCleaned) {
      items.push({
        id: 'clean',
        label: 'Очистить инжектор [Мультитул] (-20 EN)',
        icon: '🔧',
        isPrimary: true,
        onSelect: () => {
          this.stateManager.setActiveAction('disassemble');
          if (this.stateManager.modifyEnergy(-20)) {
            this.stateManager.setSynthCleaned(true);
            this.stateManager.modifyHp(40);
            Sound.playSuccess();
            this.stateManager.setLog('Мультитулом удален токсичный осадок (-20 EN). Синтезирован чистый паек (+40 HP)!');
          } else {
            this.stateManager.setLog('Недостаточно энергии (-20 EN) для прочистки синтезатора.');
          }
        }
      });

      items.push({
        id: 'eat_toxic',
        label: 'Синтезировать паек [Неочищенный]',
        icon: '🥪',
        isDanger: true,
        onSelect: () => {
          this.stateManager.triggerDeath('ТОКСИЧЕСКИЙ ШОК: Употребление зараженного белкового пайка из синтезатора');
        }
      });
    } else {
      items.push({
        id: 'toggle_fridge',
        label: s.flags.fridgeOpen ? 'Закрыть камеру синтезатора' : 'Синтезировать чистый паек (+15 HP)',
        icon: '🥪',
        isPrimary: true,
        onSelect: () => {
          this.stateManager.toggleFridge();
          this.stateManager.modifyHp(15);
          Sound.playSuccess();
          this.stateManager.setLog('Синтезирован сбалансированный рацион. Жизненные показатели улучшены.');
        }
      });
    }

    this.openActionMenu('Крио-синтезатор', 575 + 293 + 53, 365 + 30, items);
  }

  private handleFridgeCardAction(cardId: string) {
    const s = this.stateManager.getState();
    if (cardId === 'multitool') {
      if (!s.flags.synthCleaned) {
        if (this.stateManager.modifyEnergy(-20)) {
          this.stateManager.setSynthCleaned(true);
          this.stateManager.modifyHp(40);
          Sound.playSuccess();
          this.stateManager.setLog('Мультитулом удален токсичный осадок (-20 EN). Синтезирован чистый паек (+40 HP)!');
        }
      } else {
        this.stateManager.setLog('Синтезатор уже очищен и исправен.');
      }
    } else {
      this.stateManager.setLog('Этот предмет не подходит для обслуживания синтезатора.');
    }
  }

  private handleBedClick() {
    this.setHeroTargetX(960);
    const items: ActionMenuItem[] = [];

    items.push({
      id: 'inspect',
      label: 'Осмотреть модуль и нейролинк',
      icon: '👁️',
      onSelect: () => {
        this.stateManager.setActiveAction('inspect');
        this.stateManager.setLog('Спальное место. В изголовье вмонтирован разъем нейролинка с мерцающим диодом.');
      }
    });

    items.push({
      id: 'sleep',
      label: 'Отдохнуть (Сон: +30 EN / Перезагрузка)',
      icon: '💤',
      isPrimary: true,
      onSelect: () => {
        this.stateManager.modifyEnergy(30);
        Sound.playWakeup();
        this.stateManager.setLog('Короткий сон восстановил +30 энергии. Но в кошмаре снова промелькнула цифра [07]...');
        setTimeout(() => {
          this.stateManager.rebootCycle();
        }, 1200);
      }
    });

    this.openActionMenu('Спальный модуль', 575 + 400 + 100, 365 + 95, items);
  }

  private handleShelvesClick() {
    this.setHeroTargetX(960);
    const s = this.stateManager.getState();
    const items: ActionMenuItem[] = [];

    items.push({
      id: 'inspect',
      label: 'Осмотреть сервисный люк',
      icon: '👁️',
      onSelect: () => {
        this.stateManager.setActiveAction('inspect');
        this.stateManager.setLog('Настенные полки и сервисный люк вентиляции. Слышен свист хладагента.');
      }
    });

    const hasMultitool = s.inventory.some(i => i.id === 'multitool') || s.selectedCard?.id === 'multitool';
    items.push({
      id: 'pry',
      label: hasMultitool ? 'Вскрыть решетку [Мультитул]' : 'Вскрыть решетку голыми руками',
      icon: '🔧',
      isDanger: !hasMultitool,
      isPrimary: hasMultitool,
      onSelect: () => {
        this.stateManager.setActiveAction('disassemble');
        if (hasMultitool) {
          this.stateManager.setLog('Вы осторожно вскрыли панель. Найдена запасная [Изоляционная лента]!');
          Sound.playSuccess();
        } else {
          this.stateManager.triggerDeath('РАЗГЕРМЕТИЗАЦИЯ ХЛАДАГЕНТА: Попытка сорвать решетку голыми руками вызвала выброс фреона');
        }
      }
    });

    this.openActionMenu('Вентиляция / Полки', 575 + 400 + 100, 365 + 30, items);
  }

  private handleShelvesCardAction(cardId: string) {
    if (cardId === 'multitool') {
      this.stateManager.setLog('Вы осторожно вскрыли панель. Найдена запасная [Изоляционная лента]!');
      Sound.playSuccess();
    } else {
      this.stateManager.setLog('Для безопасного вскрытия сервисного люка требуется инструмент.');
    }
  }

  private handleHeroClick() {
    const s = this.stateManager.getState();
    const items: ActionMenuItem[] = [];

    items.push({
      id: 'thoughts',
      label: 'Самодиагностика / Мысли',
      icon: '🧠',
      isPrimary: true,
      onSelect: () => {
        Sound.playClick();
        if (s.flags.matrixRevealed) {
          this.stateManager.setLog('Лилит: «Всё это... код. Моя память, комната... я должна разорвать цикл.»');
        } else if (s.flags.systemGlitchLevel > 0) {
          this.stateManager.setLog('Лилит: «У меня мурашки по коже... Этот отсек словно ненастоящий.»');
        } else {
          this.stateManager.setLog('Лилит: «Статус жизнеобеспечения на исходе. Надо открыть шлюз [07].»');
        }
      }
    });

    items.push({
      id: 'inventory_status',
      label: `Инвентарь (${s.inventory.length} предм.)`,
      icon: '🎒',
      onSelect: () => {
        Sound.playClick();
        const list = s.inventory.map(i => i.name).join(', ');
        this.stateManager.setLog(`Снаряжение: ${list}. Выбирайте предметы в слотах HUD для применения.`);
      }
    });

    this.openActionMenu('Лилит', this.heroX, 413, items);
  }

  private setupStateSubscriptions() {
    this.stateManager.subscribe((state, changeType) => {
      // Door texture
      if (state.flags.doorOpen) {
        this.doorSprite.texture = this.assets.doorOpen;
      } else {
        this.doorSprite.texture = this.assets.door;
      }

      // Matrix effect behind door
      if (state.flags.doorOpen && (state.flags.matrixRevealed || state.iteration >= 4)) {
        this.matrixBehindDoor.visible = true;
      } else {
        this.matrixBehindDoor.visible = false;
      }

      // Fridge texture
      if (state.flags.fridgeOpen) {
        this.fridgeSprite.texture = this.assets.cryoFridgeOpen;
      } else {
        this.fridgeSprite.texture = this.assets.cryoFridge;
      }

      // Reposition hero to bed on cycle reboot
      if (changeType === 'cycleReboot') {
        this.heroX = 980;
        this.heroTargetX = 900;
        this.heroFacing = 'left';
        this.hideActionMenu();
      }
    });
  }

  public update(delta: number) {
    // 1. Move hero
    const dist = this.heroTargetX - this.heroX;
    if (Math.abs(dist) > 3) {
      this.heroX += Math.sign(dist) * this.heroSpeed;
      this.isWalking = true;
      this.heroStandingSprite.visible = false;
      this.heroWalkAnim.visible = true;

      // Footstep sound random trigger
      if (Math.random() < 0.04) {
        Sound.playStep();
      }
    } else {
      this.isWalking = false;
      this.heroStandingSprite.visible = true;
      this.heroWalkAnim.visible = false;
    }

    this.heroContainer.x = this.heroX;
    this.heroContainer.scale.x = this.heroFacing === 'left' ? -1 : 1;

    // 2. Waypoint reticle update
    if (this.waypointAnim) {
      this.waypointAnim.life += delta;
      if (this.waypointAnim.life >= this.waypointAnim.maxLife) {
        this.waypointAnim = null;
        this.waypointGraphics.clear();
      } else {
        const progress = this.waypointAnim.life / this.waypointAnim.maxLife;
        const radius = 6 + progress * 16;
        const alpha = 1 - progress;
        this.waypointGraphics.clear();
        this.waypointGraphics.lineStyle(1.5, 0x2cdbf0, alpha);
        this.waypointGraphics.drawCircle(this.waypointAnim.x, this.waypointAnim.y, radius);
        this.waypointGraphics.beginFill(0x2cdbf0, alpha * 0.9);
        this.waypointGraphics.drawCircle(this.waypointAnim.x, this.waypointAnim.y, 2.5);
        this.waypointGraphics.endFill();
      }
    }

    // 3. Matrix effect update
    if (this.matrixBehindDoor.visible) {
      this.matrixBehindDoor.update(delta);
    }

    // 4. Sparks update on uninsulated door lock
    const s = this.stateManager.getState();
    if (!s.flags.wiresInsulated && Math.random() < 0.15) {
      for (let i = 0; i < 3; i++) {
        this.sparks.push({
          x: 95 + 12 + (Math.random() - 0.5) * 6,
          y: 30 + 105 + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4 - 1,
          life: 0,
          maxLife: 10 + Math.random() * 15
        });
      }
    }

    this.sparkGraphics.clear();
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.life += delta;

      if (sp.life >= sp.maxLife) {
        this.sparks.splice(i, 1);
        continue;
      }

      const alpha = 1 - (sp.life / sp.maxLife);
      this.sparkGraphics.beginFill(0x2cdbf0, alpha);
      this.sparkGraphics.drawCircle(sp.x, sp.y, 1.5);
      this.sparkGraphics.endFill();
    }
  }
}
