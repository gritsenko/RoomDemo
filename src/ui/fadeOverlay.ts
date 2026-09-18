import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { centerTextVertically } from './textLayout';

/** Ticker frames (at 60fps) for each phase of the transition — 5s total. */
const FADE_OUT_FRAMES = 90;
const HOLD_FRAMES = 120;
const FADE_IN_FRAMES = 90;

type Phase = 'idle' | 'fadeOut' | 'hold' | 'fadeIn';

export interface FadeOverlayText {
  title: string;
  subtitle: string;
  /** Accent colour of the caption, e.g. '#2cdbf0' for sleep, '#e63946' for death. */
  color: string;
}

/**
 * Full-screen blackout used for both story transitions — Lilith lying down in
 * the sleep module and her death before the cycle reboots: fade to black, hold
 * on the caption, fade back in. Sits above every other scene and swallows input
 * while it runs.
 */
export class FadeOverlay extends Container {
  private veil: Graphics;
  private titleText: Text;
  private subtitleText: Text;
  private centerX: number;
  private centerY: number;

  private phase: Phase = 'idle';
  private frames: number = 0;
  private onBlackout?: () => void;

  constructor(width: number, height: number) {
    super();
    this.centerX = Math.round(width / 2);
    this.centerY = Math.round(height / 2);

    this.veil = new Graphics();
    this.veil.beginFill(0x05070a);
    this.veil.drawRect(0, 0, width, height);
    this.veil.endFill();
    this.addChild(this.veil);

    this.titleText = new Text('', new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 48,
      fill: '#2cdbf0',
      letterSpacing: 4,
      dropShadow: true,
      dropShadowColor: '#050a10',
      dropShadowBlur: 4,
      dropShadowDistance: 2
    }));
    this.titleText.anchor.x = 0.5;
    this.titleText.x = this.centerX;
    this.addChild(this.titleText);

    this.subtitleText = new Text('', new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 22,
      fill: '#7f96a8',
      letterSpacing: 2
    }));
    this.subtitleText.anchor.x = 0.5;
    this.subtitleText.x = this.centerX;
    this.addChild(this.subtitleText);

    // Blocks clicks on the room and the HUD while the blackout is on screen.
    this.eventMode = 'static';
    this.visible = false;
    this.alpha = 0;
  }

  /** Starts the 5s sequence. `onBlackout` fires once the screen is fully dark. */
  public play(text: FadeOverlayText, onBlackout?: () => void) {
    if (this.phase !== 'idle') return;

    this.titleText.style.fill = text.color;
    this.titleText.text = text.title;
    this.subtitleText.text = text.subtitle;
    // Re-centre after the text changed — the Pixel face needs ink-band centring.
    centerTextVertically(this.titleText, this.centerY - 24);
    centerTextVertically(this.subtitleText, this.centerY + 40);

    this.onBlackout = onBlackout;
    this.phase = 'fadeOut';
    this.frames = 0;
    this.visible = true;
    this.alpha = 0;
    this.titleText.alpha = 0;
    this.subtitleText.alpha = 0;
  }

  public get isPlaying(): boolean {
    return this.phase !== 'idle';
  }

  public update(delta: number) {
    if (this.phase === 'idle') return;
    this.frames += delta;

    if (this.phase === 'fadeOut') {
      const p = Math.min(1, this.frames / FADE_OUT_FRAMES);
      this.alpha = p;
      this.titleText.alpha = Math.max(0, (p - 0.55) / 0.45);
      this.subtitleText.alpha = this.titleText.alpha * 0.8;
      if (p >= 1) {
        this.phase = 'hold';
        this.frames = 0;
        const cb = this.onBlackout;
        this.onBlackout = undefined;
        if (cb) cb();
      }
      return;
    }

    if (this.phase === 'hold') {
      this.alpha = 1;
      // Slow breathing pulse on the caption.
      const pulse = 0.75 + 0.25 * Math.sin((this.frames / HOLD_FRAMES) * Math.PI * 2);
      this.titleText.alpha = pulse;
      this.subtitleText.alpha = pulse * 0.8;
      if (this.frames >= HOLD_FRAMES) {
        this.phase = 'fadeIn';
        this.frames = 0;
      }
      return;
    }

    // fadeIn
    const p = Math.min(1, this.frames / FADE_IN_FRAMES);
    this.alpha = 1 - p;
    this.titleText.alpha = Math.max(0, 1 - p * 2);
    this.subtitleText.alpha = this.titleText.alpha * 0.8;
    if (p >= 1) {
      this.phase = 'idle';
      this.frames = 0;
      this.visible = false;
      this.alpha = 0;
    }
  }
}
