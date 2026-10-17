/**
 * datagrid.js — reusable virtual-scroll data grid (Alpine component).
 *
 * Design (see the four grid teardowns behind this rewrite):
 *  - Data flows one way:  allRows (frozen) → viewRows (filtered+sorted) → visible window (sliced by scroll).
 *  - The visible window is a FIXED-SIZE pool of row slots keyed by position, so the DOM nodes are
 *    recycled on scroll (Alpine patches text in place) instead of being destroyed and rebuilt.
 *  - Cell display strings and each row's search blob are computed once and cached on the row.
 *  - A pluggable "row source" hides where filtering/sorting/paging happen: ClientRowSource does it
 *    in the browser (default); ServerRowSource offloads it to the backend for very large datasets.
 *
 * The file default-exports the Alpine factory (`datagrid`) and also named-exports the pure helpers
 * and the row sources so they can be unit-tested in Node without a browser.
 */

export const ROW_HEIGHT = 42; // px — fixed height is what makes scroll→index math O(1)
export const OVERSCAN_ROWS = 4; // rows rendered above/below the viewport as a buffer
export const OVERSCAN_COLUMNS = 2; // columns rendered left/right of the viewport as a buffer
export const CHECKBOX_COLUMN_WIDTH = 44;
export const ACTIONS_KEY = '_actions'; // userWidths key of the actions column
export const MIN_COLUMN_WIDTH = 56; // user drag-resize clamp
export const MAX_COLUMN_WIDTH = 900;
export const PIN_MIN_VIEWPORT = 640; // below this pinned columns/actions scroll normally (phones)

/**
 * Which columns fall inside the horizontal viewport (column virtualization).
 * `leadWidth` is any fixed left column (e.g. the selection checkbox) that shifts the data columns.
 * Returns the first/last visible column index (with overscan) plus the total width of the
 * columns skipped on the left and right — the "spacer" widths that keep rendered columns
 * in their true horizontal position, exactly like the vertical spacer rows.
 */
export function computeColumnWindow(columnWidths, scrollLeft, viewportWidth, overscan, leadWidth = 0) {
    const count = columnWidths.length;
    const viewStart = Math.max(0, scrollLeft - leadWidth);
    const viewEnd = scrollLeft - leadWidth + viewportWidth;
    let x = 0;
    let first = count;
    let last = -1;
    for (let i = 0; i < count; i++) {
        const start = x;
        const end = x + columnWidths[i];
        if (end > viewStart && start < viewEnd) {
            if (i < first) first = i;
            last = i;
        }
        x = end;
    }
    if (last < 0) { first = 0; last = count - 1; } // nothing matched (e.g. zero width) → render all
    first = Math.max(0, first - overscan);
    last = Math.min(count - 1, last + overscan);
    let leftSpacer = 0;
    for (let i = 0; i < first; i++) leftSpacer += columnWidths[i];
    let rightSpacer = 0;
    for (let i = last + 1; i < count; i++) rightSpacer += columnWidths[i];
    return { first, last, leftSpacer, rightSpacer };
}

/* ------------------------------------------------------------------ *
 * Pure helpers (no DOM / no framework — unit-testable in isolation)   *
 * ------------------------------------------------------------------ */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, (char) => HTML_ESCAPES[char]);
}

export const DEFAULT_LOCALE = 'en-US';

/** Locale number formatting, trimmed to 2 decimals. */
export function formatNumber(value, locale = DEFAULT_LOCALE) {
    const rounded = Math.round((Number(value) || 0) * 100) / 100;
    return rounded.toLocaleString(locale);
}

export function formatInteger(value, locale = DEFAULT_LOCALE) {
    return Math.round(Number(value) || 0).toLocaleString(locale);
}

/** "2026-01-26T14:51:03" | "2026-01-26 14:51:03" → "2026-01-26 14:51" */
export function formatDateTime(value) {
    return String(value ?? '').slice(0, 16).replace('T', ' ');
}

/** "2026-01-26 …" → "2026-01-26" */
export function formatDate(value) {
    return String(value ?? '').slice(0, 10);
}

/** One lowercased blob per row across the searchable fields — computed once, reused per keystroke. */
export function buildSearchBlob(row, searchFields) {
    let blob = '';
    for (const field of searchFields) {
        const value = row[field];
        if (value != null && value !== '') blob += String(value).toLowerCase() + ' ';
    }
    return blob;
}

/** Normalise a datetime string for range comparison ("YYYY-MM-DD HH:MM"). */
function normaliseDateTime(value) {
    return String(value ?? '').slice(0, 16).replace('T', ' ');
}

/** Is a filter value "empty" (narrows nothing)? Handles nested shapes such as `{min, max, in: []}`. */
export function isEmptyFilterValue(value) {
    if (value == null || value === '') return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.values(value).every((inner) => isEmptyFilterValue(inner));
    return false;
}

/**
 * Does a row pass a single column filter? `kind` is the column's declared filter type.
 * Values shapes: select → array; num → {min?, max?, in?: [...]}; datetime/date → {od,do}; text → string.
 * A num filter ANDs its picked values (`in`) with its range; an empty cell never satisfies either.
 */
export function rowPassesColumnFilter(row, column, filterValue) {
    if (filterValue == null) return true;
    const kind = column.filter;
    const cellValue = row[column.k];

    if (kind === 'select') {
        return !Array.isArray(filterValue) || filterValue.length === 0
            || filterValue.includes(String(cellValue ?? ''));
    }
    if (kind === 'num') {
        const picked = Array.isArray(filterValue.in) ? filterValue.in : [];
        const hasMin = filterValue.min != null && filterValue.min !== '';
        const hasMax = filterValue.max != null && filterValue.max !== '';
        if (!picked.length && !hasMin && !hasMax) return true;
        if (cellValue == null || cellValue === '') return false;
        if (picked.length && !picked.includes(String(cellValue))) return false;
        const numeric = Number(cellValue);
        if (hasMin && !(numeric >= Number(filterValue.min))) return false;
        if (hasMax && !(numeric <= Number(filterValue.max))) return false;
        return true;
    }
    if (kind === 'datetime') {
        const cell = normaliseDateTime(cellValue);
        if (filterValue.od && cell < normaliseDateTime(filterValue.od)) return false;
        if (filterValue.do && cell > normaliseDateTime(filterValue.do)) return false;
        return true;
    }
    if (kind === 'date') {
        const cell = String(cellValue ?? '');
        if (filterValue.od && cell < filterValue.od) return false;
        if (filterValue.do && cell > filterValue.do + ' 23:59:59') return false;
        return true;
    }
    // text "contains"
    return String(cellValue ?? '').toLowerCase().includes(String(filterValue).toLowerCase());
}

/** Comparator factory: numeric columns compare as numbers, everything else via a reused collator. */
export function makeRowComparator(sort, columnsByKey, collator) {
    const column = columnsByKey[sort.key] || {};
    const numeric = column.type === 'num' || column.type === 'sign';
    const direction = sort.dir === 'asc' ? 1 : -1;

    return (a, b) => {
        if (numeric) {
            return ((Number(a[sort.key]) || 0) - (Number(b[sort.key]) || 0)) * direction;
        }
        return collator.compare(String(a[sort.key] ?? ''), String(b[sort.key] ?? '')) * direction;
    };
}

/** Fixed scope applied before any user filter: `[{field, in: [...]}]`, all clauses must hold. */
export function rowPassesPreFilter(row, preFilter) {
    for (const clause of preFilter || []) {
        if (Array.isArray(clause.in) && !clause.in.includes(row[clause.field])) return false;
    }
    return true;
}

/** Distinct, sorted, non-empty values of a field across rows — for select / value-list filter options. */
export function distinctValues(rows, field, numeric = false) {
    const seen = new Set();
    for (const row of rows) {
        const value = row[field];
        if (value != null && value !== '') seen.add(String(value));
    }
    return numeric ? [...seen].sort((a, b) => Number(a) - Number(b)) : [...seen].sort();
}

/** Clamp a user-dragged column width. */
/** The config's default column order, visibility and pins — saved with a layout to detect config changes. */
export function layoutDefaults(config) {
    return {
        o: config.columns.map((column) => column.k),
        v: config.columns.filter((column) => !column.off).map((column) => column.k),
        f: [...(config.frozen || [])],
        a: !!config.stickyActions,
        q: [...(config.quickFilters || [])],
    };
}

/**
 * Saved column layout merged with the current config. Each part (order, visibility, pins) keeps the
 * user's choice only while the config default it was saved against is unchanged — so a new default
 * order or pin set in the code reaches users who already saved a layout. Unknown keys are dropped,
 * new columns are appended.
 */
export function mergeColumnLayout(saved, config) {
    const defaults = layoutDefaults(config);
    const known = defaults.o;
    // Visibility and pins are sets — only the order part compares in sequence.
    const sig = (part, keys) => JSON.stringify(part === 'o' ? keys : [...(keys || [])].sort());
    const keep = (part) => Array.isArray(saved[part]) && saved.d && sig(part, saved.d[part]) === sig(part, defaults[part]);
    const keepActions = typeof saved.a === 'boolean' && saved.d && saved.d.a === defaults.a;
    const order = keep('o') ? saved.o.filter((key) => known.includes(key)) : [...known];
    return {
        o: order.concat(known.filter((key) => !order.includes(key))),
        v: keep('v') ? saved.v.filter((key) => known.includes(key)) : defaults.v,
        f: keep('f') ? saved.f.filter((key) => known.includes(key)) : defaults.f,
        a: keepActions ? saved.a : defaults.a,
        q: keep('q') ? saved.q.filter((key) => known.includes(key)) : defaults.q,
    };
}

