import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TreeRowSource } from '../../resources/js/datagrid.js';

class FakeInner {
    constructor(rows) { this.rows = rows; this.onWindowLoaded = () => {}; }
    get mode() { return 'server'; }
    async load() {}
    setView() { return this.rows.length; }
    rowAt(index) { return this.rows[index]; }
    total() { return this.rows.length; }
    loadedRows() { return null; }
    viewIds() { return null; }
}

const top = (key, hasChildren = true) => ({ _key: key, _level: 0, _hasChildren: hasChildren });

function makeTree(children, delays = {}) {
    const inner = new FakeInner([top('A'), top('B'), top('C', false), top('D')]);
    const tree = new TreeRowSource(inner, { tree: { childrenUrl: '/children' }, csrf: 't' });
    tree.fetchChildren = async (row) => {
        if (delays[row._key]) await delays[row._key];
        const rootIndex = row._level === 0 ? row._top : row._root;
        const rootKey = row._level === 0 ? row._key : row._rootKey;
        return (children[row._key] || []).map((child) => ({ ...child, _root: rootIndex, _rootKey: rootKey }));
    };
    return tree;
}

const keys = (tree) => Array.from({ length: tree.total() }, (_, i) => tree.rowAt(i)?._key);

const CHILDREN = {
    A: [{ _key: 'A1', _level: 1, _hasChildren: true }, { _key: 'A2', _level: 1, _hasChildren: false }],
    A1: [{ _key: 'A1x', _level: 2 }, { _key: 'A1y', _level: 2 }],
    B: [{ _key: 'B1', _level: 1, _hasChildren: false }],
    D: [{ _key: 'D1', _level: 1, _hasChildren: false }],
};

test('collapsed tree maps indexes straight to the inner source', () => {
    const tree = makeTree(CHILDREN);
    assert.deepEqual(keys(tree), ['A', 'B', 'C', 'D']);
    assert.equal(tree.rowAt(2)._top, 2);
});

test('expanding rows before and after an index shifts later rows', async () => {
    const tree = makeTree(CHILDREN);
    keys(tree);
    await tree.toggle(tree.rowAt(3));   // D
    await tree.toggle(tree.rowAt(0));   // A
    assert.deepEqual(keys(tree), ['A', 'A1', 'A2', 'B', 'C', 'D', 'D1']);
    assert.equal(tree.total(), 7);
});

test('nested expansion stays inside the root segment', async () => {
    const tree = makeTree(CHILDREN);
    keys(tree);
    await tree.toggle(tree.rowAt(0));
    await tree.toggle(tree.rowAt(1));   // A1
    await tree.toggle(tree.rowAt(5));   // B
    assert.deepEqual(keys(tree), ['A', 'A1', 'A1x', 'A1y', 'A2', 'B', 'B1', 'C', 'D']);
});

test('collapsing a parent hides and closes its descendants', async () => {
    const tree = makeTree(CHILDREN);
    keys(tree);
    await tree.toggle(tree.rowAt(0));
    await tree.toggle(tree.rowAt(1));
    await tree.toggle(tree.rowAt(0));
    assert.deepEqual(keys(tree), ['A', 'B', 'C', 'D']);
    assert.equal(tree.isOpen({ _key: 'A1' }), false);
    await tree.toggle(tree.rowAt(0));   // re-open from cache, A1 stays closed
    assert.deepEqual(keys(tree), ['A', 'A1', 'A2', 'B', 'C', 'D']);
});

test('rows without children do not toggle', async () => {
    const tree = makeTree(CHILDREN);
    keys(tree);
    await tree.toggle(tree.rowAt(2));
    assert.equal(tree.total(), 4);
});

test('children arriving after setView are dropped', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const tree = makeTree(CHILDREN, { A: gate });
    keys(tree);
    const pending = tree.toggle(tree.rowAt(0));
    assert.equal(tree.isLoading(tree.rowAt(0)), true);
    tree.setView({ searchQuery: 'x', columnFilters: {}, sort: {} });
    release();
    await pending;
    assert.deepEqual(keys(tree), ['A', 'B', 'C', 'D']);
    assert.equal(tree.hasOpen(), false);
});

test('collapseAll and setView reset the expansion', async () => {
    const tree = makeTree(CHILDREN);
    keys(tree);
    await tree.toggle(tree.rowAt(0));
    tree.collapseAll();
    assert.equal(tree.total(), 4);
    await tree.toggle(tree.rowAt(0));
    tree.setView({ searchQuery: '', columnFilters: {}, sort: {} });
    assert.equal(tree.total(), 4);
    assert.equal(tree.children.size, 0);
});
