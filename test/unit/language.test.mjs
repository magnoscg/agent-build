import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { addLocale, languages, phrasesFor, problemsWith, resolveLocale } from '../../src/locales/index.ts';

/* The disclosure each language has to open with. Changing one of these is a
   change in what the library claims to be. */
const DISCLOSURES = {
  de: 'Simulation',
  en: 'Simulation',
  es: 'Simulación',
  fr: 'Simulation',
  it: 'Simulazione',
  nl: 'Simulatie',
  pt: 'Simulação',
  sv: 'Simulering',
};

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

const shipped = (await readdir(new URL('../../src/locales/', import.meta.url)))
  .filter((name) => /^[a-z-]+\.ts$/.test(name) && !['index.ts', 'types.ts'].includes(name))
  .map((name) => name.slice(0, -3))
  .sort();

const catalan = {
  kicker: 'Simulació',
  label: "Simulació: agents d'IA construint la pàgina",
  cta: 'Mira com els agents construeixen la pàgina',
  agents: { one: '{count} agent', other: '{count} agents' },
  layers: '{done}/{total} capes',
  pause: 'Pausa',
  resume: 'Continua',
  finish: 'Acaba',
  started: "Simulació en curs: un eixam d'agents d'IA està construint la pàgina. Prem Esc per acabar.",
  built: 'Construïda en {seconds} s · era una simulació',
  finished: 'Simulació acabada. La pàgina està completa.',
};

const arabic = {
  dir: 'rtl',
  kicker: 'محاكاة',
  label: 'محاكاة: وكلاء ذكاء اصطناعي يبنون الصفحة',
  cta: 'شاهد الوكلاء يبنون الصفحة',
  agents: { zero: 'لا وكلاء', one: 'وكيل واحد', two: 'وكيلان', few: '{count} وكلاء', many: '{count} وكيلًا', other: '{count} وكيل' },
  layers: '{done}/{total} طبقات',
  pause: 'إيقاف مؤقت',
  resume: 'متابعة',
  finish: 'إنهاء',
  started: 'محاكاة قيد التشغيل: سرب من وكلاء الذكاء الاصطناعي يبني الصفحة. اضغط Escape للإنهاء.',
  built: 'بُنيت في {seconds} ث · كانت محاكاة',
  finished: 'محاكاة: انتهت. الصفحة مكتملة.',
};

// MARK: - Shipped languages

test('it ships exactly the languages it discloses in', () => {
  assert.deepEqual(shipped, Object.keys(DISCLOSURES).sort());
  assert.deepEqual(languages().filter((tag) => shipped.includes(tag)).sort(), shipped);
});

test('the nearest shipped language wins, and English is the fallback', () => {
  assert.equal(resolveLocale('es'), 'es');
  assert.equal(resolveLocale('es-MX'), 'es');
  assert.equal(resolveLocale('EN-gb'), 'en');
  assert.equal(resolveLocale(' sv-SE '), 'sv');
  assert.equal(resolveLocale('pt-BR'), 'pt');
  assert.equal(resolveLocale('pt_PT'), 'pt');
  assert.equal(resolveLocale('nl-Latn-BE'), 'nl');
  assert.equal(resolveLocale('frr'), 'en');
  assert.equal(resolveLocale('not a tag'), 'en');
  assert.equal(resolveLocale(''), 'en');
  assert.equal(resolveLocale(undefined), 'en');
});

test('every shipped language passes the rule addLocale applies', async () => {
  for (const tag of shipped) {
    const { default: texts } = await import(`../../src/locales/${tag}.ts`);
    assert.deepEqual(problemsWith(texts), [], tag);
  }
});

test('it calls itself a simulation in every language', () => {
  for (const [tag, word] of Object.entries(DISCLOSURES)) {
    const text = phrasesFor(tag);
    assert.equal(text.kicker, word, `${tag} kicker`);
    assert.ok(text.label.startsWith(word), `${tag} label`);
    assert.ok(text.started.startsWith(word), `${tag} announcement`);
    assert.ok(text.finished.startsWith(word), `${tag} end announcement`);
    assert.ok(text.built(4.2).toLocaleLowerCase().includes(word.toLocaleLowerCase()), `${tag} summary`);
  }
});

test('one agent is singular in every language', () => {
  for (const tag of shipped) {
    const text = phrasesFor(tag);
    assert.notEqual(text.agents(1).replace('1', ''), text.agents(2).replace('2', ''), tag);
  }
});

test('numbers are written the way the language writes them', () => {
  assert.equal(phrasesFor('en').agents(1), '1 agent');
  assert.equal(phrasesFor('en').agents(12), '12 agents');
  assert.equal(phrasesFor('es').built(4.25), 'Montada en 4,3 s · era una simulación');
  assert.equal(phrasesFor('de').layers(1200, 3400), '1.200/3.400 Ebenen');
  assert.equal(phrasesFor('pt-BR').layers(3, 9), '3/9 camadas');
});

