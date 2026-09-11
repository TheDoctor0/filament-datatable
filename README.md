# filament-datatable

A reusable, virtual-scroll data grid for Filament. One Alpine component drives everything: a
fixed-size recycled row pool that stays smooth over tens of thousands of rows, client- or
server-side row sources, a column picker, per-column filters (text / number / date / select /
status), inline-edit cells, row actions (button or link), and CSV / XLSX export.

## Install

```bash
composer require thedoctor0/filament-datatable
```

Private repo — add it to the app's `composer.json` first:

```json
"repositories": [
    { "type": "vcs", "url": "https://github.com/TheDoctor0/filament-datatable.git" }
]
```

The service provider auto-registers the `datagrid` Alpine component with Filament and the
`filament-datatable::` view namespace.

## Frontend

Return a config from the Filament page and render the component:

```blade
<x-filament-panels::page>
    <x-filament-datatable::datagrid :config="$this->gridConfig()" />
</x-filament-panels::page>
```

Config keys: `columns` (`[{k,t,type,filter,edit,badge,badgeColors,...}]`), `sort` (`{key,dir}`),
`dataUrl`, `exportUrl`, `rowActions`, `rowUrl` (`:id` template for row click), `actionsColumnWidth`,
`exportName`, and an optional server row source for very large datasets.

## Backend export

```php
use TheDoctor0\FilamentDatatable\Concerns\HandlesGridExport;

class ProductGridController
{
    use HandlesGridExport;

    public function export(Request $request, string $extension): StreamedResponse
    {
        $rows = $this->rowsFor($request->input('ids', []));   // app-specific fetch

        return $this->streamExport($request->input('columns', []), $rows, $extension, 'export');
    }
}
```

`data()` (the model query and row mapping) stays in the app; only the generic CSV/XLSX streaming
and the column/keys wiring live here (`GridExport`, `HandlesGridExport`).

## License

MIT.
