// Every text has both languages: the Swedish and English tables in strings.js have the same
// keys, and each placeholder {name} in a Swedish text is in its English text too.
//   node --test tools/test_strings.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import '../strings.js';

const {sv, en} = globalThis.STRINGS;
const holes = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

test('sv and en have the same keys', () => {
  assert.deepEqual(Object.keys(en).filter(k => !(k in sv)), [], 'only in en');
  assert.deepEqual(Object.keys(sv).filter(k => !(k in en)), [], 'only in sv');
});

test('sv and en fill in the same placeholders', () => {
  for (const k of Object.keys(sv)) if (k in en) assert.deepEqual(holes(en[k]), holes(sv[k]), k);
});

test('no text is empty', () => {
  for (const [lang, table] of Object.entries(globalThis.STRINGS))
    for (const [k, v] of Object.entries(table)) assert.ok(v.trim(), `${lang} ${k}`);
});
