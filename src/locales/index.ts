import de from './de.ts';
import en from './en.ts';
import es from './es.ts';
import fr from './fr.ts';
import it from './it.ts';
import nl from './nl.ts';
import pt from './pt.ts';
import sv from './sv.ts';
import type { Locale } from './types.ts';

export type { Locale };

/* The texts of one language, bound to it: numbers, plurals and placeholders
   are already taken care of. */
export type Phrases = Omit<Locale, 'dir' | 'agents' | 'layers' | 'built'> & {
  language: string;
  dir: 'ltr' | 'rtl';
  agents: (count: number) => string;
  layers: (done: number, total: number) => string;
  built: (seconds: number) => string;
};

const TEXTS = ['kicker', 'label', 'cta', 'layers', 'pause', 'resume', 'finish', 'started', 'built', 'finished'] as const;
const PLACEHOLDERS = { layers: ['done', 'total'], built: ['seconds'] } as const;

const freeze = (texts: Locale): Locale => Object.freeze({ ...texts, agents: Object.freeze({ ...texts.agents }) });

const registry = new Map<string, Locale>(Object.entries({ de, en, es, fr, it, nl, pt, sv })
  .map(([tag, texts]) => [tag, freeze(texts)]));

function canonical(tag: unknown): string | null {
  try {
    return Intl.getCanonicalLocales(String(tag ?? '').trim().replaceAll('_', '-'))[0]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export const languages = (): string[] => [...registry.keys()];

/* The nearest registered language for a BCP 47 tag, dropping subtags from
   the end: pt-BR tries pt-br, then pt. Anything else gets English. */
export function resolveLocale(tag: string | null | undefined): string {
  const parts = canonical(tag)?.split('-') ?? [];
  for (let length = parts.length; length > 0; length -= 1) {
    const candidate = parts.slice(0, length).join('-');
    if (registry.has(candidate)) {
      return candidate;
    }
  }
  return 'en';
}

/* What keeps a set of texts from being a language: a missing text or
   placeholder, or a disclosure that does not open the label and both
   announcements and appear in the summary. */
export function problemsWith(texts: unknown): string[] {
  if (!texts || typeof texts !== 'object') {
    return ['are not an object'];
  }
  const given = texts as Record<string, unknown>;
  const missing: string[] = TEXTS.filter((key) => typeof given[key] !== 'string' || given[key].trim() === '');
  const agents = given.agents as Record<string, unknown> | null | undefined;
  if (typeof agents?.other !== 'string' || !agents.other.includes('{count}')) {
    missing.push('agents.other with {count}');
  }
  if (missing.length > 0) {
    return [`lack ${missing.join(', ')}`];
  }
  const { kicker, label, started, finished, built, dir } = given as unknown as Locale;
  const problems = [label, started, finished]
    .filter((text) => !text.startsWith(kicker))
    .map((text) => `"${text}" does not open with "${kicker}"`);
  if (!built.toLocaleLowerCase().includes(kicker.toLocaleLowerCase())) {
    problems.push(`built does not say "${kicker}"`);
  }
  for (const [key, names] of Object.entries(PLACEHOLDERS)) {
    for (const name of names.filter((placeholder) => !(given[key] as string).includes(`{${placeholder}}`))) {
      problems.push(`${key} lacks {${name}}`);
    }
  }
  if (dir !== undefined && dir !== 'ltr' && dir !== 'rtl') {
    problems.push('dir is neither "ltr" nor "rtl"');
  }
  return problems;
}

/* Registers or replaces a language. Throws when the tag is not a language
   tag or the texts would not declare the simulation. */
export function addLocale(tag: string, texts: Locale): void {
  const key = canonical(tag);
  if (!key) {
    throw new TypeError(`agent-build: "${tag}" is not a language tag`);
  }
  const problems = problemsWith(texts);
  if (problems.length > 0) {
    throw new TypeError(`agent-build: the "${tag}" texts ${problems.join('; ')}`);
  }
  registry.set(key, freeze(texts));
}

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

export function phrasesFor(tag: string | null | undefined): Phrases {
  const language = resolveLocale(tag);
  const texts: Locale = registry.get(language) ?? en;
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
  const plural = new Intl.PluralRules(language);
  return {
    ...texts,
    language,
    dir: texts.dir ?? 'ltr',
    agents: (count) => fill(texts.agents[plural.select(count)] ?? texts.agents.other, { count: number.format(count) }),
    layers: (done, total) => fill(texts.layers, { done: number.format(done), total: number.format(total) }),
    built: (seconds) => fill(texts.built, { seconds: number.format(seconds) }),
  };
}