export function clampColumnWidth(width) {
    return Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Number(width) || 0)));
}

/** "a, b +3" — the first `limit` items and a count of the rest. */
function shortList(items, limit = 2) {
    return items.length <= limit ? items.join(', ') : `${items.slice(0, limit).join(', ')} +${items.length - limit}`;
}

/** "from–to" / "≥ from" / "≤ to" for a range, '' when both bounds are empty. */
function rangeText(from, to) {
    const hasFrom = from != null && from !== '';
    const hasTo = to != null && to !== '';
    if (hasFrom && hasTo) return `${from}–${to}`;
    if (hasFrom) return `≥ ${from}`;
    if (hasTo) return `≤ ${to}`;
    return '';
}

/** Short human text of an active filter value, for the active-filter chips. */
export function describeFilterValue(column, value, locale = DEFAULT_LOCALE) {
    if (isEmptyFilterValue(value)) return '';
    const kind = column.filter;
    if (kind === 'select') return shortList(value.map((item) => String(valueLabel(column, item) ?? item)));
    if (kind === 'num') {
        const parts = [];
        if (Array.isArray(value.in) && value.in.length) parts.push(shortList(value.in.map((item) => formatNumber(item, locale))));
        const range = rangeText(value.min, value.max);
        if (range) parts.push(range);
        return parts.join(' · ');
    }
    if (kind === 'date' || kind === 'datetime') return rangeText(value.od && formatDateTime(value.od), value.do && formatDateTime(value.do));
    return `“${value}”`;
}

/* ------------------------------------------------------------------ *
 * Row sources — the seam between client-side and server-side data     *
 * ------------------------------------------------------------------ */

/**
 * ClientRowSource: fetches every row once, then filters/sorts/windows in the browser.
 * Best up to ~10–30k rows. `rowAt(i)` and `total()` are synchronous slices.
 */
export class ClientRowSource {
    constructor(config) {
        this.config = config;
        this.collator = new Intl.Collator(config.locale || DEFAULT_LOCALE);
        this.allRows = [];
        this.viewRows = [];
    }

    get mode() { return 'client'; }

    async load() {
        const response = await fetch(this.config.dataUrl, { headers: { Accept: 'application/json' } });
        let rows = await response.json();
        if (this.config.preFilter) rows = rows.filter((row) => rowPassesPreFilter(row, this.config.preFilter));
        for (const row of rows) row._search = buildSearchBlob(row, this.config.search || []);
        this.allRows = rows;
        this.viewRows = rows;
    }

    /** Recompute the filtered + sorted view. Returns the filtered row count. */
    setView({ searchQuery, columnFilters, sort }) {
        const columnsByKey = this.config._columnsByKey;
        let rows = this.allRows;

        if (searchQuery) {
            const needle = searchQuery.toLowerCase();
            rows = rows.filter((row) => row._search.includes(needle));
        }

        for (const key in columnFilters) {
            const value = columnFilters[key];
            const column = columnsByKey[key];
            if (value == null || !column) continue;
            rows = rows.filter((row) => rowPassesColumnFilter(row, column, value));
        }

        if (sort.key) {
            const comparator = makeRowComparator(sort, columnsByKey, this.collator);
            rows = [...rows].sort(comparator);
        }

        this.viewRows = rows;
        return rows.length;
    }

    rowAt(index) { return this.viewRows[index]; }
    total() { return this.viewRows.length; }
    loadedRows() { return this.allRows; }              // for distinct filter options / summary
    sampleRows() { return this.allRows; }              // rows available for width measuring
    viewIds() { return this.viewRows.map((row) => row.id); } // for export / select-all
}

/**
 * ServerRowSource: keeps only the visible window in memory; the backend does the
 * filtering/sorting/paging (DataTables-style protocol). Wired up in Stage C — the endpoints
 * it calls are added there. The grid talks to it through the exact same rowAt/total/setView API.
 */
export class ServerRowSource {
    constructor(config) {
        this.config = config;
        this.blockSize = config.blockSize || 200;
        this.blocks = new Map();     // blockIndex → row[]
        this.pending = new Set();    // blockIndexes being fetched
        this.filteredTotal = 0;
        this.draw = 0;
        this.generation = 0;         // bumped on each setView; stale responses are dropped
        this.query = { searchQuery: '', columnFilters: {}, sort: {} };
        this.onWindowLoaded = () => {};
    }

    get mode() { return 'server'; }

    async load() {
        await this.setView(this.query); // first request establishes the total
    }

    async setView(query) {
        this.query = query;
        const gen = ++this.generation;
        this.blocks.clear();
        this.pending.clear();
        const payload = await this.request(0, this.blockSize);
        // View changed while this request was in flight — drop it so a slow, stale
        // response can never clobber block 0 (the blank-top-rows bug).
        if (gen !== this.generation) return this.filteredTotal;
        this.filteredTotal = payload.filtered;
        this.blocks.set(0, payload.rows);
        return this.filteredTotal;
    }

    rowAt(index) {
        const blockIndex = Math.floor(index / this.blockSize);
        const block = this.blocks.get(blockIndex);
        if (block) return block[index % this.blockSize];
        this.ensureBlock(blockIndex);
        return undefined; // placeholder until the block arrives
    }

    ensureBlock(blockIndex) {
        if (this.blocks.has(blockIndex) || this.pending.has(blockIndex)) return;
        const gen = this.generation;
        this.pending.add(blockIndex);
        this.request(blockIndex * this.blockSize, this.blockSize).then((payload) => {
            // Belongs to a superseded view — discard (do not write stale rows).
            if (gen !== this.generation) return;
            this.pending.delete(blockIndex);
            this.filteredTotal = payload.filtered;
            this.blocks.set(blockIndex, payload.rows);
            this.onWindowLoaded();
        });
    }

    async request(start, length) {
        this.draw += 1;
        const draw = this.draw;
        const body = {
            draw,
            start,
            length,
            search: this.query.searchQuery || '',
            sort: this.query.sort || {},
            filters: this.query.columnFilters || {},
        };
        const response = await fetch(this.config.dataUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': this.config.csrf },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        // Staleness is handled by the generation token in setView/ensureBlock, which
        // drops the whole response — so rows are always returned as-is here.
        for (const row of data.rows) row._search = '';
        return { rows: data.rows, filtered: data.recordsFiltered };
    }

    total() { return this.filteredTotal; }
    loadedRows() { return null; }   // server mode: distinct options / summary come from the backend
    sampleRows() { return [...this.blocks.values()].flat(); }
    viewIds() { return null; }      // server mode: export re-runs the query server-side
}

/**
 * TreeRowSource: wraps a client/server source of top-level rows and splices lazily loaded
 * children in under expanded rows. Rows carry `_key` (unique in the tree), `_level` and
 * `_hasChildren`; `_q` is opaque backend data echoed back when fetching a row's children.
 *
 * Visible order is: top row, its open descendants (depth-first), next top row… Each expanded
 * top row owns a segment `{topIndex, key, flat}` where `flat` is its visible descendants, so
 * `rowAt` maps a visual index to (top row | child) with a walk over the open segments only.
 */
export class TreeRowSource {
    constructor(inner, config) {
        this.inner = inner;
        this.config = config;
        this.children = new Map();   // key → direct children (cache, cleared on setView)
        this.open = new Set();       // expanded keys
        this.loading = new Set();    // keys whose children are being fetched
        this.segments = [];          // [{topIndex, key, flat}] sorted by topIndex
        this.generation = 0;
        this.query = { searchQuery: '', columnFilters: {}, sort: {} };
    }

    get mode() { return this.inner.mode; }
    get onWindowLoaded() { return this.inner.onWindowLoaded; }
    set onWindowLoaded(callback) { this.inner.onWindowLoaded = callback; }

    reset() {
        this.generation += 1;
        this.children.clear();
        this.open.clear();
        this.loading.clear();
        this.segments = [];
    }

    async load() {
        this.reset();
        await this.inner.load();
    }

    setView(query) {
        this.query = query;
        this.reset();
        return this.inner.setView(query);
    }

    total() {
        let extra = 0;
        for (const segment of this.segments) extra += segment.flat.length;
        return this.inner.total() + extra;
    }

    rowAt(index) {
        let offset = 0;
        for (const segment of this.segments) {
            const topPosition = segment.topIndex + offset;
            if (index <= topPosition) break;
            if (index <= topPosition + segment.flat.length) return segment.flat[index - topPosition - 1];
            offset += segment.flat.length;
        }
        const topIndex = index - offset;
        const row = this.inner.rowAt(topIndex);
        if (row) row._top = topIndex;
        return row;
    }

    isOpen(row) { return !!row && this.open.has(row._key); }
    isLoading(row) { return !!row && this.loading.has(row._key); }
    hasOpen() { return this.open.size > 0; }

    async toggle(row) {
        if (!row || !row._hasChildren) return;
        if (this.open.has(row._key)) {
            this.closeBranch(row._key);
            this.rebuildSegment(row);
            return;
        }
        if (!this.children.has(row._key)) {
            const gen = this.generation;
            this.loading.add(row._key);
            let rows;
            try {
                rows = await this.fetchChildren(row);
            } finally {
                if (gen === this.generation) this.loading.delete(row._key);
            }
            if (gen !== this.generation) return;
            this.children.set(row._key, rows);
        }
        this.open.add(row._key);
        this.rebuildSegment(row);
    }

