import { Container, Graphics, Text, TextStyle } from 'pixi.js';

export class MatrixFinaleEffect extends Container {
  private matrixText: Text;
  private background: Graphics;
  private chars: string = '0123456789ABCDEF!@#$%^&*<>[]{}';
  private lines: string[] = [];
  private timer: number = 0;

  constructor(width: number = 112, height: number = 187) {
    super();

    // Dark digital abyss background
    this.background = new Graphics();
    this.background.beginFill(0x02080a, 0.95);
    this.background.drawRect(0, 0, width, height);
    this.background.endFill();

    // Cyan digital grid lines
    this.background.lineStyle(1, 0x14404b, 0.5);
    for (let x = 0; x < width; x += 16) {
      this.background.moveTo(x, 0);
      this.background.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 16) {
      this.background.moveTo(0, y);
      this.background.lineTo(width, y);
    }
    this.addChild(this.background);

    // Matrix dump text
    const style = new TextStyle({
      fontFamily: ['Pixel', 'Share Tech Mono'],
      fontSize: 10,
      fill: ['#2cdbf0', '#48cae4', '#00f5d4'],
      letterSpacing: 1,
      wordWrap: true,
      wordWrapWidth: width - 4
    });

    this.matrixText = new Text('', style);
    this.matrixText.position.set(4, 4);
    this.addChild(this.matrixText);

    this.initLines();
  }

  private initLines() {
    this.lines = [
      'CRITICAL FAULT',
      '0x007F REBOOT FAIL',
      'NODE_07 CORRUPT',
      'REALITY VOID',
      '#8849-B DESTAB',
      'MEM DUMP:',
      '00 FF 12 A4 E8',
      'SIM CONSTRUCT 0'
    ];
    this.matrixText.text = this.lines.join('\n');
  }

  public update(delta: number) {
    this.timer += delta;
    if (this.timer > 8) {
      this.timer = 0;
      // Scramble / scroll lines
      const randomHex = '0x' + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
      let scrambled = '';
      for (let i = 0; i < 8; i++) {
        scrambled += this.chars[Math.floor(Math.random() * this.chars.length)];
      }

      this.lines.shift();
      this.lines.push(`${randomHex} ${scrambled}`);
      this.matrixText.text = this.lines.join('\n');
    }
  }
}
