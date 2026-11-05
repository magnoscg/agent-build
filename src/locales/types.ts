/* A language is plain data. Placeholders in braces are filled in at run time:
   {count} in agents, {done} and {total} in layers, {seconds} in built.
   `agents` holds one form per plural category of the language, as
   Intl.PluralRules names them, and always `other`.

   The kicker is the language's word for "simulation": the label and both
   announcements must open with it, and the summary must contain it.
   addLocale() refuses a language that breaks that rule. */
export interface Locale {
  dir?: 'ltr' | 'rtl';
  kicker: string;
  label: string;
  cta: string;
  agents: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
  layers: string;
  pause: string;
  resume: string;
  finish: string;
  started: string;
  built: string;
  finished: string;
}
