/* Case studies organised by the paper's experimental settings. Uses the chart helpers exposed by bte.js as window.BTE_UI. */
(function () {
  'use strict';
  function start() {
    var U = window.BTE_UI, SET = window.BTE_SET, D = window.BTE_DATA;
    if (!U || !SET || !D) return;
    var html = U.html, svg = U.svg, clear = U.clear, fmt = U.fmt, signed = U.signed, cssVar = U.cssVar, lin = U.linear;
    function midOf(p) { var s = 0; for (var l = 12; l < 20; l++) s += p[l]; return s / 8; }
    function winMean(row, w) { var a = w === 'late' ? 24 : w === 'all' ? 0 : 12, b = w === 'late' ? 32 : w === 'all' ? 32 : 20, s = 0; for (var l = a; l < b; l++) s += row[l]; return s / (b - a); }
    function tokLabel(t) { return t.replace(/\n/g, '⏎').replace(/^ /, '␣'); }
    function sec(id) { return document.getElementById(id); }
    function seg(host, options, current, onChange) {
      var s = html('div', 'seg', host);
      options.forEach(function (o) {
        var b = html('button', null, s, o[1]); b.type = 'button'; b.setAttribute('aria-pressed', o[0] === current ? 'true' : 'false');
        b.addEventListener('click', function () { onChange(o[0]); });
      });
      return s;
    }
    function tbRow(head, label) { var r = html('div', 'tb-row', head); if (label) html('span', 'tb-lab', r, label); return r; }
    function colorbar(host, lo, hi, label) {
      var cb = html('div', 'scale lab-scale', host);
      html('span', null, cb, 'less');
      var r = html('span', 'ramp', cb); r.style.background = U.heatGradient();
      html('span', null, cb, 'more revision · ' + label + ', ' + fmt(lo, 2) + ' → ' + fmt(hi, 2) + ' nats');
    }
    function tokenText(host, item, win, lo, hi, hooks) {
      var body = html('div', 'lab-text', host);
      item.tokens.forEach(function (tk, i) {
        var sp = U.tokenFill(html('span', 'tk', body), tk);
        var v = (winMean(item.bte[i], win) / 1000 - lo) / Math.max(1e-6, hi - lo);
        var c = U.heatColor(v); sp.style.background = c.bg; sp.style.color = c.fg;
        sp.title = 'token ' + i + ' “' + tokLabel(tk) + '” · middle-window ' + fmt(midOf(item.bte[i]) / 1000, 3) + ' nats';
        if (hooks) { sp.addEventListener('mouseenter', function () { hooks.enter(item, i); }); sp.addEventListener('mouseleave', function () { hooks.leave(); }); }
      });
      return body;
    }
    var LEVEL_COL = ['--lv-1', '--lv-2', '--lv-3', '--lv-4', '--lv-5'];   /* one warm ramp for the five levels; blue is kept for likelihood */

    /* ================= Setting 1 · difficulty ================= */
    var popState = { zoom: 'mid' };
    function renderDiffPop() {
      var host = sec('set-diff-pop'); if (!host) return;
      var M = SET.difficulty.levelMean, N = SET.difficulty.levelN;
      var group = U.makeGroup();
      var x0 = popState.zoom === 'mid' ? 12 : 8, x1 = popState.zoom === 'mid' ? 19 : 23;
      var lo = Infinity, hi = -Infinity;
      [1, 2, 3, 4, 5].forEach(function (l) { for (var k = x0; k <= x1; k++) { lo = Math.min(lo, M[l][k]); hi = Math.max(hi, M[l][k]); } });
      var pad = (hi - lo) * 0.08;
      var series = [1, 2, 3, 4, 5].map(function (l) { var name = 'level ' + l + ' · ' + N[l] + ' solutions'; return { name: name, color: cssVar(LEVEL_COL[l - 1]), width: l === 1 || l === 5 ? 2.6 : 1.5, markers: true, hidden: !!group.hidden[name], points: M[l].map(function (y, i) { return { x: i, y: y }; }).filter(function (p) { return p.x >= x0 && p.x <= x1; }) }; });
      function draw() {
        series.forEach(function (s) { s.hidden = !!group.hidden[s.name]; });
        U.lineChart(host, { group: group, height: 300, table: true, title: popState.zoom === 'mid' ? 'Mean depth profile per difficulty level, the middle window 12–19' : 'Mean depth profile per difficulty level, transitions 8–23', subtitle: (popState.zoom === 'mid' ? '' : 'shaded: 12–19 · ') + '500 MATH-500 solutions', margin: { r: 14 },
          x: { domain: [x0, x1], ticks: popState.zoom === 'mid' ? [12, 13, 14, 15, 16, 17, 18, 19] : [8, 10, 12, 14, 16, 18, 20, 22], label: 'layer transition ℓ → ℓ+1' }, y: { domain: [lo - pad, hi + pad], label: 'mean BTE (nats)' }, bands: [{ x0: 12, x1: 19 }], series: series,
          tooltip: { title: function (x) { return 'layer ' + x + ' → ' + (x + 1); }, format: function (v) { return fmt(v, 4); } } });
      }
      group.renders.push(draw); draw();
      var lg = sec('set-diff-pop-legend');
      U.legend(lg, series.map(function (s) { return { name: s.name, color: s.color }; }), group);
      if (lg && lg.parentNode) {
        var old = lg.parentNode.querySelector('.seg'); if (old) old.parentNode.removeChild(old);
        var sg = seg(lg.parentNode, [['mid', 'middle window 12–19'], ['wide', 'transitions 8–23']], popState.zoom, function (v) { popState.zoom = v; renderDiffPop(); });
        lg.parentNode.insertBefore(sg, lg);
      }
      var mids = sec('set-diff-mids');
      if (mids) {
        clear(mids);
        [1, 2, 3, 4, 5].forEach(function (l) { var t = html('span', 'mid-chip', mids); var sw = html('span', 'sw', t); sw.style.background = cssVar(LEVEL_COL[l - 1]); t.appendChild(document.createTextNode('level ' + l + ' ')); html('b', null, t, fmt(midOf(M[l]), 3)); });
      }
    }
    var pairState = { idx: 0, zoom: 'mid' };
    (function () { var q = /[?&]pair=(\d+)/.exec(location.search); if (q) pairState.idx = +q[1]; })();
    function renderPair() {
      var host = sec('set-diff-pair'); if (!host) return;
      clear(host);
      var PD = window.BTE_PAIRS, M = SET.difficulty.levelMean;
      var list = PD ? PD.pairs : [{ kind: 'covered', subject: 'Algebra', easy: SET.difficulty.pairs.covered.easy, hard: SET.difficulty.pairs.covered.hard, aboveMid: 7, above32: 30 }];
      if (pairState.idx >= list.length) pairState.idx = 0;
      var P = list[pairState.idx], easy = P.easy, hard = P.hard;
      var head = html('div', 'xp-head', host);
      /* the pairs as a selector table: one row per pair, the selected row highlighted */
      var trow = html('div', 'tb-row tb-table', head);
      var tw = html('div', 'sel-wrap', trow), tbl = html('table', 'sel-table', tw), thead = html('tr', null, html('thead', null, tbl));
      [['pair'], ['level-1 solution'], ['level-5 solution'], ['middle-window BTE', 'mean over layers 12–19, level 1 → level 5']].forEach(function (h, i) { var th = html('th', i >= 3 ? 'num' : null, thead, h[0]); if (h[1]) th.title = h[1]; });
      var tbody = html('tbody', null, tbl);
      list.forEach(function (q, k) {
        var r = html('tr', 'sel-row' + (k === pairState.idx ? ' on' : ''), tbody); r.setAttribute('role', 'radio'); r.setAttribute('aria-checked', k === pairState.idx ? 'true' : 'false'); r.tabIndex = 0;
        var c0 = html('td', 'sel-name', r); var dot = html('span', 'sel-dot', c0); c0.appendChild(document.createTextNode(q.subject)); if (q.kind === 'covered') html('span', 'sel-tag', c0, 'strongest');
        html('td', null, r, q.easy.uid.replace('test/', '').replace('.json', '') + ' · ' + q.easy.T + ' tok');
        html('td', null, r, q.hard.uid.replace('test/', '').replace('.json', '') + ' · ' + q.hard.T + ' tok');
        var c3 = html('td', 'num', r); c3.appendChild(document.createTextNode(fmt(q.easy.mid, 3) + ' → ' + fmt(q.hard.mid, 3) + ' ')); html('span', 'sel-delta', c3, signed(100 * (q.hard.mid / q.easy.mid - 1), 0) + '%');
        if (PD) r.title = q.kind === 'covered' ? 'the pair with the most transitions covered among the ' + PD.eligible.n + ' length-matched pairs' : 'median-gap pair among the ' + PD.eligibleBySubject[q.subject].coveredMid + ' length-matched ' + q.subject + ' pairs where the harder solution is above at all eight middle transitions';
        var pick = function () { pairState.idx = k; renderPair(); };
        r.addEventListener('click', pick); r.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
      });
      var right = tbRow(head, 'Chart');
      seg(right, [['mid', 'middle window 12–19'], ['wide', 'transitions 8–23']], pairState.zoom, function (v) { pairState.zoom = v; renderPair(); });
      var vals = [];
      [easy, hard].forEach(function (it) { it.bte.forEach(function (row) { vals.push(winMean(row, 'mid') / 1000); }); });
      vals.sort(function (a, b) { return a - b; });
      var lo = vals[Math.floor(vals.length * 0.05)], hi = vals[Math.floor(vals.length * 0.9)];
      colorbar(html('div', 'shade-key', host), lo, hi, 'each token\'s middle-window BTE');
      var grid = html('div', 'pair-grid', host);
      var chartHost = null, hoverTok = null;
      var hooks = { enter: function (item, i) { hoverTok = { item: item, i: i }; drawChart(); }, leave: function () { hoverTok = null; drawChart(); } };
      [['easy', easy, '--lv-1'], ['hard', hard, '--lv-5']].forEach(function (p) {
        var it = p[1];
        var card = html('div', 'pair-card', grid); card.style.setProperty('--card-accent', cssVar(p[2]));
        var h = html('div', 'lab-resp-head', card); var sw = html('span', 'sw', h); sw.style.background = cssVar(p[2]);
        html('span', 'name', h, 'Level ' + it.level + ' · ' + it.subject);
        var stats = html('span', 'stats', h); var k1 = html('span', null, stats); k1.appendChild(document.createTextNode('mid BTE ')); html('b', null, k1, fmt(it.mid, 3)); var k2 = html('span', null, stats); k2.appendChild(document.createTextNode(it.T + ' tokens'));
        var pr = html('div', 'pair-problem', card); html('span', 'pair-lab', pr, 'Problem'); html('span', 'txt tex', pr, it.problem);
        html('span', 'pair-lab', card, 'Reference solution, shaded by its middle-window BTE per token');
        tokenText(card, it, 'mid', lo, hi, hooks);
      });
      chartHost = html('div', 'chart', host);
      function drawChart() {
        var x0 = pairState.zoom === 'mid' ? 12 : 8, x1 = pairState.zoom === 'mid' ? 19 : 23;
        function cut(arr, scale) { return arr.map(function (y, i) { return { x: i, y: y / (scale || 1) }; }).filter(function (p) { return p.x >= x0 && p.x <= x1; }); }
        var series = [
          { name: 'level 1 mean', color: cssVar('--lv-1'), width: 1.3, dash: true, points: cut(M[1]) },
          { name: 'level 5 mean', color: cssVar('--lv-5'), width: 1.3, dash: true, points: cut(M[5]) },
          { name: 'the level-' + easy.level + ' solution', color: cssVar('--lv-1'), width: 3, halo: 12, r: 5, markers: true, points: cut(easy.profile) },
          { name: 'the level-' + hard.level + ' solution', color: cssVar('--lv-5'), width: 3, halo: 12, r: 5, markers: true, points: cut(hard.profile) }
        ];
        if (hoverTok) series.push({ name: 'token “' + tokLabel(hoverTok.item.tokens[hoverTok.i]) + '”', color: cssVar('--accent-strong'), width: 2, dash: true, points: cut(hoverTok.item.bte[hoverTok.i], 1000) });
        var lo2 = Infinity, hi2 = -Infinity;
        series.forEach(function (s) { s.points.forEach(function (p) { lo2 = Math.min(lo2, p.y); hi2 = Math.max(hi2, p.y); }); });
        var pad = (hi2 - lo2) * 0.08;
        var narrow = (chartHost.clientWidth || 800) < 560;
        U.lineChart(chartHost, { height: 300, table: false, title: narrow ? 'The two solutions against the level means' : 'Depth profiles of the two solutions against the level means, ' + (pairState.zoom === 'mid' ? 'middle window 12–19' : 'transitions 8–23'), subtitle: pairState.zoom === 'mid' ? '' : 'shaded: 12–19', margin: { r: 14 },
          x: { domain: [x0, x1], ticks: pairState.zoom === 'mid' ? [12, 13, 14, 15, 16, 17, 18, 19] : [8, 10, 12, 14, 16, 18, 20, 22], label: 'layer transition ℓ → ℓ+1' }, y: { domain: [Math.max(0, lo2 - pad), hi2 + pad], label: 'BTE (nats)' }, bands: [{ x0: 12, x1: 19 }], series: series,
          tooltip: { title: function (x) { return 'layer ' + x + ' → ' + (x + 1); }, format: function (v) { return fmt(v, 3); } } });
      }
      drawChart();
      if (window.BTE_MATH) window.BTE_MATH(host);
    }

    /* ================= Setting 2 · reviews: likelihood vs BTE per generator ================= */
    function renderDetectionDumbbell() {
      var host = sec('set-dumb'); if (!host) return;
      var rows = D.detection.rows;
      function find(name, group) { for (var i = 0; i < rows.length; i++) if (rows[i].name === name && rows[i].group === group) return rows[i]; return null; }
      var ll = find('Log-likelihood (Llama-3.1-8B)', 'baseline'), bte = find('Llama-3.1-8B · full', 'C');
      U.dumbbell(host, { title: 'Macro-AUROC per generator · 11,200 review pairs · Llama-3.1-8B scorer', aria: 'AUROC per generator for likelihood and BTE', domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1], ref: 0.5, refLabel: 'chance',
        aLabel: 'mean log-likelihood', bLabel: 'BTE profile', aColor: cssVar('--ramp-4'), bColor: cssVar('--accent'),
        rows: D.detection.generators.map(function (g, i) { return { label: g, a: ll.values[i], b: bte.values[i] }; }), xLabel: 'AUROC, LLM-written reviews as the positive class' });
      U.legend(sec('set-dumb-legend'), [{ name: 'mean log-likelihood of the review (final layer)', color: cssVar('--ramp-4') }, { name: 'logistic regression on the 32-D BTE profile', color: cssVar('--accent') }], U.makeGroup());
    }

    /* ================= Setting 3 · attribution map ================= */
    var SRC = [
      { key: 'human', name: 'Human', fam: 'human', color: '--ink' },
      { key: 'gpt-4o', name: 'GPT-4o', fam: 'openai', color: '#7fd3ad' },
      { key: 'gpt-5.5', name: 'GPT-5.5', fam: 'openai', color: '#1baf7a' },
      { key: 'gpt-5.6-sol', name: 'GPT-5.6', fam: 'openai', color: '#0a6e4a' },
      { key: 'gemini-1.5-pro-002', name: 'Gemini 1.5 Pro', fam: 'gemini', color: '#86b6ef' },
      { key: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', fam: 'gemini', color: '#1c5cab' },
      { key: 'claude-sonnet-3.5v2', name: 'Claude 3.5 Sonnet', fam: 'claude', color: '#f0a07e' },
      { key: 'claude-opus-5', name: 'Claude Opus 5', fam: 'claude', color: '#b8552f' }
    ];
    function srcColor(s) { return s.color.charAt(0) === '-' ? cssVar(s.color) : s.color; }
    function logoInto(parent, fam, x, y, size, color) {
      var L = SET.logos[fam]; if (!L) return;
      var g = svg('g', { transform: 'translate(' + (x - size / 2) + ',' + (y - size / 2) + ') scale(' + (size / 24) + ')' }, parent);
      g.style.color = color; g.innerHTML = L.inner;
      return g;
    }
    var attrState = { scorer: 'llama', feat: '352D', hidden: {} };
    function renderAttr() {
      var host = sec('set-attr'); if (!host) return;
      clear(host);
      var head = html('div', 'xp-head', host);
      var left = tbRow(head, 'Scorer');
      seg(left, [['llama', 'Llama-3.1-8B-Instruct'], ['qwen', 'Qwen-3.5-9B']], attrState.scorer, function (v) { attrState.scorer = v; renderAttr(); });
      var nw = (host.clientWidth || 800) < 560;
      var frow = tbRow(head, 'Features');
      seg(frow, nw ? [['32D', '32-D'], ['160D', '160-D'], ['288D', '288-D'], ['352D', '352-D']] : [['32D', '32-D profile'], ['160D', '+ token distribution (160-D)'], ['288D', '+ position bins (288-D)'], ['352D', '+ dynamics (352-D)']], attrState.feat, function (v) { attrState.feat = v; renderAttr(); });
      var legend = html('div', 'attr-legend', tbRow(head, 'Sources'));
      var X = SET.attribution.data[attrState.scorer][attrState.feat];
      var vis = SRC.filter(function (s) { return !attrState.hidden[s.key]; });
      SRC.forEach(function (s) {
        var b = html('button', 'attr-key' + (attrState.hidden[s.key] ? ' off' : ''), legend); b.type = 'button';
        var ic = svg('svg', { viewBox: '0 0 24 24', width: 16, height: 16 }, b); ic.style.color = srcColor(s); ic.innerHTML = SET.logos[s.fam].inner;
        var sw = html('span', 'sw', b); sw.style.background = srcColor(s);
        html('span', null, b, s.name);
        b.addEventListener('click', function () { attrState.hidden[s.key] = !attrState.hidden[s.key]; renderAttr(); });
      });
      var W = Math.max(320, Math.floor(host.clientWidth || 900)), H = Math.round(Math.min(620, Math.max(380, W * 0.62)));
      var m = { t: 30, r: 16, b: 16, l: 16 };
      var xs0 = Infinity, xs1 = -Infinity, ys0 = Infinity, ys1 = -Infinity;
      vis.forEach(function (s) { X.points[s.key].forEach(function (p) { if (p[0] < xs0) xs0 = p[0]; if (p[0] > xs1) xs1 = p[0]; if (p[1] < ys0) ys0 = p[1]; if (p[1] > ys1) ys1 = p[1]; }); });
      if (!isFinite(xs0)) { xs0 = -1; xs1 = 1; ys0 = -1; ys1 = 1; }
      var padx = (xs1 - xs0) * 0.06, pady = (ys1 - ys0) * 0.06;
      var xs = lin(xs0 - padx, xs1 + padx, m.l, W - m.r), ys = lin(ys0 - pady, ys1 + pady, H - m.b, m.t);
      var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'attr-map', role: 'img', 'aria-label': 'Held-out reviews of eight sources in the classifier discriminant space, t-SNE map' }, html('div', 'attr-wrap', host));
      svg('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, class: 'frame' }, el);
      svg('text', { x: m.l, y: 18, class: 'title' }, el).textContent = W < 700 ? 't-SNE of ' + X.n * 8 + ' held-out reviews · ' + (attrState.scorer === 'llama' ? 'Llama' : 'Qwen') + ', ' + attrState.feat : 'LDA discriminant axes fitted on calibration papers, t-SNE of ' + X.n * 8 + ' held-out reviews · ' + (attrState.scorer === 'llama' ? 'Llama-3.1-8B-Instruct' : 'Qwen-3.5-9B') + ' scorer, ' + attrState.feat + ' features';
      if (W >= 700) svg('text', { x: W - m.r, y: 18, 'text-anchor': 'end', class: 'subtitle' }, el).textContent = 'nearest centroid in this plane ' + fmt(100 * X.acc2d, 1) + '% · full classifier ' + fmt(100 * X.accFull, 1) + '%';
      var gEll = svg('g', { class: 'ellipses' }, el), gPts = svg('g', { class: 'points' }, el), gCent = svg('g', { class: 'centroids' }, el);
      var allPts = [];
      vis.forEach(function (s) {
        var P = X.points[s.key], col = srcColor(s), n = P.length;
        var mx = 0, my = 0; P.forEach(function (p) { mx += p[0]; my += p[1]; }); mx /= n; my /= n;
        var sxx = 0, syy = 0, sxy = 0; P.forEach(function (p) { sxx += (p[0] - mx) * (p[0] - mx); syy += (p[1] - my) * (p[1] - my); sxy += (p[0] - mx) * (p[1] - my); }); sxx /= n; syy /= n; sxy /= n;
        var tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
        var l1 = tr / 2 + disc, l2 = Math.max(1e-9, tr / 2 - disc), ang = Math.atan2(l1 - sxx, sxy) * 180 / Math.PI;
        var k = 1.177;   /* sqrt of the chi-square quantile enclosing 50% of a 2-D Gaussian */
        var rx = Math.sqrt(l1) * k * (xs(1) - xs(0)), ry = Math.sqrt(l2) * k * (ys(0) - ys(1));
        svg('ellipse', { cx: xs(mx), cy: ys(my), rx: rx, ry: ry, transform: 'rotate(' + (-ang) + ' ' + xs(mx) + ' ' + ys(my) + ')', stroke: col, class: 'ell' }, gEll);
        P.forEach(function (p) { var c = svg('circle', { cx: fmt(xs(p[0]), 1), cy: fmt(ys(p[1]), 1), r: 2.6, fill: col, class: 'pt' }, gPts); allPts.push({ x: xs(p[0]), y: ys(p[1]), s: s, el: c }); });
        var cx = xs(mx), cy = ys(my);
        svg('circle', { cx: cx, cy: cy, r: 17, class: 'cring', stroke: col }, gCent);
        logoInto(gCent, s.fam, cx, cy, 22, s.fam === 'human' ? cssVar('--ink') : (s.fam === 'openai' ? cssVar('--ink') : col));
        var lab = svg('text', { x: cx, y: cy + 30, 'text-anchor': 'middle', class: 'clab' }, gCent); lab.textContent = s.name;
      });
      var tip = html('div', 'tip', host); tip.hidden = true; host.style.position = 'relative';
      var hiRing = svg('circle', { r: 6, class: 'hi', visibility: 'hidden' }, el);
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(); var x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
        var best = null, bd = 144;
        for (var i = 0; i < allPts.length; i++) { var dx = allPts[i].x - x, dy = allPts[i].y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = allPts[i]; } }
        if (!best) { tip.hidden = true; hiRing.setAttribute('visibility', 'hidden'); return; }
        hiRing.setAttribute('cx', best.x); hiRing.setAttribute('cy', best.y); hiRing.setAttribute('stroke', srcColor(best.s)); hiRing.setAttribute('visibility', 'visible');
        clear(tip); html('div', 't', tip, 'a review written by ' + best.s.name); var row = html('div', 'row', tip); html('span', 'n', row, 'held-out paper, ' + (attrState.scorer === 'llama' ? 'Llama' : 'Qwen') + ' scorer');
        tip.hidden = false;
        var hb = host.getBoundingClientRect(); var px = e.clientX - hb.left, py = e.clientY - hb.top;
        var left2 = px + 14; if (left2 + tip.offsetWidth > hb.width) left2 = px - tip.offsetWidth - 14; tip.style.left = left2 + 'px'; tip.style.top = (py - tip.offsetHeight - 8) + 'px';
      });
      el.addEventListener('pointerleave', function () { tip.hidden = true; hiRing.setAttribute('visibility', 'hidden'); });
      var note = html('p', 'note tight', host);
      note.textContent = 'Each dot is one held-out review (240 per source shown of ' + X.n + '); ellipses enclose 50% of each source under a Gaussian fit; the logo marks the centroid. Map distances are not calibrated, only overlap is meaningful. Click a source in the legend to hide it.';
    }

    /* ================= Setting 4 · familiarity: the same two solutions across training ================= */
    var famState = { item: 'hard' };
    function renderFam() {
      var host = sec('set-fam'); if (!host) return;
      clear(host);
      var F = SET.familiarity, P = SET.difficulty.pairs.typical, it = P[famState.item];
      var head = html('div', 'xp-head', host);
      var chips = html('div', 'chips', tbRow(head, 'Solution'));
      [['easy', 'The level-1 solution'], ['hard', 'The level-5 solution']].forEach(function (p) {
        var b = html('button', 'chip' + (famState.item === p[0] ? ' on' : ''), chips); b.type = 'button'; html('span', 'cl', b, p[1] + ' · ' + P[p[0]].subject);
        b.addEventListener('click', function () { famState.item = p[0]; renderFam(); });
      });
      var grid = html('div', 'two-col', host);
      var c1 = html('figure', 'fig', grid), c2 = html('figure', 'fig', grid);
      var lg1 = html('div', 'legend', html('div', 'fig-head', c1)); var h1 = html('div', 'chart', c1);
      var lg2 = html('div', 'legend', html('div', 'fig-head', c2)); var h2 = html('div', 'chart', c2);
      var pick = ['1B', '21B', '101B', '0.5T', '4T', 'final'];
      var g1 = U.makeGroup();
      var series1 = F.olmo.filter(function (o) { return pick.indexOf(o.label) >= 0; }).map(function (o, i) {
        return { name: 'OLMo-2 ' + (o.label === 'final' ? 'final (4T, annealed)' : o.label + ' tokens'), color: cssVar(['--ramp-1', '--ramp-3', '--ramp-5', '--ramp-7', '--ramp-9', '--ramp-10'][i]), width: o.label === 'final' ? 2.2 : 1.4, points: o[famState.item].map(function (y, l) { return { x: l, y: y }; }) };
      });
      series1.push({ name: 'Llama-3.1-8B-Instruct (~15T)', color: cssVar('--s2'), width: 2.2, dash: true, points: it.profile.map(function (y, l) { return { x: l, y: y }; }) });
      function draw1() {
        series1.forEach(function (s) { s.hidden = !!g1.hidden[s.name]; });
        U.lineChart(h1, { group: g1, height: 260, table: false, title: 'This solution read by OLMo-2-7B at six pretraining checkpoints', subtitle: 'shaded: 12–19', margin: { r: 14 },
          x: { domain: [0, 31], ticks: [0, 5, 10, 15, 20, 25, 30], label: 'layer transition ℓ → ℓ+1' }, y: { domain: [0, 0.36], label: 'BTE (nats)' }, bands: [{ x0: 12, x1: 19 }], series: series1,
          tooltip: { title: function (x) { return 'layer ' + x + ' → ' + (x + 1); }, format: function (v) { return fmt(v, 3); } } });
      }
      g1.renders.push(draw1); draw1();
      U.legend(lg1, series1.map(function (s) { return { name: s.name, color: s.color, dash: s.dash }; }), g1);
      html('figcaption', null, c1, 'The profile is nearly flat at 1B tokens and grows through pretraining; the Llama reading of the same solution is the dashed line.');
      var g2 = U.makeGroup();
      var series2 = [
        { name: 'this solution', color: cssVar(famState.item === 'hard' ? '--lv-5' : '--lv-1'), width: 2.4, markers: true, points: F.olmo.map(function (o) { return { x: o.tokens, y: midOf(o[famState.item]), label: 'OLMo-2 ' + o.label }; }) },
        { name: 'all 500 solutions, mean', color: cssVar('--ink'), width: 1.4, dash: true, points: F.olmo.map(function (o) { return { x: o.tokens, y: midOf(o.mean), label: 'OLMo-2 ' + o.label }; }) },
        { name: 'level-1 mean', color: cssVar('--lv-1'), width: 1.2, dash: true, points: F.olmo.map(function (o) { return { x: o.tokens, y: midOf(o.l1), label: 'OLMo-2 ' + o.label }; }) },
        { name: 'level-5 mean', color: cssVar('--lv-5'), width: 1.2, dash: true, points: F.olmo.map(function (o) { return { x: o.tokens, y: midOf(o.l5), label: 'OLMo-2 ' + o.label }; }) }
      ];
      function tokFmt(v) { return v >= 1e12 ? fmt(v / 1e12, v / 1e12 >= 10 ? 0 : 1) + 'T' : fmt(v / 1e9, 0) + 'B'; }
      function draw2() {
        series2.forEach(function (s) { s.hidden = !!g2.hidden[s.name]; });
        U.lineChart(h2, { group: g2, height: 260, table: false, title: 'Middle-window BTE across pretraining', margin: { r: 14 },
          x: { type: 'log', domain: [7e8, 6e12], ticks: [1e9, 1e10, 1e11, 1e12], format: tokFmt, label: 'pretraining tokens (log scale)' }, y: { domain: [0, 0.11], label: 'mean BTE over layers 12–19 (nats)' }, series: series2,
          tooltip: { title: function (x) { return tokFmt(x) + ' tokens'; }, format: function (v, p) { return fmt(v, 3) + (p.label ? ' · ' + p.label : ''); } } });
      }
      g2.renders.push(draw2); draw2();
      U.legend(lg2, series2.map(function (s) { return { name: s.name, color: s.color, dash: s.dash }; }), g2);
      html('figcaption', null, c2, 'Middle-window energy rises fifteen-fold over pretraining. The level-1 and level-5 means stay on top of each other in OLMo-2: no difficulty gradient yet, where Llama-3.1 reads the same two levels at ' + fmt(midOf(SET.difficulty.levelMean[1]), 3) + ' and ' + fmt(midOf(SET.difficulty.levelMean[5]), 3) + ', a gap that OLMo-2 never opens in pretraining.');
      html('p', 'note tight', host, 'A level-1 and a level-5 algebra solution (MATH-500 items 2199 and 1837), read by the released OLMo-2-7B checkpoints with the problem in the context. The dashed level means show that OLMo-2 never separates level 1 from level 5 during pretraining; the fine-tuning case above shows what training on the target domain does to the same measurement, with Llama-3.1-8B-Instruct as the scorer.');
    }

    function renderAll() { [renderDiffPop, renderPair, renderDetectionDumbbell, renderAttr, renderFam].forEach(function (f) { try { f(); } catch (err) { if (window.console) console.error(err); } }); }
    window.BTE_SET_RENDER = renderAll;
    renderAll();
  }
  if (window.BTE_UI) start(); else { var prev = window.BTE_CONTRAST_READY; window.BTE_CONTRAST_READY = function () { if (prev) prev(); start(); }; }
})();