test('every shipped language is left-to-right', () => {
  for (const tag of shipped) {
    assert.equal(phrasesFor(tag).dir, 'ltr', tag);
  }
});

// MARK: - Documentation

test('the README table lists every shipped language with its disclosure', async () => {
  const readme = await read('README.md');
  const section = readme.slice(readme.indexOf('### Languages'), readme.indexOf('## How it picks the blocks'));
  const rows = [...section.matchAll(/^\| `([a-z-]+)` \| [^|]+ \| ([^|]+?) \|$/gm)];
  assert.deepEqual(rows.map(([, tag]) => tag).sort(), shipped);
  for (const [, tag, word] of rows) {
    assert.equal(word, DISCLOSURES[tag], tag);
  }
});

test('the demo offers every shipped language', async () => {
  const [page, script] = await Promise.all([read('index.html'), read('demo/demo.js')]);
  const links = [...page.matchAll(/data-demo-lang="([a-z-]+)"/g)].map(([, tag]) => tag).sort();
  const listed = JSON.parse(script.match(/const LANGUAGES = (\[[^\]]*\]);/)[1].replaceAll("'", '"')).sort();
  assert.deepEqual(links, shipped);
  assert.deepEqual(listed, shipped);
});

// MARK: - Adding a language

test('addLocale registers a language that discloses, and copies its texts', () => {
  const texts = structuredClone(catalan);
  addLocale('ca', texts);
  texts.kicker = 'Changed';
  texts.agents.other = 'changed';

  assert.equal(resolveLocale('ca-ES'), 'ca');
  assert.equal(phrasesFor('ca').kicker, 'Simulació');
  assert.equal(phrasesFor('ca-ES-valencia').agents(3), '3 agents');
  assert.ok(languages().includes('ca'));
});

test('addLocale accepts a right-to-left language and its plural forms', () => {
  addLocale('ar', arabic);

  const text = phrasesFor('ar-EG');
  assert.equal(text.language, 'ar');
  assert.equal(text.dir, 'rtl');
  assert.equal(text.agents(0), 'لا وكلاء');
  assert.equal(text.agents(2), 'وكيلان');
  assert.match(text.agents(5), /وكلاء$/);
});

test('addLocale refuses a language that would not disclose the simulation', () => {
  const without = ({ finished, ...rest }) => rest;
  const cases = [
    [{ ...catalan, label: "Agents d'IA construint la pàgina" }, /label does not open with "Simulació"/],
    [{ ...catalan, started: 'En curs.' }, /started does not open with "Simulació"/],
    [{ ...catalan, built: 'Construïda en {seconds} s' }, /built does not say "Simulació"/],
    [without(catalan), /missing finished/],
    [{ ...catalan, kicker: ' ' }, /missing kicker/],
    [{ ...catalan, agents: { one: '{count} agent' } }, /missing agents\.other with \{count\}/],
    [{ ...catalan, layers: '{done} capes' }, /layers lacks \{total\}/],
    [{ ...catalan, dir: 'up' }, /dir is neither/],
    [null, /not an object/],
  ];
  for (const [texts, message] of cases) {
    assert.throws(() => addLocale('xx', texts), { name: 'TypeError', message }, String(message));
  }
  assert.equal(resolveLocale('xx'), 'en');
});

test('a shipped language keeps its word, in every regional variant', () => {
  const spanish = phrasesFor('es');
  const demo = {
    ...catalan,
    kicker: 'Demo',
    label: 'Demo: agentes de IA',
    started: 'Demo en curso.',
    built: 'Montada en {seconds} s · demo',
    finished: 'Demo terminada.',
  };
  for (const tag of ['es', 'es-ES', 'ES_mx']) {
    assert.throws(() => addLocale(tag, demo), { name: 'TypeError', message: /kicker is not "Simulación", the word shipped for es/ }, tag);
  }
  assert.equal(phrasesFor('es-ES').kicker, spanish.kicker);

  addLocale('es-ES', { ...catalan, kicker: 'Simulación', label: 'Simulación: agentes de IA montando la página',
    started: 'Simulación en curso.', built: 'Montada en {seconds} s · era una simulación', finished: 'Simulación terminada.' });
  assert.equal(resolveLocale('es-ES'), 'es-es');
  assert.equal(resolveLocale('es-MX'), 'es');
});

test('addLocale refuses what is not a language tag', () => {
  for (const tag of ['', 'not a tag', 'e', '12']) {
    assert.throws(() => addLocale(tag, catalan), { name: 'TypeError', message: /is not a language tag/ }, tag);
  }
});
