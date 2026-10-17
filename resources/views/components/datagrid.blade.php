@props(['config'])

@php
    // Strings the JS needs at runtime (notifications) — the rest of the UI is rendered here.
    $config['i18n'] = [
        'exportFailed' => __('filament-datatable::datagrid.export_failed'),
        'sessionExpired' => __('filament-datatable::datagrid.session_expired'),
    ];
@endphp

<div
    x-load
    x-load-src="{{ \Filament\Support\Facades\FilamentAsset::getAlpineComponentSrc('datagrid', \TheDoctor0\FilamentDatatable\DatatableServiceProvider::PACKAGE) }}"
    x-data="datagrid(@js($config))"
    x-on:rg-export.window="exportFile($event.detail.format, !!$event.detail.selected)"
    x-on:rg-refresh.window="reload()"
    x-on:rg-clear-selection.window="clearSelection()"
    class="rg fi-ta"
    :class="{ 'rg-pin': pinActive, 'rg-scrolled': scrolledX }"
>
    <div class="rg-card">
        {{-- Toolbar: search + active filters (left) + column manager (right) --}}
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

            @if (! empty($config['filterChips']))
                {{-- Active-filter chips: everything narrowing the view, each removable; click a chip to edit it. --}}
                <div class="rg-chips" x-show="isNarrowed()" x-cloak>
                    <span class="rg-chip" x-show="searchQuery">
                        <span class="rg-chip-k">{{ __('filament-datatable::datagrid.search') }}:</span>
                        <b x-text="'“' + searchQuery + '”'"></b>
                        <button type="button" class="rg-chip-x" @click="clearSearch()" aria-label="{{ __('filament-datatable::datagrid.clear') }}">&times;</button>
                    </span>
                    <template x-for="chip in filterChips()" :key="chip.key">
                        <span class="rg-chip">
                            <button type="button" class="rg-chip-body" @click.stop="openFilter(columnsByKey[chip.key], $event)">
                                <span class="rg-chip-k" x-text="chip.label + ':'"></span>
                                <b x-text="chip.text"></b>
                            </button>
                            <button type="button" class="rg-chip-x" @click="clearFilter(chip.key)" aria-label="{{ __('filament-datatable::datagrid.clear') }}">&times;</button>
                        </span>
                    </template>
                    <button type="button" class="rg-chip-clear" @click="clearAllFilters(true)">{{ __('filament-datatable::datagrid.clear_filters') }}</button>
                </div>
            @else
                <button type="button" class="rg-filterbadge" x-show="activeFilterCount() > 0" x-cloak
                        @click="clearAllFilters()" :title="'{{ __('filament-datatable::datagrid.clear_all_filters') }}'">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 4h18l-7 8.5V20l-4 1v-8.5z"/></svg>
                    <span class="rg-filterbadge-txt" x-text="filterSummary()"></span>
                    <svg class="rg-filterbadge-x" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
            @endif

            <div class="rg-tools-end">
                <button type="button" class="rg-colsbtn rg-collapse" x-show="hasExpanded()" x-cloak @click="collapseAll()">
                    <svg class="fi-icon fi-size-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M14.78 14.78a.75.75 0 0 1-1.06 0L10 11.06l-3.72 3.72a.75.75 0 1 1-1.06-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06Zm0-6a.75.75 0 0 1-1.06 0L10 5.06 6.28 8.78a.75.75 0 0 1-1.06-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06Z" clip-rule="evenodd"/>
                    </svg>
                    <span>{{ __('filament-datatable::datagrid.collapse_all') }}</span>
                </button>

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
                        <input type="text" class="ls-fsearch" placeholder="{{ __('filament-datatable::datagrid.search_columns') }}" x-model="columnSearch">
                        <template x-for="(column, index) in orderedColumns" :key="column.k">
                            <label class="ls-opt rg-colrow" :draggable="!columnSearch" x-show="columnMatchesSearch(column)"
                                   @dragstart="draggingFrom = index" @dragover.prevent @drop.prevent="dropColumn(index)"
                                   :class="draggingFrom === index && 'rg-dragging'">
                                <input type="checkbox" class="fi-checkbox-input" :checked="visibleKeys.includes(column.k)"
                                       @change="toggleColumn(column.k)">
                                <span x-text="column.t" class="rg-colrow-label"></span>
                                <button type="button" class="rg-pinbtn" :class="isPinned(column.k) && 'on'" x-html="icons.pin"
                                        :title="isPinned(column.k) ? @js(__('filament-datatable::datagrid.unpin_column')) : @js(__('filament-datatable::datagrid.pin_column'))"
                                        @click.stop.prevent="togglePin(column.k)"></button>
                                <span class="rg-drag" x-show="!columnSearch" title="{{ __('filament-datatable::datagrid.drag_to_reorder') }}">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h16M4 15h16"/></svg>
                                </span>
                            </label>
                        </template>
                        {{-- Actions column: always shown and always last — only its pin can change. --}}
                        <div class="ls-opt rg-colrow rg-colrow-fixed" x-show="rowActions && columnMatchesSearch({ k: '_actions', t: @js(__('filament-datatable::datagrid.actions')) })">
                            <input type="checkbox" class="fi-checkbox-input" checked disabled>
                            <span class="rg-colrow-label">{{ __('filament-datatable::datagrid.actions') }}</span>
                            <button type="button" class="rg-pinbtn" :class="stickyActions && 'on'" x-html="icons.pin"
                                    :title="stickyActions ? @js(__('filament-datatable::datagrid.unpin_column')) : @js(__('filament-datatable::datagrid.pin_column'))"
                                    @click.stop.prevent="toggleStickyActions()"></button>
                            <span class="rg-drag rg-drag-off" aria-hidden="true"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {{-- Quick-filter bar: pinned filters one click away; any filterable column can be added. --}}
        <template x-if="quickFiltersEnabled">
            <div class="rg-qbar">
                <span class="rg-qbar-lead">{{ __('filament-datatable::datagrid.quick_filters') }}</span>
                <template x-for="column in quickColumns" :key="column.k">
                    <button type="button" class="rg-qpill" :class="filterIsActive(column) && 'on'" :data-quick-key="column.k"
                            @click.stop="openFilter(column, $event)">
                        <span x-text="column.t"></span>
                        <span class="rg-qcnt" x-show="filterCount(column.k) > 0" x-text="filterCount(column.k)"></span>
                        <svg class="rg-qchev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                </template>
                <div class="rg-qdd" @click.outside="quickMenuOpen = false">
                    <button type="button" class="rg-qpill rg-qadd" @click="quickMenuOpen = !quickMenuOpen; quickSearch = ''">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                        <span>{{ __('filament-datatable::datagrid.add_filter') }}</span>
                    </button>
                    <div class="ls-pop rg-qmenu" x-show="quickMenuOpen" x-cloak>
                        <input type="text" class="ls-fsearch" placeholder="{{ __('filament-datatable::datagrid.search_columns') }}" x-model="quickSearch">
                        <div class="ls-opts">
                            <template x-for="column in (quickMenuOpen ? quickCandidates() : [])" :key="column.k">
                                <button type="button" class="rg-qmenu-item" @click.stop="addQuickFilter(column)" x-text="column.t"></button>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        {{-- Pasek akcji masowej — widoczny gdy coś zaznaczono (gdy skonfigurowano bulkActions / bulkExport) --}}
        <template x-if="bulkActions.length > 0 || bulkExport.length > 0">
            <div class="rg-bulkbar" x-show="hasSelection()" x-cloak>
                <span class="rg-bulk-count">
                    <span x-text="selectionCount()"></span>
                    <span x-show="allFiltered" x-text="' {{ __('filament-datatable::datagrid.bulk_all_filtered') }}'"></span>
                    {{ __('filament-datatable::datagrid.bulk_selected') }}
                </span>
                <div class="rg-bulk-actions">
                    <template x-for="format in bulkExport" :key="format">
                        <button type="button" class="rg-btn-outline" @click="exportFile(format, true)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"/></svg>
                            <span x-text="@js(__('filament-datatable::datagrid.export_selected')) + ' (' + format.toUpperCase() + ')'"></span>
                        </button>
                    </template>
                    <template x-for="action in bulkActions" :key="action.name">
                        <button type="button" :class="actionColorClass(action.color)" @click="bulkAction(action.name)">
                            <span x-show="action.icon" x-html="actionIcon(action)"></span>
                            <span x-text="action.label"></span>
                        </button>
                    </template>
                    <button type="button" class="rg-btn-outline" @click="clearSelection()">
                        {{ __('filament-datatable::datagrid.bulk_clear') }}
                    </button>
                </div>
            </div>
        </template>

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
            {{-- Column cells = pinned columns, left spacer, in-view columns, right spacer (see cellColumns). --}}
            <table class="rg-table" x-cloak :style="`min-width:${tableWidth}px`">
                <colgroup>
                    <template x-if="selectable"><col style="width:44px"></template>
                    <template x-for="column in cellColumns" :key="column.k"><col :style="`width:${cellWidth(column)}px`"></template>
                    <template x-if="rowActions"><col :style="`width:${actionsColumnWidth}px`"></template>
                </colgroup>
                <thead>
                    <tr>
                        <template x-if="selectable">
                            <th class="rg-th rg-check rg-stick" style="left:0">
                                <input type="checkbox" class="fi-checkbox-input" :checked="allSelected()" @change="toggleSelectAll()">
                            </th>
                        </template>
                        <template x-for="column in cellColumns" :key="column.k">
                            <th class="rg-th" :class="headClass(column)" :style="cellStyle(column)">
                                <template x-if="!column._spacer">
                                    <span class="rg-th-box">
                                        <span class="rg-th-in" @click="toggleSort(column.k)">
                                            <span class="rg-th-label" x-text="column.t" :title="column.t"></span>
                                            <span class="rg-sort" :class="sort.key === column.k && 'on'"
                                                  x-html="(sort.key === column.k && sort.dir === 'asc') ? icons.chevronUp : icons.chevronDown"></span>
                                        </span>
                                        <button type="button" class="rg-funnel" :class="filterIsActive(column) && 'on'"
                                                x-show="column.filter" @click.stop="openFilter(column, $event)" title="{{ __('filament-datatable::datagrid.filter') }}" x-html="icons.funnel"></button>
                                        <span class="rg-resizer" x-show="resizable" title="{{ __('filament-datatable::datagrid.resize') }}"
                                              @pointerdown.stop.prevent="startResize(column, $event)" @click.stop></span>
                                    </span>
                                </template>
                            </th>
                        </template>
                        <th class="rg-th rg-acts-th" :class="stickyActions && 'rg-stick rg-acts-pin'" x-show="rowActions">{{ __('filament-datatable::datagrid.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr x-ref="topSpacer"><td :colspan="spacerColspan" style="padding:0;border:0"></td></tr>

                    {{-- Shimmer rows while data loads — aligned to the real (already-visible) columns --}}
                    <template x-for="n in (loading ? 14 : 0)" :key="`sk${n}`">
                        <tr class="rg-row">
                            <template x-if="selectable"><td class="rg-td rg-check rg-stick" style="left:0"></td></template>
                            <template x-for="column in cellColumns" :key="column.k">
                                <td class="rg-td" :class="column._spacer ? 'rg-spacer' : cellClass(column, null)" :style="cellStyle(column)">
                                    <template x-if="!column._spacer"><span class="rg-skel-bar" :style="`width:${skeletonBarWidth(column)}px`"></span></template>
                                </td>
                            </template>
                            <template x-if="rowActions"><td class="rg-td rg-acts" :class="stickyActions && 'rg-stick rg-acts-pin'"></td></template>
                        </tr>
                    </template>

                    {{-- Fixed pool of row slots, keyed by position → DOM nodes are recycled on scroll --}}
                    <template x-for="(row, slot) in (loading ? [] : windowRows)" :key="slot">
                        <tr class="rg-row" x-show="row" @click="openRow(row)"
                            :style="rowUrl ? 'cursor:pointer' : ''"
                            :class="[row && isRowSelected(row.id) && 'rg-selected', rowHighlightClass(row), treeRowClass(row)]">
                            <template x-if="selectable">
                                <td class="rg-td rg-check rg-stick" style="left:0" @click.stop>
                                    <input type="checkbox" class="fi-checkbox-input" :checked="row && isRowSelected(row.id)" :disabled="allFiltered" @change="row && toggleRowSelection(row.id)">
                                </td>
                            </template>
                            <template x-for="column in cellColumns" :key="column.k">
                                <td class="rg-td" :class="column._spacer ? 'rg-spacer' : cellClass(column, row)" :style="cellStyle(column)">
                                    <template x-if="!column._spacer && canEdit(column, row)">
                                        <div class="fi-ta-text-input">
                                            <div class="fi-input-wrp">
                                                <div class="fi-input-wrp-content-ctn">
                                                    <input class="fi-input fi-align-start" type="text" :aria-label="column.t"
                                                           :placeholder="column.placeholder || ''"
                                                           :title="row ? (row[column.k] ?? '') : ''"
                                                           :value="row ? (row[column.k] ?? '') : ''"
                                                           @change="row && saveCell(row, column.k, $event.target.value)"
                                                           @keydown.enter="$event.target.blur()">
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                    <template x-if="!column._spacer && !canEdit(column, row) && isTreeColumn(column)">
                                        <div class="rg-tree" :style="`padding-left:${treeIndent(row)}px`">
                                            <button type="button" class="rg-chev" x-show="row && row._hasChildren"
                                                    :class="isExpanded(row) && 'open'"
                                                    :aria-expanded="isExpanded(row) ? 'true' : 'false'"
                                                    :aria-label="isExpanded(row) ? '{{ __('filament-datatable::datagrid.collapse') }}' : '{{ __('filament-datatable::datagrid.expand') }}'"
                                                    @click.stop="toggleRow(row)">
                                                <span class="rg-spin" x-show="isTreeLoading(row)"></span>
                                                <svg x-show="!isTreeLoading(row)" width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd"/></svg>
                                            </button>
                                            <span class="rg-chev-gap" x-show="!(row && row._hasChildren)"></span>
                                            <template x-if="cellLink(column, row)">
                                                <a class="rg-tree-txt rg-link" :href="cellLink(column, row)" :target="column.newTab ? '_blank' : '_self'" @click.stop
                                                   :title="row ? (cellView(row, column).title || cellView(row, column).text) : ''"
                                                   x-text="row ? cellView(row, column).text : ''"></a>
                                            </template>
                                            <template x-if="!cellLink(column, row)">
                                                <span class="rg-tree-txt" :class="row ? cellView(row, column).cls : ''"
                                                      :title="row ? (cellView(row, column).title || cellView(row, column).text) : ''"
                                                      x-text="row ? cellView(row, column).text : ''"></span>
                                            </template>
                                            <template x-if="cellTag(column, row)">
                                                <span class="rg-badge rg-tag" :class="cellTag(column, row).cls" x-text="cellTag(column, row).text"></span>
                                            </template>
                                        </div>
                                    </template>
                                    <template x-if="!column._spacer && !canEdit(column, row) && !isTreeColumn(column) && cellLink(column, row)">
                                        <a class="rg-link" :class="row ? cellView(row, column).cls : ''" :href="cellLink(column, row)"
                                           :target="column.newTab ? '_blank' : '_self'" @click.stop
                                           :title="row ? cellView(row, column).title : ''"
                                           x-text="row ? cellView(row, column).text : ''"></a>
                                    </template>
                                    <template x-if="!column._spacer && !canEdit(column, row) && !isTreeColumn(column) && !cellLink(column, row)">
                                        <span :class="row ? cellView(row, column).cls : ''"
                                              :title="row ? cellView(row, column).title : ''"
                                              x-text="row ? cellView(row, column).text : ''"></span>
                                    </template>
                                    <template x-if="!column._spacer && !isTreeColumn(column) && cellTag(column, row)">
                                        <span class="rg-badge rg-tag" :class="cellTag(column, row).cls" x-text="cellTag(column, row).text"></span>
                                    </template>
                                </td>
                            </template>
                            <td class="rg-td rg-acts" :class="stickyActions && 'rg-stick rg-acts-pin'" x-show="rowActions">
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
            <div class="rg-empty" x-cloak x-show="!loading && filteredCount === 0">
                <div>{{ __('filament-datatable::datagrid.no_rows') }}</div>
                <button type="button" class="rg-btn-outline" x-show="isNarrowed()" @click="clearAllFilters(true)">
                    {{ __('filament-datatable::datagrid.clear_filters') }}
                </button>
            </div>
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
                        <label class="ls-opt" x-show="optionMatches(option)">
                            <input type="checkbox" class="fi-checkbox-input" :checked="(filterDraft[filterColumn.k] || []).includes(option.value)" @change="toggleFilterValue(filterColumn.k, option.value)">
                            <span x-text="option.label"></span>
                        </label>
                    </template>
                </div>
            </div>
        </template>
        <template x-if="filterColumn && filterColumn.filter === 'num'">
            <div>
                {{-- Pick exact values (e.g. 50 mm, 88 mm) and/or a range — both apply together. --}}
                <template x-if="numValueList(filterColumn)">
                    <div>
                        <div class="rg-fsec">{{ __('filament-datatable::datagrid.values') }}</div>
                        <input type="text" class="ls-fsearch" placeholder="{{ __('filament-datatable::datagrid.search_options') }}" x-model="filterOptionSearch">
                        <div class="ls-opts">
                            <template x-for="option in filterOptions(filterColumn)" :key="option.value">
                                <label class="ls-opt" x-show="optionMatches(option)">
                                    <input type="checkbox" class="fi-checkbox-input" :checked="numValuePicked(filterColumn.k, option.value)" @change="toggleNumValue(filterColumn.k, option.value)">
                                    <span x-text="option.label"></span>
                                </label>
                            </template>
                        </div>
                        <div class="rg-fsec">{{ __('filament-datatable::datagrid.range') }}</div>
                    </div>
                </template>
                <div class="rg-range">
                    <input type="number" step="any" placeholder="{{ __('filament-datatable::datagrid.from') }}" title="{{ __('filament-datatable::datagrid.from') }}" :value="(filterDraft[filterColumn.k] || {}).min ?? ''" @input="setNumberBound(filterColumn.k, 'min', $event.target.value)">
                    <input type="number" step="any" placeholder="{{ __('filament-datatable::datagrid.to') }}" title="{{ __('filament-datatable::datagrid.to') }}" :value="(filterDraft[filterColumn.k] || {}).max ?? ''" @input="setNumberBound(filterColumn.k, 'max', $event.target.value)">
                </div>
            </div>
        </template>
        <template x-if="filterColumn && filterColumn.filter === 'datetime'">
            <div>
                <div style="font-size:11px;color:var(--rg-muted)">{{ __('filament-datatable::datagrid.from') }}</div>
                <input type="datetime-local" title="{{ __('filament-datatable::datagrid.from') }}" :value="(filterDraft[filterColumn.k] || {}).od || ''" @change="setRangeBound(filterColumn.k, 'od', $event.target.value)">
                <div style="font-size:11px;color:var(--rg-muted)">{{ __('filament-datatable::datagrid.to') }}</div>
                <input type="datetime-local" title="{{ __('filament-datatable::datagrid.to') }}" :value="(filterDraft[filterColumn.k] || {}).do || ''" @change="setRangeBound(filterColumn.k, 'do', $event.target.value)">
            </div>
        </template>
        <template x-if="filterColumn && filterColumn.filter === 'text'">
            <input type="text" class="ls-fsearch" placeholder="{{ __('filament-datatable::datagrid.contains') }}"
                   :value="filterDraft[filterColumn.k] || ''" @input="setTextFilter(filterColumn.k, $event.target.value)"
                   @keydown.enter="applyFilter(filterColumn.k)">
        </template>
        <template x-if="filterColumn && filterColumn.filter === 'date'">
            <div>
                <div><div style="font-size:11px;color:#6b7280">{{ __('filament-datatable::datagrid.from') }}</div>
                    <input type="date" title="{{ __('filament-datatable::datagrid.from') }}" :value="(filterDraft[filterColumn.k] || {}).od || ''" @change="setRangeBound(filterColumn.k, 'od', $event.target.value)"></div>
                <div><div style="font-size:11px;color:#6b7280">{{ __('filament-datatable::datagrid.to') }}</div>
                    <input type="date" title="{{ __('filament-datatable::datagrid.to') }}" :value="(filterDraft[filterColumn.k] || {}).do || ''" @change="setRangeBound(filterColumn.k, 'do', $event.target.value)"></div>
            </div>
        </template>
        <div class="ls-actions">
            <button @click="clearFilter(filterColumn.k)">{{ __('filament-datatable::datagrid.clear') }}</button>
            <button class="ls-apply" @click="applyFilter(filterColumn.k)">{{ __('filament-datatable::datagrid.apply') }}</button>
        </div>
        <template x-if="quickFiltersEnabled && filterColumn">
            <button type="button" class="rg-qpin" @click="toggleQuickFilter(filterColumn.k)">
                <span x-html="icons.pin"></span>
                <span x-text="quickKeys.includes(filterColumn.k) ? @js(__('filament-datatable::datagrid.unpin_from_bar')) : @js(__('filament-datatable::datagrid.pin_to_bar'))"></span>
            </button>
        </template>
    </div>

    @include('filament-datatable::components.datagrid-styles')
</div>
