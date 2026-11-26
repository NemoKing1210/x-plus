import test from 'node:test';
import assert from 'node:assert/strict';
import legacy from '../src/core/compat/profiles/legacy.js';
import modern from '../src/core/compat/profiles/modern.js';
import { KINDS } from '../src/core/compat/kinds.js';

function recordingRoot() {
  const calls = [];
  return {
    calls,
    querySelector: (selector) => { calls.push(selector); return null; },
    querySelectorAll: (selector) => { calls.push(selector); return []; },
  };
}

test('legacy getArticles uses the legacy article selector', () => {
  const root = recordingRoot();
  legacy.api.getArticles(root);
  assert.ok(root.calls.includes('article[data-testid="tweet"]'));
});

test('legacy getTextRoots uses tweetText', () => {
  const root = recordingRoot();
  legacy.api.getTextRoots(root);
  assert.ok(root.calls.some((selector) => selector.includes('tweetText')));
});

test('legacy getPostCells uses cellInnerDiv', () => {
  const root = recordingRoot();
  legacy.api.getPostCells(root);
  assert.ok(root.calls.includes('[data-testid="cellInnerDiv"]'));
});

test('legacy getMediaHosts uses tweetPhoto and videoPlayer', () => {
  const root = recordingRoot();
  legacy.api.getMediaHosts(root);
  assert.ok(root.calls.some((selector) => selector.includes('tweetPhoto')));
  assert.ok(root.calls.some((selector) => selector.includes('videoPlayer')));
});

test('legacy getAttachments looks for quote, link, poll and article cards', () => {
  const root = recordingRoot();
  legacy.api.getAttachments(root);
  const joined = root.calls.join(' ');
  assert.ok(joined.includes('quoteTweet'));
  assert.ok(joined.includes('card.wrapper'));
  assert.ok(joined.includes('card.poll'));
  assert.ok(joined.includes('article-cover-image'));
});

test('legacy getVerifiedBadge uses the verified icon', () => {
  const root = recordingRoot();
  legacy.api.getVerifiedBadge(root);
  assert.ok(root.calls.includes('[data-testid="icon-verified"]'));
});

test('legacy getSocialContext reads the post cell', () => {
  const calls = [];
  const cell = {
    querySelector: (selector) => { calls.push(selector); return null; },
  };
  const root = {
    closest: (selector) => { calls.push(selector); return cell; },
  };
  assert.equal(legacy.api.getSocialContext(root), null);
  assert.ok(calls.includes('[data-testid="socialContext"]'));
});

test('legacy getNav uses AppTabBar', () => {
  const root = recordingRoot();
  legacy.api.getNav(root);
  assert.ok(root.calls.some((selector) => selector.includes('AppTabBar')));
});

test('legacy getNavItem maps the home row', () => {
  const root = recordingRoot();
  legacy.api.getNavItem(root, 'home');
  assert.ok(root.calls.includes('[data-testid="AppTabBar_Home_Link"]'));
});

test('legacy getMenus queries role=menu', () => {
  const root = recordingRoot();
  legacy.api.getMenus(root);
  assert.ok(root.calls.includes('[role="menu"]'));
});

test('legacy getSidebar uses sidebarColumn', () => {
  const root = recordingRoot();
  legacy.api.getSidebar(root);
  assert.ok(root.calls.includes('[data-testid="sidebarColumn"]'));
});

test('legacy getUserCells uses UserCell', () => {
  const root = recordingRoot();
  legacy.api.getUserCells(root);
  assert.ok(root.calls.includes('[data-testid="UserCell"]'));
});

test('legacy getComposer uses the inline textarea', () => {
  const root = recordingRoot();
  legacy.api.getComposer(root);
  assert.ok(root.calls.includes('[data-testid="tweetTextarea_0"]'));
});

test('legacy getViewerLayer uses the viewer test ids', () => {
  const root = recordingRoot();
  legacy.api.getViewerLayer(root);
  assert.ok(root.calls.some((selector) => selector.includes('swipe-to-dismiss')));
});

test('legacy getArticleBody uses the article body test id', () => {
  const root = recordingRoot();
  legacy.api.getArticleBody(root);
  assert.ok(root.calls.some((selector) => selector.includes('twitterArticleRichTextView')));
});

test('legacy getPrimaryColumn uses primaryColumn', () => {
  const root = recordingRoot();
  legacy.api.getPrimaryColumn(root);
  assert.ok(root.calls.includes('[data-testid="primaryColumn"]'));
});

test('legacy getOverlayRoots finds dialogs', () => {
  const root = recordingRoot();
  legacy.api.getOverlayRoots(root);
  assert.ok(root.calls.some((selector) => selector.includes('[role="dialog"]')));
});

test('legacy hasNativeAutoTranslate is false without a bar', () => {
  assert.equal(legacy.api.hasNativeAutoTranslate(recordingRoot()), false);
});

