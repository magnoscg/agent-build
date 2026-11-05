import type { Layer } from '../layers.ts';
import type { Texts } from '../locales/index.ts';
import type { Config } from '../options.ts';

export interface Agent {
  element: HTMLElement;
  x: number;
  y: number;
}

export interface Hud {
  hud: HTMLElement;
  info: HTMLElement;
  layers: HTMLElement;
  fill: HTMLElement;
  pause: HTMLButtonElement;
  stop: HTMLButtonElement;
  live: HTMLElement;
}

export interface Gate {
  promise: Promise<void>;
  open: () => void;
}

export interface Run {
  config: Config;
  text: Texts;
  decimal: Intl.NumberFormat;
  pace: number;
  trigger: Element | null;
  returnFocus: Element | null;
  running: boolean;
  paused: boolean;
  following: boolean;
  animations: Set<Animation>;
  active: Set<Layer>;
  listeners: AbortController;
  layers: Layer[];
  queue: Layer[];
  marked: Element[];
  gates: Map<Layer, Gate>;
  opened: Set<Layer>;
  restIn: Map<Layer, Element[]>;
  built: number;
  frame: number;
  startedAt: number;
  pausedAt: number;
  pausedFor: number;
  width: number;
  stage: HTMLElement | null;
  ruler: HTMLElement | null;
  ui: Hud | null;
}
