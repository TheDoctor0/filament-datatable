import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    clampColumnWidth,
    cleanFilterValue,
    computeColumnWindow,
    describeFilterValue,
    distinctValues,
    isEmptyFilterValue,
    MAX_COLUMN_WIDTH,
    MIN_COLUMN_WIDTH,
    rowPassesColumnFilter,
    serializeGridState,
} from '../../resources/js/datagrid.js';

const core = { k: 'core', filter: 'num' };

test('empty filter values, including nested pick-lists', () => {
    assert.equal(isEmptyFilterValue(null), true);
    assert.equal(isEmptyFilterValue(''), true);
    assert.equal(isEmptyFilterValue([]), true);
    assert.equal(isEmptyFilterValue({ min: '', max: null, in: [] }), true);
    assert.equal(isEmptyFilterValue({ in: ['50'] }), false);
    assert.equal(isEmptyFilterValue({ min: '0' }), false);
    assert.equal(isEmptyFilterValue('abc'), false);
});

test('num filter picks exact values', () => {
    const filter = { in: ['50', '88'] };
    assert.equal(rowPassesColumnFilter({ core: '50' }, core, filter), true);
    assert.equal(rowPassesColumnFilter({ core: 88 }, core, filter), true);
    assert.equal(rowPassesColumnFilter({ core: '76' }, core, filter), false);
});

test('num filter ANDs picked values with the range', () => {
    const filter = { in: ['50', '88'], min: '60' };
    assert.equal(rowPassesColumnFilter({ core: '50' }, core, filter), false);
    assert.equal(rowPassesColumnFilter({ core: '88' }, core, filter), true);
});

test('empty cells never satisfy an active num filter, but pass an empty one', () => {
    assert.equal(rowPassesColumnFilter({ core: null }, core, { max: '10' }), false);
    assert.equal(rowPassesColumnFilter({ core: '' }, core, { min: '0' }), false);
    assert.equal(rowPassesColumnFilter({ core: null }, core, { min: '', in: [] }), true);
    assert.equal(rowPassesColumnFilter({ core: '0' }, core, { min: '0', max: '0' }), true);
});

test('URL state keeps num pick-lists and drops junk in them', () => {
    assert.deepEqual(cleanFilterValue('num', { in: ['50', 88, 'x', null], min: '' }), { in: ['50', '88'] });
    assert.equal(cleanFilterValue('num', { in: [] }), null);
    const params = serializeGridState(new URLSearchParams(), {
        searchQuery: '', sort: {}, columnFilters: { core: { in: [] }, other: { in: ['1'] } },
    });
    assert.equal(params.get('f'), JSON.stringify({ other: { in: ['1'] } }));
});

test('numeric distinct values sort as numbers', () => {
    const rows = [{ core: '88' }, { core: '9' }, { core: '50' }, { core: null }, { core: '50' }];
    assert.deepEqual(distinctValues(rows, 'core', true), ['9', '50', '88']);
    assert.deepEqual(distinctValues(rows, 'core'), ['50', '88', '9']);
});

test('chip text describes each filter kind', () => {
    const brand = { k: 'brand', filter: 'select', valueLabels: { V: 'Velvet' } };
    assert.equal(describeFilterValue(brand, ['V', 'X']), 'Velvet, X');
    assert.equal(describeFilterValue(brand, ['a', 'b', 'c', 'd']), 'a, b +2');
    assert.equal(describeFilterValue(core, { in: ['50', '88'], min: '10', max: '' }, 'pl-PL'), '50, 88 · ≥ 10');
    assert.equal(describeFilterValue(core, { min: '1', max: '5' }), '1–5');
    assert.equal(describeFilterValue({ k: 'd', filter: 'date' }, { do: '2026-01-31' }), '≤ 2026-01-31');
    assert.equal(describeFilterValue({ k: 'n', filter: 'text' }, 'abc'), '“abc”');
    assert.equal(describeFilterValue(core, { in: [] }), '');
});

test('user column widths are clamped', () => {
    assert.equal(clampColumnWidth(10), MIN_COLUMN_WIDTH);
    assert.equal(clampColumnWidth(5000), MAX_COLUMN_WIDTH);
    assert.equal(clampColumnWidth(140.6), 141);
    assert.equal(clampColumnWidth('junk'), MIN_COLUMN_WIDTH);
});

test('pinned layout: the scroll columns window over the gap between sticky parts', () => {
    // 10 scroll columns × 100px; viewport 600px with 250px pinned on the left and 150px sticky on the right
    // leaves a 200px window for scroll columns. At scrollLeft 0 that is columns 0–1 (+2 overscan → 0–3).
    const widths = new Array(10).fill(100);
    const window = computeColumnWindow(widths, 0, 600 - 250 - 150, 2, 0);
    assert.deepEqual([window.first, window.last], [0, 3]);
    assert.equal(window.rightSpacer, 600);
    const scrolled = computeColumnWindow(widths, 500, 200, 2, 0);
    assert.deepEqual([scrolled.first, scrolled.last], [3, 8]);
    assert.equal(scrolled.leftSpacer, 300);
});
