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

function withPath(pathname, run) {
  const had = 'location' in globalThis;
  const previous = globalThis.location;
  globalThis.location = { pathname };
  try {
    return run();
  } finally {
    if (had) globalThis.location = previous;
    else delete globalThis.location;
  }
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

test('legacy css marks the sidebar trends and the slid-in panels', () => {
  assert.equal(legacy.css.trend, '[data-testid="trend"]');
  assert.equal(legacy.css.newPostsPill, '[data-testid="pillLabel"]');
  assert.equal(legacy.css.grokDrawer, '[data-testid="GrokDrawer"]');
  assert.equal(legacy.css.chatDrawer, '[data-testid="chat-drawer-root"]');
  assert.equal(legacy.css.showPostsButton, '[data-keep-composer-open] > button');
});

test('modern css marks the sidebar trends', () => {
  assert.equal(modern.css.trend, '[data-trend], a[href*="/search?q="]');
});

test('modern layout fragments do not also match the legacy markup', () => {
  // A legacy page's <main> wraps both columns: matching it would resize the whole row.
  assert.equal(modern.css.primaryColumn, 'main:not(:has([data-testid="primaryColumn"]))');
  // The legacy sidebar modules are <aside>s inside sidebarColumn: matching them pins each card.
  // A dialog can hold an <aside> too, and pinning that would freeze the photo viewer.
  assert.equal(
    modern.css.sidebarColumn,
    'aside:not([data-testid="sidebarColumn"] *):not([role="dialog"] *)',
  );
  // The sidebar footer nav also carries aria-label: only the nav with the Home row is the menu.
  // The legacy menu is inside the banner and has that row too, so the banner is excluded.
  assert.equal(
    modern.css.leftNav,
    'nav[aria-label]:has(a[href="/home"]):not(header[role="banner"] *)',
  );
  assert.equal(
    modern.css.navCenter,
    'nav[aria-label]:has(a[href="/home"]):not([data-testid]):not(header[role="banner"] *)',
  );
});

test('modern getSidebarBlock never widens a module to the whole sidebar', () => {
  // A plain card (the fixture's `div[data-who-to-follow]` before the marker is known)
  // resolves to the sidebar itself, which must not become the hidden block.
  const aside = { contains: () => true };
  const card = { closest: () => aside };
  assert.equal(modern.api.getSidebarBlock(card), null);
});

test('modern getSidebarBlock treats a who-to-follow card as the block', () => {
  const aside = { contains: () => true };
  const card = {
    closest: (selector) =>
      selector === 'aside' ? aside : String(selector).includes('[data-who-to-follow]') ? card : null,
  };
  assert.equal(modern.api.getSidebarBlock(card), card);
});

test('modern getInlineComposer returns the card around the composer form', () => {
  const card = { children: [], firstElementChild: null, querySelector: () => null };
  const form = { parentElement: card, closest: () => null };
  card.children = [form];
  card.firstElementChild = form;
  const field = { closest: (selector) => (selector === 'form' ? form : null) };
  assert.equal(modern.api.getInlineComposer({ querySelector: () => field }), card);
});

test('modern getInlineComposer ignores the composer of a dialog or a post', () => {
  const form = { parentElement: { children: [], querySelector: () => null }, closest: () => ({}) };
  const field = { closest: (selector) => (selector === 'form' ? form : null) };
  assert.equal(modern.api.getInlineComposer({ querySelector: () => field }), null);
});

test('modern css marks the Grok and chat dock windows', () => {
  assert.equal(modern.css.grokDrawer, '[data-slot="xds-dock-window"]:has(svg[data-icon="icon-logo-grok"])');
  assert.equal(modern.css.chatDrawer, '[data-slot="xds-dock-window"]:has(svg[data-icon="icon-chat"])');
});

test('modern css marks the timeline width cap', () => {
  // X wraps the feed in `max-w-[var(--x-timeline-max-width,600px)]`; without
  // removing that cap, widening `main` leaves the posts at 600px.
  assert.equal(modern.css.contentCap, '[class*="x-timeline-max-width"]');
});

test('modern css centres the left nav column', () => {
  assert.equal(
    modern.css.navCenter,
    'nav[aria-label]:has(a[href="/home"]):not([data-testid]):not(header[role="banner"] *)',
  );
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

/** A nav row: an <a href> or a <button>, with the icon / label children X gives it. */
function navRow({ href = null, tag = 'a', icon = 'nav', span = true, current = false } = {}) {
  return {
    tagName: tag.toUpperCase(),
    getAttribute: (name) => {
      if (name === 'href') return href;
      if (name === 'aria-current') return current ? 'page' : null;
      return null;
    },
    hasAttribute: () => false,
    querySelector: (selector) => {
      if (selector === 'svg') return icon ? { nodeType: 1 } : null;
      if (selector === 'svg[data-icon="icon-more-dots-hor-circle"]') return icon === 'more' ? { nodeType: 1 } : null;
      if (selector === 'span') return span ? { nodeType: 1 } : null;
      return null;
    },
    querySelectorAll: () => [],
  };
}

function modernNav(links, buttons = []) {
  return {
    querySelector: (selector) => (selector === 'a[href="/home"]' ? links[0] || {} : null),
    querySelectorAll: (selector) => {
      if (selector === 'a[href]') return links;
      if (selector === 'button') return buttons;
      return [];
    },
  };
}

test('modern nav rows match sub-paths of their base href', () => {
  const premium = navRow({ href: '/i/premium_sign_up' });
  const studio = navRow({ href: '/i/jf/creators/studio' });
  const nav = modernNav([navRow({ href: '/home' }), premium, studio]);
  const root = { querySelectorAll: (selector) => (selector === 'nav' ? [nav] : []) };
  assert.equal(modern.api.getNavItem(root, 'premium'), premium);
  assert.equal(modern.api.getNavItem(root, 'creatorStudio'), studio);
});

test('modern finds the Post button outside the nav', () => {
  const compose = navRow({ href: '/compose/post', icon: 'edit' });
  const nav = modernNav([navRow({ href: '/home' })]);
  const root = {
    querySelectorAll: (selector) => {
      if (selector === 'nav') return [nav];
      if (selector === 'a[href]') return [compose];
      return [];
    },
  };
  assert.equal(modern.api.getNavItem(root, 'post'), compose);
});

test('modern getNavTemplate inserts the row before the More button when there is no settings row', () => {
  const explore = navRow({ href: '/explore' });
  const more = navRow({ tag: 'button', icon: 'more' });
  const slot = modern.api.getNavTemplate(modernNav([navRow({ href: '/home', current: true }), explore], [more]));
  assert.equal(slot.template, explore);
  assert.equal(slot.before, more);
});

test('modern getNavTemplate still prefers a settings row', () => {
  const settings = navRow({ href: '/settings' });
  const more = navRow({ tag: 'button', icon: 'more' });
  const nav = modernNav([navRow({ href: '/home', current: true }), navRow({ href: '/explore' }), settings], [more]);
  assert.equal(modern.api.getNavTemplate(nav).before, settings);
});

test('modern getFeedTabs, getUserCells and getComposer pin the current markers', () => {
  const tabs = recordingRoot();
  withPath('/home', () => modern.api.getFeedTabs(tabs));
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

test('modern getAuthorHeader stops at the post header, not the wrapper around the text', () => {
  const name = {};
  const article = {
    nodeType: 1,
    contains: () => true,
    querySelector: (selector) => (selector === 'header' ? header : null),
    querySelectorAll: (selector) => (selector === '[data-post-avatar]' ? [avatar] : []),
  };
  const header = {
    querySelector: (selector) => (selector === 'div[dir="auto"]' ? name : null),
    closest: (selector) => (selector === 'article' ? article : null),
  };
  const wrapper = {
    parentElement: article,
    querySelector: (selector) => (selector === 'div[dir="auto"]' ? name : null),
  };
  const avatarColumn = { parentElement: wrapper };
  const avatar = {
    parentElement: avatarColumn,
    closest: (selector) => (selector === 'article' ? article : null),
  };
  assert.equal(modern.api.getAuthorHeader(article), header);
});

test('legacy getAuthorHeaders returns every User-Name block, quotes included', () => {
  const names = [{}, {}];
  const article = { querySelectorAll: (selector) => (selector === '[data-testid="User-Name"]' ? names : []) };
  assert.deepEqual(legacy.api.getAuthorHeaders(article), names);
});

test('modern getAuthorHeaders adds the header of a quoted article', () => {
  const nameNode = {};
  const quoteHeader = { querySelector: (selector) => (selector === 'div[dir="auto"]' ? nameNode : null) };
  const nested = {
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const avatar = { closest: (selector) => (selector === 'article' ? nested : null) };
  nested.querySelectorAll = (selector) => (selector === '[data-post-avatar]' ? [avatar] : []);
  quoteHeader.parentElement = nested;
  avatar.parentElement = quoteHeader;
  const article = {
    querySelector: () => null,
    querySelectorAll: (selector) => (selector === 'article' ? [nested] : []),
  };
  assert.deepEqual(modern.api.getAuthorHeaders(article), [quoteHeader]);
});

test('legacy getGrokButton hides the wrapper of a lone Grok button', () => {
  const button = { getAttribute: () => 'Grok actions', closest: () => null };
  const wrapper = { children: [button] };
  button.parentElement = wrapper;
  const article = { contains: () => true, querySelectorAll: (selector) => (selector === 'button[aria-label]' ? [button] : []) };
  assert.equal(legacy.api.getGrokButton(article), wrapper);
});

test('legacy getGrokButton keeps the button when its row holds more', () => {
  const button = { getAttribute: () => 'Grok actions', closest: () => null };
  const row = { children: [button, {}] };
  button.parentElement = row;
  const article = { contains: () => true, querySelectorAll: (selector) => (selector === 'button[aria-label]' ? [button] : []) };
  assert.equal(legacy.api.getGrokButton(article), button);
});

test('modern getGrokButton finds the button carrying the Grok icon', () => {
  const button = {
    querySelector: (selector) => (selector === 'svg[data-icon="icon-logo-grok"]' ? {} : null),
    closest: (selector) => (selector === 'article' ? article : null),
  };
  const row = { children: [button, {}] };
  button.parentElement = row;
  const article = { querySelectorAll: (selector) => (selector === 'button' ? [button] : []) };
  assert.equal(modern.api.getGrokButton(article), button);
});

test('modern getNavItem finds the logo above the nav on the home column', () => {
  // The home column keeps the logo in a spacer that is a sibling of the <nav>.
  const navHome = { querySelector: () => null };
  const nav = { querySelector: () => navHome, querySelectorAll: () => [navHome] };
  const logo = { querySelector: (selector) => (selector === 'svg[data-icon="icon-logo-x"]' ? {} : null) };
  const root = {
    querySelectorAll: (selector) =>
      selector === 'nav' ? [nav] : selector === 'a[href="/home"]' ? [logo, navHome] : [],
  };
  assert.equal(modern.api.getNavItem(root, 'logo'), logo);
});

test('modern getAuthorHeader reaches the actions row of a headerless post', () => {
  const POST_TEXT = '[dir="auto"].whitespace-pre-wrap';
  const caret = { querySelector: () => null, parentElement: null };
  const row = { querySelectorAll: (selector) => (selector === 'button' ? [caret] : []) };
  caret.parentElement = row;

  const actionsRow = { querySelector: (selector) => (selector === 'button[aria-haspopup="menu"]' ? caret : null) };
  const nameRow = { querySelector: () => null };
  const textNode = {};
  const body = { querySelector: (selector) => (selector === POST_TEXT ? textNode : null) };

  const nameLink = {
    textContent: 'Jack',
    querySelector: () => null,
    closest: (selector) => (selector === 'article' ? article : null),
  };
  const handleLink = {
    textContent: '@jack',
    querySelector: () => null,
    closest: (selector) => (selector === 'article' ? article : null),
  };
  const avatarLink = { querySelector: (selector) => (selector === 'img' ? {} : null) };
  const article = {
    querySelectorAll: (selector) => (selector === 'a[href]' ? [avatarLink, handleLink, nameLink] : []),
    closest: (selector) => (selector === 'article' ? article : null),
  };

  nameLink.parentElement = nameRow;
  nameRow.parentElement = actionsRow;
  actionsRow.parentElement = body;
  body.parentElement = article;

  assert.equal(modern.api.getAuthorHeader(article), actionsRow);
  assert.deepEqual(modern.api.getHeaderActionsSlot(article), { row, before: caret });
});

test('modern getTimeLink uses the post permalink when the time carries no <time>', () => {
  const quote = {};
  const article = {
    querySelectorAll: (selector) => (selector === 'a[href*="/status/"]' ? [photo, quoted, own] : []),
  };
  const photo = { getAttribute: () => '/jack/status/20/photo/1', closest: () => article };
  const quoted = { getAttribute: () => '/nasa/status/123', closest: () => quote };
  const own = { getAttribute: () => '/jack/status/20', closest: () => article };
  assert.equal(modern.api.getTimeLink(article), own);
});

test('css marks the post surface X rounds and colours', () => {
  assert.equal(legacy.css.postSurface, '[data-testid="cellInnerDiv"] article[data-testid="tweet"]');
  assert.equal(modern.css.postSurface, 'li[data-index] > div:has(article)');
});

test('modern getNavItem finds the account switcher below the nav', () => {
  const avatar = { getAttribute: (name) => (name === 'alt' ? '@jack' : null) };
  const button = {
    querySelector: (selector) =>
      selector === 'img[src*="profile_images"]' || selector === 'img[alt^="@"]' ? avatar : null,
  };
  const column = { querySelectorAll: (selector) => (selector === 'button' ? [button] : []) };
  const nav = {
    parentElement: { parentElement: column },
    querySelector: (selector) => (selector === 'a[href="/home"]' ? {} : null),
    querySelectorAll: () => [],
  };
  const root = { querySelectorAll: (selector) => (selector === 'nav' ? [nav] : []) };
  assert.equal(modern.api.getNavItem(root, 'account'), button);
});

test('modern getNavItem finds the profile row that links to the account handle', () => {
  const avatar = { getAttribute: (name) => (name === 'alt' ? '@Jack' : null) };
  const button = { querySelector: () => avatar };
  const column = { querySelectorAll: (selector) => (selector === 'button' ? [button] : []) };
  const profile = {
    getAttribute: (name) => (name === 'href' ? '/jack/' : null),
    querySelector: () => null,
  };
  const nav = {
    parentElement: { parentElement: column },
    querySelector: (selector) => (selector === 'a[href="/home"]' ? {} : null),
    querySelectorAll: (selector) => (selector === 'a[href]' ? [profile] : []),
  };
  const root = { querySelectorAll: (selector) => (selector === 'nav' ? [nav] : []) };
  assert.equal(modern.api.getNavItem(root, 'profile'), profile);
});

test('css marks where the gap sits on each generation', () => {
  assert.equal(legacy.css.postGapPad, '[data-testid="cellInnerDiv"] div:has(> article[data-testid="tweet"])');
  assert.equal(modern.css.postGapMargin, 'li[data-index] > div:has(article)');
  assert.equal(legacy.css.postGapMargin, undefined);
  assert.equal(modern.css.postGapPad, undefined);
});

/* ------------------------------------------------------------------ */
/* Column / nav fragments never match the legacy build                 */
/* ------------------------------------------------------------------ */

test('modern column and nav fragments exclude the legacy markup', () => {
  // The legacy <main> wraps every column and the legacy nav lives in the banner,
  // so a bare fragment would also match the old build and change it.
  for (const key of ['primaryColumn', 'sidebarColumn', 'leftNav', 'navCenter']) {
    assert.match(modern.css[key], /data-testid|role="banner"/, `${key} must exclude the legacy markup`);
  }
  assert.match(modern.css.sidebarColumn, /:not\(\[role="dialog"\] \*\)/);
});

test('the modern profile defines no column wrapper', () => {
  // The modern column is `main` itself and its row centres it with
  // `justify-content`: a wrapper rule would grow the box around the column,
  // absorb the free space and pull the feed out of the centre.
  assert.equal(modern.css.primaryColumnWrapper, undefined);
  assert.equal(modern.css.primaryColumnWrapperDeep, undefined);
});

/* ------------------------------------------------------------------ */
/* Feed tabs                                                           */
/* ------------------------------------------------------------------ */

test('modern getFeedTabs only answers on the home timeline', () => {
  const root = recordingRoot();
  withPath('/somebody', () => {
    assert.deepEqual(modern.api.getFeedTabs(root), []);
    assert.deepEqual(root.calls, []);
  });
});

test('modern getFeedTabs answers on every home-timeline path', () => {
  // The Following tab and the bare root are still the home timeline; a strict
  // `/home` check silently dropped the rule there.
  for (const pathname of ['/home', '/home/', '/home/following', '/']) {
    const root = recordingRoot();
    withPath(pathname, () => {
      modern.api.getFeedTabs(root);
      assert.deepEqual(root.calls, ['main [role="tablist"]'], pathname);
    });
  }
});

test('modern getFeedTabs skips tab lists inside a dialog', () => {
  const dialog = {};
  const list = { closest: (selector) => (selector === '[role="dialog"]' ? dialog : null) };
  const root = { querySelectorAll: () => [list] };
  withPath('/home', () => assert.deepEqual(modern.api.getFeedTabs(root), []));
});

test('modern getFeedTabsBlock returns the block inside the sticky wrapper', () => {
  const main = {};
  const sticky = { parentElement: main };
  const list = { closest: (selector) => (selector === 'main' ? main : null) };
  const block = { parentElement: sticky, children: [list], querySelector: () => null, matches: () => false };
  list.parentElement = block;
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (node) => ({ position: node === sticky ? 'sticky' : 'static' });
  try {
    assert.equal(modern.api.getFeedTabsBlock(list), block);
  } finally {
    globalThis.getComputedStyle = previous;
  }
});

/* ------------------------------------------------------------------ */
/* Generation-specific lookups                                         */
/* ------------------------------------------------------------------ */

test('modern getPrimaryColumn ignores the legacy wrapper main', () => {
  const primary = {};
  const legacyMain = { querySelector: (selector) => (selector === '[data-testid="primaryColumn"]' ? primary : null) };
  const root = { querySelector: () => legacyMain };
  assert.equal(modern.api.getPrimaryColumn(root), null);
});

test('modern getNav ignores the legacy banner nav', () => {
  const legacyNav = {
    closest: (selector) => (selector === 'header[role="banner"]' ? {} : null),
    querySelector: (selector) => (selector === 'a[href="/home"]' ? {} : null),
    querySelectorAll: () => [],
  };
  const root = { querySelectorAll: (selector) => (selector === 'nav' ? [legacyNav] : []) };
  assert.equal(modern.api.getNav(root), null);
});

/* ------------------------------------------------------------------ */
/* Documented fallbacks                                                */
/* ------------------------------------------------------------------ */

test('modern getPostCells falls back to bare data-index cells', () => {
  const cell = { id: 'cell' };
  const root = {
    querySelectorAll: (selector) => (selector === '[data-index]' ? [cell] : []),
  };
  assert.deepEqual(modern.api.getPostCells(root), [cell]);
});

test('modern getVerifiedBadge falls back to a verification aria-label', () => {
  const badge = { closest: (selector) => (selector === 'article' ? article : null) };
  const article = {
    querySelectorAll: (selector) => (selector.includes('aria-label') ? [badge] : []),
  };
  assert.equal(modern.api.getVerifiedBadge(article), badge);
});

test('modern getMediaHosts falls back to post photos without a media action', () => {
  const img = {
    matches: () => false,
    querySelector: () => null,
    closest: (selector) => (selector === 'article' ? article : null),
  };
  const article = {
    querySelectorAll: (selector) =>
      selector === 'img[src*="pbs.twimg.com/media/"]' ? [img] : [],
    closest: (selector) => (selector === 'article' ? article : null),
  };
  assert.deepEqual(modern.api.getMediaHosts(article), [{ el: img, kind: 'photo', owner: 'main' }]);
});

test('modern getViewerImages falls back to the active media holder', () => {
  const img = { closest: () => null };
  const holder = { querySelectorAll: () => [img] };
  const root = {
    querySelector: (selector) => (selector === '[data-active-media-holder]' ? holder : null),
  };
  assert.deepEqual(modern.api.getViewerImages(root), [img]);
});

test('modern getSidebar falls back to the parent of the who-to-follow module', () => {
  const sidebar = {};
  const marker = { parentElement: sidebar };
  const root = {
    querySelectorAll: () => [],
    querySelector: (selector) => (selector === '[data-who-to-follow]' ? marker : null),
  };
  assert.equal(modern.api.getSidebar(root), sidebar);
});
