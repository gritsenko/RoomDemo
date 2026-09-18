import { Filter } from 'pixi.js';

const fragmentShader = `
precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uIntensity;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main(void) {
  vec2 uv = vTextureCoord;

  if (uIntensity <= 0.001) {
    gl_FragColor = texture2D(uSampler, uv);
    return;
  }

  // Random slice block displacement
  float sliceBlock = floor(uv.y * 28.0);
  float n = rand(vec2(sliceBlock, floor(uTime * 18.0)));
  float hOffset = 0.0;
  if (n < uIntensity * 0.6) {
    hOffset = (rand(vec2(sliceBlock, uTime * 25.0)) - 0.5) * 0.07 * uIntensity;
  }

  vec2 displacedCoord = vec2(clamp(uv.x + hOffset, 0.0, 1.0), uv.y);

  // Chromatic RGB separation
  float rgbShift = 0.018 * uIntensity;
  float r = texture2D(uSampler, vec2(clamp(displacedCoord.x + rgbShift, 0.0, 1.0), displacedCoord.y)).r;
  float g = texture2D(uSampler, displacedCoord).g;
  float b = texture2D(uSampler, vec2(clamp(displacedCoord.x - rgbShift, 0.0, 1.0), displacedCoord.y)).b;
  float a = texture2D(uSampler, displacedCoord).a;

  vec3 finalColor = vec3(r, g, b);

  // Digital noise spikes
  float grain = (rand(uv + fract(uTime)) - 0.5) * 0.12 * uIntensity;
  finalColor = clamp(finalColor + grain, 0.0, 1.0);

  gl_FragColor = vec4(finalColor * a, a);
}
`;

export class GlitchFilter extends Filter {
  private _intensity: number = 0;
  private _time: number = 0;

  constructor() {
    super(undefined, fragmentShader, {
      uTime: 0.0,
      uIntensity: 0.0
    });
  }

  public update(delta: number) {
    this._time += delta * 0.05;
    this.uniforms.uTime = this._time;
    this.uniforms.uIntensity = this._intensity;
  }

  public set intensity(val: number) {
    this._intensity = Math.max(0, Math.min(1, val));
    this.uniforms.uIntensity = this._intensity;
  }

  public get intensity(): number {
    return this._intensity;
  }
}
