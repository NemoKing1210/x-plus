import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultOf,
  defaultsOf,
  field,
  getPath,
  normalizeField,
  normalizeFields,
  setPath,
} from '../src/core/schema.js';

test('bool / enum / int / text normalization', () => {
  assert.equal(normalizeField(field.bool(true), undefined), true);
  assert.equal(normalizeField(field.bool(true), 'yes'), true); // non-boolean → default
  assert.equal(normalizeField(field.enum(['a', 'b'], 'a'), 'b'), 'b');
  assert.equal(normalizeField(field.enum(['a', 'b'], 'a'), 'c'), 'a');

  const int = field.int(10, { min: 5, max: 20 });
  assert.equal(normalizeField(int, '12'), 12);
  assert.equal(normalizeField(int, 12.6), 13);
  assert.equal(normalizeField(int, 1), 5);
  assert.equal(normalizeField(int, 99), 20);
  assert.equal(normalizeField(int, ''), 10);

  const text = field.text('x', { max: 3 });
  assert.equal(normalizeField(text, '  abcd  '), 'abc');
  assert.equal(normalizeField(text, 42), 'x');
});

test('url fields accept only absolute http(s) URLs', () => {
  const url = field.url('https://api.example.com/v1');
  assert.equal(normalizeField(url, 'https://api.example.com/v1'), 'https://api.example.com/v1');
  assert.equal(normalizeField(url, 'http://localhost:8080/'), 'http://localhost:8080/');
  assert.equal(normalizeField(url, ''), '');
  assert.equal(normalizeField(url, 'javascript:alert(1)'), 'https://api.example.com/v1');
  assert.equal(normalizeField(url, 'ftp://example.com'), 'https://api.example.com/v1');
  assert.equal(normalizeField(url, 'not a url'), 'https://api.example.com/v1');
});

test('lists are normalized, deduplicated and sorted', () => {
  const list = field.list('handle');
  assert.deepEqual(normalizeField(list, ['@B', 'a', 'b', 'https://x.com/C']), ['a', 'b', 'c']);
  assert.deepEqual(normalizeField(list, null), []);

  const lang = field.list('lang');
  assert.deepEqual(normalizeField(lang, ['EN', 'en', 'pt_BR']), ['en', 'pt-br']);
});

test('records and defaults are deep copies', () => {
  const fields = {
    enabled: field.bool(true),
    nested: field.record({ name: field.text('x'), tags: field.list('text', ['a']) }),
  };
  const defaults = defaultsOf(fields);
  assert.deepEqual(defaults, { enabled: true, nested: { name: 'x', tags: ['a'] } });

  defaults.nested.tags.push('b');
  assert.deepEqual(defaultOf(fields.nested).tags, ['a']);

  assert.deepEqual(normalizeFields(fields, { nested: { name: ' y ', extra: 1 } }), {
    enabled: true,
    nested: { name: 'y', tags: ['a'] },
  });
});

test('getPath / setPath', () => {
  const object = {};
  setPath(object, 'a.b.c', 1);
  assert.deepEqual(object, { a: { b: { c: 1 } } });
  assert.equal(getPath(object, 'a.b.c'), 1);
  assert.equal(getPath(object, 'a.missing.c'), undefined);
});
