import test from 'node:test';
import assert from 'node:assert/strict';
import { CENTER_CSS, FEED_TABS_STATIC_CSS, MENU_CENTER_CSS, contentWidthCss } from '../src/features/interface/layout-css.js';
import { ACTION_BAR_CSS, drawerCss } from '../src/features/interface/rules.js';

/**
 * `:has()` cannot be nested inside another `:has()`: the browser drops the
 * inner argument, and a composed selector silently stops matching the build
 * whose fragment carries the `:has()`. Generated CSS must stay flat.
 */
function hasNestedHas(selector) {
  const stack = [];
  for (let i = 0; i < selector.length; i += 1) {
    if (selector.startsWith(':has(', i)) {
      if (stack.includes('has')) return true;
      stack.push('has');
      i += 4;
      continue;
    }
    if (selector[i] === '(') stack.push('paren');
    else if (selector[i] === ')') stack.pop();
  }
  return false;
}

const selectorOf = (rule) => {
  const brace = rule.indexOf('{');
  return brace === -1 ? rule : rule.slice(0, brace);
};

test('the nested-:has() detector catches the shape that broke the modern rules', () => {
  assert.equal(hasNestedHas('div:has(> :is(main:not(:has([data-testid="primaryColumn"]))))'), true);
  assert.equal(hasNestedHas('div:has(> :is([data-testid="primaryColumn"], main))'), false);
  assert.equal(hasNestedHas(':is(main:not(:has([data-testid="x"])), [data-testid="x"])'), false);
});

test('generated wrapper selectors never nest :has()', () => {
  const selectors = [
    ...contentWidthCss(600).split('\n'),
    ...MENU_CENTER_CSS.split('\n'),
    ...CENTER_CSS.split('\n'),
    ...ACTION_BAR_CSS,
    ...drawerCss('grokDrawer'),
    ...drawerCss('chatDrawer'),
  ].filter(Boolean);

  for (const selector of selectors) {
    const flat = selectorOf(selector);
    assert.equal(hasNestedHas(flat), false, `nested :has() in ${flat}`);
  }
});

test('content width sizes the modern column but never grows its parent', () => {
  const css = contentWidthCss(600);
  // The modern column is the `main` element and the row centres it with
  // `justify-content`. Growing the box around `main` would absorb the row's free
  // space and pull the feed out of the centre, so no wrapper rule may match that
  // markup: the wrapper is a legacy-only fragment.
  assert.match(css, /main:not\(:has\(\[data-testid="primaryColumn"\]\)\)[^{]*\{width:600px/);
  assert.doesNotMatch(css, /:has\(> main\)/);
  assert.match(css, /div:has\(> \[data-testid="primaryColumn"\]\)\{width:auto/);
});

test('content width removes the cap inside the modern column too', () => {
  // X wraps the feed in a container capped by `--x-timeline-max-width` (600px);
  // widening `main` alone leaves the posts at that width.
  const css = contentWidthCss(750);
  assert.match(css, /:is\(\[class\*="x-timeline-max-width"\], \.r-1ye8kvj\)\{max-width:none!important\}/);
});

test('centring leaves the box around the modern column alone as well', () => {
  assert.doesNotMatch(CENTER_CSS, /:has\(> main\)/);
  assert.match(CENTER_CSS, /div:has\(> \[data-testid="primaryColumn"\]\)\{width:auto[^}]*flex-grow:0/);
});

test('un-sticking the feed tabs keeps the sticky element positioned', () => {
  // On the modern build the sticky element is X's page header, and its frosted
  // backdrop is `position: absolute` with `height: calc(100% + …)`. A `static`
  // header stops being that backdrop's containing block: the backdrop then
  // sizes against the viewport and shades the whole timeline until a scroll.
  assert.match(FEED_TABS_STATIC_CSS, /\[data-xp-sticky\]\{position:relative!important\}/);
});
