<style>
    [x-cloak]{display:none!important}
    .rg{--rg-bg:var(--fi-color-white,#fff);--rg-fg:#111827;--rg-muted:#6b7280;--rg-line:#e5e7eb;--rg-hover:#f9fafb;
        --rg-head:#f9fafb;--rg-primary:#0b7099;--rg-pos:#15803d;--rg-neg:#b91c1c;position:relative;}
    :where(.dark) .rg{--rg-bg:#1f2023;--rg-fg:#f4f4f5;--rg-muted:#9ca3af;--rg-line:rgba(255,255,255,.1);
        --rg-hover:rgba(255,255,255,.04);--rg-head:#27282b;--rg-primary:#38bdf8;--rg-pos:#4ade80;--rg-neg:#f87171;}
    .rg-card{border:1px solid var(--rg-line);border-radius:12px;overflow:hidden;background:var(--rg-bg);}
    .rg-toolbar{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--rg-line);}
    .rg-search-wrp{max-width:24rem;}
    .rg-dd{position:relative;margin-left:auto;}
    .rg-colsbtn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--rg-line);background:var(--rg-bg);
        color:var(--rg-fg);border-radius:8px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;line-height:1.3;}
    .rg-colsbtn:hover{background:var(--rg-hover);border-color:var(--rg-primary);color:var(--rg-primary);}
    .rg-colsbtn svg{width:16px;height:16px;}
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
    .rg-late td{background:rgba(185,28,28,.09);}
    :where(.dark) .rg-late td{background:rgba(248,113,113,.10);}
    .rg-late:hover td{background:rgba(185,28,28,.15);}
    :where(.dark) .rg-late:hover td{background:rgba(248,113,113,.16);}
    .rg-end{text-align:right!important;}
    .rg-funnel{margin-left:1px;border:none;background:transparent;color:var(--rg-muted);cursor:pointer;padding:2px;
        border-radius:4px;vertical-align:middle;display:inline-flex;}
    .rg-funnel:hover{color:var(--rg-primary);}
    .rg-funnel.on{color:var(--rg-primary);}
    .rg-row{height:42px;}
    .rg-row:hover td{background:var(--rg-hover);}
    .rg-td{padding:0 12px;height:42px;border-bottom:1px solid var(--rg-line);white-space:nowrap;overflow:hidden;
        text-overflow:ellipsis;max-width:0;}
    .rg-spacer{padding:0!important;} /* off-viewport column spacers (column virtualization) */
    .rg-mono{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:12.5px;}
    /* Editable cells: compact so the row keeps the same 42px height as the other grids. */
    .rg-edit{overflow:visible;padding:0 6px;}
    .rg-edit .fi-ta-text-input{padding:0;display:flex;align-items:center;height:42px;}
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
    .rg-st-ok{background:rgba(22,163,74,.12);border-color:rgba(22,163,74,.3);color:var(--rg-pos);}
    .rg-st-late{background:rgba(185,28,28,.12);border-color:rgba(185,28,28,.3);color:var(--rg-neg);}
    .rg-st-wait{background:rgba(202,138,4,.14);border-color:rgba(202,138,4,.3);color:#a16207;}
    :where(.dark) .rg-st-wait{color:#facc15;}
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
</style>
