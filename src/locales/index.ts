import de from './de.ts';
import en from './en.ts';
import es from './es.ts';
import fr from './fr.ts';
import it from './it.ts';
import nl from './nl.ts';
import sv from './sv.ts';
import type { Texts } from './types.ts';

export type { Texts };

export const LOCALES: Readonly<Record<string, Texts>> = Object.freeze({ de, en, es, fr, it, nl, sv });

export function resolveLanguage(lang: string | null | undefined): string {
  const code = String(lang || '').trim().slice(0, 2).toLowerCase();
  return Object.prototype.hasOwnProperty.call(LOCALES, code) ? code : 'en';
}