    closeBranch(key) {
        this.open.delete(key);
        for (const child of this.children.get(key) || []) {
            if (this.open.has(child._key)) this.closeBranch(child._key);
        }
    }

    collapseAll() {
        this.open.clear();
        this.segments = [];
    }

    async fetchChildren(row) {
        const response = await fetch(this.config.tree.childrenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': this.config.csrf },
            body: JSON.stringify({
                parent: row._key,
                q: row._q ?? null,
                search: this.query.searchQuery || '',
                filters: this.query.columnFilters || {},
                sort: this.query.sort || {},
            }),
        });
        if (!response.ok) throw new Error(`Tree children request failed (${response.status})`);
        const data = await response.json();
        const rootIndex = row._level === 0 || row._level == null ? row._top : row._root;
        const rootKey = row._level === 0 || row._level == null ? row._key : row._rootKey;
        for (const child of data.rows || []) {
            child._search = '';
            child._root = rootIndex;
            child._rootKey = rootKey;
        }
        return data.rows || [];
    }

    flatten(key, out = []) {
        for (const child of this.children.get(key) || []) {
            out.push(child);
            if (this.open.has(child._key)) this.flatten(child._key, out);
        }
        return out;
    }

    rebuildSegment(row) {
        const isTop = row._level === 0 || row._level == null;
        const topIndex = isTop ? row._top : row._root;
        const key = isTop ? row._key : row._rootKey;
        const flat = this.open.has(key) ? this.flatten(key) : [];
        const segments = this.segments.filter((segment) => segment.topIndex !== topIndex);
        if (flat.length > 0) segments.push({ topIndex, key, flat });
        segments.sort((a, b) => a.topIndex - b.topIndex);
        this.segments = segments;
    }

    loadedRows() { return this.inner.loadedRows(); }
    sampleRows() {
        const rows = [...this.inner.sampleRows()];
        for (const segment of this.segments) rows.push(...segment.flat);
        return rows;
    }
    viewIds() { return this.inner.viewIds(); }
}

export function makeRowSource(config) {
    const source = config.server ? new ServerRowSource(config) : new ClientRowSource(config);
    return config.tree ? new TreeRowSource(source, config) : source;
}

/* ------------------------------------------------------------------ *
 * Grid state in the URL (search, column filters, sort)                *
 * ------------------------------------------------------------------ */

const isText = (value) => typeof value === 'string' || typeof value === 'number';

/** Validates one filter value against its column's filter kind; returns the cleaned value or null. */
export function cleanFilterValue(kind, value) {
    if (value == null) return null;
    if (kind === 'select') {
        if (!Array.isArray(value)) return null;
        const values = value.filter(isText).map(String);
        return values.length > 0 ? values : null;
    }
    if (kind === 'text') {
        return isText(value) && String(value) !== '' ? String(value) : null;
    }
    if (typeof value !== 'object' || Array.isArray(value)) return null;
    const bounds = kind === 'num' ? ['min', 'max'] : kind === 'date' || kind === 'datetime' ? ['od', 'do'] : null;
    if (!bounds) return null;
    const range = {};
    for (const bound of bounds) {
        const raw = value[bound];
        if (raw == null || raw === '') continue;
        if (kind === 'num' ? !Number.isFinite(Number(raw)) : typeof raw !== 'string') continue;
        range[bound] = String(raw);
    }
    if (kind === 'num' && Array.isArray(value.in)) {
        const picked = value.in.filter(isText).map(String).filter((item) => Number.isFinite(Number(item)));
        if (picked.length > 0) range.in = picked;
    }
    return Object.keys(range).length > 0 ? range : null;
}

/**
 * Reads `{prefix}q`, `{prefix}sort` (key:asc|desc) and `{prefix}f` (JSON filters) from a query
 * string. Unknown columns, columns without a filter and wrongly shaped values are dropped, so
 * stale or hand-edited links never break the grid. Only the keys present in the URL are returned.
 */
export function parseGridState(params, columnsByKey, prefix = '') {
    const search = typeof params === 'string' ? new URLSearchParams(params) : params;
    const state = {};

    if (search.has(prefix + 'q')) state.searchQuery = search.get(prefix + 'q') || '';

    const sort = search.get(prefix + 'sort');
    if (sort) {
        const [key, dir] = sort.split(':');
        if (columnsByKey[key] && (dir === 'asc' || dir === 'desc')) state.sort = { key, dir };
    }

    const filters = search.get(prefix + 'f');
    if (filters) {
        let parsed = null;
        try { parsed = JSON.parse(filters); } catch (error) { /* malformed link */ }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const clean = {};
            for (const key in parsed) {
                const column = columnsByKey[key];
                if (!column || !column.filter) continue;
                const value = cleanFilterValue(column.filter, parsed[key]);
                if (value != null) clean[key] = value;
            }
            state.columnFilters = clean;
        }
    }
    return state;
}

/**
 * Writes the grid state into `params` (a URLSearchParams, mutated and returned). Empty values
 * and a sort equal to `defaultSort` are removed so the default view keeps a clean URL.
 */
export function serializeGridState(params, { searchQuery, columnFilters, sort }, defaultSort = null, prefix = '') {
    if (searchQuery) params.set(prefix + 'q', searchQuery);
    else params.delete(prefix + 'q');

    const isDefault = !sort || !sort.key
        || (defaultSort && defaultSort.key === sort.key && (defaultSort.dir || 'asc') === sort.dir);
    if (isDefault) params.delete(prefix + 'sort');
    else params.set(prefix + 'sort', `${sort.key}:${sort.dir}`);

    const active = {};
    for (const key in columnFilters || {}) {
        const value = columnFilters[key];
        if (isEmptyFilterValue(value)) continue;
        active[key] = value;
    }
    if (Object.keys(active).length > 0) params.set(prefix + 'f', JSON.stringify(active));
    else params.delete(prefix + 'f');

    return params;
}

/* ------------------------------------------------------------------ *
 * Icons                                                               *
 * ------------------------------------------------------------------ */

const PIN_ICON =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>';
const FUNNEL_ICON =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18l-7 8.5V20l-4 1v-8.5z"/></svg>';
const CHEVRON_UP_ICON =
    '<svg class="fi-icon fi-size-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25Z" clip-rule="evenodd"/></svg>';
const CHEVRON_DOWN_ICON =
    '<svg class="fi-icon fi-size-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>';

const actionIconSvg = (path) =>
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
/** Built-in row-action icons, referenced by `action.icon`. */
export const ACTION_ICONS = {
    'arrow-right-circle': actionIconSvg('<path d="M8.25 12h7.5m0 0-3-3m3 3-3 3"/><circle cx="12" cy="12" r="9"/>'),
    'minus-circle': actionIconSvg('<path d="M15 12H9"/><circle cx="12" cy="12" r="9"/>'),
    'arrow-uturn-left': actionIconSvg('<path d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"/>'),
    clock: actionIconSvg('<path d="M12 6v6l4.5 2.5"/><circle cx="12" cy="12" r="9"/>'),
    pencil: actionIconSvg('<path d="M16.5 3.5 20.5 7.5 8 20H4v-4z"/><path d="M13.5 6.5 17.5 10.5"/>'),
    eye: actionIconSvg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'),
    document: actionIconSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'),
};

/* ------------------------------------------------------------------ *
 * The Alpine component                                                *
 * ------------------------------------------------------------------ */

