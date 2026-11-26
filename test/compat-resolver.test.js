import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, kindOf } from '../src/core/compat/kinds.js';
import { createReport } from '../src/core/compat/report.js';
import { createResolver, dedupeElements } from '../src/core/compat/resolve.js';

const node = (id) => ({ nodeType: 1, id, contains: () => false });
const profile = (id, api) => ({ id, detect: () => false, api, css: {} });

test('kindOf throws on unknown capability', () => {
  assert.throws(() => kindOf('nope'), /unknown capability/);
});

test('page-list unions profiles and removes nested duplicates', () => {
  const a = node('a');
  const b = node('b');
  a.contains = (x) => x === b;
  const modern = profile('modern', { getArticles: () => [a, b] });
  const legacy = profile('legacy', { getArticles: () => [b] });
  const resolver = createResolver({ profiles: [modern, legacy], report: createReport() });
  resolver.setActive('modern');
  assert.deepEqual(resolver.resolve('getArticles', [{}]), [a]);
});

test('element-single uses the owner profile and accepts a null answer', () => {
  const article = node('article');
  const modern = profile('modern', { getArticles: () => [article], getPostText: () => null });
  const legacy = profile('legacy', { getPostText: () => node('false-positive') });
  const resolver = createResolver({ profiles: [modern, legacy], report: createReport() });
  resolver.setActive('modern');
  resolver.resolve('getArticles', [{}]);
  assert.equal(resolver.resolve('getPostText', [article]), null);
});

test('predicate false on an owned element never falls back', () => {
  const article = node('article');
  const modern = profile('modern', { getArticles: () => [article], isPromotedArticle: () => false });
  const legacy = profile('legacy', { isPromotedArticle: () => true });
  const resolver = createResolver({ profiles: [modern, legacy], report: createReport() });
  resolver.setActive('modern');
  resolver.resolve('getArticles', [{}]);
  assert.equal(resolver.resolve('isPromotedArticle', [article]), false);
});

test('element-list does not union across profiles', () => {
  const article = node('article');
  const modern = profile('modern', { getArticles: () => [article], getMediaHosts: () => [] });
  const legacy = profile('legacy', { getMediaHosts: () => [{ el: node('media') }] });
  const resolver = createResolver({ profiles: [modern, legacy], report: createReport() });
  resolver.setActive('modern');
  resolver.resolve('getArticles', [{}]);
  assert.deepEqual(resolver.resolve('getMediaHosts', [article]), []);
});

test('undefined falls back, but an exception in one profile does not block', () => {
  const modern = profile('modern', { getNav: () => undefined });
  const legacy = profile('legacy', { getNav: () => { throw new Error('boom'); } });
  const report = createReport();
  const resolver = createResolver({ profiles: [modern, legacy], report });
  resolver.setActive('modern');
  assert.equal(resolver.resolve('getNav', [{}]), null);
  assert.equal(report.snapshot().errors.length, 1);
});

test('page-single records a miss once', () => {
  const modern = profile('modern', { getNav: () => null });
  const legacy = profile('legacy', { getNav: () => null });
  const report = createReport();
  const resolver = createResolver({ profiles: [modern, legacy], report });
  resolver.setActive('modern');
  resolver.resolve('getNav', [{}]);
  resolver.resolve('getNav', [{}]);
  assert.deepEqual(report.snapshot().misses, ['getNav']);
});

test('predicate undefined on an owned element falls back, false is final', () => {
  const article = node('article');
  const modern = profile('modern', { getArticles: () => [article], isPromotedArticle: () => undefined });
  const legacy = profile('legacy', { isPromotedArticle: () => true });
  const resolver = createResolver({ profiles: [modern, legacy], report: createReport() });
  resolver.setActive('modern');
  resolver.resolve('getArticles', [{}]);
  assert.equal(resolver.resolve('isPromotedArticle', [article]), true);
});

test('a disconnected element is not treated as owned', () => {
  const stale = node('stale');
  stale.isConnected = false;
  const fresh = node('fresh');
  const modern = profile('modern', { getArticles: () => [stale], getPostText: () => null });
  const legacy = profile('legacy', { getPostText: () => fresh });
  const resolver = createResolver({ profiles: [modern, legacy], report: createReport() });
  resolver.setActive('modern');
  resolver.resolve('getArticles', [{}]);
  assert.equal(resolver.resolve('getPostText', [stale]).id, 'fresh');
});

test('the resolver reports misses to the logger', () => {
  const seen = [];
  const logger = { miss: (key) => seen.push(key) };
  const resolver = createResolver({
    profiles: [profile('modern', { getNav: () => null }), profile('legacy', { getNav: () => null })],
    report: createReport(),
    logger,
  });
  resolver.setActive('modern');
  resolver.resolve('getNav', [{}]);
  resolver.resolve('getNav', [{}]);
  assert.deepEqual(seen, ['getNav']);
});

test('a missing capability is not applicable, not an error', () => {
  const report = createReport();
  const modern = profile('modern', {});
  const legacy = profile('legacy', { getNav: () => node('nav') });
  const resolver = createResolver({ profiles: [modern, legacy], report });
  resolver.setActive('modern');
  assert.equal(resolver.resolve('getNav', [{}]).id, 'nav');
  assert.equal(report.snapshot().errors.length, 0);
});

test('element capabilities are cached until owners are cleared', () => {
  const article = node('article');
  let calls = 0;
  const modern = profile('modern', {
    getArticles: () => [article],
    getPostText: () => { calls += 1; return node('text'); },
  });
  const resolver = createResolver({ profiles: [modern], report: createReport() });
  resolver.setActive('modern');
  resolver.resolve('getArticles', [{}]);
  const first = resolver.resolve('getPostText', [article]);
  assert.equal(resolver.resolve('getPostText', [article]), first);
  assert.equal(calls, 1);
  resolver.clearOwners();
  resolver.resolve('getPostText', [article]);
  assert.equal(calls, 2);
});

test('dedupeElements removes descendants', () => {
  const a = node('a');
  const b = node('b');
  a.contains = (x) => x === b;
  assert.deepEqual(dedupeElements([a, b, a]), [a]);
});