test('legacy css exposes the article and cell fragments', () => {
  assert.equal(legacy.css.article, 'article[data-testid="tweet"]');
  assert.equal(legacy.css.cell, '[data-testid="cellInnerDiv"]');
});

test('modern getArticles excludes nested quote articles', () => {
  const outer = { nodeType: 1, closest: () => null, parentElement: null, matches: () => false };
  const inner = { nodeType: 1, closest: (sel) => (sel === 'article' ? outer : null), parentElement: { closest: () => outer }, matches: () => false };
  const root = { querySelectorAll: () => [outer, inner] };
  assert.deepEqual(modern.api.getArticles(root), [outer]);
});

test('modern getTextRoots uses the whitespace-pre-wrap text root', () => {
  const root = recordingRoot();
  modern.api.getTextRoots(root);
  assert.ok(root.calls.some((selector) => selector.includes('whitespace-pre-wrap')));
});

test('modern getActionGroup returns the group with a reply action', () => {
  const article = {
    nodeType: 1,
    contains: () => true,
    querySelector: () => null,
    querySelectorAll: (selector) => (selector === '[role="group"]' ? [group] : []),
  };
  const group = {
    closest: (selector) => (selector === 'article' ? article : null),
    querySelector: (selector) => (selector === '[data-engagement-action="reply"]' ? {} : null),
  };
  assert.equal(modern.api.getActionGroup(article), group);
});

test('modern getMediaHosts keeps one video host per media block', () => {
  const video = { closest: (selector) => (selector === 'article' ? article : null), matches: (selector) => selector === 'video' };
  const host = {
    matches: () => false,
    querySelector: (selector) => (selector === 'video' ? video : null),
    closest: (selector) => (selector === 'article' ? article : null),
    contains: (node) => node === video,
  };
  const article = {
    querySelectorAll: (selector) => {
      if (selector === '[data-engagement-action="media"]') return [host];
      if (selector === 'video') return [video];
      return [];
    },
  };
  assert.deepEqual(modern.api.getMediaHosts(article), [{ el: host, kind: 'video', owner: 'main' }]);
});

test('modern getQuoteCard finds the embedded tweet frame', () => {
  const frame = {};
  const article = { contains: (node) => node === frame };
  const node = { closest: (selector) => (selector === '[data-slot="embedded-tweet-frame"]' ? frame : null) };
  assert.equal(modern.api.getQuoteCard(node, article), frame);
});

test('modern getQuoteCard derives the outer article around a quote frame', () => {
  const frame = {};
  const outer = { contains: (node) => node === frame };
  frame.parentElement = { closest: (selector) => (selector === 'article' ? outer : null) };
  const node = { closest: (selector) => (selector === '[data-slot="embedded-tweet-frame"]' ? frame : null) };
  assert.equal(modern.api.getQuoteCard(node), frame);
});

test('modern getMenus uses xds-menu-content', () => {
  const root = recordingRoot();
  modern.api.getMenus(root);
  assert.ok(root.calls.some((selector) => selector.includes('xds-menu-content')));
});

test('modern getNav finds the nav containing /home', () => {
  const nav = { querySelector: (selector) => (selector === 'a[href="/home"]' ? {} : null) };
  const root = { querySelectorAll: (selector) => (selector === 'nav' ? [nav] : []) };
  assert.equal(modern.api.getNav(root), nav);
});

test('modern getFeedTabs, getUserCells and getComposer pin the current markers', () => {
  const tabs = recordingRoot();
  modern.api.getFeedTabs(tabs);
  assert.ok(tabs.calls.some((selector) => selector.includes('tablist')));

  const cells = recordingRoot();
  modern.api.getUserCells(cells);
  assert.ok(cells.calls.includes('[data-who-to-follow]'));

  const composer = recordingRoot();
  modern.api.getComposer(composer);
  assert.ok(composer.calls.some((selector) => selector.includes('textarea[aria-label]')));
});

test('every profile implements every capability', () => {
  for (const profile of [legacy, modern]) {
    for (const key of Object.keys(KINDS)) {
      assert.equal(typeof profile.api[key], 'function', `${profile.id}.${key}`);
    }
  }
});

test('modern getAuthorHeader keeps the name row when the post has no status link', () => {
  const name = {};
  const header = {
    querySelector: (selector) => (selector === 'div[dir="auto"]' ? name : null),
  };
  const article = {
    nodeType: 1,
    contains: () => true,
    querySelector: () => null,
    querySelectorAll: (selector) => (selector === '[data-post-avatar]' ? [avatar] : []),
  };
  const avatar = { closest: (selector) => (selector === 'article' ? article : null) };
  header.parentElement = article;
  avatar.parentElement = header;
  assert.equal(modern.api.getAuthorHeader(article), header);
});
