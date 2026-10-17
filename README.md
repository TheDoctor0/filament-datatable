# Filament Datatable

A reusable, virtual-scroll data grid component for Filament v5.

`filament-datatable` ships a single Alpine component that renders a data grid over a fixed-size,
recycled pool of row slots. The DOM nodes are reused as you scroll instead of being destroyed and
rebuilt, so the grid stays smooth over tens of thousands of rows. Rows can come from the client (the
whole dataset is fetched once and filtered, sorted and windowed in the browser) or from the server (the
backend does the filtering, sorting and paging and only the visible window is held in memory). On top of
that it provides a column picker (toggle, reorder, persist), per-column filters, inline-edit cells, row
actions, a summary bar and streamed CSV / XLSX export.

The grid is domain-agnostic: it renders whatever fields your rows carry. Derived values (a computed
status, an "overdue" flag, whether an action applies to a row) are produced by your backend and handed to
the grid as plain row fields — see [Derived row fields](#derived-row-fields).

## Requirements

- PHP `^8.2`
- Laravel 11, 12 or 13 (`illuminate/http` and `illuminate/support` `^11 || ^12 || ^13`)
- Filament `^5.0` (`filament/support`)
- `openspout/openspout` `^4.0` (XLSX export)

## Features

- **Virtual scrolling** — fixed row height, a recycled pool of row slots, and column virtualization
  (only the columns inside the horizontal viewport are rendered), so wide, long grids stay responsive.
- **Client or server row source** — the same grid API (`rowAt`/`total`/`setView`) backs an in-browser
  source and a DataTables-style server source, selected by config.
- **Column picker** — search, show/hide, pin, drag to reorder, reset to defaults; the layout (visibility,
  order, pins, widths, quick filters) is persisted in `localStorage`.
- **Per-column filters** — text (contains), number range plus a pick-list of values, date range, datetime range
  and multi-select. Filters apply on "Apply"; active ones show as a badge or as removable chips.
- **Quick-filter bar** — chosen filters one click away above the grid; any filterable column can be added.
- **Pinned columns + sticky actions** — pin columns to the left (sticky while scrolling sideways) and keep
  the actions column on the right edge.
- **Column resize** — drag a header edge (the actions column from its left edge); double-click it to fit the column to its loaded content
  (like Excel). Widths persist with the layout.
- **Value labels** — map raw cell values (enum codes, ids) to display labels per column; used in cells,
  filter options and badges.
- **Auto-fit column widths** — the widest rendered value per column is measured against the real cell
  font (canvas, off-DOM) for a stable width that never jumps on scroll — the whole dataset in client mode,
  the first loaded block in server mode; overridable per column.
- **Inline-edit cells** — editable text inputs that save through a Livewire method on the host page.
- **Row actions** — per-row links (with an optional `:id` template and new-tab) or buttons that mount a
  Filament action, each optionally gated by a boolean row field.
- **Row highlight** — a row field that, when truthy, adds a highlight class to the row.
- **Summary bar** — row count and per-field sums over the current (filtered) view.
- **Row click** — an optional `rowUrl` opens a row on click.
- **Bulk selection** — an optional checkbox column with select-all.
- **Tree rows** — expandable rows whose children are fetched lazily from the backend, any depth, with a
  "Collapse all" toolbar button.
- **URL state** — search, column filters and sort mirrored in the query string, so a filtered view can
  be bookmarked or shared.
- **Localised** — UI strings ship in English and Polish (`filament-datatable::datagrid.*`) and follow the
  app locale; number formatting uses the `locale` config option.
- **CSV / XLSX export** — the visible columns are streamed by the backend; CSV is UTF-8 with a BOM and a
  `;` separator, XLSX is written with OpenSpout.

## Installation

```bash
composer require thedoctor0/filament-datatable
```

The package is auto-discovered — there is no provider to register by hand.

The grid's JavaScript is registered as a Filament Alpine asset, so after installing (and on every
deploy) you must publish Filament's assets:

```bash
php artisan filament:assets
```

Run this again after `php artisan filament:upgrade`.

## Usage

Render the component from a Filament page, passing it a config array:

```blade
<x-filament-panels::page>
    <x-filament-datatable::datagrid :config="$this->gridConfig()" />
</x-filament-panels::page>
```

