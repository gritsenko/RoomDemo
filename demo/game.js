/**
 * 2D Cyberpunk Point-and-Click Quest Prototype
 * Interactive Sprite Demo & Controller
 */

// Web Audio API Synthesizer for Retro SFX
const SoundFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
  },
  playBleep(freq = 440, duration = 0.08, type = 'sine') {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch(e) {}
  },
  doorSound() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch(e) {}
  },
  typeSound() {
    this.playBleep(520 + Math.random() * 80, 0.03, 'triangle');
  }
};

// Game State
const Game = {
  hero: {
    el: null,
    x: 800,
    y: 422,
    speed: 4,
    targetX: 800,
    facing: 'right',
    isMoving: false,
    minX: 740, // Bounds inside room (near door)
    maxX: 1040 // Bounds inside room (near bed)
  },
  keys: {
    left: false,
    right: false
  },
  dialogueTimer: null,
  activeItem: null,

  init() {
    this.hero.el = document.getElementById('hero');
    this.setupResize();
    this.setupInput();
    this.setupInteractions();
    this.setupUI();
    this.loadSpriteGallery();
    this.gameLoop();

    this.typeDialogue("Место где день начинается, и... заканчивается");
  },

  setupResize() {
    const stage = document.getElementById('stage');
    const wrapper = document.getElementById('viewportWrapper');

    const updateScale = () => {
      const w = wrapper.clientWidth;
      const h = wrapper.clientHeight;
      const scale = Math.min(w / 1920, h / 1080);
      stage.style.transform = `scale(${scale})`;
    };

    window.addEventListener('resize', updateScale);
    updateScale();
  },

  setupInput() {
    window.addEventListener('keydown', (e) => {
      SoundFX.init();
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        this.keys.left = true;
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        this.keys.right = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        this.keys.left = false;
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        this.keys.right = false;
      }
    });

    // Click on room floor to walk
    const roomBg = document.getElementById('roomBg');
    roomBg.addEventListener('click', (e) => {
      SoundFX.init();
      const rect = roomBg.getBoundingClientRect();
      const scale = rect.width / 540;
      const clickXInRoom = (e.clientX - rect.left) / scale;
      // Room left is 655 in global coords
      const targetGlobalX = 655 + clickXInRoom - 32;
      this.hero.targetX = Math.max(this.hero.minX, Math.min(this.hero.maxX, targetGlobalX));
    });
  },

  setupInteractions() {
    const door = document.getElementById('propDoor');
    const fridge = document.getElementById('propFridge');
    const bed = document.getElementById('propBed');
    const shelves = document.getElementById('propShelves');
    const heroEl = document.getElementById('hero');

    door.addEventListener('click', () => {
      SoundFX.doorSound();
      door.classList.toggle('open');
      if (door.classList.contains('open')) {
        this.typeDialogue("Гермодверь Отсека 07 открыта. За ней — шлюзовой коридор.");
      } else {
        this.typeDialogue("Гермодверь Отсека 07 заблокирована. Требуется протокол доступа.");
      }
    });

    fridge.addEventListener('click', () => {
      SoundFX.playBleep(320, 0.15, 'sawtooth');
      fridge.classList.toggle('open');
      if (fridge.classList.contains('open')) {
        this.typeDialogue("Криокапсула открыта: внутри охлаждаются ампулы стимуляторов и батарея.");
      } else {
        this.typeDialogue("Холодильный модуль перешёл в режим термоизоляции.");
      }
    });

    bed.addEventListener('click', () => {
      SoundFX.playBleep(280, 0.12, 'sine');
      this.typeDialogue("Спальное место. Смятый термоплед. Спать пока некогда.");
    });

    shelves.addEventListener('click', () => {
      SoundFX.playBleep(440, 0.1, 'sine');
      this.typeDialogue("Настенные полки: пустые банки синтетических пайков и сервисные кабели.");
    });

    heroEl.addEventListener('click', () => {
      SoundFX.playBleep(600, 0.1, 'sine');
      this.typeDialogue("Идентификатор субъекта: Лилит. Статус: Норма (пульс 78).");
    });
  },

  setupUI() {
    // Gallery Modal toggle
    const galleryBtn = document.getElementById('galleryBtn');
    const galleryModal = document.getElementById('galleryModal');
    const closeModal = document.getElementById('closeModal');
    galleryBtn.addEventListener('click', () => {
      galleryModal.classList.add('active');
    });
    closeModal.addEventListener('click', () => {
      galleryModal.classList.remove('active');
    });

    // Slots click
    const slots = document.querySelectorAll('.slot');
    slots.forEach(slot => {
      slot.addEventListener('click', () => {
        SoundFX.playBleep(660, 0.08, 'sine');
        slots.forEach(s => s.classList.remove('active'));
        slot.classList.add('active');
        const itemName = slot.getAttribute('data-name');
        this.typeDialogue(`Выбран предмет: [${itemName}]`);
      });
    });

    // D-Pad buttons
    const dpadButtons = document.querySelectorAll('.dpad-btn');
    dpadButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        SoundFX.playBleep(580, 0.1, 'sine');
        const action = btn.getAttribute('data-action');
        this.typeDialogue(`Режим действия переключен: [${action}]`);
      });
    });

    // Portrait click
    const portrait = document.getElementById('hudPortrait');
    portrait.addEventListener('click', () => {
      SoundFX.playBleep(700, 0.1, 'sine');
      this.typeDialogue("Лилит: «Надо проверить шлюз и запустить диагностику реактора.»");
    });

    // Backpack click
    const backpack = document.getElementById('hudBackpack');
    backpack.addEventListener('click', () => {
      SoundFX.playBleep(480, 0.12, 'square');
      this.typeDialogue("Инвентарь: 3/12 слотов занято. В наличии ключ-карта, энергоячейка и стимулятор.");
    });
  },

  typeDialogue(text) {
    const el = document.getElementById('dialogueText');
    if (this.dialogueTimer) clearInterval(this.dialogueTimer);
    el.textContent = "";
    let i = 0;
    this.dialogueTimer = setInterval(() => {
      if (i < text.length) {
        el.textContent += text[i];
        if (i % 2 === 0) SoundFX.typeSound();
        i++;
      } else {
        clearInterval(this.dialogueTimer);
      }
    }, 28);
  },

  gameLoop() {
    const update = () => {
      let moving = false;
      if (this.keys.left) {
        this.hero.x -= this.hero.speed;
        this.hero.facing = 'left';
        this.hero.targetX = this.hero.x;
        moving = true;
      } else if (this.keys.right) {
        this.hero.x += this.hero.speed;
        this.hero.facing = 'right';
        this.hero.targetX = this.hero.x;
        moving = true;
      } else if (Math.abs(this.hero.targetX - this.hero.x) > 3) {
        // Smooth click-to-walk
        if (this.hero.targetX < this.hero.x) {
          this.hero.x -= this.hero.speed;
          this.hero.facing = 'left';
        } else {
          this.hero.x += this.hero.speed;
          this.hero.facing = 'right';
        }
        moving = true;
      }

      // Constrain inside room
      this.hero.x = Math.max(this.hero.minX, Math.min(this.hero.maxX, this.hero.x));

      // Update DOM
      this.hero.el.style.left = `${this.hero.x}px`;
      if (this.hero.facing === 'left') {
        this.hero.el.classList.add('facing-left');
      } else {
        this.hero.el.classList.remove('facing-left');
      }

      if (moving) {
        this.hero.el.classList.add('walking');
        if (Math.random() < 0.08) {
          SoundFX.playBleep(160 + Math.random() * 30, 0.04, 'square');
        }
      } else {
        this.hero.el.classList.remove('walking');
      }

      requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  },

  loadSpriteGallery() {
    fetch('../assets/sprites_metadata.json')
      .then(res => res.json())
      .then(data => {
        const grid = document.getElementById('galleryGrid');
        grid.innerHTML = "";

        const allSprites = [];
        for (const [key, item] of Object.entries(data.sprites)) {
          allSprites.push({ name: key, ...item });
        }
        if (data.items) {
          for (const [key, item] of Object.entries(data.items)) {
            allSprites.push({ name: key, ...item });
          }
        }

        allSprites.forEach(s => {
          const card = document.createElement('div');
          card.className = 'sprite-card';
          const sizeText = s.width && s.height ? `${s.width} × ${s.height} px` : (s.frame_width ? `${s.frame_width}×${s.frame_height} (4 frames)` : 'Item');
          card.innerHTML = `
            <div class="sprite-preview">
              <img src="../assets/${s.file}" alt="${s.name}">
            </div>
            <div class="sprite-name">${s.name}</div>
            <div class="sprite-meta">${sizeText}</div>
            <div class="sprite-meta" style="font-size: 10px; color: #4e6d87; text-align: center;">${s.description || s.file}</div>
          `;
          grid.appendChild(card);
        });
      })
      .catch(err => {
        console.error("Could not load sprites_metadata.json", err);
      });
  }
};

window.addEventListener('DOMContentLoaded', () => {
  Game.init();
});
