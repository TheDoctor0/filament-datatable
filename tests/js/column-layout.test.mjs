import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutDefaults, mergeColumnLayout } from '../../resources/js/datagrid.js';

const config = (keys, frozen = [], off = []) => ({
    columns: keys.map((k) => ({ k, off: off.includes(k) })),
    frozen,
});

test('keeps the user layout while the config defaults are unchanged', () => {
    const cfg = config(['a', 'b', 'c'], ['a']);
    const saved = { o: ['c', 'a', 'b'], v: ['a', 'c'], f: [], d: layoutDefaults(cfg) };
    assert.deepEqual(mergeColumnLayout(saved, cfg), { o: ['c', 'a', 'b'], v: ['a', 'c'], f: [], a: false, q: [] });
});

test('a new default order replaces the saved order but keeps visibility and pins', () => {
    const old = config(['a', 'b', 'c']);
    const saved = { o: ['a', 'b', 'c'], v: ['a', 'b'], f: ['b'], d: layoutDefaults(old) };
    assert.deepEqual(mergeColumnLayout(saved, config(['a', 'c', 'b'])), { o: ['a', 'c', 'b'], v: ['a', 'b'], f: ['b'], a: false, q: [] });
});

test('new default pins reach saved layouts', () => {
    const saved = { o: ['a', 'b'], v: ['a', 'b'], f: [], d: layoutDefaults(config(['a', 'b'])) };
    assert.deepEqual(mergeColumnLayout(saved, config(['a', 'b'], ['a'])).f, ['a']);
});

test('layouts saved without defaults fall back to the config', () => {
    const saved = { o: ['b', 'a'], v: ['b'], f: ['b'] };
    assert.deepEqual(mergeColumnLayout(saved, config(['a', 'b'], ['a'], ['b'])), { o: ['a', 'b'], v: ['a'], f: ['a'], a: false, q: [] });
});

test('the actions pin follows the user until the config default changes', () => {
    const sticky = { ...config(['a']), stickyActions: true };
    const unpinned = { o: ['a'], v: ['a'], f: [], a: false, d: layoutDefaults(sticky) };
    assert.equal(mergeColumnLayout(unpinned, sticky).a, false);
    assert.equal(mergeColumnLayout({ ...unpinned, d: layoutDefaults(config(['a'])) }, sticky).a, true);
});

test('new default quick filters reach layouts saved without them', () => {
    const before = config(['a', 'b']);
    const saved = { o: ['a', 'b'], v: ['a', 'b'], f: [], q: [], d: layoutDefaults(before) };
    assert.deepEqual(mergeColumnLayout(saved, { ...before, quickFilters: ['b'] }).q, ['b']);
    const removedPill = { ...saved, d: layoutDefaults({ ...before, quickFilters: ['b'] }) };
    assert.deepEqual(mergeColumnLayout(removedPill, { ...before, quickFilters: ['b'] }).q, []);
});
