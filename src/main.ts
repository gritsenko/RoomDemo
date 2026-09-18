import { GameApp } from './core/app';
import { AssetLoader } from './atlas/assetLoader';
import { GameStateManager } from './state/gameState';
import { RoomScene } from './scenes/roomScene';
import { HudScene } from './scenes/hudScene';
import { GlitchFilter } from './shaders/glitchFilter';
import { FadeOverlay } from './ui/fadeOverlay';
import { Sound } from './core/audio';

async function bootstrap() {
  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Could not find #game-container in DOM.');
  }

  // Preload custom 'Pixel' font so canvas renders with the font ready
  try {
    await document.fonts.load('16px Pixel');
    await document.fonts.ready;
  } catch (err) {
    console.warn('Font loading failed, falling back:', err);
  }

  // 1. Initialize PixiJS Application
  const gameApp = new GameApp(container);

  // 2. Initialize Glitch Filter
  const glitchFilter = new GlitchFilter();
  gameApp.stageContainer.filters = [glitchFilter];

  // 3. Load Game Assets
  const assets = await AssetLoader.loadAll(gameApp.app.renderer);

  // 4. Initialize State Manager
  const stateManager = new GameStateManager();

  // Glitch callback on death
  stateManager.registerGlitchCallback((durationMs: number, onDone: () => void) => {
    glitchFilter.intensity = 0.95;
    const startTime = performance.now();

    const animGlitch = (now: number) => {
      const elapsed = now - startTime;
      const progress = elapsed / durationMs;
      if (progress < 1) {
        // Flickering glitch decay
        glitchFilter.intensity = (1 - progress * 0.7) * (0.8 + Math.random() * 0.2);
        requestAnimationFrame(animGlitch);
      } else {
        glitchFilter.intensity = 0.0;
        onDone();
      }
    };
    requestAnimationFrame(animGlitch);
  });

  // Blackout callback — 5s fade with a caption, used for sleep and for death
  const fadeOverlay = new FadeOverlay(gameApp.width, gameApp.height);
  stateManager.registerFadeCallback((text, onBlackout) => {
    fadeOverlay.play(text, onBlackout);
  });

  // 5. Build Scenes
  const roomScene = new RoomScene(assets, stateManager);
  gameApp.stageContainer.addChild(roomScene);

  const hudScene = new HudScene(assets, stateManager);
  gameApp.stageContainer.addChild(hudScene);

  // Overlay sits above the room and the HUD
  gameApp.stageContainer.addChild(fadeOverlay);

  // 6. Setup Top Bar Telemetry & Controls
  setupTopBar(stateManager);

  // 7. Main Render & Logic Ticker Loop
  gameApp.app.ticker.add((delta) => {
    glitchFilter.update(delta);
    roomScene.update(delta);
    hudScene.update(delta);
    fadeOverlay.update(delta);
  });
}

function setupTopBar(stateManager: GameStateManager) {
  const resetCycleBtn = document.getElementById('resetCycleBtn');
  const cycleBadge = document.getElementById('cycleBadge');
  const simStatus = document.getElementById('simStatus');
  const audioPrompt = document.getElementById('audio-prompt');

  // Dismiss audio prompt on any click
  window.addEventListener('pointerdown', () => {
    Sound.init();
    if (audioPrompt) {
      audioPrompt.style.opacity = '0';
      setTimeout(() => audioPrompt.remove(), 300);
    }
  }, { once: true });

  if (resetCycleBtn) {
    resetCycleBtn.addEventListener('click', () => {
      Sound.playClick();
      stateManager.rebootCycle();
    });
  }

  // Update telemetry on state change
  stateManager.subscribe((state) => {
    if (cycleBadge) {
      cycleBadge.textContent = `ЦИКЛ #${state.iteration}`;
    }
    if (simStatus) {
      if (state.flags.matrixRevealed) {
        simStatus.textContent = 'SIM_CORRUPTED';
        simStatus.style.borderColor = '#e63946';
        simStatus.style.color = '#e63946';
      } else if (state.flags.systemGlitchLevel > 1) {
        simStatus.textContent = 'SIM_UNSTABLE';
        simStatus.style.borderColor = '#f09235';
        simStatus.style.color = '#f09235';
      } else {
        simStatus.textContent = 'SIM_ACTIVE';
        simStatus.style.borderColor = '#2cdbf0';
        simStatus.style.color = '#2cdbf0';
      }
    }
  });
}

// Start application on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
