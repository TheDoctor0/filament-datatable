import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGridState, serializeGridState } from '../../resources/js/datagrid.js';

const COLUMNS = {
    nazwa: { k: 'nazwa', filter: 'text' },
    podklad: { k: 'podklad', filter: 'select' },
    saldo: { k: 'saldo', filter: 'num' },
    data: { k: 'data', filter: 'datetime' },
    kod: { k: 'kod' },
};

test('round trip keeps search, sort and filters', () => {
    const state = {
        searchQuery: 'jmd',
        sort: { key: 'nazwa', dir: 'asc' },
        columnFilters: { podklad: ['EURO'], saldo: { min: '10', max: null }, nazwa: 'dc' },
    };
    const params = serializeGridState(new URLSearchParams('page=2'), state, { key: 'saldo', dir: 'desc' });
    assert.equal(params.get('page'), '2');
    const parsed = parseGridState(params.toString(), COLUMNS);
    assert.equal(parsed.searchQuery, 'jmd');
    assert.deepEqual(parsed.sort, { key: 'nazwa', dir: 'asc' });
    assert.deepEqual(parsed.columnFilters, { podklad: ['EURO'], saldo: { min: '10' }, nazwa: 'dc' });
});

test('default sort and empty values leave no params', () => {
    const params = serializeGridState(new URLSearchParams('q=old&sort=x:asc&f=%7B%7D'), {
        searchQuery: '', sort: { key: 'saldo', dir: 'desc' }, columnFilters: { podklad: [], saldo: { min: '', max: null } },
    }, { key: 'saldo', dir: 'desc' });
    assert.equal(params.toString(), '');
});

test('prefix isolates params', () => {
    const params = serializeGridState(new URLSearchParams(), { searchQuery: 'a', sort: {}, columnFilters: {} }, null, 'k_');
    assert.equal(params.toString(), 'k_q=a');
    assert.deepEqual(parseGridState('q=b&k_q=a', COLUMNS, 'k_'), { searchQuery: 'a' });
});

test('unknown columns, missing filters and bad shapes are dropped', () => {
    const f = JSON.stringify({
        nope: ['x'], kod: 'x', podklad: 'EURO', saldo: { min: 'abc', max: '5' }, data: ['2026'], nazwa: { a: 1 },
    });
    const parsed = parseGridState(new URLSearchParams({ f, sort: 'nope:asc' }), COLUMNS);
    assert.deepEqual(parsed.columnFilters, { saldo: { max: '5' } });
    assert.equal(parsed.sort, undefined);
});

test('malformed JSON and bad sort direction are ignored', () => {
    assert.deepEqual(parseGridState('f=%7Bbroken&sort=saldo:sideways', COLUMNS), {});
});

test('absent params return nothing so other sources keep precedence', () => {
    assert.deepEqual(parseGridState('', COLUMNS), {});
});
