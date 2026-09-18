export type ActionType = 'inspect' | 'use' | 'disassemble' | 'hack';

export interface CardItem {
  id: string;
  name: string;
  category: 'tool' | 'consumable' | 'hardware';
  description: string;
  iconCoord?: { x: number; y: number; w: number; h: number };
  iconUrl?: string;
  usesRemaining?: number;
}

export interface HotspotDef {
  id: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  cursor?: string;
  onInspect: () => void;
  onUseCard: (card: CardItem) => void;
  onDisassemble?: () => void;
  onHack?: () => void;
}

export interface GameFlags {
  doorInspected: boolean;
  wiresExposed: boolean;
  wiresInsulated: boolean;
  synthCleaned: boolean;
  hasKeycard: boolean;
  doorUnlocked: boolean;
  fridgeOpen: boolean;
  doorOpen: boolean;
  systemGlitchLevel: number;
  matrixRevealed: boolean;
}

export interface GameState {
  iteration: number;
  maxIterations: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  activeAction: ActionType;
  selectedCard: CardItem | null;
  deck: CardItem[];
  inventory: CardItem[];
  logMessage: string;
  flags: GameFlags;
}
