import { clamp, toNumber } from './util.ts';
import { BUTTONISH, CONTROL_TAGS, FRAME_TAGS, MEDIA_TAGS, TEXT_TAGS } from './vocabulary.ts';

export interface Options {
  frames?: string;
  atoms?: string;
  pop?: string;
  hub?: string;
  pace?: number | string;
  count?: number | string;
  accent?: string;
}

export interface StartOptions extends Options {
  trigger?: Element | null;
}

export interface Config {
  frames: string;
  atoms: string;
  pop: string;
  hub: string;
  pace: number;
  count: number;
  accent: string;
}

export interface Env {
  isSelector?: (selector: string) => boolean;
  isColor?: (value: string) => boolean;
  warn?: (message: string) => void;
  narrow?: boolean;
}

export type RawOptions = { [Key in keyof Options]?: unknown };

/* A frame reveals only its own box (background, border and loose text) and
   its content comes later. An atom reveals everything inside it at once: pop
   atoms fade in, the rest are typed. */
export const DEFAULTS = Object.freeze({
  frames: FRAME_TAGS.join(', '),
  atoms: [...TEXT_TAGS, 'figure', ...MEDIA_TAGS, ...CONTROL_TAGS, 'a'].join(', '),
  pop: ['figure', ...MEDIA_TAGS, ...CONTROL_TAGS, BUTTONISH].join(', '),
  pace: 1,
});

export const AGENTS = Object.freeze({ wide: 20, narrow: 14, breakpoint: 720 });

/* A run builds for about twenty seconds, pauses aside, whatever the pace and
   count: then the rest of the page appears at once. The layer cap bounds the
   walk on huge pages, and settle bounds the wait for fonts and transitions
   before measuring. */
export const LIMITS = Object.freeze({
  pace: [0.25, 4],
  count: [1, 40],
  layers: 240,
  seconds: 20,
  settle: 1500,
} as const);

export const OPTION_KEYS = ['frames', 'atoms', 'pop', 'hub', 'pace', 'count', 'accent'] as const;

const provided = (value: unknown) => value !== undefined && value !== null && value !== '';

export function datasetOptions(element: { dataset?: DOMStringMap } | null | undefined): RawOptions {
  const data = element?.dataset ?? {};
  return {
    frames: data.agentFrames,
    atoms: data.agentAtoms,
    pop: data.agentPop,
    hub: data.agentHub,
    pace: data.agentPace,
    count: data.agentCount,
    accent: data.agentAccent,
  };
}

/* Options passed to start() win over the button's data attributes. */
export function mergeOptions(base: RawOptions, overrides: unknown): RawOptions {
  const merged: RawOptions = { ...base };
  if (overrides && typeof overrides === 'object') {
    const given = overrides as RawOptions;
    for (const key of OPTION_KEYS) {
      if (given[key] !== undefined && given[key] !== null) {
        merged[key] = given[key];
      }
    }
  }
  return merged;
}

/* A broken selector or colour falls back to the default with a warning
   instead of breaking the page, and numbers are clamped. */
export function normalizeOptions(raw?: RawOptions, env?: Env): Config {
  const source = raw ?? {};
  const isSelector = env?.isSelector ?? (() => true);
  const isColor = env?.isColor ?? (() => false);
  const warn = env?.warn ?? (() => {});

  const selector = (key: 'frames' | 'atoms' | 'pop'): string => {
    const value = source[key];
    if (typeof value !== 'string' || value.trim() === '') {
      return DEFAULTS[key];
    }
    if (isSelector(value)) {
      return value;
    }
    warn(`ignoring the invalid ${key} selector "${value}"`);
    return DEFAULTS[key];
  };

  const pace = toNumber(source.pace);
  if (provided(source.pace) && !(pace > 0)) {
    warn(`ignoring the invalid pace "${String(source.pace)}"`);
  }
  const count = toNumber(source.count);
  if (provided(source.count) && !(count >= 1)) {
    warn(`ignoring the invalid count "${String(source.count)}"`);
  }
  let accent = typeof source.accent === 'string' ? source.accent.trim() : '';
  if (accent && !isColor(accent)) {
    warn(`ignoring the invalid accent "${accent}"`);
    accent = '';
  }

  return {
    frames: selector('frames'),
    atoms: selector('atoms'),
    pop: selector('pop'),
    hub: typeof source.hub === 'string' ? source.hub.trim() : '',
    pace: pace > 0 ? clamp(pace, LIMITS.pace[0], LIMITS.pace[1]) : DEFAULTS.pace,
    count: count >= 1
      ? Math.round(clamp(count, LIMITS.count[0], LIMITS.count[1]))
      : (env?.narrow ? AGENTS.narrow : AGENTS.wide),
    accent,
  };
}