export default function datagrid(config) {
    // Index columns by key once; reused by the row source and the render layer.
    config._columnsByKey = Object.fromEntries((config.columns || []).map((column) => [column.k, column]));

    if (config.tree && (config.selectable || (config.bulkActions || []).length > 0)) {
        console.warn('[datagrid] tree mode does not support selection; selectable/bulkActions are ignored.');
        config.selectable = false;
        config.bulkActions = [];
    }

    return {
        config,
        icons: { funnel: FUNNEL_ICON, chevronUp: CHEVRON_UP_ICON, chevronDown: CHEVRON_DOWN_ICON, pin: PIN_ICON },

        // ---- data ----
        source: null,
        loading: true,
        hydrated: false,   // false until Alpine initializes the component (pre-hydration skeleton)
        filteredCount: 0,

        // ---- view state ----
        searchQuery: '',
        columnFilters: {},
        filterDraft: {},          // robocza kopia filtra dla aktualnie otwartej kolumny
        sort: config.sort || { key: null, dir: 'asc' },
        selectedIds: [],
        allFiltered: false,       // bulk: „zaznacz wszystko" = cały przefiltrowany zbiór (tryb serwerowy)

        // ---- columns (visibility + order + pinning + user widths, persisted) ----
        columnOrder: (config.columns || []).map((column) => column.k),
        visibleKeys: (config.columns || []).filter((column) => !column.off).map((column) => column.k),
        frozenKeys: [...(config.frozen || [])],   // pinned left (sticky) while scrolling sideways
        userWidths: {},                          // key → px, set by dragging a header edge
        resizable: config.resizable !== false,
        stickyActions: !!config.stickyActions,   // actions column pinned to the right edge
        pinActive: true,                         // false on narrow viewports: pinned parts scroll normally
        scrolledX: false,                        // drives the shadow under the pinned edge

        // ---- quick-filter bar ----
        quickFiltersEnabled: Array.isArray(config.quickFilters),
        quickKeys: [...(config.quickFilters || [])],
        quickMenuOpen: false,
        quickSearch: '',

        // ---- vertical window (fixed pool recycled on scroll) ----
        firstIndex: 0,
        poolSize: 40,

        // ---- horizontal window (column virtualization) ----
        // `cellColumns` is what every header/body row iterates: the pinned columns (wrapped with
        // their sticky offset), the left spacer, the scrolled-into-view columns and the right spacer.
        // It is rebuilt only when the window or the layout changes, never per row.
        cellColumns: [],
        firstColIndex: 0,
        lastColIndex: 999,
        leftColSpacer: 0,
        rightColSpacer: 0,
        _columnWidths: null,
        _contentWidths: null,   // measured auto-fit widths per column key
        _measureCtx: null,
        _lastResizeDown: null,  // {key, at} of the previous pointerdown on a resize handle
        _lastScrollLeft: -1,
        _windowSignature: '',

        // ---- popovers / dropdowns ----
        columnMenuOpen: false,
        columnSearch: '',
        draggingFrom: null,
        filterColumn: null,
        filterOptionSearch: '',
        filterStyle: '',

        // ---- misc config-derived ----
        rowActions: config.rowActions || null,
        rowUrl: config.rowUrl || null,   // optional ':id' template — clicking a row opens it
        actionsAutoWidth: config.actionsColumnWidth || 370,  // measured (or configured) actions width
        get actionsColumnWidth() { return this.userWidths[ACTIONS_KEY] || this.actionsAutoWidth; },
        rowHighlight: config.rowHighlight || null,   // {field, class?} — truthy row[field] adds the class
        locale: config.locale || DEFAULT_LOCALE,
        // Akcje masowe = akcje Filamenta montowane z paska zaznaczenia (modal/formularz po stronie app).
        bulkActions: config.bulkActions || [],   // [{name,label,icon?,color?}]
        bulkExport: config.bulkExport || [],     // ['xlsx','csv'] — built-in "export selected" buttons on the bulk bar
        // kolumna checkbox gdy są akcje masowe
        selectable: config.selectable || (config.bulkActions || []).length > 0 || (config.bulkExport || []).length > 0,
        _distinctCache: {},
        serverSummary: null,      // {count, sums} — tryb serwerowy
        _serverOptions: {},       // field → distinct values (tryb serwerowy)
        tree: config.tree || null,   // {column, childrenUrl, indent?}
        treeRevision: 0,          // bumped on expand/collapse so tree-dependent bindings re-evaluate
        urlPrefix: config.urlState ? ((config.urlState && config.urlState.prefix) || '') : null,

        openRow(row) {
            if (row && this.rowUrl) window.location.href = this.rowUrl.replace(':id', row.id);
        },

        /* ---------------------------- lifecycle ---------------------------- */

        async init() {
            this.hydrated = true;
            this.restoreColumnLayout();
            this.restoreSharedSearch();
            this.restoreUrlState();
            this.recomputePoolSize();
            this.recomputeColumnWindow();   // bound the skeleton's columns to the viewport too
            this.source = makeRowSource(this.config);
            if (this.source.onWindowLoaded !== undefined) {
                this.source.onWindowLoaded = () => this.refreshWindowRows();
            }
            this.attachScrollListener();
            if (this.source.mode === 'client') {
                await this.source.load();
            }
            // Zastosuj początkowe sortowanie/filtry i policz wiersze ZANIM zdejmiemy
            // loading — inaczej między hydracją a nadejściem danych mignąłby pusty stan.
            this.filteredCount = await Promise.resolve(this.source.setView({
                searchQuery: this.searchQuery,
                columnFilters: this.columnFilters,
                sort: this.sort,
            }));
            this.computeContentWidths();
            if (this.config.server) this.loadServerSummary();
            this.recomputeColumnWindow();
            this.recomputePadding();
            this.refreshWindowRows();
            this.loading = false;
        },

        /** Placeholder bar width for a skeleton cell — a fraction of the column width. */
        skeletonBarWidth(column) {
            return Math.max(40, Math.round(this.columnWidth(column) * 0.6));
        },

        attachScrollListener() {
            const scroller = this.$refs.scroller;
            if (scroller) scroller.addEventListener('scroll', () => this.onScroll(), { passive: true });
            // Viewport width decides whether pinning is active and how many columns are in view.
            let frame = 0;
            window.addEventListener('resize', () => {
                if (frame) return;
                frame = requestAnimationFrame(() => {
                    frame = 0;
                    this.recomputePoolSize();
                    this.recomputeColumnWindow();
                    this.recomputePadding();
                });
            }, { passive: true });
        },

        /* ------------------------- view pipeline ------------------------- */

        /**
         * Recompute filter+sort (in the source), then reset the window to the top.
         * setView is sync in client mode and async in server mode — Promise.resolve
         * unifies both, so the window/summary refresh once the (possibly remote) view lands.
         */
        applyView() {
            this.persistSharedSearch();
            this.persistUrlState();
            this.treeRevision++;
            Promise.resolve(this.source.setView({
                searchQuery: this.searchQuery,
                columnFilters: this.columnFilters,
                sort: this.sort,
            })).then((count) => {
                this.filteredCount = count;
                this.firstIndex = 0;
                if (this.$refs.scroller) this.$refs.scroller.scrollTop = 0;
                if (!this._contentWidths) this.computeContentWidths(); // first non-empty server view
                this.recomputePoolSize();
                this.recomputeColumnWindow();
                this.recomputePadding();
                this.refreshWindowRows();
                if (this.config.server) this.loadServerSummary();
            });
        },

        /** Tryb serwerowy: podsumowanie liczone w backendzie nad bieżącymi filtrami. */
        loadServerSummary() {
            if (!this.config.summaryUrl) return;
            fetch(this.config.summaryUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': this.config.csrf },
                body: JSON.stringify({ search: this.searchQuery, filters: this.columnFilters }),
            }).then((r) => r.json()).then((data) => { this.serverSummary = data; });
        },

        /** The fixed-length array the template iterates; slot i shows row (firstIndex + i). */
        get windowRows() {
            this.treeRevision;
            const rows = [];
            for (let slot = 0; slot < this.poolSize; slot++) {
                rows.push(this.source.rowAt(this.firstIndex + slot) ?? null);
            }
            return rows;
        },

        refreshWindowRows() {
            this.firstIndex = this.firstIndex; // touch to re-run the getter (server block arrived)
            this.recomputePadding();
        },

        recomputePoolSize() {
            const scroller = this.$refs.scroller;
            const viewportRows = Math.ceil((scroller ? scroller.clientHeight : 600) / ROW_HEIGHT);
            this.poolSize = viewportRows + OVERSCAN_ROWS * 2;
        },

        // Spacer heights are written imperatively (not via a reactive binding) so the rows stay
        // glued to the current scroll position even while the slower content flush catches up —
        // that decoupling is what prevents the blank-gap-during-drag artefact.
        recomputePadding() {
            const total = this.source.total();
            const top = this.firstIndex * ROW_HEIGHT;
            const bottom = Math.max(0, (total - this.firstIndex - this.poolSize) * ROW_HEIGHT);
            if (this.$refs.topSpacer) this.$refs.topSpacer.style.height = top + 'px';
            if (this.$refs.bottomSpacer) this.$refs.bottomSpacer.style.height = bottom + 'px';
        },

        // Runs synchronously per scroll event (cheap): it only updates firstIndex + spacer heights.
        // The expensive part — re-rendering the row content — is Alpine's, coalesced on its own tick.
        onScroll() {
            const scroller = this.$refs.scroller;
            if (!scroller) return;
            // Clamp so the pool never runs past the end (keeps a full pool of real rows at the bottom).
            const maxFirst = Math.max(0, this.source.total() - this.poolSize);
            const nextRow = Math.min(maxFirst, Math.max(0, Math.floor(scroller.scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS));
            if (nextRow !== this.firstIndex) {
                this.firstIndex = nextRow;
                this.recomputePadding();
            }
            if (scroller.scrollLeft !== this._lastScrollLeft) {
                this._lastScrollLeft = scroller.scrollLeft;
                const scrolled = scroller.scrollLeft > 0;
                if (scrolled !== this.scrolledX) this.scrolledX = scrolled;
                this.recomputeColumnWindow();
            }
        },

        /* ------------------------- search ------------------------- */

        onSearchInput() { this.applyView(); },

        restoreSharedSearch() {
            try {
                const saved = localStorage.getItem('ls-search');
                if (saved) this.searchQuery = saved;
            } catch (error) { /* storage unavailable */ }
        },
        persistSharedSearch() {
            try { localStorage.setItem('ls-search', this.searchQuery || ''); } catch (error) { /* */ }
        },

        /* ------------------------- URL state ------------------------- */

        restoreUrlState() {
            if (this.urlPrefix === null) return;
            const state = parseGridState(window.location.search, this.columnsByKey, this.urlPrefix);
            if (state.searchQuery !== undefined) this.searchQuery = state.searchQuery;
            if (state.sort) this.sort = state.sort;
            if (state.columnFilters) this.columnFilters = state.columnFilters;
        },
        persistUrlState() {
            if (this.urlPrefix === null) return;
            try {
                const url = new URL(window.location.href);
                serializeGridState(url.searchParams, {
                    searchQuery: this.searchQuery,
                    columnFilters: this.columnFilters,
                    sort: this.sort,
                }, this.config.sort || null, this.urlPrefix);
                if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
            } catch (error) { /* history unavailable */ }
        },

        /* ------------------------- tree ------------------------- */

        /** URL for a linked cell: `column.link` names the row field that holds it. */
        cellLink(column, row) { return (column.link && row && row[column.link]) || null; },
        /** Badge after the cell text: `column.tag` names the row field, `tagColors` maps value → colour. */
        cellTag(column, row) {
            const raw = column.tag && row ? row[column.tag] : null;
            if (raw == null || raw === '') return null;
            const color = (column.tagColors && column.tagColors[raw]) || 'info';
            return { text: String(raw), cls: `rg-c-${color}` };
        },
        isTreeColumn(column) { return !!this.tree && column.k === this.tree.column; },
        treeIndent(row) { return row ? (row._level || 0) * (this.tree.indent || 18) : 0; },
        isExpanded(row) { this.treeRevision; return this.source.isOpen(row); },
        isTreeLoading(row) { this.treeRevision; return this.source.isLoading(row); },
        hasExpanded() { this.treeRevision; return !!this.tree && !!this.source && this.source.hasOpen(); },
        treeRowClass(row) { return this.tree && row ? `rg-lvl-${row._level || 0}` : ''; },
        toggleRow(row) {
            if (!this.tree || !row || !row._hasChildren) return;
            const done = this.source.toggle(row);
            this.afterTreeChange();
            done.then(() => this.afterTreeChange(), (error) => { console.error(error); this.afterTreeChange(); });
        },
        collapseAll() {
            if (!this.tree) return;
            this.source.collapseAll();
            this.afterTreeChange();
        },
        afterTreeChange() {
            this.treeRevision++;
            const maxFirst = Math.max(0, this.source.total() - this.poolSize);
            if (this.firstIndex > maxFirst) this.firstIndex = maxFirst;
            this.recomputePadding();
        },

        /* ------------------------- sorting ------------------------- */

        toggleSort(key) {
            if (this.sort.key !== key) this.sort = { key, dir: 'asc' };
            else this.sort = { key, dir: this.sort.dir === 'asc' ? 'desc' : 'asc' };
            this.applyView();
        },

        /* ---------------------- columns (order/visibility) ---------------------- */

        get columnsByKey() { return this.config._columnsByKey; },
        get orderedColumns() { return this.columnOrder.map((key) => this.columnsByKey[key]).filter(Boolean); },
        get visibleColumns() {
            return this.columnOrder
                .filter((key) => this.visibleKeys.includes(key))
                .map((key) => this.columnsByKey[key])
                .filter(Boolean);
        },
        /** Visible pinned columns, in column order. They are never virtualized. */
        get frozenColumns() { return this.visibleColumns.filter((column) => this.frozenKeys.includes(column.k)); },
        /** Visible unpinned columns — the ones column virtualization windows over. */
        get scrollColumns() { return this.visibleColumns.filter((column) => !this.frozenKeys.includes(column.k)); },
        get frozenWidth() { return this.frozenColumns.reduce((sum, column) => sum + this.columnWidth(column), 0); },
        get checkboxWidth() { return this.selectable ? CHECKBOX_COLUMN_WIDTH : 0; },
        get tableWidth() {
            return this.checkboxWidth + this.frozenWidth + this.columnWidths().reduce((sum, width) => sum + width, 0)
                + (this.rowActions ? this.actionsColumnWidth : 0);
        },

        // Only the horizontally-visible scroll columns are rendered; spacers fill the rest.
        columnWidths() {
            if (!this._columnWidths) this._columnWidths = this.scrollColumns.map((column) => this.columnWidth(column));
            return this._columnWidths;
        },
        get spacerColspan() {
            // optional checkbox + pinned + spacers + rendered columns + optional actions column
            return (this.selectable ? 1 : 0) + this.cellColumns.length + (this.rowActions ? 1 : 0);
        },
        /**
         * Recompute which scroll columns are in view and rebuild `cellColumns`. With pinning active
         * the checkbox + pinned columns (left) and the actions column (right, when sticky) cover part
         * of the viewport, so only the gap between them is the scroll columns' viewport. Without it
         * (narrow screens) they are ordinary leading/trailing columns.
         */
        recomputeColumnWindow(force = false) {
            const scroller = this.$refs.scroller;
            if (!scroller) return;
            const pinActive = scroller.clientWidth >= (this.config.pinMinViewport || PIN_MIN_VIEWPORT);
            if (pinActive !== this.pinActive) { this.pinActive = pinActive; force = true; }
            const leading = this.checkboxWidth + this.frozenWidth;
            const trailing = this.stickyActions && this.rowActions ? this.actionsColumnWidth : 0;
            const window = pinActive
                ? computeColumnWindow(this.columnWidths(), scroller.scrollLeft, Math.max(0, scroller.clientWidth - leading - trailing), OVERSCAN_COLUMNS, 0)
                : computeColumnWindow(this.columnWidths(), scroller.scrollLeft, scroller.clientWidth, OVERSCAN_COLUMNS, leading);
            const signature = `${window.first}:${window.last}`;
            if (!force && signature === this._windowSignature) return;
            this._windowSignature = signature;
            this.firstColIndex = window.first;
            this.lastColIndex = window.last;
            this.leftColSpacer = window.leftSpacer;
            this.rightColSpacer = window.rightSpacer;

            let left = this.checkboxWidth;
            const frozen = this.frozenColumns;
            const pinned = frozen.map((column, index) => {
                const cell = { ...column, _frozen: true, _left: left, _edge: index === frozen.length - 1 };
                left += this.columnWidth(column);
                return cell;
            });
            this.cellColumns = [
                ...pinned,
                { k: '__left', _spacer: true, _w: window.leftSpacer },
                ...this.scrollColumns.slice(window.first, window.last + 1),
                { k: '__right', _spacer: true, _w: window.rightSpacer },
            ];
        },
        /** Pixel width of a `cellColumns` entry (spacers carry their own). */
        cellWidth(column) { return column._spacer ? column._w : this.columnWidth(column); },
        /** Inline style for a pinned cell: its sticky left offset. */
        cellStyle(column) { return column._frozen ? `left:${column._left}px` : ''; },
        headClass(column) {
            if (column._spacer) return 'rg-spacer';
            return [column.align === 'end' && 'rg-end', column._frozen && 'rg-stick rg-frz', column._edge && 'rg-frz-edge']
                .filter(Boolean).join(' ');
        },

        /** Width resolution: user-dragged → explicit config width → measured content-fit → type heuristic. */
        columnWidth(column) {
            if (this.userWidths[column.k]) return this.userWidths[column.k];
            if (column.width) return column.width;
            if (this._contentWidths && this._contentWidths[column.k] != null) return this._contentWidths[column.k];
            return this.heuristicWidth(column);
        },
        heuristicWidth(column) {
            if (column.type === 'num' || column.type === 'sign') return 110;
            if (column.type === 'datetime') return 150;
            if (column.type === 'date') return 110;
            if (column.badge) return 120;
            if (column.edit) return 180;
            return 150;
        },

        /**
         * Auto-width: measure the widest rendered value per column against the actual cell font
         * (canvas — no DOM), like Handsontable. Client mode measures the whole dataset (sampled
         * above 2000 rows) once per data load; server mode measures the first loaded block once.
         * The result is a stable fixed width that never jumps on scroll. Columns with an explicit
         * config `width` are skipped.
         */
        computeContentWidths() {
            const rows = this.source.loadedRows() ?? (this._contentWidths ? null : this.source.sampleRows());
            if (!rows || rows.length === 0) return;
            const widths = {};
            for (const column of this.config.columns) {
                if (column.width) continue;
                widths[column.k] = this.measureColumn(column, rows, false);
            }
            this._contentWidths = widths;
            if (!this.config.actionsColumnWidth && this.rowActions) this.actionsAutoWidth = this.measureActions(rows);
            this.invalidateLayout(); // the cached width array + pinned offsets must pick up the fit
        },

        /**
         * Width that fits the widest rendered value (and the header) of a column. `exact` skips the
         * min/max clamps — used by the double-click fit, which should match the content like Excel.
         */
        measureColumn(column, rows, exact) {
            const table = this.$refs.scroller && this.$refs.scroller.querySelector('.rg-table');
            const baseFont = table
                ? `${getComputedStyle(table).fontSize} ${getComputedStyle(table).fontFamily}`
                : '13px sans-serif';
            const monoFont = '12.5px ui-monospace, Menlo, monospace';
            // Header labels are bold — measure them with the real header font, taken from a rendered <th>.
            const labelEl = this.$el.querySelector('.rg-th .rg-th-label');
            const headerFont = labelEl
                ? (() => { const s = getComputedStyle(labelEl); return `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`; })()
                : `600 ${baseFont}`;
            const ctx = this._measureCtx || (this._measureCtx = document.createElement('canvas').getContext('2d'));

            const CELL_PADDING = 24;        // .rg-td left+right padding
            const HEADER_PADDING = 24;      // .rg-th left+right padding
            const SORT_ICON = 23;           // sort chevron (20) + its gap (3), always present
            const FUNNEL_ICON = 18;         // filter funnel (17) + its margin, only on filterable columns
            const HEADER_GAPS = 2;          // flex gap before the funnel + rounding slack
            const COMPACT_LABEL = 56;       // compactHeaders: minimum visible label width
            const TREE_TOGGLE = 26;         // chevron + gap in front of a tree cell
            const TAG_PADDING = 28;         // badge padding + border + gap after the text
            const step = Math.max(1, Math.floor(rows.length / 2000)); // sample big datasets
            const tree = this.isTreeColumn(column);

            ctx.font = column.mono ? monoFont : baseFont;
            let cellWidth = 0;
            for (let i = 0; i < rows.length; i += step) {
                const row = rows[i];
                if (!row) continue;
                const text = column.edit && this.canEdit(column, row)
                    ? String(row[column.k] ?? column.placeholder ?? '')
                    : this.computeCell(row, column).text;
                const tag = this.cellTag(column, row);
                const width = ctx.measureText(text).width + (tree ? this.treeIndent(row) + TREE_TOGGLE : 0)
                    + (tag ? ctx.measureText(tag.text).width + TAG_PADDING : 0);
                if (width > cellWidth) cellWidth = width;
            }
            cellWidth += CELL_PADDING + (column.badge ? 20 : 0);

            ctx.font = headerFont;
            // compactHeaders: the column is sized by its content, not by a long header — the
            // one-line label is truncated with an ellipsis, keeping at least COMPACT_LABEL px of it.
            const labelWidth = ctx.measureText(column.t).width;
            const headerWidth = (this.config.compactHeaders ? Math.min(labelWidth, COMPACT_LABEL) : labelWidth) + HEADER_PADDING + SORT_ICON + HEADER_GAPS
                + (column.filter ? FUNNEL_ICON : 0);
            const fit = Math.ceil(Math.max(cellWidth, headerWidth));
            if (exact) return clampColumnWidth(fit);
            const min = column.minWidth || (column.edit ? 180 : 72);
            const max = column.maxWidth || 460;
            return Math.round(Math.min(max, Math.max(min, fit)));
        },

        /** Actions column width: the widest set of buttons any measured row shows (all actions without rows). */
        measureActions(rows) {
            const table = this.$refs.scroller && this.$refs.scroller.querySelector('.rg-table');
            const family = table ? getComputedStyle(table).fontFamily : 'sans-serif';
            const ctx = this._measureCtx || (this._measureCtx = document.createElement('canvas').getContext('2d'));
            ctx.font = `500 12.5px ${family}`;
            const BUTTON = 6 + 14 + 5 + 6;  // padding + icon + gap + padding
            const GAP = 6;                  // .rg-acts-in gap
            const CELL_PADDING = 24;
            const setWidth = (actions) => actions.reduce((sum, action) => sum + ctx.measureText(action.label).width + BUTTON, 0)
                + Math.max(0, actions.length - 1) * GAP;
            let widest = 0;
            const step = Math.max(1, Math.floor(rows.length / 2000));
            for (let i = 0; i < rows.length; i += step) {
                if (rows[i]) widest = Math.max(widest, setWidth(this.actionsFor(rows[i])));
            }
            if (widest === 0) widest = setWidth(this.rowActions);
            return Math.ceil(widest + CELL_PADDING + 4);
        },

        /** Drop cached widths/window so the next recomputeColumnWindow rebuilds everything. */
        invalidateLayout() {
            this._columnWidths = null;
            this._windowSignature = '';
            this._lastScrollLeft = -1;
        },

        toggleColumn(key) {
            const index = this.visibleKeys.indexOf(key);
            if (index >= 0) this.visibleKeys.splice(index, 1);
            else this.visibleKeys.push(key);
            this.onColumnsChanged();
        },
        dropColumn(toIndex) {
            const fromIndex = this.draggingFrom;
            this.draggingFrom = null;
            if (fromIndex == null || fromIndex === toIndex) return;
            const order = [...this.columnOrder];
            const [moved] = order.splice(fromIndex, 1);
            order.splice(toIndex, 0, moved);
            this.columnOrder = order;
            this.onColumnsChanged();
        },
        resetColumns() {
            this.columnOrder = this.config.columns.map((column) => column.k);
            this.visibleKeys = this.config.columns.filter((column) => !column.off).map((column) => column.k);
            this.frozenKeys = [...(this.config.frozen || [])];
            this.userWidths = {};
            this.stickyActions = !!this.config.stickyActions;
            this.onColumnsChanged();
        },
        /** Pin / unpin a column; pinning a hidden column shows it. A pinned column can still be hidden — it keeps its pin for when it is shown again. */
        togglePin(key) {
            if (this.frozenKeys.includes(key)) {
                this.frozenKeys = this.frozenKeys.filter((frozen) => frozen !== key);
            } else {
                this.frozenKeys = [...this.frozenKeys, key];
                if (!this.visibleKeys.includes(key)) this.visibleKeys.push(key);
            }
            this.onColumnsChanged();
        },
        isPinned(key) { return this.frozenKeys.includes(key); },
        /** Pin / unpin the actions column to the right edge (it cannot be hidden or moved). */
        toggleStickyActions() {
            this.stickyActions = !this.stickyActions;
            this.onColumnsChanged();
        },
        /** Column picker search (#columns with long lists). */
        columnMatchesSearch(column) {
            const needle = this.columnSearch.trim().toLowerCase();
            return !needle || String(column.t).toLowerCase().includes(needle) || column.k.toLowerCase().includes(needle);
        },
        onColumnsChanged() {
            this.invalidateLayout();   // widths / pinned set changed → rebuild the horizontal window
            this.recomputeColumnWindow(true);
            this.persistColumnLayout();
        },

        /* ---------------------- column resize (drag a header edge) ---------------------- */

        /**
         * Pointer-drag on a header's right edge sets a user width for that column (persisted with
         * the layout). Pointer capture keeps the drag alive outside the handle; updates are batched
         * per animation frame. Double-click the edge to fit the column to its loaded content.
         */
        /** The actions column sits at the right edge, so it is resized from its left edge. */
        startActionsResize(event) {
            this.startResize({ k: ACTIONS_KEY }, event, -1);
        },
        startResize(column, event, direction = 1) {
            // Detect the double-click here: the drag's pointer capture can swallow a native dblclick.
            const now = Date.now();
            const last = this._lastResizeDown;
            this._lastResizeDown = { key: column.k, at: now };
            if (last && last.key === column.k && now - last.at < 400) {
                this._lastResizeDown = null;
                this.fitColumn(column);
                return;
            }
            const handle = event.currentTarget;
            const startX = event.clientX;
            const startWidth = column.k === ACTIONS_KEY ? this.actionsColumnWidth : this.columnWidth(column);
            let frame = 0;
            let width = startWidth;
            try { handle.setPointerCapture(event.pointerId); } catch (error) { /* synthetic event */ }
            document.body.classList.add('rg-resizing');

            const move = (moveEvent) => {
                width = clampColumnWidth(startWidth + direction * (moveEvent.clientX - startX));
                if (frame) return;
                frame = requestAnimationFrame(() => {
                    frame = 0;
                    this.userWidths = { ...this.userWidths, [column.k]: width };
                    this.invalidateLayout();
                    this.recomputeColumnWindow(true);
                });
            };
            const end = () => {
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', end);
                handle.removeEventListener('pointercancel', end);
                document.body.classList.remove('rg-resizing');
                if (frame) cancelAnimationFrame(frame);
                if (width !== startWidth) {
                    this.userWidths = { ...this.userWidths, [column.k]: width };
                    this.onColumnsChanged();
                }
            };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', end);
            handle.addEventListener('pointercancel', end);
        },
        fitColumn(column) {
            const rows = this.source.sampleRows();
            if (!rows || rows.length === 0) return;
            const width = column.k === ACTIONS_KEY ? this.measureActions(rows) : this.measureColumn(column, rows, true);
            this.userWidths = { ...this.userWidths, [column.k]: width };
            this.onColumnsChanged();
        },
        resetWidth(key) {
            if (!(key in this.userWidths)) return;
            const widths = { ...this.userWidths };
            delete widths[key];
            this.userWidths = widths;
            this.onColumnsChanged();
        },

        persistColumnLayout() {
            const key = this.config.storageKey || 'rg-cols';
            try {
                localStorage.setItem(key, JSON.stringify({
                    v: this.visibleKeys, o: this.columnOrder, f: this.frozenKeys, w: this.userWidths, q: this.quickKeys,
                    a: this.stickyActions, d: layoutDefaults(this.config),
                }));
            } catch (error) { /* */ }
        },
        restoreColumnLayout() {
            try {
                const saved = JSON.parse(localStorage.getItem(this.config.storageKey || 'rg-cols') || 'null');
                if (!saved || !Array.isArray(saved.v) || !Array.isArray(saved.o)) return;
                const known = this.config.columns.map((column) => column.k);
                const layout = mergeColumnLayout(saved, this.config);
                this.columnOrder = layout.o;
                this.visibleKeys = layout.v;
                this.frozenKeys = layout.f;
                this.stickyActions = layout.a;
                if (saved.w && typeof saved.w === 'object') {
                    const widths = {};
                    for (const key in saved.w) if (known.includes(key) || key === ACTIONS_KEY) widths[key] = clampColumnWidth(saved.w[key]);
                    this.userWidths = widths;
                }
                if (this.quickFiltersEnabled) {
                    this.quickKeys = layout.q.filter((key) => this.columnsByKey[key] && this.columnsByKey[key].filter);
                }
            } catch (error) { /* */ }
        },

        /* ------------------------- quick-filter bar ------------------------- */

        /** Columns shown as pills on the quick-filter bar (filterable ones only). */
        get quickColumns() {
            return this.quickKeys.map((key) => this.columnsByKey[key]).filter((column) => column && column.filter);
        },
        /** Filterable columns not yet on the bar, matching the "Add filter" search. */
        quickCandidates() {
            const needle = this.quickSearch.trim().toLowerCase();
            return this.orderedColumns.filter((column) => column.filter && !this.quickKeys.includes(column.k)
                && (!needle || String(column.t).toLowerCase().includes(needle)));
        },
        toggleQuickFilter(key) {
            this.quickKeys = this.quickKeys.includes(key)
                ? this.quickKeys.filter((quick) => quick !== key)
                : [...this.quickKeys, key];
            this.persistColumnLayout();
        },
        /** "Add filter" → put the column on the bar and open its filter under the new pill. */
        addQuickFilter(column) {
            this.quickMenuOpen = false;
            if (!this.quickKeys.includes(column.k)) this.toggleQuickFilter(column.k);
            this.$nextTick(() => {
                const pill = [...this.$el.querySelectorAll('[data-quick-key]')].find((element) => element.dataset.quickKey === column.k);
                if (pill) this.openFilterAt(column, pill.getBoundingClientRect());
            });
        },
        /** How many things a column filter narrows by — the count badge on its pill. */
        filterCount(key) {
            const value = this.columnFilters[key];
            if (isEmptyFilterValue(value)) return 0;
            if (Array.isArray(value)) return value.length;
            if (typeof value === 'object') {
                const picked = Array.isArray(value.in) ? value.in.length : 0;
                const ranged = Object.entries(value).some(([bound, item]) => bound !== 'in' && !isEmptyFilterValue(item));
                return picked + (ranged ? 1 : 0);
            }
            return 1;
        },

        /* ------------------------- per-column filters ------------------------- */

        filterIsActive(column) {
            return !isEmptyFilterValue(this.columnFilters[column.k]);
        },
        openFilter(column, event) {
            if (this.filterColumn && this.filterColumn.k === column.k) { this.filterColumn = null; return; }
            this.openFilterAt(column, event.currentTarget.getBoundingClientRect());
        },
        /** Open the filter popover for a column under an anchor rect (header funnel, bar pill, chip). */
        openFilterAt(column, rect) {
            this.filterOptionSearch = '';
            this.filterColumn = this.columnsByKey[column.k] || column;
            // Seed draft z zatwierdzonej wartości (głęboka kopia), bez dotykania columnFilters.
            const current = this.columnFilters[column.k];
            this.filterDraft = { [column.k]: current == null ? null : JSON.parse(JSON.stringify(current)) };
            const left = Math.min(Math.max(8, rect.left - 40), Math.max(8, window.innerWidth - 280));
            this.filterStyle = `top:${rect.bottom + 4}px;left:${left}px`;
            if (this.config.server && (column.filter === 'select' || column.filter === 'num')) this.fetchServerOptions(column.k);
        },
        /** Num filters offer a pick-list of the column's values next to the range, unless turned off. */
        numValueList(column) {
            if (!column || column.filter !== 'num' || column.valueList === false || this.config.numValueList === false) return false;
            const values = this.distinctFor(column.k);
            return values.length > 0 && values.length <= (this.config.numValueListMax || 500);
        },
        toggleNumValue(key, value) {
            const draft = { ...(this.filterDraft[key] || {}) };
            const picked = Array.isArray(draft.in) ? [...draft.in] : [];
            const index = picked.indexOf(value);
            if (index >= 0) picked.splice(index, 1);
            else picked.push(value);
            draft.in = picked;
            this.filterDraft[key] = draft;
        },
        numValuePicked(key, value) {
            const draft = this.filterDraft[key];
            return !!draft && Array.isArray(draft.in) && draft.in.includes(value);
        },
        optionMatches(option) {
            return !this.filterOptionSearch || String(option.label).toLowerCase().includes(this.filterOptionSearch.toLowerCase());
        },
        /** Tryb serwerowy: opcje filtra select pobierane leniwie z backendu. */
        fetchServerOptions(field) {
            if (this._serverOptions[field] || !this.config.optionsUrl) return;
            fetch(this.config.optionsUrl + '?col=' + encodeURIComponent(field), { headers: { Accept: 'application/json' } })
                .then((r) => r.json())
                .then((data) => { this._serverOptions = { ...this._serverOptions, [field]: data.values || [] }; });
        },
        distinctFor(field) {
            if (this.config.server) return this._serverOptions[field] || [];
            if (!this._distinctCache[field]) {
                const rows = (this.source && this.source.loadedRows()) || [];
                const column = this.columnsByKey[field];
                this._distinctCache[field] = distinctValues(rows, field, !!column && column.filter === 'num');
            }
            return this._distinctCache[field];
        },
        filterOptions(column) {
            const numeric = column.filter === 'num';
            const label = (value) => (numeric ? formatNumber(value, this.locale) : valueLabel(column, value));
            // Backend może zwrócić skalary lub obiekty {value,label} (np. sentinel „(puste)").
            return this.distinctFor(column.k).map((item) => (item && typeof item === 'object')
                ? { value: String(item.value), label: item.label ?? label(item.value) }
                : { value: String(item), label: label(item) });
        },
        // Filtry są ODROCZONE: edycja trafia do draftu dla otwartej kolumny,
        // a widok odświeża się dopiero po „Zastosuj" (applyFilter). Zamknięcie
        // popovera bez „Zastosuj" (klik poza / Escape) porzuca draft.
        toggleFilterValue(key, value) {
            const values = Array.isArray(this.filterDraft[key]) ? [...this.filterDraft[key]] : [];
            const index = values.indexOf(value);
            if (index >= 0) values.splice(index, 1);
            else values.push(value);
            this.filterDraft[key] = values;
        },
        setTextFilter(key, value) { this.filterDraft[key] = value || null; },
        setRangeBound(key, bound, value) {
            const range = { ...(this.filterDraft[key] || {}) };
            range[bound] = value || null;
            this.filterDraft[key] = range;
        },
        setNumberBound(key, bound, value) {
            const range = { ...(this.filterDraft[key] || {}) };
            range[bound] = value === '' ? null : value;
            this.filterDraft[key] = range;
        },

        /** Czy wartość filtra jest „pusta" (nic nie zawęża). */
        filterValueEmpty(value) {
            return isEmptyFilterValue(value);
        },

        /** „Zastosuj": zatwierdź draft otwartej kolumny i odśwież widok. */
        applyFilter(key) {
            const value = this.filterDraft[key];
            if (this.filterValueEmpty(value)) delete this.columnFilters[key];
            else this.columnFilters[key] = value;
            this.filterColumn = null;
            this.applyView();
        },

        clearFilter(key) {
            delete this.columnFilters[key];
            delete this.filterDraft[key];
            this.filterColumn = null;
            this.applyView();
        },

        /** Klucze aktywnych filtrów w kolejności kolumn. */
        activeFilterKeys() {
            const active = Object.keys(this.columnFilters).filter((k) => !this.filterValueEmpty(this.columnFilters[k]));
            const order = (this.columnOrder && this.columnOrder.length) ? this.columnOrder : active;
            const ordered = order.filter((k) => active.includes(k));
            return ordered.concat(active.filter((k) => !ordered.includes(k)));
        },

        /** Liczba aktywnych filtrów kolumn — do badge w pasku narzędzi. */
        activeFilterCount() {
            return this.activeFilterKeys().length;
        },

        /** Podsumowanie badge: nazwy kolumn (do 3) + „+x". */
        filterSummary() {
            const names = this.activeFilterKeys().map((k) => (this.columnsByKey[k] && this.columnsByKey[k].t) || k);
            if (names.length <= 3) return names.join(', ');
            return names.slice(0, 3).join(', ') + ' +' + (names.length - 3);
        },

        /** Wyczyść wszystkie filtry kolumn naraz (`withSearch` — także wyszukiwanie). */
        clearAllFilters(withSearch = false) {
            this.columnFilters = {};
            this.filterDraft = {};
            this.filterColumn = null;
            if (withSearch) this.searchQuery = '';
            this.applyView();
        },

        /** Czy cokolwiek zawęża widok (filtry kolumn lub wyszukiwanie). */
        isNarrowed() {
            return this.activeFilterCount() > 0 || !!this.searchQuery;
        },

        /** `filterChips`: one removable chip per active column filter, `{key, label, text}`. */
        filterChips() {
            return this.activeFilterKeys().map((key) => {
                const column = this.columnsByKey[key] || { k: key, t: key };
                return { key, label: column.t, text: describeFilterValue(column, this.columnFilters[key], this.locale) };
            });
        },
        clearSearch() {
            this.searchQuery = '';
            this.applyView();
        },

        /* ------------------------- selection ------------------------- */

        allSelected() {
            const total = this.source.total();
            if (this.allFiltered) return total > 0;
            return total > 0 && this.selectedIds.length >= total;
        },
        /**
         * Nagłówkowy „zaznacz wszystko". W trybie klienta wybieramy konkretne id widoku.
         * W trybie serwerowym nie znamy wszystkich id (ładujemy blokami) — ustawiamy flagę
         * allFiltered, którą backend tłumaczy na „cały przefiltrowany zbiór".
         */
        toggleSelectAll() {
            if (this.allSelected()) { this.clearSelection(); return; }
            const ids = this.source.viewIds();
            if (ids) { this.selectedIds = ids; this.allFiltered = false; }
            else { this.allFiltered = true; this.selectedIds = []; }   // tryb serwerowy
        },
        toggleRowSelection(id) {
            if (this.allFiltered) return;   // przy „wszystko przefiltrowane" pojedyncze wiersze są zablokowane
            const index = this.selectedIds.indexOf(id);
            if (index >= 0) this.selectedIds.splice(index, 1);
            else this.selectedIds.push(id);
        },
        isRowSelected(id) { return this.allFiltered || this.selectedIds.includes(id); },

        /* ------------------------- akcja masowa ------------------------- */

        selectionCount() {
            return this.allFiltered ? this.source.total() : this.selectedIds.length;
        },
        hasSelection() { return this.selectionCount() > 0; },
        clearSelection() { this.selectedIds = []; this.allFiltered = false; },

        /** Opis bieżącego zaznaczenia przekazywany do akcji (serwer odtwarza zakres). */
        selectionPayload() {
            return {
                all: this.allFiltered,
                ids: this.allFiltered ? [] : this.selectedIds,
                search: this.searchQuery || '',
                filters: this.columnFilters || {},
            };
        },

        /**
         * Montuje akcję masową Filamenta z zaznaczeniem w argumencie `bulk`
         * (analogicznie do akcji wierszowych z { record: id }). Formularz/potwierdzenie
         * i zapis są po stronie aplikacji; po sukcesie app wysyła rg-refresh / rg-clear-selection.
         */
        bulkAction(name) {
            if (this.$wire) this.$wire.mountAction(name, { bulk: this.selectionPayload() });
        },
        actionColorClass(color) {
            return color === 'primary' ? 'rg-btn-filled' : 'rg-btn-outline';
        },

        rowHighlightClass(row) {
            if (!row || !this.rowHighlight || !row[this.rowHighlight.field]) return '';
            return this.rowHighlight.class || 'rg-alert';
        },

        /* ------------------------- cell rendering (cached) ------------------------- */

        /** Returns cached { text, cls, title } for a cell — computed once per row+column. */
        cellView(row, column) {
            if (!row) return EMPTY_CELL;
            const cache = row._cells || (row._cells = {});
            return cache[column.k] || (cache[column.k] = this.computeCell(row, column));
        },
        computeCell(row, column) {
            const raw = row[column.k];
            if (column.type === 'datetime') return { text: formatDateTime(raw), cls: '', title: '' };
            if (column.type === 'date') return { text: formatDate(raw), cls: '', title: '' };
            if ((column.type === 'num' || column.type === 'sign') && (raw == null || raw === '')) return EMPTY_CELL;
            if (column.type === 'num') return { text: formatNumber(raw, this.locale), cls: '', title: '' };
            if (column.type === 'sign') {
                const n = Number(raw) || 0;
                return { text: formatNumber(n, this.locale), cls: n < 0 ? 'rg-neg' : n > 0 ? 'rg-pos' : '', title: '' };
            }
            const value = valueLabel(column, raw);
            if (column.badge && value) {
                const color = (column.badgeColors && column.badgeColors[raw]) || column.badgeColor || 'info';
                return { text: String(value), cls: `rg-badge rg-c-${color}`, title: String(raw ?? '') };
            }
            return { text: String(value ?? ''), cls: '', title: '' };
        },
        cellClass(column, row) {
            return [
                column._frozen && 'rg-stick rg-frz',
                column._edge && 'rg-frz-edge',
                column.align === 'end' && 'rg-end',
                column.mono && 'rg-mono',
                column.bold && 'rg-bold',
                this.canEdit(column, row) && 'rg-edit',
                this.isTreeColumn(column) && 'rg-tree-cell',
            ].filter(Boolean).join(' ');
        },
        /** `column.edit`: true = every row; a string = only rows where that field is truthy. */
        canEdit(column, row) {
            if (typeof column.edit === 'string') return !!row && !!row[column.edit];
            return !!column.edit;
        },

        /* ------------------------- editable cells ------------------------- */

        saveCell(row, key, value) {
            row[key] = value;                     // optimistic
            row._cells = {};                      // invalidate cached display for this row
            if (!this.$wire || !this.$wire.saveCell) return;
            this.$wire.saveCell(row.id, key, value).then((changes) => {
                if (!changes) return;
                Object.assign(row, changes);
                row._cells = {};
            });
        },

        /* ------------------------- row actions ------------------------- */

        actionsFor(row) {
            if (!this.rowActions || !row) return [];
            return this.rowActions.filter((action) => this.actionIsVisible(action, row));
        },
        actionIsVisible(action, row) {
            return action.when ? !!row[action.when] : true;
        },
        actionIcon(action) { return ACTION_ICONS[action.icon] || ''; },
        mountAction(name, id) { if (this.$wire) this.$wire.mountAction(name, { record: id }); },

        /* ------------------------- summary bar ------------------------- */

        /** `config.summary`: `[{key, label, agg: 'count'|'sum', format: 'number'|'int'}]`. */
        summaryHtml() {
            const items = this.config.summary || [];
            const sums = {};
            // Client mode sums the in-memory rows; server mode gets aggregates from the backend.
            if (!this.loading && !this.config.server) {
                const sumKeys = items.filter((item) => item.agg === 'sum').map((item) => item.key);
                for (const key of sumKeys) sums[key] = 0;
                if (sumKeys.length > 0) {
                    for (const row of this.iterateViewRows()) {
                        for (const key of sumKeys) sums[key] += Number(row[key]) || 0;
                    }
                }
            }
            const separator = '<span class="rg-sep">·</span>';
            return items.map((item) => `${escapeHtml(item.label)}: <b>${this.summaryValue(item, sums)}</b>`).join(separator);
        },
        summaryValue(item, sums) {
            if (this.loading) return '–';
            let value;
            if (this.config.server) {
                if (!this.serverSummary) return '–';
                value = item.agg === 'count' ? this.serverSummary.count : (this.serverSummary.sums?.[item.key] ?? 0);
            } else {
                value = item.agg === 'count' ? this.filteredCount : sums[item.key];
            }
            return item.format === 'int' || item.agg === 'count'
                ? formatInteger(value, this.locale)
                : formatNumber(value, this.locale);
        },
        /** Iterate the current filtered view (client mode has every row; server mode has the window). */
        *iterateViewRows() {
            const total = this.source.total();
            for (let index = 0; index < total; index++) {
                const row = this.source.rowAt(index);
                if (row) yield row;
            }
        },

        /* ------------------------- export ------------------------- */

        /**
         * Export the visible columns of the current view. `selectedOnly` narrows it to the checked
         * rows (kept in view order); "select all" in server mode still exports the whole filtered set.
         */
        exportFile(extension, selectedOnly = false) {
            const withLabels = !!this.config.exportLabels;
            const columns = this.visibleColumns.map((column) => ({
                key: column.k,
                label: column.t,
                ...(withLabels && column.valueLabels ? { valueLabels: column.valueLabels } : {}),
            }));
            const explicitSelection = selectedOnly && !this.allFiltered && this.selectedIds.length > 0;
            let body;
            if (explicitSelection) {
                const chosen = new Set(this.selectedIds);
                const viewIds = this.source.viewIds();
                body = { ids: viewIds ? viewIds.filter((id) => chosen.has(id)) : [...this.selectedIds], columns };
            } else if (this.config.server) {
                // Server mode: no client-side id list — the backend re-runs the filtered query.
                body = { server: 1, columns, search: this.searchQuery, filters: this.columnFilters, sort: this.sort };
            } else {
                body = { ids: this.source.viewIds(), columns };
            }
            fetch(this.config.exportUrl + '.' + extension, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': this.config.csrf },
                body: JSON.stringify(body),
            })
                .then((response) => {
                    // Never hand an error page (419 expired session, 500…) to the user as the file.
                    if (!response.ok) throw Object.assign(new Error(`Export failed (${response.status})`), { status: response.status });
                    return response.blob();
                })
                .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = (this.config.exportName || 'export') + '.' + extension;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                })
                .catch((error) => {
                    console.error(error);
                    const messages = this.config.i18n || {};
                    this.notifyError(error.status === 419
                        ? (messages.sessionExpired || 'Session expired — reload the page and try again.')
                        : (messages.exportFailed || 'Export failed.'));
                });
        },
        notifyError(message) {
            if (window.FilamentNotification) new window.FilamentNotification().title(message).danger().send();
            else window.alert(message);
        },

        /* ------------------------- external events ------------------------- */

        async reload() {
            await this.source.load();
            this.computeContentWidths();
            this._distinctCache = {};
            this.recomputeColumnWindow(true);
            this.selectedIds = [];
            this.allFiltered = false;
            this.applyView();
        },
    };
}

const EMPTY_CELL = { text: '', cls: '', title: '' };

/** Display text for a raw cell value: `column.valueLabels[raw]` when mapped, else the raw value. */
function valueLabel(column, raw) {
    if (column.valueLabels && raw != null && column.valueLabels[raw] != null) return column.valueLabels[raw];
    return raw;
}
