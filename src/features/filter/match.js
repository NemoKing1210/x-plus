import { FIELDS, takesValue } from './config.js';
import { normalizeHandle } from '../../utils/handle.js';

/**
 * Pure rule matcher: no DOM, no settings. `facts` comes from `facts.js` with
 * `authorName` / `handle` / `text` already lower-cased.
 *
 * Incomplete conditions (unknown field/operator/value, empty value, invalid
 * regex) never compile; a rule with no complete conditions never matches.
 */

const WORD_BOUNDARY = (value) =>
  new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(value)}(?![\\p{L}\\p{N}_])`, 'iu');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `/pattern/flags` or a bare pattern; null when invalid. Facts text is
 * lower-cased, so every regex is case-insensitive: `/Airdrop/` and
 * `notRegex /Airdrop/` must behave like their bare forms. `g` / `y` are
 * dropped (stateful lastIndex would make repeated tests unstable); `u` is
 * added unless the pattern opts into `v`.
 */
function compileRegex(source) {
  const text = String(source);
  const literal = /^\/([\s\S]+)\/([a-z]*)$/.exec(text);
  const flags = new Set((literal?.[2] ?? '').replace(/[gy]/g, '').split(''));
  flags.add('i');
  if (!flags.has('u') && !flags.has('v')) flags.add('u');
  try {
    return new RegExp(literal ? literal[1] : text, [...flags].join(''));
  } catch {
    return null;
  }
}

/** What blocks a condition from being used: 'incomplete' | 'regex' | null. */
export function conditionProblem(condition) {
  const spec = condition && FIELDS[condition.field];
  if (!spec || !spec.ops.includes(condition.op)) return 'incomplete';
  const value = String(condition.value ?? '');
  if (takesValue(condition.op) && !value.trim()) return 'incomplete';
  if (spec.value === 'lang' && !/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(value.trim())) {
    return 'incomplete';
  }
  if (Array.isArray(spec.value) && !spec.value.includes(condition.value)) return 'incomplete';
  if ((condition.op === 'regex' || condition.op === 'notRegex') && !compileRegex(value)) {
    return 'regex';
  }
  return null;
}

/** Compile one condition once per settings change; null when it cannot match. */
export function compileCondition(condition) {
  if (conditionProblem(condition)) return null;
  const raw = String(condition.value ?? '');
  const isRegex = condition.op === 'regex' || condition.op === 'notRegex';
  let value = takesValue(condition.op) ? raw : '';
  if (!isRegex) {
    value = condition.field === 'handle' ? normalizeHandle(value) : value.toLowerCase();
  }
  return {
    field: condition.field,
    op: condition.op,
    value,
    regex: isRegex ? compileRegex(raw) : null,
    wordRe:
      condition.op === 'word' || condition.op === 'notWord' ? WORD_BOUNDARY(raw) : null,
  };
}

export function testCondition(condition, facts) {
  switch (condition.field) {
    case 'lang':
      return testLang(condition, facts.lang);
    case 'media':
      return testSet(condition, facts.media);
    case 'attachment':
      return testSet(condition, facts.attachments);
    case 'meta':
      return testSet(condition, facts.meta);
    default:
      return testText(condition, String(facts[condition.field] ?? ''));
  }
}

function testLang(condition, lang) {
  if (!lang) return false;
  const match = lang === condition.value || lang.startsWith(`${condition.value}-`);
  return condition.op === 'is' ? match : !match;
}

function testSet(condition, set) {
  const present = condition.value === 'any' ? set.size > 0 : set.has(condition.value);
  return condition.op === 'has' || condition.op === 'is' ? present : !present;
}

function testText(condition, text) {
  switch (condition.op) {
    case 'contains':
      return text.includes(condition.value);
    case 'notContains':
      return !text.includes(condition.value);
    case 'word':
      return condition.wordRe.test(text);
    case 'notWord':
      return !condition.wordRe.test(text);
    case 'startsWith':
      return text.startsWith(condition.value);
    case 'endsWith':
      return text.endsWith(condition.value);
    case 'equals':
      return text === condition.value;
    case 'notEquals':
      return text !== condition.value;
    case 'empty':
      return text.trim() === '';
    case 'notEmpty':
      return text.trim() !== '';
    case 'regex':
      return condition.regex.test(text);
    case 'notRegex':
      return !condition.regex.test(text);
    default:
      return false;
  }
}

/** Enabled rules with at least one complete condition, compiled for matching. */
export function compileRules(cfg) {
  if (!cfg?.enabled) return [];
  const out = [];
  for (const rule of cfg.rules ?? []) {
    if (!rule?.enabled) continue;
    const conditions = (rule.conditions ?? []).map(compileCondition).filter(Boolean);
    if (!conditions.length) continue;
    out.push({ id: rule.id, match: rule.match === 'any' ? 'any' : 'all', conditions });
  }
  return out;
}

/** A post is hidden when any enabled rule matches. */
export function postMatches(rules, facts) {
  for (const rule of rules) {
    const hit =
      rule.match === 'any'
        ? rule.conditions.some((condition) => testCondition(condition, facts))
        : rule.conditions.every((condition) => testCondition(condition, facts));
    if (hit) return true;
  }
  return false;
}
