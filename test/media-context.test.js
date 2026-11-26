import assert from 'node:assert/strict';
import test from 'node:test';
import { mediaHostAt, postContext, statusId } from '../src/features/media/context.js';

function link(href) {
  return { getAttribute: (name) => (name === 'href' ? href : null) };
}

test('postContext reads the post author, time and text from the compat layer', () => {
  const article = {};
  const text = { textContent: 'hello world' };
  const time = { getAttribute: (name) => (name === 'datetime' ? '2026-11-26T10:00:00.000Z' : null) };
  const timeLink = { ...link('/author/status/123'), querySelector: (selector) => (selector === 'time' ? time : null) };
  const api = {
    getTimeLink: (node) => (node === article ? timeLink : null),
    getPostText: (node) => (node === article ? text : null),
  };

  assert.deepEqual(postContext(article, null, 'main', api), {
    id: '123',
    user: 'author',
    createdAt: '2026-11-26T10:00:00.000Z',
    text: 'hello world',
  });
});

test('postContext reads a quoted post through its quote card', () => {
  const article = {};
  const host = {};
  const quoteText = { textContent: 'quoted words' };
  const card = { querySelectorAll: () => [link('/quoted/status/9'), link('/quoted')] };
  const api = {
    getQuoteCard: (node, owner) => (node === host && owner === article ? card : null),
    getTextRoots: (scope) => (scope === card ? [quoteText] : []),
  };

  assert.deepEqual(postContext(article, host, 'quote', api), {
    id: '',
    user: 'quoted',
    createdAt: '',
    text: 'quoted words',
  });
});

test('postContext leaves a quoted post empty when its card cannot be found', () => {
  const api = { getQuoteCard: () => null };

  assert.deepEqual(postContext({}, {}, 'quote', api), { id: '', user: '', createdAt: '', text: '' });
});

test('statusId falls back to the page path when the post has no time link', () => {
  assert.equal(statusId('/someone/status/7', '/home'), '7');
  assert.equal(statusId('', '/someone/status/42'), '42');
  assert.equal(statusId('', '/home'), '');
});

test('mediaHostAt finds the media host that contains the click', () => {
  const article = {};
  const img = {};
  const photo = { el: { contains: (node) => node === img }, kind: 'photo', owner: 'main' };
  const video = { el: { contains: () => false }, kind: 'video', owner: 'main' };
  const api = {
    getPostArticle: (node) => (node === img ? article : null),
    getMediaHosts: (node) => (node === article ? [photo, video] : []),
  };

  assert.deepEqual(mediaHostAt(img, api), { article, host: photo });
});

test('mediaHostAt ignores clicks outside any media host', () => {
  const article = {};
  const elsewhere = {};
  const api = {
    getPostArticle: () => article,
    getMediaHosts: () => [{ el: { contains: () => false }, kind: 'photo', owner: 'main' }],
  };

  assert.equal(mediaHostAt(elsewhere, api), null);
});

test('mediaHostAt needs a post article around the click', () => {
  assert.equal(mediaHostAt({}, { getPostArticle: () => null }), null);
});