The package already registers an Alpine component with the id `datagrid` — do **not** register another
one with that id in your app.

A minimal config on the page:

```php
public function gridConfig(): array
{
    return [
        'columns' => [
            ['k' => 'id',         't' => 'ID',      'type' => 'num'],
            ['k' => 'name',       't' => 'Name',    'filter' => 'text'],
            ['k' => 'status',     't' => 'Status',  'badge' => true, 'filter' => 'select',
             'valueLabels' => ['open' => 'Open', 'closed' => 'Closed'],
             'badgeColors' => ['open' => 'success', 'closed' => 'gray']],
            ['k' => 'total',      't' => 'Total',   'type' => 'sign', 'filter' => 'num', 'align' => 'end'],
            ['k' => 'created_at', 't' => 'Created', 'type' => 'datetime', 'filter' => 'datetime'],
        ],
        'sort'       => ['key' => 'created_at', 'dir' => 'desc'],
        'search'     => ['name', 'status'],
        'locale'     => 'en-US',
        'dataUrl'    => route('products.data'),
        'exportUrl'  => route('products.export'),
        'exportName' => 'products',
        'storageKey' => 'products-grid',
        'csrf'       => csrf_token(),
        'rowUrl'     => route('products.show', ['id' => ':id']),
        'rowActions' => [
            ['name' => 'view', 'label' => 'View', 'color' => 'primary', 'icon' => 'eye',
             'url' => route('products.show', ['id' => ':id']), 'newTab' => false],
        ],
        'summary' => [
            ['key' => 'id',    'label' => 'Rows',  'agg' => 'count'],
            ['key' => 'total', 'label' => 'Total', 'agg' => 'sum', 'format' => 'number'],
        ],
    ];
}
```

In **client mode** (the default) `dataUrl` is fetched once with `GET` and must return a JSON array of
row objects. Every row needs a unique `id` field (used for selection, row actions and export).

The grid also listens for two `window` events: dispatch `rg-export` with `detail.format` (`csv` /
`xlsx`, plus `detail.selected: true` to export only the checked rows) to trigger an export, and
`rg-refresh` to reload the data. A failed export (e.g. an expired session, 419) shows a Filament
notification instead of downloading the error page.

## Configuration reference

### Top-level config

