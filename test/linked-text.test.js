import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasTranslatablePlainText,
  linkToken,
  plainTextWithoutLinkTokens,
  restoreLinkedHtml,
  sanitizeHref,
} from '../src/utils/linked-text.js';

// `sanitizeHref` resolves relative URLs against the page origin.
globalThis.location = { origin: 'https://x.com' };

const links = [
  {
    href: 'https://example.com/a?x=1&y=2',
    text: 'example',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
  { href: '/profile', text: 'profile', target: '', rel: '' },
];

test('links are restored from tokens and escaped', () => {
  const input = `look ${linkToken(0)} and ${linkToken(1)} <b>`;
  const html = restoreLinkedHtml(input, links);
  assert.match(html, /<a href="https:\/\/example\.com\/a\?x=1&amp;y=2"/);
  assert.match(html, /<a href="\/profile">profile<\/a>/);
  assert.match(html, /&lt;b&gt;/);
  assert.doesNotMatch(html, /<b>/);
});

test('a dropped token is appended so the link is not lost', () => {
  const html = restoreLinkedHtml('translated only', links);
  assert.match(html, /href="https:\/\/example\.com/);
  assert.match(html, /href="\/profile"/);
});

test('only the requested fallback links are appended', () => {
  const html = restoreLinkedHtml('x', links, { only: [1] });
  assert.doesNotMatch(html, /example\.com/);
  assert.match(html, /\/profile/);
});

test('sanitizeHref rejects script and unknown schemes', () => {
  assert.equal(sanitizeHref('javascript:alert(1)'), null);
  assert.equal(sanitizeHref('data:text/html,x'), null);
  assert.equal(sanitizeHref('https://example.com'), 'https://example.com/');
  assert.equal(sanitizeHref('/relative'), '/relative');
  assert.equal(sanitizeHref('#hash'), '#hash');
  assert.equal(sanitizeHref(''), null);
});

test('plain-text checks skip links, emoji and punctuation only', () => {
  const onlyLinks = `${linkToken(0)} ${linkToken(1)}`;
  assert.equal(plainTextWithoutLinkTokens(onlyLinks), '');
  assert.equal(hasTranslatablePlainText(onlyLinks), false);
  assert.equal(hasTranslatablePlainText('😂😂 123 !!!'), false);
  assert.equal(hasTranslatablePlainText('Привет'), true);
  assert.equal(hasTranslatablePlainText('こんにちは'), true);
  assert.equal(hasTranslatablePlainText('Hello'), true);
});
