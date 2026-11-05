import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES as TEXTS, resolveLanguage } from '../../src/locales/index.ts';

/* The disclosure each language has to open with. Changing one of these is a
   change in what the library claims to be. */
const DISCLOSURES = {
  es: 'Simulación',
  en: 'Simulation',
  fr: 'Simulation',
  de: 'Simulation',
  it: 'Simulazione',
  nl: 'Simulatie',
  sv: 'Simulering',
};

test('the page language picks the texts, and English is the fallback', () => {
  assert.equal(resolveLanguage('es'), 'es');
  assert.equal(resolveLanguage('es-MX'), 'es');
  assert.equal(resolveLanguage('EN-gb'), 'en');
  assert.equal(resolveLanguage(' sv-SE '), 'sv');
  assert.equal(resolveLanguage('pt-BR'), 'en');
  assert.equal(resolveLanguage(''), 'en');
  assert.equal(resolveLanguage(undefined), 'en');
});

test('it ships exactly the seven languages it discloses in', () => {
  assert.deepEqual(Object.keys(TEXTS).sort(), Object.keys(DISCLOSURES).sort());
});

test('every language has every text', () => {
  const keys = Object.keys(TEXTS.en).sort();
  for (const [language, text] of Object.entries(TEXTS)) {
    assert.deepEqual(Object.keys(text).sort(), keys, language);
    for (const [key, value] of Object.entries(text)) {
      const sample = typeof value === 'function' ? value(3, 9) : value;
      assert.ok(String(sample).trim().length > 0, `${language}.${key}`);
    }
  }
});

test('it calls itself a simulation in every language', () => {
  for (const [language, word] of Object.entries(DISCLOSURES)) {
    const text = TEXTS[language];
    assert.equal(text.kicker, word, `${language} kicker`);
    assert.ok(text.label.startsWith(word), `${language} label`);
    assert.ok(text.started.startsWith(word), `${language} announcement`);
    assert.ok(text.finished.startsWith(word), `${language} end announcement`);
    assert.ok(text.built('4,2').toLowerCase().includes(word.toLowerCase()), `${language} summary`);
  }
});

test('one agent is singular', () => {
  for (const [language, text] of Object.entries(TEXTS)) {
    assert.notEqual(text.agents(1).replace('1', ''), text.agents(2).replace('2', ''), language);
  }
});
