<?php

declare(strict_types=1);

namespace TheDoctor0\FilamentDatatable;

use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GridExport
{
    /** @param  list<string>  $header  @param  iterable<array<int, scalar|null>>  $lines */
    public static function csv(array $header, iterable $lines, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($header, $lines): void {
            $out = fopen('php://output', 'wb');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $header, ';');
            foreach ($lines as $line) {
                fputcsv($out, $line, ';');
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** @param  list<string>  $header  @param  iterable<array<int, scalar|null>>  $lines */
    public static function xlsx(array $header, iterable $lines, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($header, $lines): void {
            $writer = new Writer;
            $writer->openToFile('php://output');
            $writer->addRow(Row::fromValues($header));
            foreach ($lines as $line) {
                $writer->addRow(Row::fromValues($line));
            }
            $writer->close();
        }, $filename, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    /** Pick the writer by extension: xlsx, else csv. */
    public static function stream(string $extension, array $header, iterable $lines, string $name): StreamedResponse
    {
        return strtolower($extension) === 'xlsx'
            ? self::xlsx($header, $lines, "{$name}.xlsx")
            : self::csv($header, $lines, "{$name}.csv");
    }
}