| Key                  | Type              | Description |
| -------------------- | ----------------- | ----------- |
| `columns`            | array             | Column definitions (see below). Required. |
| `sort`               | `{key, dir}`      | Initial sort. `dir` is `asc` or `desc`. Defaults to `{key: null, dir: 'asc'}`. |
| `locale`             | string            | BCP 47 locale for number formatting and string collation (e.g. `en-US`, `pl-PL`, `de-DE`). Defaults to `en-US`. |
| `dataUrl`            | string            | Row source URL. Client mode: `GET`, returns a JSON array of rows. Server mode: `POST` (see below). |
| `exportUrl`          | string            | Base URL for export; the grid appends `.csv` / `.xlsx` and `POST`s `{ids, columns}`. |
| `exportName`         | string            | Download filename (without extension). Defaults to `export`. |
| `exportLabels`       | bool              | Export the `valueLabels` display labels instead of raw values. Defaults to `false` (raw values). |
| `search`             | `string[]`        | Row fields concatenated into each row's search blob for the toolbar search (client mode). |
| `preFilter`          | array             | Client mode: fixed scope applied before any user filter, `[{field, in: [...]}]`. All clauses must hold. |
| `server`             | bool              | Use the server-side row source instead of the client one. Defaults to `false`. |
| `blockSize`          | number            | Server mode: rows fetched per block. Defaults to `200`. |
| `csrf`               | string            | CSRF token sent as `X-CSRF-TOKEN` on export and server-mode requests. |
| `selectable`         | bool              | Show the selection checkbox column. Defaults to `false`. |
| `rowActions`         | array             | Per-row actions (see below). |
| `rowUrl`             | string            | `:id` template; clicking a row navigates here. |
| `rowHighlight`       | `{field, class?}` | When `row[field]` is truthy the row gets `class` (defaults to `rg-alert`, a red tint). |
| `summary`            | array             | Summary bar items (see below). Omit or leave empty to hide the bar. |
| `actionsColumnWidth` | number            | Width (px) of the actions column. Defaults to the widest set of buttons on the loaded rows. |
| `storageKey`         | string            | `localStorage` key for the persisted column layout. Defaults to `rg-cols`. |
| `tree`               | `{column, childrenUrl, indent?}` | Tree mode (see below). `column` is the key of the column that gets the expand chevron and indent; `indent` is px per level (default `18`). Disables selection. |
| `urlState`           | `true` \| `{prefix}` | Mirror search (`q`), sort (`sort=key:dir`) and column filters (`f`, JSON) in the query string. `prefix` namespaces the params when a page has several grids. |
| `frozen`             | `string[]`        | Column keys pinned to the left by default. Pinned columns stay visible (sticky) while scrolling sideways; users pin/unpin any column in the column picker. Persisted with the layout. |
| `stickyActions`      | bool              | Keep the row-actions column stuck to the right edge by default. Users can pin / unpin it in the column picker (it cannot be hidden or moved). Defaults to `false`. |
| `pinMinViewport`     | number            | Below this viewport width (px) pinned columns and sticky actions scroll normally. Defaults to `640`. |
| `resizable`          | bool              | Users can drag a header's right edge to resize a column (double-click = back to auto-fit). Widths are persisted with the layout. Defaults to `true`. |
| `compactHeaders`     | bool              | Size columns by their content, not their header: long labels are truncated with an ellipsis (full text in the tooltip). Defaults to `false`. |
| `quickFilters`       | `string[]`        | Enables the quick-filter bar with these columns as default pills. Users add any filterable column ("Add filter") or remove pills; the set is persisted with the layout. |
| `filterChips`        | bool              | Show one removable chip per active filter (and the search) next to the search box, plus "Clear filters", instead of the single summary badge. Clicking a chip reopens its filter. |
| `bulkExport`         | `string[]`        | Built-in "Export selected" buttons on the bulk bar, e.g. `['xlsx', 'csv']`. Implies `selectable`. Exports only the checked rows, in view order. |
| `numValueList`       | bool              | `num` filters also offer a pick-list of the column's values (ANDed with the range). Defaults to `true`; per column `valueList: false` turns it off. |
| `numValueListMax`    | number            | Hide the num pick-list when a column has more distinct values than this. Defaults to `500`. |

### Column definition

| Key           | Type              | Description |
| ------------- | ----------------- | ----------- |
| `k`           | string            | Row field key. Required. |
| `t`           | string            | Header label. Required. |
| `type`        | string            | Cell rendering: `text` (default), `num` (locale number), `sign` (signed number, positive/negative styled), `date`, `datetime`. |
| `filter`      | string            | Filter control: `text`, `num`, `date`, `datetime`, `select`. Omit for no filter. A `num` filter value is `{min?, max?, in?: [...]}`; empty cells never match an active num filter. |
| `valueList`   | bool              | `num` filter only: `false` hides the value pick-list for this column. |
| `valueLabels` | `{raw: label}`    | Display label per raw value — applied to the cell text and to `select` filter options. Filtering still matches the raw value. |
| `edit`        | bool \| string   | Render the cell as an editable text input. A string is a row field name: the cell is editable only in rows where that field is truthy (plain text elsewhere). |
| `placeholder` | string            | Placeholder of the inline-edit input. |
| `badge`       | bool              | Render the value as a badge. |
| `badgeColors` | `{raw: color}`    | Per-value badge colour map, keyed by the raw value. |
| `badgeColor`  | string            | Fallback badge colour. Defaults to `info`. |
| `align`       | string            | `end` right-aligns the column. |
| `mono`        | bool              | Monospace cell font. |
| `bold`        | bool              | Bold cell text. |
| `off`         | bool              | Hidden by default in the column picker (can be enabled by the user). |
| `link`        | string            | Row field holding a URL; when set on a row the cell renders as a link to it. |
| `newTab`      | bool              | Open the `link` URL in a new tab. |
| `tag`         | string            | Row field shown as a small badge after the cell text (e.g. a document type). |
| `tagColors`   | `{value: color}`  | Badge colour per `tag` value (`info` by default, like `badge`). |
| `width`       | number            | Explicit column width (px); disables auto-fit for this column. |
| `minWidth`    | number            | Lower clamp for the auto-fit width. Defaults to `72` (`180` for editable columns). |
| `maxWidth`    | number            | Upper clamp for the auto-fit width. Defaults to `460`. |

