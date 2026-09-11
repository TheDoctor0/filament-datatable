# Filament Datatable

A reusable, virtual-scroll data grid component for Filament v5.

`filament-datatable` ships a single Alpine component that renders a data grid over a fixed-size,
recycled pool of row slots. The DOM nodes are reused as you scroll instead of being destroyed and
rebuilt, so the grid stays smooth over tens of thousands of rows. Rows can come from the client (the
whole dataset is fetched once and filtered, sorted and windowed in the browser) or from the server (the
backend does the filtering, sorting and paging and only the visible window is held in memory). On top of
that it provides a column picker (toggle, reorder, persist), per-column filters, inline-edit cells, row
actions and streamed CSV / XLSX export.

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
- **Column picker** — show/hide columns, drag to reorder, reset to defaults; the layout is persisted in
  `localStorage`.
- **Per-column filters** — text (contains), number range, date range, datetime range, multi-select and
  status.
- **Auto-fit column widths** — the widest rendered value per column is measured against the real cell
  font (canvas, off-DOM) for a stable width that never jumps on scroll; overridable per column.
- **Inline-edit cells** — editable text inputs that save through a Livewire method on the host page.
- **Row actions** — per-row links (with an optional `:id` template and new-tab) or buttons that mount a
  Filament action.
- **Row click** — an optional `rowUrl` opens a row on click.
- **Bulk selection** — an optional checkbox column with select-all.
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
            ['k' => 'id',        't' => 'ID',       'type' => 'num'],
            ['k' => 'name',      't' => 'Name',     'filter' => 'text'],
            ['k' => 'status',    't' => 'Status',   'type' => 'status', 'filter' => 'status'],
            ['k' => 'total',     't' => 'Total',    'type' => 'sign',   'filter' => 'num', 'align' => 'end'],
            ['k' => 'created_at','t' => 'Created',   'type' => 'datetime', 'filter' => 'datetime'],
        ],
        'sort'       => ['key' => 'created_at', 'dir' => 'desc'],
        'search'     => ['name', 'status'],
        'dataUrl'    => route('products.data'),
        'exportUrl'  => route('products.export'),
        'exportName' => 'products',
        'storageKey' => 'products-grid',
        'csrf'       => csrf_token(),
        'rowUrl'     => route('products.show', ['id' => ':id']),
        'rowActions' => [
            ['name' => 'view', 'label' => 'View', 'color' => 'primary',
             'url' => route('products.show', ['id' => ':id']), 'newTab' => false],
        ],
    ];
}
```

In **client mode** (the default) `dataUrl` is fetched once with `GET` and must return a JSON array of
row objects. Every row needs a unique `id` field (used for selection, row actions and export).

The grid also listens for two `window` events: dispatch `rg-export` with `detail.format` (`csv` /
`xlsx`) to trigger an export, and `rg-refresh` to reload the data.

## Configuration reference

### Top-level config

| Key                  | Type              | Description |
| -------------------- | ----------------- | ----------- |
| `columns`            | array             | Column definitions (see below). Required. |
| `sort`               | `{key, dir}`      | Initial sort. `dir` is `asc` or `desc`. Defaults to `{key: null, dir: 'asc'}`. |
| `dataUrl`            | string            | Row source URL. Client mode: `GET`, returns a JSON array of rows. Server mode: `POST` (see below). |
| `exportUrl`          | string            | Base URL for export; the grid appends `.csv` / `.xlsx` and `POST`s `{ids, columns}`. |
| `exportName`         | string            | Download filename (without extension). Defaults to `export`. |
| `search`             | `string[]`        | Row fields concatenated into each row's search blob for the toolbar search (client mode). |
| `server`             | bool              | Use the server-side row source instead of the client one. Defaults to `false`. |
| `blockSize`          | number            | Server mode: rows fetched per block. Defaults to `200`. |
| `csrf`               | string            | CSRF token sent as `X-CSRF-TOKEN` on export and server-mode requests. |
| `selectable`         | bool              | Show the selection checkbox column. Defaults to `false`. |
| `rowActions`         | array             | Per-row actions (see below). |
| `rowUrl`             | string            | `:id` template; clicking a row navigates here. |
| `actionsColumnWidth` | number            | Width (px) of the actions column. Defaults to `370`. |
| `storageKey`         | string            | `localStorage` key for the persisted column layout. Defaults to `rg-cols`. |

### Column definition

| Key           | Type              | Description |
| ------------- | ----------------- | ----------- |
| `k`           | string            | Row field key. Required. |
| `t`           | string            | Header label. Required. |
| `type`        | string            | Cell rendering: `text` (default), `num` (locale number), `sign` (signed number, positive/negative styled), `date`, `datetime`, `status` (rendered as a badge). |
| `filter`      | string            | Filter control: `text`, `num`, `date`, `datetime`, `select`, `status`. Omit for no filter. |
| `edit`        | bool              | Render the cell as an editable text input. |
| `badge`       | bool              | Render the value as a badge. |
| `badgeColors` | `{value: color}`  | Per-value badge colour map. |
| `badgeColor`  | string            | Fallback badge colour. Defaults to `info`. |
| `align`       | string            | `end` right-aligns the column. |
| `mono`        | bool              | Monospace cell font. |
| `bold`        | bool              | Bold cell text. |
| `off`         | bool              | Hidden by default in the column picker (can be enabled by the user). |
| `width`       | number            | Explicit column width (px); disables auto-fit for this column. |
| `minWidth`    | number            | Lower clamp for the auto-fit width. Defaults to `72` (`180` for editable columns). |
| `maxWidth`    | number            | Upper clamp for the auto-fit width. Defaults to `460`. |

### Row action

| Key      | Type   | Description |
| -------- | ------ | ----------- |
| `name`   | string | Action identifier; when there is no `url`, this is passed to the Filament action mount. |
| `label`  | string | Button/link text. |
| `color`  | string | Colour token, applied as the CSS class `rg-act-{color}`. |
| `url`    | string | Optional `:id` template. If present the action renders as a link; if absent it renders as a button. |
| `newTab` | bool   | Open the link in a new tab. |

### Inline-edit cells

A column with `edit: true` renders a text input. On change the grid updates the row optimistically and
calls the Livewire method `saveCell($id, $key, $value)` on the host page. If that method returns an
array, its fields are merged back into the row (so the server can normalise or reformat the saved
value). Provide the method on the Filament page:

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
  "filters": { "status": ["ok"], "total": { "min": "0" } }
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
grid requests further blocks (`start` advancing by `length`) as the viewport scrolls.

## Export (backend)

Export requests are thin: the grid `POST`s `{ids, columns}` to `exportUrl.csv` / `exportUrl.xlsx`, where
`columns` is `[{key, label}]` for the currently visible columns. Your controller fetches the rows and
maps them to the same shape the grid renders; the package's `HandlesGridExport` trait and `GridExport`
handle the generic CSV/XLSX streaming.

```php
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use TheDoctor0\FilamentDatatable\Concerns\HandlesGridExport;

class ProductGridController
{
    use HandlesGridExport;

    public function export(Request $request, string $extension): StreamedResponse
    {
        $columns = $request->input('columns', []);           // [{key, label}], visible columns
        $ids = $request->input('ids');                       // selected/filtered ids, or null

        $rows = Product::query()
            ->when($ids, fn ($query) => $query->whereIn('id', $ids))
            ->get()
            ->map(fn (Product $product): array => [
                'id'         => $product->id,
                'name'       => $product->name,
                'total'      => $product->total,
                'created_at' => $product->created_at?->format('Y-m-d H:i'),
            ]);

        return $this->streamExport($columns, $rows, $extension, 'products');
    }
}
```

`streamExport(array $columns, iterable $rows, string $extension, string $name)` builds the header from
each column's `label` (falling back to `key`), pulls each row's values by `key`, and delegates to
`GridExport::stream()`, which writes XLSX when `$extension` is `xlsx` and CSV otherwise.

## Publishing views

The Blade component and its styles can be overridden by publishing them:

```bash
php artisan vendor:publish --tag=filament-datatable-views
```

They are copied to `resources/views/vendor/filament-datatable`.

## License

MIT. See [LICENSE](LICENSE).
