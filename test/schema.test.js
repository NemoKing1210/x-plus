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

test('records normalize items, cap the list and generate ids', () => {
  const conditionFields = {
    field: field.enum(['text'], 'text'),
    op: field.text('contains'),
    value: field.text(''),
  };
  const ruleFields = {
    id: field.text('', { max: 40 }),
    name: field.text(''),
    conditions: field.records(conditionFields, { max: 1, idKey: null }),
  };
  const spec = field.records(ruleFields, { max: 2, idPrefix: 'r' });

  const out = normalizeField(spec, [
    { name: ' a ', conditions: [{ field: 'text', op: 'contains', value: 'x', junk: 1 }, { field: 'text', op: 'contains', value: 'y' }], junk: true },
    { id: 'bad id !', name: 'b' },
    { name: 'c' },
    null,
    'nope',
  ]);

  assert.equal(out.length, 2);
  assert.equal(out[0].name, 'a');
  assert.equal(out[0].conditions.length, 1); // nested max
  assert.deepEqual(Object.keys(out[0].conditions[0]).sort(), ['field', 'op', 'value']);
  assert.match(out[0].id, /^r-[a-z0-9]+$/);
  assert.match(out[1].id, /^r-[a-z0-9]+$/);
  assert.notEqual(out[0].id, out[1].id);
});

test('records keep valid unique ids and run sanitizeItem', () => {
  const spec = field.records(
    { id: field.text(''), value: field.text('') },
    { sanitizeItem: (item) => ({ ...item, value: item.value === 'bad' ? '' : item.value }) },
  );
  const out = normalizeField(spec, [
    { id: 'keep-me', value: 'ok' },
    { id: 'keep-me', value: 'bad' },
  ]);
  assert.equal(out[0].id, 'keep-me');
  assert.notEqual(out[1].id, 'keep-me');
  assert.equal(out[1].value, '');
});

test('records default to a fresh empty array', () => {
  const spec = field.records({ id: field.text('') });
  const a = defaultOf(spec);
  const b = defaultOf(spec);
  assert.deepEqual(a, []);
  assert.notEqual(a, b);
  assert.deepEqual(normalizeField(spec, 'not an array'), []);
});
