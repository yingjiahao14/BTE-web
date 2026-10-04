/* The paper's overview figure rebuilt as page elements, driven by real Llama-3.1-8B-Instruct readouts (cases.js → readout). */
(function () {
  'use strict';
  function start() {
    var U = window.BTE_UI, CS = window.BTE_CASES, SET = window.BTE_SET;
    if (!U || !CS || !CS.readout) return;
    var html = U.html, svg = U.svg, clear = U.clear, fmt = U.fmt, cssVar = U.cssVar;
    var L = 32;
    var ITEMS = CS.readout.concat(window.BTE_METHOD_EXTRA || []);
    var state = { item: 0, tok: null, layer: 15, playing: null };
    function sec(id) { return document.getElementById(id); }
    function tokLabel(t) { return t.replace(/\n/g, '⏎').replace(/^ $/, '␣').replace(/^ /, '␣'); }
    function item() { return ITEMS[state.item]; }
    function profile(it) { var e = []; for (var l = 0; l < L; l++) { var s = 0; it.bte.forEach(function (row) { s += row[l]; }); e.push(s / it.bte.length / 1000); } return e; }
    function midMean(e) { var s = 0; for (var l = 12; l < 20; l++) s += e[l]; return s / 8; }
    function topk(it, i, l) { return it.topk[i][l].map(function (p) { return { tok: it.vocab[p[0]], p: p[1] / 1000 }; }); }
    function text(parent, x, y, str, cls, anchor) { var t = svg('text', { x: x, y: y, class: cls || 'mf-lab', 'text-anchor': anchor || 'start' }, parent); t.textContent = str; return t; }
    function sup(parent, x, y, base, sup_, sub_, cls, anchor) {
      /* p^{ℓ}_{i} style labels */
      var t = svg('text', { x: x, y: y, class: cls || 'mf-math', 'text-anchor': anchor || 'start' }, parent);
      var b = svg('tspan', {}, t); b.textContent = base;
      if (sup_ != null) { var s = svg('tspan', { dy: -6, class: 'mf-sup' }, t); s.textContent = sup_; }
      if (sub_ != null) { var u = svg('tspan', { dy: sup_ != null ? 10 : 5, class: 'mf-sup' }, t); u.textContent = sub_; }
      return t;
    }
    function box(parent, x, y, w, h, cls, r) { return svg('rect', { x: x, y: y, width: w, height: h, rx: r == null ? 8 : r, class: cls }, parent); }
    function dashed(parent, x1, y1, x2, y2, cls) { return svg('path', { d: 'M' + x1 + ',' + y1 + ' C' + (x1 + (x2 - x1) * 0.5) + ',' + y1 + ' ' + (x1 + (x2 - x1) * 0.5) + ',' + y2 + ' ' + x2 + ',' + y2, class: cls || 'mf-dash' }, parent); }
    function readoutCard(parent, x, y, w, h, label, sup_, dist, current) {
      var g = svg('g', { class: 'mf-card' + (current ? ' cur' : '') }, parent);
      box(g, x, y, w, h, 'mf-cardbg', 8);
      sup(g, x + 10, y + 18, 'p', sup_, 'i', 'mf-math');
      var top = dist[0];
      var t = text(g, x + w - 8, y + 17, '“' + tokLabel(top.tok) + '” ' + (top.p >= 0.995 ? '100' : fmt(100 * top.p, top.p < 0.1 ? 1 : 0)) + '%', 'mf-small', 'end');
      var bw = 12, gap = 5, bx = x + 10, base = y + h - 8, maxH = h - 32;
      dist.forEach(function (d, k) {
        var bh = Math.max(1.5, d.p * maxH);
        var r = svg('rect', { x: bx + k * (bw + gap), y: base - bh, width: bw, height: bh, class: 'mf-bar' + (k === 0 ? ' top' : '') }, g);
        svg('title', {}, r).textContent = '“' + tokLabel(d.tok) + '” ' + fmt(100 * d.p, 1) + '%';
      });
      text(g, x + w - 8, y + h - 8, label, 'mf-tiny', 'end');
      return g;
    }
    function bteBox(parent, x, y, w, h, sup_, value, current) {
      var g = svg('g', { class: 'mf-bte' + (current ? ' cur' : '') }, parent);
      box(g, x, y, w, h, 'mf-btebg', 8);
      sup(g, x + 10, y + h / 2 + 5, 'BTE', sup_, 'i', 'mf-math');
      text(g, x + w - 8, y + h / 2 + 4, value == null ? '' : fmt(value, 3), 'mf-val', 'end');
      return g;
    }
    function layerBox(parent, x, y, w, h, label, cls) { var g = svg('g', {}, parent); box(g, x, y, w, h, 'mf-layer' + (cls ? ' ' + cls : ''), 7); text(g, x + w / 2, y + h / 2 + 4.5, label, 'mf-layerlab', 'middle'); return g; }
    function dot(parent, x, y) { return svg('circle', { cx: x, cy: y, r: 6, class: 'mf-dot' }, parent); }
    function plus(parent, x, y) { var g = svg('g', {}, parent); svg('circle', { cx: x, cy: y, r: 7, class: 'mf-plus' }, g); text(g, x, y + 3.5, '+', 'mf-plustxt', 'middle'); return g; }

    function draw() {
      var host = sec('method-fig'); if (!host) return;
      var it = item(); if (state.tok == null || state.tok >= it.positions.length) state.tok = Math.min(it.positions.length - 1, 5);
      var i = state.tok, l = state.layer, e = profile(it), row = it.bte[i].map(function (v) { return v / 1000; }), em = midMean(e);
      clear(host);
      /* ---------- controls ---------- */
      var head = html('div', 'xp-head', host);
      var row1 = html('div', 'tb-row', head); html('span', 'tb-lab', row1, 'Answer');
      var chips = html('div', 'chips', row1);
      ITEMS.forEach(function (r, k) {
        var b = html('button', 'chip' + (k === state.item ? ' on' : ''), chips); b.type = 'button'; html('span', 'cl', b, r.chip || r.question);
        b.addEventListener('click', function () { state.item = k; state.tok = null; stopPlay(); draw(); });
      });
      var ctl = html('div', 'tb-row mf-ctl', head); html('span', 'tb-lab', ctl, 'Layer ℓ');
      var bPrev = html('button', 'btn', ctl, '◀'); bPrev.type = 'button'; bPrev.title = 'previous layer';
      var range = html('input', null, ctl); range.type = 'range'; range.min = 1; range.max = L - 2; range.step = 1; range.value = l; range.setAttribute('aria-label', 'layer ℓ');
      var bNext = html('button', 'btn', ctl, '▶'); bNext.type = 'button'; bNext.title = 'next layer';
      var lab = html('span', 'mf-ctllab', ctl); lab.innerHTML = 'ℓ = <b>' + l + '</b> · readouts ' + l + ' → ' + (l + 1);
      var bPlay = html('button', 'btn' + (state.playing ? ' on' : ''), ctl, state.playing ? 'Pause' : 'Play through the layers'); bPlay.type = 'button';
      bPrev.addEventListener('click', function () { stopPlay(); state.layer = Math.max(1, state.layer - 1); draw(); });
      bNext.addEventListener('click', function () { stopPlay(); state.layer = Math.min(L - 2, state.layer + 1); draw(); });
      range.addEventListener('input', function () { stopPlay(); state.layer = +range.value; draw(); });
      var tokMid = it.bte.map(function (r) { var s = 0; for (var q = 12; q < 20; q++) s += r[q]; return s / 8000; });
      var sorted = tokMid.slice().sort(function (a, b) { return a - b; }), lo = sorted[Math.floor(sorted.length * 0.05)], hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]; if (hi - lo < 1e-6) hi = lo + 1e-3;
      var cb = html('div', 'scale lab-scale', html('div', 'shade-key', host)); html('span', null, cb, 'less'); var rp = html('span', 'ramp', cb); rp.style.background = U.heatGradient(); html('span', null, cb, 'more revision · each response token\'s middle-window BTE, ' + fmt(lo, 2) + ' → ' + fmt(hi, 2) + ' nats');
      bPlay.addEventListener('click', function () { if (state.playing) { stopPlay(); draw(); return; } state.layer = state.layer >= L - 2 ? 1 : state.layer; state.playing = setInterval(function () { if (state.layer >= L - 2) { stopPlay(); draw(); return; } state.layer++; draw(); }, 650); draw(); });

      /* ---------- the figure ---------- */
      var W = 1180, H = 660;
      var wrap = html('div', 'mf-scroll', host);
      var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'method-fig', role: 'img', 'aria-label': 'How BTE is computed: every layer state is read out as a next-token distribution, consecutive readouts are compared, and the values are stacked into a depth profile' }, wrap);
      var defs = svg('defs', {}, el);
      var mk = svg('marker', { id: 'mf-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'mf-arrowhead' }, mk);
      /* transformer */
      text(el, 24, 32, 'Belief-Trajectory Energy', 'mf-title');
      text(el, 24, 50, 'one forward pass of the scorer over token i', 'mf-sub');
      var tf = svg('g', {}, el);
      box(tf, 24, 62, 302, 470, 'mf-tf', 18);
      var sx = 175;
      svg('line', { x1: sx, y1: 500, x2: sx, y2: 74, class: 'mf-stream', 'marker-end': 'url(#mf-arrow)' }, tf);
      layerBox(tf, 64, 448, 222, 32, 'Embedding', 'emb');
      layerBox(tf, 64, 392, 222, 32, 'Layer 1');
      text(tf, sx, 372, '⋮', 'mf-dots', 'middle');
      /* expanded layer ℓ+1 */
      var blk = svg('g', {}, tf);
      box(blk, 42, 200, 266, 146, 'mf-block', 10);
      text(blk, 60, 268, 'Layer', 'mf-blocklab'); text(blk, 60, 286, (l + 1), 'mf-blocklab');
      svg('path', { d: 'M' + sx + ',346 L' + sx + ',200', class: 'mf-stream' }, blk);
      svg('path', { d: 'M' + sx + ',334 L132,334 L132,290 L' + (sx - 8) + ',290', class: 'mf-skip', 'marker-end': 'url(#mf-arrow)' }, blk);
      svg('path', { d: 'M' + sx + ',270 L132,270 L132,220 L' + (sx - 8) + ',220', class: 'mf-skip', 'marker-end': 'url(#mf-arrow)' }, blk);
      layerBox(blk, 150, 300, 142, 28, 'Attention', 'sub');
      plus(blk, sx, 290);
      layerBox(blk, 150, 232, 142, 28, 'MLP', 'sub');
      plus(blk, sx, 220);
      text(tf, sx, 178, '⋮', 'mf-dots', 'middle');
      layerBox(tf, 64, 100, 222, 32, 'Layer ' + L);
      /* readout dots and cards */
      var cards = [
        { y: 440, l: 0, sup: '0', cy: 466 },
        { y: 384, l: 1, sup: '1', cy: 398 },
        { y: 354, l: l, sup: String(l), cy: 326, cur: true },
        { y: 192, l: l + 1, sup: String(l + 1), cy: 201, cur: true },
        { y: 92, l: L, sup: String(L), cy: 86 }
      ];
      var cardX = 372, cardW = 150, cardH = 52;
      cards.forEach(function (c) {
        dot(tf, sx, c.y);
        dashed(el, sx + 8, c.y, cardX - 4, c.cy, 'mf-dash' + (c.cur ? ' cur' : ''));
        text(el, sx + 22 + (cardX - sx - 40) / 2, Math.min(c.y, c.cy) - 6, 'W', 'mf-wu', 'middle');
        var wl = el.lastChild; var ws = svg('tspan', { dy: 3, class: 'mf-sup' }, wl); ws.textContent = 'U'; var w2 = svg('tspan', { dy: -3 }, wl); w2.textContent = ' · LN(·)';
        readoutCard(el, cardX, c.cy - cardH / 2, cardW, cardH, 'readout ' + c.l + (c.l === 0 ? ' · embedding' : c.l === L ? ' · final' : ''), c.sup, topk(it, i, c.l), c.cur);
      });
      text(el, cardX + cardW / 2, 292, '⋯', 'mf-dots', 'middle');
      text(el, cardX + cardW / 2, 150, '⋯', 'mf-dots', 'middle');
      /* BTE boxes */
      var bx = 572, bw = 126, bh = 34;
      var btes = [
        { cy: 432, sup: '0', v: row[0], from: [466, 398] },
        { cy: 386, sup: '1', v: row[1], from: [398] },
        { cy: 300, sup: String(l - 1), v: row[l - 1], from: [326] },
        { cy: 262, sup: String(l), v: row[l], from: [326, 201], cur: true },
        { cy: 130, sup: String(L - 1), v: row[L - 1], from: [86] }
      ];
      btes.forEach(function (b) {
        b.from.forEach(function (fy) { dashed(el, cardX + cardW + 4, fy, bx - 4, b.cy, 'mf-dash' + (b.cur ? ' cur' : '')); });
        bteBox(el, bx, b.cy - bh / 2, bw, bh, b.sup, b.v, b.cur);
      });
      text(el, bx + bw / 2, 352, '⋯', 'mf-dots', 'middle');
      text(el, bx + bw / 2, 205, '⋯', 'mf-dots', 'middle');
      text(el, bx + bw / 2, 470, 'JSD of consecutive readouts, nats', 'mf-tiny', 'middle');
      /* brace and stacking */
      var brX = 716;
      svg('path', { d: 'M' + brX + ',113 Q' + (brX + 10) + ',113 ' + (brX + 10) + ',123 L' + (brX + 10) + ',270 Q' + (brX + 10) + ',282 ' + (brX + 20) + ',282 Q' + (brX + 10) + ',282 ' + (brX + 10) + ',294 L' + (brX + 10) + ',439 Q' + (brX + 10) + ',449 ' + brX + ',449', class: 'mf-brace' }, el);
      text(el, brX + 30, 286, 'stack over layers ℓ', 'mf-sub');
      /* profile */
      var px = 760, py = 110, pw = 396, ph = 138;
      text(el, px, 32, 'BTE depth profile', 'mf-title');
      sup(el, px, 52, 'e(ℓ) = (1/T) Σ', null, 'i', 'mf-math'); var f = el.lastChild; var f2 = svg('tspan', { dy: -5 }, f); f2.textContent = ' BTE'; var f3 = svg('tspan', { dy: -6, class: 'mf-sup' }, f); f3.textContent = 'ℓ'; var f4 = svg('tspan', { dy: 10, class: 'mf-sup' }, f); f4.textContent = 'i'; var f5 = svg('tspan', { dy: -4 }, f); f5.textContent = ' · the mean over the ' + it.positions.length + ' response tokens';
      var emax = Math.max(Math.max.apply(null, e), Math.max.apply(null, row)) * 1.08;
      var xs = function (k) { return px + (k + 0.5) * pw / L; }, ys = function (v) { return py + ph - v / emax * ph; };
      svg('rect', { x: px + 12 * pw / L, y: py, width: 8 * pw / L, height: ph, class: 'mf-band' }, el);
      [0, 0.2, 0.4, 0.6].forEach(function (v) { if (v > emax) return; svg('line', { x1: px, x2: px + pw, y1: ys(v), y2: ys(v), class: 'mf-grid' }, el); text(el, px - 6, ys(v) + 3.5, fmt(v, 1), 'mf-tick', 'end'); });
      var bwid = pw / L * 0.7;
      e.forEach(function (v, k) {
        var r = svg('rect', { x: xs(k) - bwid / 2, y: ys(v), width: bwid, height: py + ph - ys(v), class: 'mf-pbar' + (k === l ? ' cur' : '') }, el);
        svg('title', {}, r).textContent = 'e(' + k + ') = ' + fmt(v, 3) + ' nats';
      });
      var d = row.map(function (v, k) { return (k ? 'L' : 'M') + fmt(xs(k), 1) + ',' + fmt(ys(v), 1); }).join(' ');
      svg('path', { d: d, class: 'mf-tokline' }, el);
      svg('circle', { cx: xs(l), cy: ys(row[l]), r: 4, class: 'mf-tokdot' }, el);
      [0, 8, 16, 24, 31].forEach(function (k) { text(el, xs(k), py + ph + 14, k, 'mf-tick', 'middle'); });
      text(el, px + pw / 2, py + ph + 28, 'layer transition ℓ → ℓ+1', 'mf-tiny', 'middle');
      /* legend on two lines: grey bars = the answer's mean profile, orange bar = the current transition, dashed line = the selected token */
      var lg = svg('g', { class: 'mf-legend' }, el), lx = px;
      svg('rect', { x: lx, y: py - 30, width: 10, height: 9, class: 'mf-pbar' }, lg); lx += 14;
      var t1 = text(lg, lx, py - 22, 'e(ℓ): mean over the ' + it.positions.length + ' response tokens', 'mf-small'); lx += (t1.getComputedTextLength ? t1.getComputedTextLength() : 170) + 16;
      svg('rect', { x: lx, y: py - 30, width: 10, height: 9, class: 'mf-pbar cur' }, lg); lx += 14;
      text(lg, lx, py - 22, 'current transition ℓ = ' + l, 'mf-small');
      lx = px; svg('line', { x1: lx, x2: lx + 18, y1: py - 11.5, y2: py - 11.5, class: 'mf-tokline' }, lg); svg('circle', { cx: lx + 9, cy: py - 11.5, r: 3, class: 'mf-tokdot' }, lg); lx += 22;
      text(lg, lx, py - 8, 'the selected token i = ' + i + ' “' + tokLabel(it.positions[i].tok) + '”: its own BTE at every transition', 'mf-small');
      text(el, px + 16 * pw / L, py + 12, 'M = 12–19', 'mf-tiny', 'middle');
      /* three heads */
      var hy = 300, hw = 396, hh = 72, hx = px;
      function headBox(y, title, formula, result, href, icon) {
        var a = svg('a', { href: href, class: 'mf-head' }, el);
        box(a, hx, y, hw, hh, 'mf-headbg', 10);
        text(a, hx + 14, y + 20, title, 'mf-headtitle');
        var t = text(a, hx + 14, y + 42, formula, 'mf-math');
        text(a, hx + 14, y + 61, result, 'mf-small');
        text(a, hx + hw - 12, y + 20, '↗ section', 'mf-tiny', 'end');
        if (icon) icon(a, hx + hw - 40, y + 44);
        return a;
      }
      headBox(hy, 'Data difficulty · the training-free scalar', 'ēₘ = Σₗ∈M e(ℓ) / |M|', 'middle-window mean of this answer: ' + fmt(em, 3) + ' nats', '#difficulty', function (g, x, y) {
        for (var k = 12; k < 20; k++) svg('rect', { x: x - 14 + (k - 12) * 4, y: y - 6 - e[k] / emax * 22, width: 3, height: e[k] / emax * 22, class: 'mf-pbar' }, g);
      });
      headBox(hy + hh + 14, 'Review detection · a logistic regression on e', 's = σ(w · e)   →   LLM if s > τ, else human', 'w fitted on calibration papers', '#reviews', function (g, x, y) {
        /* human or model */
        var Lh = SET && SET.logos && SET.logos.human;
        if (Lh) { var gh = svg('g', { transform: 'translate(' + (x - 36) + ',' + (y - 16) + ') scale(0.8)' }, g); gh.style.color = cssVar('--ink'); gh.innerHTML = Lh.inner; }
        text(g, x - 12, y - 1, '/', 'mf-small', 'middle');
        var gm = svg('g', { transform: 'translate(' + (x - 6) + ',' + (y - 16) + ') scale(0.8)' }, g); gm.style.color = cssVar('--accent-strong');
        gm.innerHTML = '<rect x="4" y="7" width="16" height="12" rx="3" fill="currentColor"/><line x1="12" y1="3" x2="12" y2="7" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="2.5" r="1.6" fill="currentColor"/><circle cx="9" cy="13" r="1.7" fill="#FAF9F5"/><circle cx="15" cy="13" r="1.7" fill="#FAF9F5"/><rect x="1" y="11" width="3" height="5" rx="1" fill="currentColor"/><rect x="20" y="11" width="3" height="5" rx="1" fill="currentColor"/>';
      });
      headBox(hy + 2 * (hh + 14), 'Generator attribution', 'P(g | e) = softmax(W e)', 'eight sources, one row of W each', '#attribution', function (g, x, y) {
        ['human', 'openai', 'gemini', 'claude'].forEach(function (fam, k) {
          var Lg = SET && SET.logos && SET.logos[fam]; if (!Lg) return;
          var gg = svg('g', { transform: 'translate(' + (x - 36 + k * 16) + ',' + (y - 14) + ') scale(0.55)' }, g); gg.style.color = cssVar(k === 0 ? '--ink' : k === 1 ? '--s3' : k === 2 ? '--s1' : '--accent'); gg.innerHTML = Lg.inner;
        });
      });
      /* token rows: prefix context, then the response shaded by middle-window BTE; both wrap */
      var ty = 590, cx = 24, ch = 30, gap = 8, maxX = W - 24;
      text(el, 24, ty - 12, 'Prefix context · ' + (it.problem ? 'the problem statement' : 'the question'), 'mf-tiny');
      it.question.split(/\s+/).forEach(function (w) {
        var cw = Math.max(30, w.length * 6.6 + 12);
        if (cx + cw > maxX) { cx = 24; ty += ch + gap; }
        box(el, cx, ty, cw, ch, 'mf-tok ctx', 6); text(el, cx + cw / 2, ty + ch / 2 + 4, w, 'mf-toktxt ctx', 'middle'); cx += cw + 6;
      });
      ty += ch + gap + 16; cx = 24;
      text(el, 24, ty - 12, 'Response · click a token i · shade: its middle-window BTE', 'mf-tiny');
      it.positions.forEach(function (p, k) {
        var s = tokLabel(p.tok), cw = Math.max(30, s.length * 7.2 + 16);
        if (cx + cw > maxX) { cx = 24; ty += ch + gap; }
        var g = svg('g', { class: 'mf-tokg' + (k === i ? ' cur' : ''), tabindex: 0, role: 'button', 'aria-label': 'token ' + k + ' ' + s }, el);
        var col = U.heatColor((tokMid[k] - lo) / (hi - lo));
        var r = box(g, cx, ty, cw, ch, 'mf-tok shaded', 6); r.style.fill = col.bg;
        var t = text(g, cx + cw / 2, ty + ch / 2 + 4, s, 'mf-toktxt', 'middle'); t.style.fill = col.fg;
        svg('title', {}, g).textContent = 'token ' + k + ' “' + s + '” · middle-window BTE ' + fmt(tokMid[k], 3) + ' nats · the readouts then predict “' + tokLabel(p.next) + '”';
        g.addEventListener('click', function () { stopPlay(); state.tok = k; draw(); });
        g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); stopPlay(); state.tok = k; draw(); } });
        cx += cw + 6;
      });
      ty += ch + 22;
      text(el, 24, ty, 'token ' + i + ' “' + tokLabel(it.positions[i].tok) + '” has been read (middle-window BTE ' + fmt(tokMid[i], 3) + '); the readouts predict the next token, actually “' + tokLabel(it.positions[i].next) + '”', 'mf-small');
      el.setAttribute('viewBox', '0 0 ' + W + ' ' + (ty + 16));

      /* ---------- detail table for the two current readouts ---------- */
      var det = html('div', 'mf-detail', host);
      [l, l + 1].forEach(function (k) {
        var c = html('div', 'mf-dcol', det);
        var h3 = html('div', 'mf-dhead', c); h3.innerHTML = 'p<sup>(' + k + ')</sup><sub>i</sub> · the belief after readout ' + k + ', top ' + topk(it, i, k).length + ' tokens';
        topk(it, i, k).forEach(function (dd) {
          var r = html('div', 'mf-drow', c); html('span', 'mf-dtok', r, '“' + tokLabel(dd.tok) + '”'); var bar = html('span', 'mf-dbar', r); var fill = html('span', 'mf-dfill', bar); fill.style.width = (100 * dd.p) + '%'; html('span', 'mf-dp', r, fmt(100 * dd.p, dd.p < 0.1 ? 1 : 0) + '%');
        });
      });
      html('p', 'note tight mf-cap', host, 'The paper\'s overview figure, rebuilt from real readouts. Pick one of the answers scored by Llama-3.1-8B-Instruct, click a response token, and move ℓ through the layer transitions with the slider or the buttons. Each card shows the scorer\'s actual next-token belief at that readout, each BTE box the divergence between two consecutive readouts, and the profile on the right is the mean of those values over the answer\'s tokens. The response tokens are shaded by their own middle-window BTE; the two lists give the five most likely next tokens at the two readouts ℓ and ℓ+1 being compared.');
      if (window.BTE_MATH) window.BTE_MATH(host);
    }
    function stopPlay() { if (state.playing) { clearInterval(state.playing); state.playing = null; } }
    window.BTE_METHOD_RENDER = function () { try { draw(); } catch (err) { if (window.console) console.error(err); } };
    var q = /[?&]mfl=(\d+)/.exec(location.search); if (q) state.layer = Math.max(1, Math.min(L - 2, +q[1]));
    var q2 = /[?&]mft=(\d+)/.exec(location.search); if (q2) state.tok = +q2[1];
    var q3 = /[?&]mfi=(\d+)/.exec(location.search); if (q3) state.item = Math.min(ITEMS.length - 1, +q3[1]);
    window.BTE_METHOD_RENDER();
  }
  if (window.BTE_UI) start(); else { var prev = window.BTE_CONTRAST_READY; window.BTE_CONTRAST_READY = function () { if (prev) prev(); start(); }; }
})();
