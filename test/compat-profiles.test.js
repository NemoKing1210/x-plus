import test from 'node:test';
import assert from 'node:assert/strict';
import legacy from '../src/core/compat/profiles/legacy.js';
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