Badge colours: `info`, `success`, `warning`, `danger`, `gray`, `primary`, `purple`, `teal`, `pink`,
`indigo`, `orange`, `cyan`.

### Row action

| Key      | Type   | Description |
| -------- | ------ | ----------- |
| `name`   | string | Action identifier; when there is no `url`, this is passed to the Filament action mount. |
| `label`  | string | Button/link text. |
| `color`  | string | Colour token, applied as the CSS class `rg-act-{color}` (`primary`, `gray`, `warning`, `danger`). |
| `icon`   | string | Built-in icon: `eye`, `document`, `pencil`, `clock`, `arrow-right-circle`, `minus-circle`, `arrow-uturn-left`. Optional. |
| `url`    | string | Optional `:id` template. If present the action renders as a link; if absent it renders as a button. |
| `newTab` | bool   | Open the link in a new tab. |
| `when`   | string | Row field name; the action is shown only when `row[when]` is truthy. Omit to always show it. |

### Summary item

| Key      | Type   | Description |
| -------- | ------ | ----------- |
| `key`    | string | Row field to aggregate (ignored for `count`). |
| `label`  | string | Text shown before the value. |
| `agg`    | string | `count` (rows in the filtered view) or `sum` (of `row[key]` over the filtered view). |
| `format` | string | `number` (2 decimals, default for `sum`) or `int`. Both use `locale`. |

### Inline-edit cells

A column with `edit: true` renders a text input. On change the grid updates the row optimistically and
calls the Livewire method `saveCell($id, $key, $value)` on the host page. If that method returns an
array, its fields are merged back into the row (so the server can normalise the saved value, or refresh
derived fields such as a status). Provide the method on the Filament page:

```php
public function saveCell(int|string $id, string $key, mixed $value): array
{
    $model = Product::findOrFail($id);
    $model->update([$key => $value]);

    return $model->only([$key]); // returned fields are merged back into the grid row
}
```

Row actions without a `url` mount a Filament action via `mountAction($name, ['record' => $id])`, so they
integrate with the page's regular action definitions.

## Derived row fields

The grid never computes business rules. Anything that depends on more than one field — a status, an
"overdue" flag, whether an action is allowed — is computed once by your backend and emitted as a row
field, then referenced from config:

```php
// Row mapper on the backend
[
    'id'       => $order->id,
    'status'   => $order->status,                       // 'open' | 'late' | 'closed'
    'is_late'  => $order->status === 'late' ? 1 : 0,    // rowHighlight + summary
    'can_ship' => $order->status === 'open',            // gates a row action
]

// Grid config
'columns' => [
    ['k' => 'status', 't' => 'Status', 'badge' => true, 'filter' => 'select',
     'valueLabels' => ['open' => 'Open', 'late' => 'Overdue', 'closed' => 'Closed'],
     'badgeColors' => ['open' => 'warning', 'late' => 'danger', 'closed' => 'success']],
],
'rowHighlight' => ['field' => 'is_late'],
'rowActions'   => [['name' => 'ship', 'label' => 'Ship', 'color' => 'primary', 'when' => 'can_ship']],
'summary'      => [
    ['key' => 'id',      'label' => 'Rows',    'agg' => 'count'],
    ['key' => 'is_late', 'label' => 'Overdue', 'agg' => 'sum', 'format' => 'int'],
],
```

Fields that only exist for the grid (not shown as columns) are fine — prefix them however you like.

## Server-side row source

Set `server: true` to offload filtering, sorting and paging to the backend for very large datasets. The
grid `POST`s to `dataUrl` (with `X-CSRF-TOKEN` from `csrf`) a JSON body:

```json
{
  "draw": 1,
  "start": 0,
  "length": 200,
  "search": "…",
  "sort": { "key": "created_at", "dir": "desc" },
  "filters": { "status": ["open"], "total": { "min": "0" } }
}
```

Your endpoint must respond with:

```json
{
  "draw": 1,
  "rows": [ { "id": 1, "…": "…" } ],
  "recordsFiltered": 12345
}
```

