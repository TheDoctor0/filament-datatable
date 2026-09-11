<?php

declare(strict_types=1);

namespace TheDoctor0\FilamentDatatable;

use Filament\Support\Assets\AlpineComponent;
use Filament\Support\Facades\FilamentAsset;
use Illuminate\Support\ServiceProvider;

class DatatableServiceProvider extends ServiceProvider
{
    public const PACKAGE = 'thedoctor0/filament-datatable';

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'filament-datatable');
        $this->loadTranslationsFrom(__DIR__.'/../resources/lang', 'filament-datatable');

        FilamentAsset::register([
            AlpineComponent::make('datagrid', __DIR__.'/../resources/js/datagrid.js'),
        ], self::PACKAGE);

        $this->publishes([
            __DIR__.'/../resources/views' => resource_path('views/vendor/filament-datatable'),
        ], 'filament-datatable-views');

        $this->publishes([
            __DIR__.'/../resources/lang' => $this->app->langPath('vendor/filament-datatable'),
        ], 'filament-datatable-translations');
    }
}
