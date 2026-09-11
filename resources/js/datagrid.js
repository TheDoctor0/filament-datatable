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

/**
 * Does a row pass a single column filter? `kind` is the column's declared filter type.
 * Values shapes: select → array; num → {min,max}; datetime/date → {od,do}; text → string.
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
        const numeric = Number(cellValue) || 0;
        if (filterValue.min != null && filterValue.min !== '' && numeric < Number(filterValue.min)) return false;
        if (filterValue.max != null && filterValue.max !== '' && numeric > Number(filterValue.max)) return false;
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

/** Distinct, sorted, non-empty values of a field across rows — for select-filter options. */
export function distinctValues(rows, field) {
    const seen = new Set();
    for (const row of rows) {
        const value = row[field];
        if (value != null && value !== '') seen.add(String(value));
    }
    return [...seen].sort();
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
        this.query = { searchQuery: '', columnFilters: {}, sort: {} };
        this.onWindowLoaded = () => {};
    }

    get mode() { return 'server'; }

    async load() {
        await this.setView(this.query); // first request establishes the total
    }

    async setView(query) {
        this.query = query;
        this.blocks.clear();
        this.pending.clear();
        const payload = await this.request(0, this.blockSize);
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
        this.pending.add(blockIndex);
        this.request(blockIndex * this.blockSize, this.blockSize).then((payload) => {
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
        // Ignore out-of-order responses (the classic DataTables `draw` guard).
        if (data.draw < this.draw && start === 0) return { rows: [], filtered: this.filteredTotal };
        for (const row of data.rows) row._search = '';
        return { rows: data.rows, filtered: data.recordsFiltered };
    }

    total() { return this.filteredTotal; }
    loadedRows() { return null; }   // server mode: distinct options / summary come from the backend
    viewIds() { return null; }      // server mode: export re-runs the query server-side
}

export function makeRowSource(config) {
    return config.server ? new ServerRowSource(config) : new ClientRowSource(config);
}

/* ------------------------------------------------------------------ *
 * Icons                                                               *
 * ------------------------------------------------------------------ */

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

    return {
        config,
        icons: { funnel: FUNNEL_ICON, chevronUp: CHEVRON_UP_ICON, chevronDown: CHEVRON_DOWN_ICON },

        // ---- data ----
        source: null,
        loading: true,
        hydrated: false,   // false until Alpine initializes the component (pre-hydration skeleton)
        filteredCount: 0,

        // ---- view state ----
        searchQuery: '',
        columnFilters: {},
        sort: config.sort || { key: null, dir: 'asc' },
        selectedIds: [],

        // ---- columns (visibility + order, persisted) ----
        columnOrder: (config.columns || []).map((column) => column.k),
        visibleKeys: (config.columns || []).filter((column) => !column.off).map((column) => column.k),

        // ---- vertical window (fixed pool recycled on scroll) ----
        firstIndex: 0,
        poolSize: 40,

        // ---- horizontal window (column virtualization) ----
        firstColIndex: 0,
        lastColIndex: 999,
        leftColSpacer: 0,
        rightColSpacer: 0,
        _columnWidths: null,
        _contentWidths: null,   // measured auto-fit widths per column key
        _measureCtx: null,
        _lastScrollLeft: -1,

        // ---- popovers / dropdowns ----
        columnMenuOpen: false,
        draggingFrom: null,
        filterColumn: null,
        filterOptionSearch: '',
        filterStyle: '',

        // ---- misc config-derived ----
        rowActions: config.rowActions || null,
        rowUrl: config.rowUrl || null,   // optional ':id' template — clicking a row opens it
        actionsColumnWidth: config.actionsColumnWidth || 370,
        rowHighlight: config.rowHighlight || null,   // {field, class?} — truthy row[field] adds the class
        locale: config.locale || DEFAULT_LOCALE,
        selectable: config.selectable || false,   // only show the checkbox column when bulk selection is used
        _distinctCache: {},

        openRow(row) {
            if (row && this.rowUrl) window.location.href = this.rowUrl.replace(':id', row.id);
        },

        /* ---------------------------- lifecycle ---------------------------- */

        async init() {
            this.hydrated = true;
            this.restoreColumnLayout();
            this.restoreSharedSearch();
            this.recomputePoolSize();
            this.recomputeColumnWindow();   // bound the skeleton's columns to the viewport too
            this.source = makeRowSource(this.config);
            if (this.source.onWindowLoaded !== undefined) {
                this.source.onWindowLoaded = () => this.refreshWindowRows();
            }
            this.attachScrollListener();
            await this.source.load();
            this.computeContentWidths();
            this.loading = false;
            this.applyView();
        },

        /** Placeholder bar width for a skeleton cell — a fraction of the column width. */
        skeletonBarWidth(column) {
            return Math.max(40, Math.round(this.columnWidth(column) * 0.6));
        },

        attachScrollListener() {
            const scroller = this.$refs.scroller;
            if (scroller) scroller.addEventListener('scroll', () => this.onScroll(), { passive: true });
        },

        /* ------------------------- view pipeline ------------------------- */

        /** Recompute filter+sort (in the source), then reset the window to the top. */
        applyView() {
            this.persistSharedSearch();
            this.filteredCount = this.source.setView({
                searchQuery: this.searchQuery,
                columnFilters: this.columnFilters,
                sort: this.sort,
            });
            this.recomputePoolSize();
            this.recomputeColumnWindow();
            this.firstIndex = 0;
            if (this.$refs.scroller) this.$refs.scroller.scrollTop = 0;
            this.recomputePadding();
        },

        /** The fixed-length array the template iterates; slot i shows row (firstIndex + i). */
        get windowRows() {
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
        get totalColumnsWidth() {
            return this.columnWidths().reduce((sum, width) => sum + width, 0);
        },

        // Only the horizontally-visible columns are rendered; spacers fill the rest.
        columnWidths() {
            if (!this._columnWidths) this._columnWidths = this.visibleColumns.map((column) => this.columnWidth(column));
            return this._columnWidths;
        },
        get renderedColumns() {
            return this.visibleColumns.slice(this.firstColIndex, this.lastColIndex + 1);
        },
        get leadWidth() { return this.selectable ? CHECKBOX_COLUMN_WIDTH : 0; },
        get spacerColspan() {
            // optional checkbox + left spacer + rendered columns + right spacer + optional actions column
            return (this.selectable ? 1 : 0) + 2 + this.renderedColumns.length + (this.rowActions ? 1 : 0);
        },
        recomputeColumnWindow() {
            const scroller = this.$refs.scroller;
            if (!scroller) return;
            const window = computeColumnWindow(this.columnWidths(), scroller.scrollLeft, scroller.clientWidth, OVERSCAN_COLUMNS, this.leadWidth);
            this.firstColIndex = window.first;
            this.lastColIndex = window.last;
            this.leftColSpacer = window.leftSpacer;
            this.rightColSpacer = window.rightSpacer;
        },

        /** Width resolution: explicit config width → measured content-fit → type heuristic. */
        columnWidth(column) {
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
         * above 2000 rows); result is a stable fixed width that never jumps on scroll. Columns
         * with an explicit config `width` are skipped. Runs once per data load.
         */
        computeContentWidths() {
            const rows = this.source.loadedRows();
            if (!rows || rows.length === 0) return;
            const table = this.$refs.scroller && this.$refs.scroller.querySelector('.rg-table');
            const baseFont = table
                ? `${getComputedStyle(table).fontSize} ${getComputedStyle(table).fontFamily}`
                : '13px sans-serif';
            const monoFont = '12.5px ui-monospace, Menlo, monospace';
            // Header labels are bold — measure them with the real header font, taken from a rendered <th>.
            const labelEl = this.$el.querySelector('.rg-th .rg-th-in > span');
            const headerFont = labelEl
                ? (() => { const s = getComputedStyle(labelEl); return `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`; })()
                : `600 ${baseFont}`;
            const ctx = this._measureCtx || (this._measureCtx = document.createElement('canvas').getContext('2d'));

            const CELL_PADDING = 24;        // .rg-td left+right padding
            const HEADER_PADDING = 24;      // .rg-th left+right padding
            const SORT_ICON = 24;           // sort chevron + its gap (always present)
            const FUNNEL_ICON = 22;         // filter funnel (only on filterable columns)
            const step = Math.max(1, Math.floor(rows.length / 2000)); // sample big datasets
            const widths = {};
            for (const column of this.config.columns) {
                if (column.width) continue;
                let longest = '';
                for (let i = 0; i < rows.length; i += step) {
                    const text = this.computeCell(rows[i], column).text;
                    if (text.length > longest.length) longest = text;
                }
                ctx.font = column.mono ? monoFont : baseFont;
                const cellWidth = ctx.measureText(longest).width + CELL_PADDING + (column.badge ? 20 : 0);
                ctx.font = headerFont;
                const headerWidth = ctx.measureText(column.t).width + HEADER_PADDING + SORT_ICON
                    + (column.filter ? FUNNEL_ICON : 0);
                const min = column.minWidth || (column.edit ? 180 : 72);
                const max = column.maxWidth || 460;
                widths[column.k] = Math.round(Math.min(max, Math.max(min, Math.ceil(Math.max(cellWidth, headerWidth)))));
            }
            this._contentWidths = widths;
            this._columnWidths = null; // invalidate the cached width array so the layout picks up the fit
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
            this.onColumnsChanged();
        },
        onColumnsChanged() {
            this._columnWidths = null;   // widths changed → recompute the horizontal window
            this._lastScrollLeft = -1;
            this.recomputeColumnWindow();
            this.persistColumnLayout();
        },
        persistColumnLayout() {
            const key = this.config.storageKey || 'rg-cols';
            try {
                localStorage.setItem(key, JSON.stringify({ v: this.visibleKeys, o: this.columnOrder }));
            } catch (error) { /* */ }
        },
        restoreColumnLayout() {
            try {
                const saved = JSON.parse(localStorage.getItem(this.config.storageKey || 'rg-cols') || 'null');
                if (!saved || !Array.isArray(saved.v) || !Array.isArray(saved.o)) return;
                const known = this.config.columns.map((column) => column.k);
                this.columnOrder = saved.o.filter((key) => known.includes(key))
                    .concat(known.filter((key) => !saved.o.includes(key)));
                this.visibleKeys = saved.v.filter((key) => known.includes(key));
            } catch (error) { /* */ }
        },

        /* ------------------------- per-column filters ------------------------- */

        filterIsActive(column) {
            const value = this.columnFilters[column.k];
            if (!value) return false;
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value === 'object') return Object.values(value).some((v) => v !== '' && v != null);
            return true;
        },
        openFilter(column, event) {
            if (this.filterColumn && this.filterColumn.k === column.k) { this.filterColumn = null; return; }
            this.filterOptionSearch = '';
            this.filterColumn = column;
            const rect = event.currentTarget.getBoundingClientRect();
            this.filterStyle = `top:${rect.bottom + 4}px;left:${Math.max(8, rect.left - 40)}px`;
        },
        distinctFor(field) {
            if (!this._distinctCache[field]) {
                const rows = this.source.loadedRows() || [];
                this._distinctCache[field] = distinctValues(rows, field);
            }
            return this._distinctCache[field];
        },
        filterOptions(column) {
            return this.distinctFor(column.k).map((value) => ({ value, label: valueLabel(column, value) }));
        },
        toggleFilterValue(key, value) {
            const values = this.columnFilters[key] ? [...this.columnFilters[key]] : [];
            const index = values.indexOf(value);
            if (index >= 0) values.splice(index, 1);
            else values.push(value);
            this.columnFilters[key] = values;
            this.applyView();
        },
        setTextFilter(key, value) { this.columnFilters[key] = value || null; this.applyView(); },
        setRangeBound(key, bound, value) {
            const range = { ...(this.columnFilters[key] || {}) };
            range[bound] = value || null;
            this.columnFilters[key] = range;
            this.applyView();
        },
        setNumberBound(key, bound, value) {
            const range = { ...(this.columnFilters[key] || {}) };
            range[bound] = value === '' ? null : value;
            this.columnFilters[key] = range;
            this.applyView();
        },
        clearFilter(key) { delete this.columnFilters[key]; this.filterColumn = null; this.applyView(); },

        /* ------------------------- selection ------------------------- */

        allSelected() {
            const total = this.source.total();
            return total > 0 && this.selectedIds.length >= total;
        },
        toggleSelectAll() {
            const ids = this.source.viewIds();
            this.selectedIds = this.allSelected() || !ids ? [] : ids;
        },
        toggleRowSelection(id) {
            const index = this.selectedIds.indexOf(id);
            if (index >= 0) this.selectedIds.splice(index, 1);
            else this.selectedIds.push(id);
        },
        isRowSelected(id) { return this.selectedIds.includes(id); },

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
        cellClass(column) {
            return [
                column.align === 'end' && 'rg-end',
                column.mono && 'rg-mono',
                column.bold && 'rg-bold',
                column.edit && 'rg-edit',
            ].filter(Boolean).join(' ');
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
            if (!this.loading) {
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
            const value = item.agg === 'count' ? this.filteredCount : sums[item.key];
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

        exportFile(extension) {
            const withLabels = !!this.config.exportLabels;
            const columns = this.visibleColumns.map((column) => ({
                key: column.k,
                label: column.t,
                ...(withLabels && column.valueLabels ? { valueLabels: column.valueLabels } : {}),
            }));
            const ids = this.source.viewIds();
            fetch(this.config.exportUrl + '.' + extension, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': this.config.csrf },
                body: JSON.stringify({ ids, columns }),
            })
                .then((response) => response.blob())
                .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = (this.config.exportName || 'export') + '.' + extension;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                });
        },

        /* ------------------------- external events ------------------------- */

        async reload() {
            await this.source.load();
            this.computeContentWidths();
            this._distinctCache = {};
            this.selectedIds = [];
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
