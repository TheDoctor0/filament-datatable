@props(['config'])

<div
    x-load
    x-load-src="{{ \Filament\Support\Facades\FilamentAsset::getAlpineComponentSrc('datagrid', \TheDoctor0\FilamentDatatable\DatatableServiceProvider::PACKAGE) }}"
    x-data="datagrid(@js($config))"
    x-on:rg-export.window="exportFile($event.detail.format)"
    x-on:rg-refresh.window="reload()"
    class="rg fi-ta"
>
    <div class="rg-card">
        {{-- Toolbar: search (left) + column manager (right) --}}
        <div class="rg-toolbar">
            <div class="fi-input-wrp rg-search-wrp">
                <div class="fi-input-wrp-prefix fi-input-wrp-prefix-has-content fi-inline">
                    <svg class="fi-icon fi-size-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <div class="fi-input-wrp-content-ctn">
                    <input class="fi-input fi-input-has-inline-prefix" type="search" placeholder="{{ __('filament-datatable::datagrid.search') }}"
                           x-model="searchQuery" @input.debounce.250ms="onSearchInput()" @search="onSearchInput()">
                </div>
            </div>

            <div class="rg-dd" @click.outside="columnMenuOpen = false">
                <button type="button" class="rg-colsbtn" title="{{ __('filament-datatable::datagrid.choose_columns') }}" @click="columnMenuOpen = !columnMenuOpen">
                    <svg class="fi-icon fi-size-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M14 17h2.75A2.25 2.25 0 0 0 19 14.75v-9.5A2.25 2.25 0 0 0 16.75 3H14v14ZM12.5 3h-5v14h5V3ZM3.25 3H6v14H3.25A2.25 2.25 0 0 1 1 14.75v-9.5A2.25 2.25 0 0 1 3.25 3Z"/>
                    </svg>
                    <span>{{ __('filament-datatable::datagrid.columns') }}</span>
                </button>
                <div class="ls-pop rg-cols" x-show="columnMenuOpen" x-cloak @click.outside="columnMenuOpen = false">
                    <div class="rg-cols-head">
                        <span>{{ __('filament-datatable::datagrid.columns') }}</span>
                        <button type="button" class="rg-reset" @click="resetColumns()">{{ __('filament-datatable::datagrid.reset') }}</button>
                    </div>
                    <template x-for="(column, index) in orderedColumns" :key="column.k">
                        <label class="ls-opt rg-colrow" draggable="true"
                               @dragstart="draggingFrom = index" @dragover.prevent @drop.prevent="dropColumn(index)"
                               :class="draggingFrom === index && 'rg-dragging'">
                            <input type="checkbox" class="fi-checkbox-input" :checked="visibleKeys.includes(column.k)" @change="toggleColumn(column.k)">
                            <span x-text="column.t" style="flex:1"></span>
                            <span class="rg-drag" title="{{ __('filament-datatable::datagrid.drag_to_reorder') }}">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h16M4 15h16"/></svg>
                            </span>
                        </label>
                    </template>
                </div>
            </div>
        </div>

        {{-- Virtual-scroll table --}}
        <div class="rg-wrap" x-ref="scroller">
            {{-- Generic skeleton for the brief moment before the component hydrates (no columns yet). --}}
            <div class="rg-skeleton" x-show="!hydrated">
                @for ($i = 0; $i < 14; $i++)
                    <div class="rg-skel-row">
                        @foreach ([1.2, 2.4, 1.5, 3.2, 1, 2, 1.3, 2.6, 1.1, 1.8] as $flex)
                            <span class="rg-skel-bar" style="flex:{{ $flex }}"></span>
                        @endforeach
                    </div>
                @endfor
            </div>
            <table class="rg-table" x-cloak :style="`min-width:${totalColumnsWidth + leadWidth + (rowActions ? actionsColumnWidth : 0)}px`">
                <colgroup>
                    <template x-if="selectable"><col style="width:44px"></template>
                    <col :style="`width:${leftColSpacer}px`">
                    <template x-for="column in renderedColumns" :key="column.k"><col :style="`width:${columnWidth(column)}px`"></template>
                    <col :style="`width:${rightColSpacer}px`">
                    <template x-if="rowActions"><col :style="`width:${actionsColumnWidth}px`"></template>
                </colgroup>
                <thead>
                    <tr>
                        <template x-if="selectable">
                            <th class="rg-th rg-check">
                                <input type="checkbox" class="fi-checkbox-input" :checked="allSelected()" @change="toggleSelectAll()">
                            </th>
                        </template>
                        <th class="rg-th rg-spacer"></th>
                        <template x-for="column in renderedColumns" :key="column.k">
                            <th class="rg-th" :class="column.align === 'end' && 'rg-end'">
                                <span class="rg-th-in" @click="toggleSort(column.k)">
                                    <span x-text="column.t"></span>
                                    <span class="rg-sort" :class="sort.key === column.k && 'on'"
                                          x-html="(sort.key === column.k && sort.dir === 'asc') ? icons.chevronUp : icons.chevronDown"></span>
                                </span>
                                <button type="button" class="rg-funnel" :class="filterIsActive(column) && 'on'"
                                        x-show="column.filter" @click.stop="openFilter(column, $event)" title="{{ __('filament-datatable::datagrid.filter') }}" x-html="icons.funnel"></button>
                            </th>
                        </template>
                        <th class="rg-th rg-spacer"></th>
                        <th class="rg-th rg-acts-th" x-show="rowActions">{{ __('filament-datatable::datagrid.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr x-ref="topSpacer"><td :colspan="spacerColspan" style="padding:0;border:0"></td></tr>

                    {{-- Shimmer rows while data loads — aligned to the real (already-visible) columns --}}
                    <template x-for="n in (loading ? 14 : 0)" :key="`sk${n}`">
                        <tr class="rg-row">
                            <template x-if="selectable"><td class="rg-td rg-check"></td></template>
                            <td class="rg-td rg-spacer"></td>
                            <template x-for="column in renderedColumns" :key="column.k">
                                <td class="rg-td"><span class="rg-skel-bar" :style="`width:${skeletonBarWidth(column)}px`"></span></td>
                            </template>
                            <td class="rg-td rg-spacer"></td>
                            <template x-if="rowActions"><td class="rg-td rg-acts"></td></template>
                        </tr>
                    </template>

                    {{-- Fixed pool of row slots, keyed by position → DOM nodes are recycled on scroll --}}
                    <template x-for="(row, slot) in (loading ? [] : windowRows)" :key="slot">
                        <tr class="rg-row" x-show="row" @click="openRow(row)"
                            :style="rowUrl ? 'cursor:pointer' : ''"
                            :class="[row && isRowSelected(row.id) && 'rg-selected', rowHighlightClass(row)]">
                            <template x-if="selectable">
                                <td class="rg-td rg-check">
                                    <input type="checkbox" class="fi-checkbox-input" :checked="row && isRowSelected(row.id)" @change="row && toggleRowSelection(row.id)">
                                </td>
                            </template>
                            <td class="rg-td rg-spacer"></td>
                            <template x-for="column in renderedColumns" :key="column.k">
                                <td class="rg-td" :class="cellClass(column)">
                                    <template x-if="column.edit">
                                        <div class="fi-ta-text-input">
                                            <div class="fi-input-wrp">
                                                <div class="fi-input-wrp-content-ctn">
                                                    <input class="fi-input fi-align-start" type="text" :aria-label="column.t"
                                                           :value="row ? (row[column.k] ?? '') : ''"
                                                           @change="row && saveCell(row, column.k, $event.target.value)"
                                                           @keydown.enter="$event.target.blur()">
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                    <template x-if="!column.edit">
                                        <span :class="row ? cellView(row, column).cls : ''"
                                              :title="row ? cellView(row, column).title : ''"
                                              x-text="row ? cellView(row, column).text : ''"></span>
                                    </template>
                                </td>
                            </template>
                            <td class="rg-td rg-spacer"></td>
                            <td class="rg-td rg-acts" x-show="rowActions">
                                <div class="rg-acts-in">
                                    <template x-for="action in (row ? actionsFor(row) : [])" :key="action.name">
                                        <span>
                                            <a x-show="action.url" :href="action.url ? action.url.replace(':id', row.id) : '#'"
                                               :target="action.newTab ? '_blank' : '_self'" @click.stop class="rg-actbtn" :class="`rg-act-${action.color}`">
                                                <span class="rg-actico" x-html="actionIcon(action)"></span><span x-text="action.label"></span>
                                            </a>
                                            <button x-show="!action.url" type="button" class="rg-actbtn" :class="`rg-act-${action.color}`"
                                                    @click.stop="mountAction(action.name, row.id)">
                                                <span class="rg-actico" x-html="actionIcon(action)"></span><span x-text="action.label"></span>
                                            </button>
                                        </span>
                                    </template>
                                </div>
                            </td>
                        </tr>
                    </template>

                    <tr x-ref="bottomSpacer"><td :colspan="spacerColspan" style="padding:0;border:0"></td></tr>
                </tbody>
            </table>
            <div class="rg-empty" x-cloak x-show="!loading && filteredCount === 0">{{ __('filament-datatable::datagrid.no_rows') }}</div>
        </div>

        {{-- Summary bar (part of the card, does not scroll horizontally). --}}
        {{-- Server-rendered placeholder shows immediately with "–"; Alpine fills the values in. --}}
        @if (! empty($config['summary']))
            <div class="rg-footbar" x-html="summaryHtml()">{!! collect($config['summary'])
                ->map(fn (array $item) => e($item['label']).': <b>–</b>')
                ->implode('<span class="rg-sep">·</span>') !!}</div>
        @endif
    </div>

    {{-- Filter popover --}}
    <div class="ls-pop rg-fpop" x-show="filterColumn" x-cloak :style="filterStyle" @click.outside="filterColumn = null" @keydown.escape.window="filterColumn = null">
        <template x-if="filterColumn && filterColumn.filter === 'select'">
            <div>
                <input type="text" class="ls-fsearch" placeholder="{{ __('filament-datatable::datagrid.search_options') }}" x-model="filterOptionSearch">
                <div class="ls-opts">
                    <template x-for="option in filterOptions(filterColumn)" :key="option.value">
                        <label class="ls-opt" x-show="!filterOptionSearch || option.label.toLowerCase().includes(filterOptionSearch.toLowerCase())">
                            <input type="checkbox" class="fi-checkbox-input" :checked="(columnFilters[filterColumn.k] || []).includes(option.value)" @change="toggleFilterValue(filterColumn.k, option.value)">
                            <span x-text="option.label"></span>
                        </label>
                    </template>
                </div>
            </div>
        </template>
        <template x-if="filterColumn && filterColumn.filter === 'num'">
            <div>
                <div style="font-size:11px;color:var(--rg-muted)">{{ __('filament-datatable::datagrid.from') }}</div>
                <input type="number" step="any" title="{{ __('filament-datatable::datagrid.from') }}" :value="(columnFilters[filterColumn.k] || {}).min ?? ''" @input="setNumberBound(filterColumn.k, 'min', $event.target.value)">
                <div style="font-size:11px;color:var(--rg-muted)">{{ __('filament-datatable::datagrid.to') }}</div>
                <input type="number" step="any" title="{{ __('filament-datatable::datagrid.to') }}" :value="(columnFilters[filterColumn.k] || {}).max ?? ''" @input="setNumberBound(filterColumn.k, 'max', $event.target.value)">
            </div>
        </template>
        <template x-if="filterColumn && filterColumn.filter === 'datetime'">
            <div>
                <div style="font-size:11px;color:var(--rg-muted)">{{ __('filament-datatable::datagrid.from') }}</div>
                <input type="datetime-local" title="{{ __('filament-datatable::datagrid.from') }}" :value="(columnFilters[filterColumn.k] || {}).od || ''" @change="setRangeBound(filterColumn.k, 'od', $event.target.value)">
                <div style="font-size:11px;color:var(--rg-muted)">{{ __('filament-datatable::datagrid.to') }}</div>
                <input type="datetime-local" title="{{ __('filament-datatable::datagrid.to') }}" :value="(columnFilters[filterColumn.k] || {}).do || ''" @change="setRangeBound(filterColumn.k, 'do', $event.target.value)">
            </div>
        </template>
        <template x-if="filterColumn && filterColumn.filter === 'text'">
            <input type="text" class="ls-fsearch" placeholder="{{ __('filament-datatable::datagrid.contains') }}"
                   :value="columnFilters[filterColumn.k] || ''" @input="setTextFilter(filterColumn.k, $event.target.value)">
        </template>
        <template x-if="filterColumn && filterColumn.filter === 'date'">
            <div>
                <div><div style="font-size:11px;color:#6b7280">{{ __('filament-datatable::datagrid.from') }}</div>
                    <input type="date" title="{{ __('filament-datatable::datagrid.from') }}" :value="(columnFilters[filterColumn.k] || {}).od || ''" @change="setRangeBound(filterColumn.k, 'od', $event.target.value)"></div>
                <div><div style="font-size:11px;color:#6b7280">{{ __('filament-datatable::datagrid.to') }}</div>
                    <input type="date" title="{{ __('filament-datatable::datagrid.to') }}" :value="(columnFilters[filterColumn.k] || {}).do || ''" @change="setRangeBound(filterColumn.k, 'do', $event.target.value)"></div>
            </div>
        </template>
        <div class="ls-actions">
            <button @click="clearFilter(filterColumn.k)">{{ __('filament-datatable::datagrid.clear') }}</button>
            <button class="ls-apply" @click="filterColumn = null">{{ __('filament-datatable::datagrid.apply') }}</button>
        </div>
    </div>

    @include('filament-datatable::components.datagrid-styles')
</div>
