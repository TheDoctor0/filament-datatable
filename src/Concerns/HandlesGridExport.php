<?php

declare(strict_types=1);

namespace TheDoctor0\FilamentDatatable\Concerns;

use Symfony\Component\HttpFoundation\StreamedResponse;
use TheDoctor0\FilamentDatatable\GridExport;

trait HandlesGridExport
{
    /**
     * Stream the grid's chosen columns for the given rows.
     *
     * @param  list<array{key: string, label?: string}>  $columns  the visible columns the grid sent
     * @param  iterable<array<string, mixed>>  $rows  the row payloads (same shape the grid renders)
     */
    protected function streamExport(array $columns, iterable $rows, string $extension, string $name): StreamedResponse
    {
        $header = array_map(static fn (array $column): string => $column['label'] ?? $column['key'], $columns);
        $keys = array_map(static fn (array $column): string => $column['key'], $columns);

        $lines = [];
        foreach ($rows as $row) {
            $lines[] = array_map(static fn (string $key): string => (string) ($row[$key] ?? ''), $keys);
        }

        return GridExport::stream($extension, $header, $lines, $name);
    }
}
