import { Application, BaseTexture, SCALE_MODES, Container } from 'pixi.js';

// Enforce nearest-neighbor interpolation for crisp pixel art
BaseTexture.defaultOptions.scaleMode = SCALE_MODES.NEAREST;

export class GameApp {
  public app: Application;
  public stageContainer: Container;
  public readonly width = 1920;
  public readonly height = 1080;

  constructor(containerElement: HTMLElement) {
    this.app = new Application({
      width: this.width,
      height: this.height,
      backgroundColor: 0x05070a,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
      powerPreference: 'high-performance'
    });

    // Root virtual container for pixel-perfect scaling
    this.stageContainer = new Container();
    this.app.stage.addChild(this.stageContainer);

    containerElement.appendChild(this.app.view as HTMLCanvasElement);

    this.setupResize(containerElement);
  }

  private setupResize(containerElement: HTMLElement) {
    const canvas = this.app.view as HTMLCanvasElement;

    const resize = () => {
      const containerWidth = containerElement.clientWidth;
      const containerHeight = containerElement.clientHeight;

      const scale = Math.min(containerWidth / this.width, containerHeight / this.height);
      const displayWidth = Math.round(this.width * scale);
      const displayHeight = Math.round(this.height * scale);

      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
    };

    window.addEventListener('resize', resize);
    // Initial call
    resize();
  }
}