`draw` echoes the request and guards against out-of-order responses (the DataTables convention). The
grid requests further blocks (`start` advancing by `length`) as the viewport scrolls. In server mode
`preFilter`, `select` filter options and `summary` sums are the backend's responsibility.

## Tree rows

With `tree` set, rows returned by the row source are the top level of a tree. Each row carries:

| Field          | Description |
| -------------- | ----------- |
| `_key`         | Unique key of the row within the whole tree. |
| `_level`       | Depth, `0` for top-level rows. Adds the `rg-lvl-{n}` class to the row. |
| `_hasChildren` | Whether the row shows an expand chevron. |
| `_q`           | Optional opaque data echoed back to the backend when the row's children are requested. |

Expanding a row `POST`s to `tree.childrenUrl`:

```json
{ "parent": "K:0001", "q": { "kod": "0001" }, "search": "…", "filters": { }, "sort": { "key": "saldo", "dir": "desc" } }
```

and expects `{ "rows": [ … ] }` with the direct children (each with its own `_key`, `_level`,
`_hasChildren`). Children are cached until the view changes; any change of search, filters or sort
collapses the tree. Inline edits and row actions work on child rows as on top-level ones — gate them
with `edit: '<field>'` and `when`.

## URL state

With `urlState: true` the grid writes its search, column filters and sort into the page URL through
`history.replaceState` (no new history entries) and reads them back on load:

```
/admin/orders?q=acme&sort=total:desc&f={"status":["open"],"total":{"min":"100"}}
```

A sort equal to the configured default and empty filters are left out. On load the URL wins over the
search remembered in `localStorage`, which wins over the config. Unknown columns, columns without a
filter and wrongly shaped values are ignored, so stale or hand-edited links never break the grid. The
column layout stays in `localStorage`.

## Development

Pure helpers and row sources are exported from `resources/js/datagrid.js` and tested with Node's
built-in runner:

```bash
node --test tests/js/*.test.mjs
```

## Export (backend)

Export requests are thin: the grid `POST`s `{ids, columns}` to `exportUrl.csv` / `exportUrl.xlsx`, where
`columns` is `[{key, label}]` for the currently visible columns (plus `valueLabels` when `exportLabels` is
on) and `ids` lists the rows in the current view order. Your controller fetches the rows and maps them to the same shape the grid renders; the
package's `HandlesGridExport` trait and `GridExport` handle the generic CSV/XLSX streaming.

```php
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use TheDoctor0\FilamentDatatable\Concerns\HandlesGridExport;

class ProductGridController
{
    use HandlesGridExport;

    public function export(Request $request, string $extension): StreamedResponse
    {
        $ids = $request->input('ids', []);

        $byId = Product::query()->whereIn('id', $ids)->get()->keyBy('id')
            ->map(fn (Product $product): array => [
                'id'         => $product->id,
                'name'       => $product->name,
                'total'      => $product->total,
                'created_at' => $product->created_at?->format('Y-m-d H:i'),
            ]);
        $rows = collect($ids)->map(fn ($id) => $byId[$id] ?? null)->filter();

        return $this->streamExport($request->input('columns', []), $rows, $extension, 'products');
    }
}
```

`streamExport(array $columns, iterable $rows, string $extension, string $name)` builds the header from
each column's `label` (falling back to `key`), pulls each row's values by `key`, and delegates to
`GridExport::stream()`, which writes XLSX when `$extension` is `xlsx` and CSV otherwise. Exports carry raw
row values by default; with `exportLabels: true` the grid sends each column's `valueLabels` along and
`streamExport` writes the display labels instead.

## Translations

UI strings (search placeholder, column picker, filter popover, empty state) live under the
`filament-datatable::datagrid` namespace. English and Polish are bundled and picked by the app locale.
To add or override a language, publish the files:

```bash
php artisan vendor:publish --tag=filament-datatable-translations
```

They are copied to `lang/vendor/filament-datatable/{locale}/datagrid.php`.

## Publishing views

The Blade component and its styles can be overridden by publishing them:

```bash
php artisan vendor:publish --tag=filament-datatable-views
```

They are copied to `resources/views/vendor/filament-datatable`.

## License

MIT. See [LICENSE](LICENSE).
