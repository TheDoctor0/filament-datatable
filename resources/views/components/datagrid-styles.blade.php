<style>
    [x-cloak]{display:none!important}
    .rg{--rg-bg:var(--fi-color-white,#fff);--rg-fg:#111827;--rg-muted:#6b7280;--rg-line:#e5e7eb;--rg-hover:#f9fafb;
        --rg-head:#f9fafb;--rg-primary:#0b7099;--rg-pos:#15803d;--rg-neg:#b91c1c;position:relative;}
    :where(.dark) .rg{--rg-bg:#1f2023;--rg-fg:#f4f4f5;--rg-muted:#9ca3af;--rg-line:rgba(255,255,255,.1);
        --rg-hover:rgba(255,255,255,.04);--rg-head:#27282b;--rg-primary:#38bdf8;--rg-pos:#4ade80;--rg-neg:#f87171;}
    .rg-card{border:1px solid var(--rg-line);border-radius:12px;overflow:hidden;background:var(--rg-bg);}
    .rg-toolbar{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--rg-line);}
    .rg-search-wrp{max-width:24rem;}
    .rg-bulkbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid var(--rg-line);
        background:color-mix(in srgb,var(--rg-primary) 8%,transparent);}
    .rg-bulk-count{font-size:13px;font-weight:600;color:var(--rg-fg);}
    .rg-bulk-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:auto;}
    .rg-actbtn:disabled{opacity:.5;cursor:default;}
    /* Przyciski paska akcji masowej */
    .rg-btn-filled{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--rg-primary);
        background:var(--rg-primary);color:#fff;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;
        cursor:pointer;line-height:1.3;}
    .rg-btn-filled:hover{background:color-mix(in srgb,var(--rg-primary) 88%,#000);}
    .rg-btn-filled svg{flex:none;}
    .rg-btn-outline{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--rg-line);
        background:transparent;color:var(--rg-fg);border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;
        cursor:pointer;line-height:1.3;}
    .rg-btn-outline:hover{background:var(--rg-hover);border-color:var(--rg-primary);}
    .rg-dd{position:relative;margin-left:auto;}
    .rg-tools-end{display:flex;gap:8px;align-items:center;margin-left:auto;}
    .rg-colsbtn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--rg-line);background:var(--rg-bg);
        color:var(--rg-fg);border-radius:8px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;line-height:1.3;}
    .rg-colsbtn:hover{background:var(--rg-hover);border-color:var(--rg-primary);color:var(--rg-primary);}
    .rg-colsbtn svg{width:16px;height:16px;}
    .rg-filterbadge{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--rg-primary);
        background:color-mix(in srgb, var(--rg-primary) 12%, var(--rg-bg));color:var(--rg-primary);
        border-radius:999px;padding:5px 11px;font-size:13px;font-weight:700;cursor:pointer;line-height:1.3;}
    .rg-filterbadge:hover{background:color-mix(in srgb, var(--rg-primary) 20%, var(--rg-bg));}
    .rg-filterbadge .rg-filterbadge-x{opacity:.65;flex:none;}
    .rg-filterbadge:hover .rg-filterbadge-x{opacity:1;}
    .rg-filterbadge .rg-filterbadge-txt{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .rg-filterbadge svg{flex:none;}
    .rg-wrap{overflow:auto;height:calc(100vh - 300px);background:var(--rg-bg);}
    .rg-table{border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;font-size:13.5px;color:var(--rg-fg);}
    .rg-table thead th{position:sticky;top:0;z-index:2;background:var(--rg-head);color:var(--rg-muted);font-weight:600;
        text-align:left;padding:10px 12px;border-bottom:1px solid var(--rg-line);white-space:nowrap;}
    .rg-th{position:relative;}
    .rg-th-in{display:inline-flex;gap:3px;align-items:center;cursor:pointer;vertical-align:middle;}
    .rg-sort{color:var(--rg-muted);opacity:.4;display:inline-flex;transition:opacity .1s;}
    .rg-th-in:hover .rg-sort{opacity:.7;}
    .rg-sort.on{color:var(--rg-primary);opacity:1;}
    .rg-check{width:44px;text-align:center;padding-left:0;padding-right:0;}
    .rg-check .fi-checkbox-input{vertical-align:middle;}
    .rg-selected td{background:var(--rg-hover);}
    .rg-alert td{background:rgba(185,28,28,.09);}
    :where(.dark) .rg-alert td{background:rgba(248,113,113,.10);}
    .rg-alert:hover td{background:rgba(185,28,28,.15);}
    :where(.dark) .rg-alert:hover td{background:rgba(248,113,113,.16);}
    .rg-end{text-align:right!important;}
    .rg-funnel{margin-left:1px;border:none;background:transparent;color:var(--rg-muted);cursor:pointer;padding:2px;
        border-radius:4px;vertical-align:middle;display:inline-flex;}
    .rg-funnel:hover{color:var(--rg-primary);}
    /* Aktywny filtr: wypełniony lejek w kolorze brandu — wyraźnie widoczny. */
    .rg-funnel.on{color:var(--rg-primary);}
    .rg-funnel.on svg,.rg-funnel.on svg path{fill:var(--rg-primary);stroke:var(--rg-primary);}
    .rg-row{height:42px;}
    .rg-row:hover td{background:var(--rg-hover);}
    .rg-td{padding:0 12px;height:42px;border-bottom:1px solid var(--rg-line);white-space:nowrap;overflow:hidden;
        text-overflow:ellipsis;max-width:0;}
    .rg-spacer{padding:0!important;} /* off-viewport column spacers (column virtualization) */
    .rg-mono{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:12.5px;}
    /* Editable cells: compact so the row keeps the same 42px height as the other grids. */
    .rg-edit{overflow:visible;padding:0 6px;}
    .rg-tree{display:flex;align-items:center;gap:4px;min-width:0;}
    .rg-tree-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .rg-tag{margin-left:6px;flex:none;font-weight:600;}
    .rg-chev{flex:none;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;
        color:var(--rg-muted);cursor:pointer;background:transparent;border:0;padding:0;}
    .rg-chev:hover{background:var(--rg-hover);color:var(--rg-primary);}
    .rg-chev:focus-visible{outline:2px solid var(--rg-primary);outline-offset:1px;}
    .rg-chev svg{transition:transform .12s ease;}
    .rg-chev.open svg{transform:rotate(90deg);}
    .rg-chev-gap{flex:none;width:22px;}
    .rg-spin{width:12px;height:12px;border:2px solid var(--rg-line);border-top-color:var(--rg-primary);border-radius:50%;
        animation:rg-spin .7s linear infinite;}
    @keyframes rg-spin{to{transform:rotate(360deg);}}
    .rg-lvl-0 .rg-tree-txt{font-weight:600;}
    .rg-lvl-1 td{background:var(--rg-lvl1,rgba(17,24,39,.025));}
    .rg-lvl-2 td{background:var(--rg-lvl2,rgba(11,112,153,.045));}
    :where(.dark) .rg-lvl-1 td{background:var(--rg-lvl1,rgba(255,255,255,.03));}
    :where(.dark) .rg-lvl-2 td{background:var(--rg-lvl2,rgba(56,189,248,.06));}
    .rg-row.rg-lvl-1:hover td,.rg-row.rg-lvl-2:hover td{background:var(--rg-hover);}
    .rg-edit .fi-ta-text-input{padding:0;display:flex;align-items:center;height:41px;min-width:0;} /* row 42 = 41 + 1px border */
    .rg-edit .fi-input-wrp{min-height:0!important;height:30px!important;width:100%;max-width:100%;}
    .rg-edit .fi-input{width:100%;min-width:0;height:30px!important;padding:2px 8px;font-size:13px;line-height:1.2;}
    .rg-bold{font-weight:700;}
    .rg-badge{display:inline-block;padding:2px 8px;border-radius:8px;font-size:11.5px;font-weight:600;
        background:var(--rg-hover);border:1px solid var(--rg-line);white-space:nowrap;}
    /* Badge palette — soft translucent tint with a readable text colour, per value. */
    .rg-badge[class*="rg-c-"]{color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent);
        border-color:color-mix(in srgb,var(--c) 26%,transparent);}
    :where(.dark) .rg-badge[class*="rg-c-"]{color:color-mix(in srgb,var(--c) 62%,white);
        background:color-mix(in srgb,var(--c) 18%,transparent);border-color:color-mix(in srgb,var(--c) 34%,transparent);}
    .rg-c-info{--c:#0369a1;}
    .rg-c-success{--c:#15803d;}
    .rg-c-warning{--c:#b45309;}
    .rg-c-danger{--c:#b91c1c;}
    .rg-c-gray{--c:#6b7280;}
    .rg-c-primary{--c:#0b7099;}
    .rg-c-purple{--c:#7e22ce;}
    .rg-c-teal{--c:#0f766e;}
    .rg-c-pink{--c:#be185d;}
    .rg-c-indigo{--c:#4338ca;}
    .rg-c-orange{--c:#c2410c;}
    .rg-c-cyan{--c:#0e7490;}
    .rg-pos{color:var(--rg-pos);}.rg-neg{color:var(--rg-neg);}
    .rg-acts-th{text-align:right!important;}
    .rg-acts{overflow:visible;}
    .rg-acts-in{display:flex;gap:6px;justify-content:flex-end;flex-wrap:nowrap;}
    /* Link-style row actions (icon + text), matching Filament's table actions. */
    .rg-actbtn{display:inline-flex;align-items:center;gap:5px;border:none;background:transparent;color:var(--rg-muted);border-radius:6px;
        padding:4px 6px;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;line-height:1.5;text-decoration:none;transition:color .1s,background .1s;}
    .rg-actico{display:inline-flex;}.rg-actico svg{display:block;}
    .rg-actbtn:hover{color:var(--rg-fg);background:var(--rg-hover);}
    .rg-act-primary{color:var(--rg-primary);}
    .rg-act-primary:hover{color:var(--rg-primary);background:color-mix(in srgb,var(--rg-primary) 12%,transparent);}
    .rg-act-gray{color:var(--rg-muted);}
    .rg-act-danger{color:var(--rg-neg);}
    .rg-act-danger:hover{color:var(--rg-neg);background:color-mix(in srgb,var(--rg-neg) 12%,transparent);}
    .rg-act-warning{color:#b45309;}
    .rg-act-warning:hover{color:#b45309;background:color-mix(in srgb,#b45309 12%,transparent);}
    .rg-footbar{background:var(--rg-head);color:var(--rg-fg);font-weight:600;font-size:13px;
        padding:10px 14px;border-top:1px solid var(--rg-line);}
    .rg-footbar b{font-variant-numeric:tabular-nums;color:var(--rg-primary);}
    .rg-sep{color:var(--rg-muted);padding:0 18px;}
    .rg-empty{padding:24px;text-align:center;color:var(--rg-muted);}
    /* loading skeleton */
    .rg-skel-row{display:flex;gap:26px;align-items:center;height:42px;padding:0 12px;border-bottom:1px solid var(--rg-line);}
    .rg-skel-bar{display:inline-block;vertical-align:middle;height:12px;border-radius:6px;flex:1 1 0;min-width:0;
        background:linear-gradient(90deg, color-mix(in srgb,var(--rg-fg) 11%,transparent) 25%,
            color-mix(in srgb,var(--rg-fg) 24%,transparent) 37%, color-mix(in srgb,var(--rg-fg) 11%,transparent) 63%);
        background-size:400% 100%;animation:rg-shimmer 1.4s ease infinite;}
    @keyframes rg-shimmer{0%{background-position:100% 50%}100%{background-position:0 50%}}
    /* popover / dropdown — funnel filter styled like Filament */
    .ls-pop{position:absolute;z-index:50;background:var(--rg-bg);border:1px solid var(--rg-line);border-radius:10px;
        box-shadow:0 12px 32px rgba(0,0,0,.18);padding:10px;min-width:200px;color:var(--rg-fg);font-size:13px;}
    .rg-cols{position:absolute;top:40px;right:0;max-height:380px;overflow:auto;min-width:230px;}
    .rg-cols-head{display:flex;align-items:center;justify-content:space-between;padding:2px 4px 8px;
        font-weight:600;border-bottom:1px solid var(--rg-line);margin-bottom:6px;}
    .rg-reset{border:none;background:transparent;color:var(--rg-neg);font-weight:600;font-size:12.5px;cursor:pointer;padding:0;}
    .rg-colrow{justify-content:flex-start;gap:10px;border-radius:7px;padding:5px 6px;}
    .rg-colrow:hover{background:var(--rg-hover);}
    .rg-colrow.rg-dragging{opacity:.5;}
    .rg-drag-off{visibility:hidden;width:15px;}
    .rg-drag{color:var(--rg-muted);cursor:grab;display:inline-flex;}
    .rg-fpop{position:fixed;}
    .ls-pop input[type=text],.ls-pop input[type=date],.ls-pop input[type=number],.ls-pop input[type=datetime-local]{width:100%;box-sizing:border-box;border:1px solid var(--rg-line);
        border-radius:7px;padding:6px 8px;font-size:13px;margin-bottom:6px;background:var(--rg-bg);color:var(--rg-fg);}
    .ls-opts{max-height:240px;overflow:auto;margin:4px 0;}
    .ls-opt{display:flex;gap:8px;align-items:center;padding:4px 2px;cursor:pointer;}
    .ls-fsearch{margin-bottom:6px;}
    .ls-actions{display:flex;gap:6px;margin-top:8px;}
    .ls-actions button{flex:1;border-radius:7px;padding:6px 0;font-weight:600;font-size:12.5px;cursor:pointer;
        border:1px solid var(--rg-line);background:var(--rg-bg);color:var(--rg-fg);}
    .ls-actions .ls-apply{background:var(--rg-primary);color:#fff;border-color:var(--rg-primary);}
    .ls-pop input[type=text]:focus,.ls-pop input[type=number]:focus{outline:2px solid color-mix(in srgb,var(--rg-primary) 40%,transparent);outline-offset:0;}

    /* Thicker, easier-to-grab scrollbars on the grid viewport. */
    .rg-wrap{scrollbar-width:auto;scrollbar-color:color-mix(in srgb,var(--rg-fg) 28%,transparent) transparent;}
    .rg-wrap::-webkit-scrollbar{width:14px;height:14px;}
    .rg-wrap::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--rg-fg) 24%,transparent);border-radius:8px;border:3px solid var(--rg-bg);}
    .rg-wrap::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--rg-fg) 40%,transparent);}
    .rg-wrap::-webkit-scrollbar-track{background:transparent;}
    .rg-wrap::-webkit-scrollbar-corner{background:var(--rg-bg);}

    /* Pinned columns (sticky left) and the sticky actions column (right). Only while .rg-pin is set
       (wide enough viewport). Backgrounds are opaque so the cells scrolling underneath never show through. */
    .rg-pin .rg-stick{position:sticky;z-index:1;background:var(--rg-bg);}
    .rg-pin .rg-table thead th.rg-stick{z-index:3;background:var(--rg-head);}
    .rg-pin .rg-row:hover td.rg-stick,.rg-pin .rg-selected td.rg-stick{background:linear-gradient(var(--rg-hover),var(--rg-hover)),var(--rg-bg);}
    .rg-pin .rg-alert td.rg-stick{background:linear-gradient(rgba(185,28,28,.09),rgba(185,28,28,.09)),var(--rg-bg);}
    :where(.dark) .rg-pin .rg-alert td.rg-stick{background:linear-gradient(rgba(248,113,113,.10),rgba(248,113,113,.10)),var(--rg-bg);}
    .rg-pin .rg-frz-edge{box-shadow:inset -1px 0 0 var(--rg-line);}
    .rg-pin.rg-scrolled .rg-frz-edge{box-shadow:inset -1px 0 0 var(--rg-line),8px 0 8px -8px rgba(0,0,0,.22);}
    .rg-pin .rg-acts-pin{right:0;overflow:hidden;box-shadow:inset 1px 0 0 var(--rg-line),-8px 0 8px -8px rgba(0,0,0,.22);}

    /* Header: one line — label truncated with an ellipsis (full text in the tooltip), icons never squeezed. */
    .rg-th-box{display:flex;align-items:center;gap:1px;min-width:0;}
    .rg-end .rg-th-box{justify-content:flex-end;}
    .rg-th-in{min-width:0;}
    .rg-th-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .rg-sort,.rg-funnel{flex:none;}
    /* Column resize handle on the header's right edge. */
    .rg-resizer{position:absolute;top:0;right:0;width:9px;height:100%;cursor:col-resize;touch-action:none;z-index:4;}
    .rg-resizer::after{content:"";position:absolute;top:24%;bottom:24%;right:3px;width:2px;border-radius:2px;background:var(--rg-line);opacity:0;transition:opacity .1s;}
    .rg-th:hover .rg-resizer::after{opacity:1;}
    .rg-resizer-start{right:auto;left:0;}
    .rg-resizer-start::after{right:auto;left:3px;}
    .rg-resizer:hover::after{background:var(--rg-primary);opacity:1;}
    body.rg-resizing{cursor:col-resize!important;user-select:none;}
    .rg-link{color:var(--rg-primary);text-decoration:none;}
    .rg-link:hover{text-decoration:underline;}
    body.rg-resizing *{cursor:col-resize!important;}

    /* Column picker: search + pin toggle per row. */
    .rg-cols{min-width:280px;max-height:440px;}
    .rg-cols .ls-fsearch{margin:2px 0 6px;}
    .rg-colrow-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .rg-pinbtn{flex:none;display:inline-grid;place-items:center;width:26px;height:24px;border:1px solid transparent;border-radius:6px;
        background:transparent;color:var(--rg-muted);cursor:pointer;opacity:.45;padding:0;}
    .rg-colrow:hover .rg-pinbtn{opacity:.8;}
    .rg-pinbtn:hover{border-color:var(--rg-line);opacity:1;}
    .rg-pinbtn.on{opacity:1;color:var(--rg-primary);border-color:color-mix(in srgb,var(--rg-primary) 35%,transparent);
        background:color-mix(in srgb,var(--rg-primary) 10%,transparent);}

    /* Quick-filter bar. */
    .rg-qbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border-bottom:1px solid var(--rg-line);background:var(--rg-head);}
    .rg-qbar-lead{font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--rg-muted);margin-right:2px;}
    .rg-qpill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--rg-line);background:var(--rg-bg);color:var(--rg-fg);
        border-radius:8px;padding:5px 10px;font-size:13px;font-weight:500;cursor:pointer;line-height:1.3;white-space:nowrap;}
    .rg-qpill:hover{border-color:var(--rg-primary);}
    .rg-qpill.on{border-color:var(--rg-primary);color:var(--rg-primary);background:color-mix(in srgb,var(--rg-primary) 9%,var(--rg-bg));font-weight:600;}
    .rg-qchev{opacity:.6;flex:none;}
    .rg-qcnt{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;font-size:11px;font-weight:700;
        background:var(--rg-primary);color:#fff;}
    .rg-qadd{border-style:dashed;color:var(--rg-muted);}
    .rg-qdd{position:relative;}
    .rg-qmenu{top:36px;left:0;min-width:250px;}
    .rg-qmenu .ls-opts{max-height:300px;}
    .rg-qmenu-item{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--rg-fg);padding:6px 8px;border-radius:6px;
        font-size:13px;cursor:pointer;}
    .rg-qmenu-item:hover{background:var(--rg-hover);color:var(--rg-primary);}
    .rg-qpin{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:6px;border:1px dashed var(--rg-line);
        background:transparent;color:var(--rg-muted);border-radius:7px;padding:6px 0;font-size:12.5px;font-weight:600;cursor:pointer;}
    .rg-qpin:hover{color:var(--rg-primary);border-color:var(--rg-primary);}

    /* Active-filter chips (filterChips). */
    .rg-toolbar{flex-wrap:wrap;}
    .rg-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;}
    .rg-chip{display:inline-flex;align-items:center;gap:2px;max-width:280px;border:1px solid color-mix(in srgb,var(--rg-primary) 30%,var(--rg-line));
        background:color-mix(in srgb,var(--rg-primary) 8%,var(--rg-bg));border-radius:999px;padding:2px 4px 2px 10px;font-size:12.5px;line-height:1.4;}
    .rg-chip-body{display:inline-flex;gap:4px;min-width:0;border:0;background:transparent;color:inherit;padding:0;cursor:pointer;font:inherit;}
    .rg-chip-k{color:var(--rg-muted);white-space:nowrap;}
    .rg-chip b{font-weight:600;color:var(--rg-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .rg-chip-x{flex:none;display:inline-grid;place-items:center;width:18px;height:18px;border:0;border-radius:50%;background:transparent;
        color:var(--rg-muted);cursor:pointer;font-size:14px;line-height:1;padding:0;}
    .rg-chip-x:hover{background:color-mix(in srgb,var(--rg-fg) 12%,transparent);color:var(--rg-fg);}
    .rg-chip-clear{border:0;background:transparent;color:var(--rg-primary);font-weight:600;font-size:12.5px;cursor:pointer;padding:3px 6px;border-radius:6px;}
    .rg-chip-clear:hover{background:color-mix(in srgb,var(--rg-primary) 10%,transparent);}

    /* Num filter: value list + range. */
    .rg-fpop{max-width:min(300px,calc(100vw - 16px));}
    .rg-fsec{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--rg-muted);margin:2px 0 6px;}
    .rg-range{display:flex;gap:6px;}
    .rg-range input{min-width:0;}
    .rg-empty{display:flex;flex-direction:column;align-items:center;gap:12px;}
</style>
