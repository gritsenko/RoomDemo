import { ActionType, CardItem, GameState } from '../types/game';
import { INITIAL_CARDS } from '../types/items';
import { Sound } from '../core/audio';
import { FadeOverlayText } from '../ui/fadeOverlay';

export type StateListener = (state: GameState, changeType: string) => void;

/** Glitch filter burst right after the fatal hit. */
const DEATH_GLITCH_MS = 700;
/** Beat after the glitch so the cause of death can be read before the blackout. */
const DEATH_READ_PAUSE_MS = 1900;

export class GameStateManager {
  private state: GameState;
  private listeners: StateListener[] = [];
  public isRebooting: boolean = false;
  private onDeathGlitch?: (durationMs: number, onDone: () => void) => void;
  private onFade?: (text: FadeOverlayText, onBlackout: () => void) => void;

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    return {
      iteration: 1,
      maxIterations: 99,
      hp: 48,
      maxHp: 100,
      energy: 96,
      maxEnergy: 100,
      activeAction: 'inspect',
      selectedCard: null,
      deck: [...INITIAL_CARDS],
      inventory: INITIAL_CARDS.slice(0, 3), // quick 3 slots
      logMessage: 'Место где день начинается, и... заканчивается',
      flags: {
        doorInspected: false,
        wiresExposed: false,
        wiresInsulated: false,
        synthCleaned: false,
        hasKeycard: true,
        doorUnlocked: false,
        fridgeOpen: false,
        doorOpen: false,
        systemGlitchLevel: 0,
        matrixRevealed: false
      }
    };
  }

  public registerGlitchCallback(fn: (durationMs: number, onDone: () => void) => void) {
    this.onDeathGlitch = fn;
  }

  /** Registers the full-screen blackout; it calls back once the screen is dark. */
  public registerFadeCallback(fn: (text: FadeOverlayText, onBlackout: () => void) => void) {
    this.onFade = fn;
  }

  /** Runs the blackout if one is registered, otherwise just waits out the beat. */
  private runFade(text: FadeOverlayText, onBlackout: () => void) {
    if (this.onFade) {
      this.onFade(text, onBlackout);
    } else {
      setTimeout(onBlackout, 1500);
    }
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.push(listener);
    // Notify with initial state
    listener(this.getState(), 'init');
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(changeType: string) {
    const s = this.getState();
    for (const l of this.listeners) {
      l(s, changeType);
    }
  }

  public getState(): GameState {
    return {
      ...this.state,
      flags: { ...this.state.flags },
      deck: [...this.state.deck],
      inventory: [...this.state.inventory]
    };
  }

  public setLog(msg: string) {
    this.state.logMessage = msg;
    this.emit('log');
  }

  public setActiveAction(action: ActionType) {
    this.state.activeAction = action;
    Sound.playClick();
    this.emit('action');
  }

  public selectCard(card: CardItem | null) {
    if (this.state.selectedCard?.id === card?.id) {
      this.state.selectedCard = null;
    } else {
      this.state.selectedCard = card;
      if (card) Sound.playCardSelect();
    }
    this.emit('card');
  }

  public modifyHp(amount: number, reason?: string) {
    const prev = this.state.hp;
    this.state.hp = Math.max(0, Math.min(this.state.maxHp, this.state.hp + amount));
    this.emit('stats');

    if (this.state.hp <= 0 && prev > 0) {
      this.triggerDeath(reason || 'Критическое падение жизненных показателей');
    }
  }

  public modifyEnergy(amount: number): boolean {
    if (this.state.energy + amount < 0) {
      this.setLog('НЕДОСТАТОЧНО ЭНЕРГИИ! Требуется подзарядка или отдых.');
      Sound.playClick();
      return false;
    }
    this.state.energy = Math.max(0, Math.min(this.state.maxEnergy, this.state.energy + amount));
    this.emit('stats');
    return true;
  }

  public triggerDeath(cause: string) {
    if (this.isRebooting) return;
    this.isRebooting = true;

    this.setLog(`[ФАТАЛЬНАЯ ОШИБКА] ${cause}. СИСТЕМА ДЕСТАБИЛИЗИРОВАНА.`);
    Sound.playShock();

    // Glitch filter, then the flatline plays into a 5s blackout
    const fadeToReboot = () => {
      Sound.playGlitchFlatline();
      this.runFade({
        title: 'ЛИЛИТ ПОГИБЛА',
        subtitle: `ВОССТАНОВЛЕНИЕ ИЗ РЕЗЕРВНОЙ КОПИИ... ЦИКЛ #${this.state.iteration + 1}`,
        color: '#e63946'
      }, () => {
        this.isRebooting = false;
        this.rebootCycle();
      });
    };

    if (this.onDeathGlitch) {
      this.onDeathGlitch(DEATH_GLITCH_MS, () => {
        setTimeout(fadeToReboot, DEATH_READ_PAUSE_MS);
      });
    } else {
      setTimeout(fadeToReboot, DEATH_GLITCH_MS + DEATH_READ_PAUSE_MS);
    }
  }

  /**
   * Lilith lies down: +30 energy, then the screen fades out for 5s while the
   * cycle reboots behind the blackout.
   */
  public sleep() {
    if (this.isRebooting) return;
    this.isRebooting = true;

    this.modifyEnergy(30);
    this.setLog('Короткий сон восстановил +30 энергии. Но в кошмаре снова промелькнула цифра [07]...');

    this.runFade({
      title: 'ЛИЛИТ СПИТ...',
      subtitle: 'ЦИКЛ СНА: ВОССТАНОВЛЕНИЕ ЭНЕРГИИ...',
      color: '#2cdbf0'
    }, () => {
      this.isRebooting = false;
      this.rebootCycle();
    });
  }

  public rebootCycle() {
    this.state.iteration += 1;
    this.state.flags.systemGlitchLevel += 1;

    // Reset biological values
    this.state.hp = 48;
    this.state.energy = 85;

    // Reset certain environment states but keep accumulated glitch awareness
    this.state.flags.fridgeOpen = false;
    this.state.flags.doorOpen = false;
    this.state.selectedCard = null;

    // Awakening lines based on iteration count
    let wakeText = 'Опять этот кошмар... Воздух кончается, нужно спешить.';
    if (this.state.iteration === 2) {
      wakeText = 'Голова раскалывается. Мне кажется, я это уже делала...';
    } else if (this.state.iteration === 3) {
      wakeText = 'Стоп. Этот синтезатор не мог сломаться точно так же...';
    } else if (this.state.iteration >= 4) {
      wakeText = 'ВНИМАНИЕ: СИМУЛЯЦИЯ ПЕРЕЗАГРУЖЕНА С ОШИБКАМИ. Ячейка [07] нестабильна.';
    }

    this.isRebooting = false;
    this.setLog(wakeText);
    Sound.playWakeup();
    this.emit('cycleReboot');
  }

  public toggleFridge() {
    this.state.flags.fridgeOpen = !this.state.flags.fridgeOpen;
    Sound.playDoor();
    this.emit('fridge');
  }

  public toggleDoor() {
    this.state.flags.doorOpen = !this.state.flags.doorOpen;
    Sound.playDoor();
    this.emit('door');
  }

  public setDoorUnlocked(unlocked: boolean) {
    this.state.flags.doorUnlocked = unlocked;
    this.emit('doorLock');
  }

  public setWiresInsulated(insulated: boolean) {
    this.state.flags.wiresInsulated = insulated;
    this.emit('wires');
  }

  public setSynthCleaned(cleaned: boolean) {
    this.state.flags.synthCleaned = cleaned;
    this.emit('synth');
  }

  public revealMatrix() {
    this.state.flags.matrixRevealed = true;
    this.state.flags.doorOpen = true;
    Sound.playSuccess();
    this.emit('matrix');
  }
}
