/* Case studies taken from the paper's experimental settings (setting_cases_20260928), rendered from casedata.js. */
(function () {
  'use strict';
  function start() {
    var U = window.BTE_UI, C = window.BTE_SETCASES, SET = window.BTE_SET;
    if (!U || !C) return;
    var html = U.html, svg = U.svg, clear = U.clear, fmt = U.fmt, signed = U.signed, cssVar = U.cssVar, lin = U.linear;
    var LAYER_X = { domain: [0, 31], ticks: [0, 5, 10, 15, 20, 25, 30], label: 'layer transition ℓ → ℓ+1' };
    var BAND = [{ x0: 12, x1: 19 }];
    var LAYER_TIP = { title: function (x) { return 'layer ' + x + ' → ' + (x + 1); }, format: function (v) { return fmt(v, 3); } };
    var RAMP5 = ['--lv-1', '--lv-2', '--lv-3', '--lv-4', '--lv-5'];   /* warm ramp for ordered BTE series (depth, training dose); blue stays for likelihood */
    var SRC_STYLE = {
      human: ['--ink', 'human', 'Human reviewer'], human_rewrite: ['--muted', 'human', 'Human, proofread'],
      'gpt-4o': ['--lv-1', 'openai', 'GPT-4o'], 'gemini-1.5-pro-002': ['--lv-2', 'gemini', 'Gemini 1.5 Pro'], 'claude-sonnet-3.5v2': ['--lv-2', 'claude', 'Claude 3.5 Sonnet'],
      'gpt-5.5': ['--lv-4', 'openai', 'GPT-5.5'], 'gpt-5.6-sol': ['--lv-4', 'openai', 'GPT-5.6'], 'gemini-3.1-pro-preview': ['--lv-5', 'gemini', 'Gemini 3.1 Pro'], 'claude-opus-5': ['--lv-5', 'claude', 'Claude Opus 5']
    };
    /* the attribution map's palette, so the attribution case matches the map above it */
    var ATTR_COL = { human: '--ink', 'gpt-4o': '#7fd3ad', 'gpt-5.5': '#1baf7a', 'gpt-5.6-sol': '#0a6e4a', 'gemini-1.5-pro-002': '#86b6ef', 'gemini-3.1-pro-preview': '#1c5cab', 'claude-sonnet-3.5v2': '#f0a07e', 'claude-opus-5': '#b8552f' };
    function col(c) { return c.charAt(0) === '-' ? cssVar(c) : c; }
    function srcName(s) { return SRC_STYLE[s] ? SRC_STYLE[s][2] : s; }
    function sec(id) { return document.getElementById(id); }
    function narrow(host) { return (host.clientWidth || (host.parentNode && host.parentNode.clientWidth) || 800) < 560; }
    function tokLabel(t) { return t.replace(/\n/g, '⏎').replace(/^ /, '␣'); }
    function midOf(p) { var s = 0; for (var l = 12; l < 20; l++) s += p[l]; return s / 8; }
    function winMean(row, w) { var a = w === 'late' ? 24 : w === 'all' ? 0 : 12, b = w === 'late' ? 32 : w === 'all' ? 32 : 20, s = 0; for (var l = a; l < b; l++) s += row[l]; return s / (b - a); }
    function winName(w) { return w === 'mid' ? 'middle-window (12–19)' : w === 'late' ? 'late-window (24–31)' : 'all-layer'; }
    function pts(arr) { return arr.map(function (y, i) { return { x: i, y: y }; }); }
    function quantRange(vals) { var v = vals.slice().sort(function (a, b) { return a - b; }); return [v[Math.floor(v.length * 0.05)], v[Math.floor(v.length * 0.9)]]; }
    function seg(host, options, current, onChange) {
      var s = html('div', 'seg', host);
      options.forEach(function (o) {
        var b = html('button', null, s, o[1]); b.type = 'button'; b.setAttribute('aria-pressed', o[0] === current ? 'true' : 'false');
        b.addEventListener('click', function () { onChange(o[0]); });
      });
      return s;
    }
    function chips(host, options, current, onChange) {
      var cs = html('div', 'chips', host);
      options.forEach(function (o) {
        var b = html('button', 'chip' + (o[0] === current ? ' on' : ''), cs); b.type = 'button';
        if (o[3]) { var sw = html('span', 'sw', b); sw.style.background = o[3]; }
        html('span', 'cl', b, o[1]); if (o[2]) html('span', 'cv', b, o[2]);
        b.addEventListener('click', function () { onChange(o[0]); });
      });
      return cs;
    }
    function tbRow(head, label) { var r = html('div', 'tb-row', head); if (label) html('span', 'tb-lab', r, label); return r; }
    function colorbar(host, lo, hi, label) {
      var cb = html('div', 'scale lab-scale', host);
      html('span', null, cb, 'less');
      var r = html('span', 'ramp', cb); r.style.background = U.heatGradient();
      html('span', null, cb, 'more revision · ' + label + ', ' + fmt(lo, 2) + ' → ' + fmt(hi, 2) + ' nats');
    }
    /* token text shaded by a per-token value in millinats */
    function shaded(host, tokens, vals, lo, hi, opts) {
      opts = opts || {};
      var body = html('div', 'lab-text' + (opts.cls ? ' ' + opts.cls : ''), host);
      tokens.forEach(function (tk, i) {
        if (opts.marks && opts.marks[i]) { var mk = html('span', 'sp-label', body, opts.marks[i].text); mk.style.background = opts.marks[i].color; mk.style.color = hexLum(opts.marks[i].color) > 0.5 ? '#1F1E1D' : '#FAF9F5'; }
        var sp = U.tokenFill(html('span', 'tk', body), tk, opts.breaks);
        var v = vals[i] / 1000, c = U.heatColor((v - lo) / Math.max(1e-6, hi - lo));
        sp.style.background = c.bg; sp.style.color = c.fg;
        sp.title = 'token ' + i + ' “' + tokLabel(tk) + '” · ' + (opts.unit || 'middle-window BTE') + ' ' + fmt(v, 3) + ' nats';
        if (opts.hooks) { sp.addEventListener('mouseenter', function () { opts.hooks.enter(i); }); sp.addEventListener('mouseleave', function () { opts.hooks.leave(); }); }
      });
      return body;
    }
    function logoSvg(parent, fam, color) {
      var L = SET && SET.logos && SET.logos[fam]; if (!L) return null;
      var ic = svg('svg', { viewBox: L.vb || '0 0 24 24', class: 'logo', 'aria-hidden': 'true' }, parent); ic.style.color = color; ic.innerHTML = L.inner; return ic;
    }
    function respHead(card, name, color, fam, stats, tag) {
      var h = html('div', 'lab-resp-head', card);
      if (fam) logoSvg(h, fam, color); else { var sw = html('span', 'sw', h); sw.style.background = color; }
      html('span', 'name', h, name);
      if (tag) html('span', 'tag', h, tag);
      var st = html('span', 'stats', h);
      stats.forEach(function (s) { var k = html('span', null, st); k.appendChild(document.createTextNode(s[0] + ' ')); html('b', null, k, s[1]); });
      return h;
    }
    function table(host, cols, rows, opts) {
      opts = opts || {};
      var wrap = html('div', 'tbl-wrap', host), t = html('table', 'tbl dense', wrap), tr = html('tr', null, html('thead', null, t));
      cols.forEach(function (c, i) { html('th', i ? 'num' : null, tr, c); });
      var tb = html('tbody', null, t);
      rows.forEach(function (r) {
        var row = html('tr', r.cls || null, tb);
        r.cells.forEach(function (c, i) {
          var td = html('td', i ? 'num' : null, row);
          if (c && typeof c === 'object') { td.appendChild(document.createTextNode(c.text)); if (c.mark) html('span', 'mark ' + (c.bad ? 'bad' : 'ok'), td, c.mark); if (c.cls) td.classList.add(c.cls); }
          else td.textContent = c;
        });
      });
      return wrap;
    }
    /* signed vertical bars over the 32 transitions */
    function vbars(host, spec) {
      clear(host);
      var W = Math.max(240, Math.floor(host.clientWidth || (host.parentNode && host.parentNode.clientWidth) || 520)), H = spec.height || 230;
      var m = { t: spec.subtitle ? 44 : 28, r: 12, b: 40, l: 50 }, pw = W - m.l - m.r, ph = H - m.t - m.b, n = spec.values.length;
      var mx = 0; spec.values.forEach(function (v) { mx = Math.max(mx, Math.abs(v)); }); mx = mx || 1;
      var xs = lin(-0.5, n - 0.5, m.l, m.l + pw), ys = lin(-mx * 1.08, mx * 1.08, m.t + ph, m.t);
      var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': spec.title || 'bar chart' }, host);
      svg('rect', { x: xs(11.5), y: m.t, width: xs(19.5) - xs(11.5), height: ph, class: 'band' }, el);
      var ticks = U.niceTicks(-mx, mx, 5), grid = svg('g', { class: 'grid' }, el);
      var tdec = mx < 0.3 ? 2 : 1;
      ticks.forEach(function (v) { svg('line', { x1: m.l, x2: m.l + pw, y1: ys(v), y2: ys(v) }, grid); svg('text', { x: m.l - 7, y: ys(v) + 3.5, 'text-anchor': 'end', class: 'tick' }, el).textContent = signed(v, tdec); });
      svg('line', { x1: m.l, x2: m.l + pw, y1: ys(0), y2: ys(0), class: 'axis' }, el);
      [0, 5, 10, 15, 20, 25, 30].forEach(function (v) { svg('text', { x: xs(v), y: m.t + ph + 15, 'text-anchor': 'middle', class: 'tick' }, el).textContent = v; });
      svg('text', { x: m.l + pw / 2, y: H - 5, 'text-anchor': 'middle', class: 'label' }, el).textContent = LAYER_X.label;
      if (spec.title) svg('text', { x: m.l, y: 15, class: 'title' }, el).textContent = spec.title;
      if (spec.subtitle) svg('text', { x: m.l, y: 31, class: 'subtitle' }, el).textContent = spec.subtitle;
      var bw = Math.max(2, xs(1) - xs(0) - 2), bars = [];
      spec.values.forEach(function (v, i) {
        bars.push(svg('rect', { x: xs(i) - bw / 2, y: Math.min(ys(0), ys(v)), width: bw, height: Math.abs(ys(v) - ys(0)), class: 'vbar ' + (v >= 0 ? 'pos' : 'neg') }, el));
      });
      /* hover: the nearest bar lights up and a tooltip gives its value, as on the line charts */
      var tip = html('div', 'tip', host); tip.hidden = true;
      var cross = svg('line', { y1: m.t, y2: m.t + ph, class: 'crosshair', visibility: 'hidden' }, el);
      var hit = svg('rect', { x: m.l, y: m.t, width: pw, height: ph, class: 'hit' }, el);
      hit.addEventListener('pointermove', function (e) {
        var pt = el.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var loc = pt.matrixTransform(el.getScreenCTM().inverse());
        var i = Math.max(0, Math.min(n - 1, Math.round((loc.x - m.l) / pw * n - 0.5))), v = spec.values[i];
        bars.forEach(function (b, k) { b.classList.toggle('on', k === i); });
        cross.setAttribute('x1', xs(i)); cross.setAttribute('x2', xs(i)); cross.setAttribute('visibility', 'visible');
        clear(tip); html('div', 't', tip, 'layer ' + i + ' → ' + (i + 1)); var row = html('div', 'row', tip); html('span', 'v', row, signed(v, 3) + (spec.unit ? ' ' + spec.unit : '')); html('span', 'n', row, v >= 0 ? 'toward “generated”' : 'toward “human”');
        tip.hidden = false; U.placeTip ? U.placeTip(tip, host, e) : (function () { var hb = host.getBoundingClientRect(); tip.style.left = (e.clientX - hb.left + 14) + 'px'; tip.style.top = (e.clientY - hb.top - 10) + 'px'; })();
      });
      hit.addEventListener('pointerleave', function () { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); bars.forEach(function (b) { b.classList.remove('on'); }); });
      return el;
    }

    /* ================= 02 · ProofWriter: one theory, five proofs ================= */
    var proofState = { depth: 5, win: 'mid', zoom: 'mid' };  /* shading is always the middle window */
    function hexLum(h) { h = (h || '#888').replace('#', ''); if (h.length === 3) h = h.replace(/(.)/g, '$1$1'); var r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, bb = parseInt(h.slice(4, 6), 16) / 255; return 0.2126 * r + 0.7152 * g + 0.0722 * bb; }
    function proofSteps(P) {
      /* the five inference steps, read from the depth-5 proof: premises, rule, conclusion */
      var steps = [];
      P.depths[P.depths.length - 1].response.split('\n').forEach(function (ln) {
        var m = /^Premises:\s*(.*?)\s*Rule:\s*(.*?)\s*Therefore:\s*(.*?)\s*$/.exec(ln);
        if (m) steps.push({ prem: m[1].split(/\.\s*/).filter(Boolean).map(function (x) { return x + '.'; }), rule: m[2], concl: m[3], attr: m[3].replace(/\.$/, '').split(' ').pop() });
      });
      return steps;
    }
    function wrapText(str, maxChars) {
      var words = str.split(' '), lines = [], cur = '';
      words.forEach(function (w) { if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
      if (cur) lines.push(cur); return lines;
    }
    function ladder(host, P, steps, depth, onPick) {
      var D = P.depths, n = steps.length + 1;
      var W = Math.max(760, Math.floor(host.clientWidth || 900)), H = 214;
      var m = { l: 44, r: 62 }, nodeH = 30, yN = 96; if (W < 900) H = 228;
      var labels = ['Harry is red'].concat(steps.map(function (s) { return s.attr; }));
      var widths = labels.map(function (t, k) { return Math.max(k ? 62 : 104, t.length * 7.4 + 24); });
      var span = (W - m.l - m.r - widths[0] / 2 - widths[n - 1] / 2) / (n - 1);
      var xs = labels.map(function (_, k) { return m.l + widths[0] / 2 + k * span; });
      var wrap = html('div', 'ladder-wrap', host);
      var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'ladder', role: 'group', 'aria-label': 'The five inference steps of the proof; click a step to show its proof' }, wrap);
      var defs = svg('defs', {}, el);
      ['on', 'off'].forEach(function (k) { var mk = svg('marker', { id: 'lad-' + k, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs); svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'lad-head ' + k }, mk); });
      /* reuse arcs: the fact is a premise again in steps 3–5 */
      steps.forEach(function (s, i) {
        var k = i + 1; if (k < 2 || s.prem.indexOf('Harry is red.') < 0) return;
        var on = k <= depth, x0 = xs[0] + widths[0] / 2 - 14, x1 = xs[k] - 8, peak = yN - nodeH / 2 - 26 - (k - 2) * 16;
        svg('path', { d: 'M' + x0 + ',' + (yN - nodeH / 2) + ' C' + (x0 + 40) + ',' + peak + ' ' + (x1 - 40) + ',' + peak + ' ' + x1 + ',' + (yN - nodeH / 2 - 1), class: 'lad-arc' + (on ? ' on' : ''), 'marker-end': 'url(#lad-' + (on ? 'on' : 'off') + ')' }, el);
      });
      var arcLab = svg('text', { x: xs[0] + widths[0] / 2 + 6, y: 16, class: 'lad-tiny' }, el); arcLab.textContent = 'the fact is reused as a premise';
      steps.forEach(function (s, i) {
        var k = i + 1, on = k <= depth, col = cssVar(RAMP5[k - 1]);
        /* arrow with the rule under it */
        var xa = xs[k - 1] + widths[k - 1] / 2 + 4, xb = xs[k] - widths[k] / 2 - 4;
        var ln = svg('line', { x1: xa, y1: yN, x2: xb, y2: yN, class: 'lad-edge' + (on ? ' on' : ''), 'marker-end': 'url(#lad-' + (on ? 'on' : 'off') + ')' }, el); if (on) ln.style.stroke = col;
        var lines = wrapText(s.rule, Math.max(14, Math.floor((xb - xa + 30) / 5.6)));
        lines.forEach(function (t, j) { var tx = svg('text', { x: (xa + xb) / 2, y: yN + nodeH / 2 + 14 + j * 12, 'text-anchor': 'middle', class: 'lad-rule' + (on ? ' on' : '') }, el); tx.textContent = t; });
      });
      labels.forEach(function (t, k) {
        var on = k === 0 || k <= depth, col = k ? cssVar(RAMP5[k - 1]) : cssVar('--ink');
        var g = svg('g', { class: 'lad-node' + (on ? ' on' : '') + (k === depth ? ' cur' : '') + (k ? ' pick' : ''), transform: 'translate(' + (xs[k] - widths[k] / 2) + ',' + (yN - nodeH / 2) + ')' }, el);
        if (k) { g.setAttribute('tabindex', 0); g.setAttribute('role', 'button'); g.setAttribute('aria-label', 'depth ' + k + ': prove Harry is ' + t); }
        var r = svg('rect', { width: widths[k], height: nodeH, rx: nodeH / 2, class: 'lad-pill' }, g);
        if (on) { r.style.fill = col; r.style.stroke = col; }
        if (k === depth) svg('rect', { x: -4, y: -4, width: widths[k] + 8, height: nodeH + 8, rx: nodeH / 2 + 4, class: 'lad-ring' }, g);
        var tx = svg('text', { x: widths[k] / 2, y: nodeH / 2 + 4.5, 'text-anchor': 'middle', class: 'lad-label' }, g); tx.textContent = t;
        if (on) tx.style.fill = hexLum(col) > 0.5 ? '#1F1E1D' : '#FAF9F5';
        if (k) {
          var d = D[k - 1];
          var tight = span < 150;
          var s1 = svg('text', { x: widths[k] / 2, y: nodeH + 66, 'text-anchor': 'middle', class: 'lad-stat' + (on ? ' on' : '') }, g); s1.textContent = 'depth ' + k + ' · ' + d.T + ' tok';
          var s2 = svg('text', { x: widths[k] / 2, y: nodeH + 79, 'text-anchor': 'middle', class: 'lad-stat num' + (on ? ' on' : '') }, g); s2.textContent = tight ? 'BTE ' + fmt(d.mid, 4) : 'BTE ' + fmt(d.mid, 4) + ' · NLL ' + fmt(d.nll, 2);
          if (tight) { var s3 = svg('text', { x: widths[k] / 2, y: nodeH + 92, 'text-anchor': 'middle', class: 'lad-stat num' + (on ? ' on' : '') }, g); s3.textContent = 'NLL ' + fmt(d.nll, 2); }
          svg('title', {}, g).textContent = 'show the depth-' + k + ' proof (query: ' + d.query + ')';
          g.addEventListener('click', function () { onPick(k); });
          g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(k); } });
        } else {
          var s0 = svg('text', { x: widths[0] / 2, y: nodeH + 66, 'text-anchor': 'middle', class: 'lad-stat on' }, g); s0.textContent = 'given fact';
        }
      });
      return el;
    }
    function renderProof() {
      var host = sec('case-proof'); if (!host) return; clear(host);
      var P = C.proof, D = P.depths, cur = D[proofState.depth - 1], steps = proofSteps(P);
      /* the reasoning ladder is the control */
      var hd = html('div', 'xp-head', host);
      var row = tbRow(hd, 'Proof depth'); html('span', 'tb-hint', row, 'click a derived attribute to show the proof that ends there');
      ladder(html('div', 'tb-row', hd), P, steps, proofState.depth, function (k) { proofState.depth = k; renderProof(); });
      /* the theory, with the rules the selected proof uses underlined in their step colour */
      var th = html('div', 'proof-theory', host);
      html('span', 'pair-lab', th, 'Facts and rules given to the scorer, the same for all five queries');
      var txt = html('div', 'txt', th);
      var used = {}; steps.forEach(function (s, i) { if (i < proofState.depth) used[s.rule] = i; });
      P.theory.split(/(?<=\.)\s+/).forEach(function (sent, j) {
        var sp = html('span', 'sent', txt, sent);
        if (sent === 'Harry is red.') { sp.classList.add('used'); sp.style.borderBottomColor = cssVar('--ink'); sp.title = 'the fact the chain starts from'; }
        else if (used[sent] != null) { sp.classList.add('used'); sp.style.borderBottomColor = cssVar(RAMP5[used[sent]]); sp.title = 'used at step ' + (used[sent] + 1); }
        txt.appendChild(document.createTextNode(' '));
      });
      var q = html('div', 'proof-query', th); html('span', 'pair-lab', q, 'Query'); html('span', 'qtxt', q, cur.query + '  →  the depth-' + cur.depth + ' proof, ' + cur.T + ' tokens');
      var vals = []; D.forEach(function (d) { d.bte.forEach(function (r) { vals.push(winMean(r, proofState.win) / 1000); }); });
      var rg = quantRange(vals);
      colorbar(html('div', 'shade-key', host), rg[0], rg[1], 'each token\'s ' + winName(proofState.win) + ' BTE, one scale for the five proofs');
      var grid = html('div', 'proof-grid', host);
      var card = html('div', 'pair-card', grid); card.style.setProperty('--card-accent', cssVar(RAMP5[cur.depth - 1]));
      respHead(card, 'Official proof, depth ' + cur.depth, cssVar(RAMP5[cur.depth - 1]), null, [['mid BTE', fmt(cur.mid, 4)], ['NLL', fmt(cur.nll, 3)], ['tokens', cur.T]]);
      /* step markers at the start of each proof line */
      var marks = {}, off = 0, starts = []; cur.tokens.forEach(function (t) { starts.push(off); off += t.length; });
      var pos = 0, stepNo = 0;
      cur.response.split('\n').forEach(function (line) {
        var at = cur.response.indexOf(line, pos); pos = at + line.length;
        var ti = starts.indexOf(at); if (ti < 0) { for (var i = 0; i < starts.length; i++) if (starts[i] > at) { ti = i - 1; break; } }
        if (ti < 0) return;
        if (/^Premises:/.test(line)) { stepNo++; marks[ti] = { text: 'step ' + stepNo, color: cssVar(RAMP5[stepNo - 1]) }; }
        else if (/^Fact:/.test(line)) marks[ti] = { text: 'fact', color: cssVar('--ink') };
        else if (/^Answer:/.test(line)) marks[ti] = { text: 'answer', color: cssVar('--muted') };
      });
      shaded(card, cur.tokens, cur.bte.map(function (r) { return winMean(r, proofState.win); }), rg[0], rg[1], { unit: winName(proofState.win) + ' BTE', marks: marks, breaks: true });
      var side = html('div', 'proof-metrics', grid);
      var c1 = html('div', 'chart', side), c2 = html('div', 'chart', side);
      var attrs = ['', 'big', 'young', 'round', 'cold', 'green'];
      var xspec = { domain: [0.6, 5.4], ticks: [1, 2, 3, 4, 5], format: function (v) { return v + ' · ' + attrs[v]; }, label: 'proof depth · attribute derived' };
      function pointSeries(key, dec) {
        /* the line, then one marker per depth in its ladder colour; the selected depth gets a ring */
        var out = [{ name: key === 'mid' ? 'middle-window BTE' : 'final-layer NLL', color: cssVar(key === 'mid' ? '--accent' : '--s1'), width: 1.8, points: D.map(function (d) { return { x: d.depth, y: d[key] }; }) }];
        D.forEach(function (d) { var on = d.depth === proofState.depth; out.push({ name: 'depth ' + d.depth, color: key === 'mid' ? cssVar(RAMP5[d.depth - 1]) : cssVar('--s1'), noLine: true, markers: true, r: on ? 7 : 4.5, ring: on, points: [{ x: d.depth, y: d[key] }] }); });
        return out;
      }
      function drawSmall(hgt) {
        U.lineChart(c1, { height: hgt, table: false, title: 'Middle-window BTE (nats) · depth ' + proofState.depth + ': ' + fmt(cur.mid, 4), margin: { r: 14, l: 50, b: 38 }, x: xspec, y: { domain: [0.158, 0.172], ticks: [0.16, 0.165, 0.17] },
          series: pointSeries('mid'), tooltip: { title: function (x) { return 'depth ' + x + ' · Harry is ' + attrs[x]; }, format: function (v) { return fmt(v, 4); } } });
        U.lineChart(c2, { height: hgt, table: false, title: 'Final-layer mean NLL (nats/token) · depth ' + proofState.depth + ': ' + fmt(cur.nll, 3), margin: { r: 14, l: 50, b: 38 }, x: xspec, y: { domain: [0, 2.4], ticks: [0, 1, 2] },
          series: pointSeries('nll'), tooltip: { title: function (x) { return 'depth ' + x + ' · Harry is ' + attrs[x]; }, format: function (v) { return fmt(v, 3); } } });
      }
      drawSmall(170);
      /* the two columns share one height: the charts grow to the proof card, or the card grows to the charts */
      (function balance() {
        if (window.innerWidth < 860) return;
        var gap = 14, cardH = card.offsetHeight, sideH = side.offsetHeight;
        if (cardH > sideH + 4) drawSmall(Math.floor((cardH - gap) / 2));
        else if (sideH > cardH + 4) card.style.minHeight = sideH + 'px';
      })();
    }

    /* ================= 02 · two controls: wording and length ================= */
    var ctlState = { word: 0, equal: 0 };
    (function () { var q = /[?&]eq=(\d)/.exec(location.search); if (q) ctlState.equal = +q[1]; var w = /[?&]word=(\d)/.exec(location.search); if (w) ctlState.word = +w[1]; })();
    function renderControls() {
      var host = sec('case-controls'); if (!host) return; clear(host);
      var R = C.rewrite, E = C.equal;
      var wordPairs = R.pairs || [{ uid: R.uid, level: R.level, subject: 'Prealgebra', problem: R.problem, items: R.items }];
      var eqPairs = E.pairs || [{ id: E.id, problem: E.problem, items: E.items }];
      if (ctlState.word >= wordPairs.length) ctlState.word = 0; if (ctlState.equal >= eqPairs.length) ctlState.equal = 0;
      var grid = html('div', 'ctl-grid', host);
      /* both cards share one layout, row by row (subgrid): title · question · selector · problem · two shaded texts · colour key · depth profiles · table · note */
      function selector(a, cols, rows, cur, onPick) {
        var wrap = html('div', 'sel-wrap ctl-sel', a), tbl = html('table', 'sel-table', wrap), thead = html('tr', null, html('thead', null, tbl));
        cols.forEach(function (h, i) { html('th', i ? 'num' : null, thead, h); });
        var tb = html('tbody', null, tbl);
        rows.forEach(function (r, k) {
          var tr = html('tr', 'sel-row' + (k === cur ? ' on' : ''), tb); tr.setAttribute('role', 'radio'); tr.setAttribute('aria-checked', k === cur ? 'true' : 'false'); tr.tabIndex = 0;
          r.forEach(function (c, i) { var td = html('td', i ? 'num' : 'sel-name', tr); if (!i) html('span', 'sel-dot', td); td.appendChild(document.createTextNode(c)); });
          var pick = function () { onPick(k); };
          tr.addEventListener('click', pick); tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
        });
      }
      function controlCard(spec) {
        var a = html('div', 'ctl-card', grid);
        html('h4', null, a, spec.title);
        html('p', 'ctl-q', a, spec.question);
        selector(a, spec.selCols, spec.selRows, spec.selCur, spec.onPick);
        var pr = html('div', 'pair-problem', a); html('span', 'pair-lab', pr, 'Problem'); html('span', 'txt tex', pr, spec.problem);
        var vals = []; spec.items.forEach(function (it) { it.bte.forEach(function (row) { vals.push(winMean(row, 'mid') / 1000); }); });
        var rg = quantRange(vals);
        var tx = html('div', 'ctl-texts', a);
        spec.items.forEach(function (it, i) {
          var card = html('div', 'lab-resp', tx);
          respHead(card, spec.names[i], cssVar(i ? '--accent' : '--ink'), null, [['mid BTE', fmt(it.mid, 4)], ['NLL', fmt(it.nll, 3)], ['tokens', it.T]]);
          shaded(card, it.tokens, it.bte.map(function (row) { return winMean(row, 'mid'); }), rg[0], rg[1]);
        });
        colorbar(html('div', 'shade-key', a), rg[0], rg[1], 'each token\'s middle-window BTE');
        var ch = html('div', 'chart', a);
        U.lineChart(ch, { height: 210, table: false, title: 'Depth profiles of the two responses', subtitle: 'shaded: 12–19', margin: { r: 14 }, x: LAYER_X, y: { domain: [0, spec.yTop], label: 'BTE (nats)' }, bands: BAND,
          series: spec.items.map(function (it, i) { return { name: spec.names[i], color: cssVar(i ? '--accent' : '--ink'), width: 2.2, dash: i === 1, points: pts(it.profile) }; }), tooltip: LAYER_TIP });
        table(a, spec.cols, spec.rows);
        html('p', 'note tight small', a, spec.note);
        if (window.BTE_MATH) window.BTE_MATH(a);
        return a;
      }
      /* wording */
      var WP = wordPairs[ctlState.word], o = WP.items[0], w = WP.items[1];
      controlCard({
        title: 'Same computation, different wording',
        question: 'What changes: who wrote the words around the same arithmetic. To decide: does the readout move with the wording as much as the likelihood does, or does it stay where it was?',
        selCols: ['pair', 'level', 'tokens', 'Δ mid BTE', 'Δ NLL'],
        selRows: wordPairs.map(function (p) { var x = p.items[0], y = p.items[1]; return [p.subject + ' · ' + p.uid.replace('test/', '').replace('.json', '').split('/')[1], String(p.level), x.T + ' → ' + y.T, signed(100 * (y.mid / x.mid - 1), 1) + '%', signed(100 * (y.nll / x.nll - 1), 0) + '%']; }),
        selCur: ctlState.word, onPick: function (k) { ctlState.word = k; renderControls(); },
        problem: WP.problem, items: WP.items, names: ['Official MATH solution', 'GPT-5.5 rewrite'], yTop: 0.4,
        cols: ['', 'official', 'rewrite', 'change'],
        rows: [
          { cells: ['tokens', String(o.T), String(w.T), signed(100 * (w.T / o.T - 1), 0) + '%'] },
          { cells: ['middle-window BTE (nats)', fmt(o.mid, 4), fmt(w.mid, 4), { text: signed(100 * (w.mid / o.mid - 1), 2) + '%', cls: 'best' }] },
          { cells: ['final-layer NLL (nats/token)', fmt(o.nll, 3), fmt(w.nll, 3), { text: signed(100 * (w.nll / o.nll - 1), 1) + '%', cls: 'best' }] }
        ],
        note: 'BTE is insensitive to style. Same arithmetic in different words: NLL falls by 35% (22% at the median of 500 pairs), BTE changes by 0.04% (2.3% at the median): the same content, the same reading.'
      });
      /* length */
      var VNAME = { periodic_ab: '“abab…” repeated', repeated_word: '“the” repeated', random_words: 'random words', shuffled_tokens: 'the solution, tokens shuffled', repeated_sentence: 'one sentence repeated' };
      var EP = eqPairs[ctlState.equal], n = EP.items[0], p = EP.items[1], PP = EP.pop || E.pop, vname = VNAME[p.key] || p.key;
      controlCard({
        title: 'Same problem, same length, no content',
        question: 'What changes: the solution is replaced by a text with no content and exactly the same token count: a repeated string, one word repeated, random words, or the solution\'s own tokens in random order. To decide: is a high BTE just long or hard-to-predict text, and does the choice of layer window matter?',
        selCols: ['pair · control', 'tokens', 'Δ mid BTE', 'Δ NLL'],
        selRows: eqPairs.map(function (q) { var x = q.items[0], y = q.items[1]; return [q.id.replace('gsm8k-gsm8k-', 'GSM8K ') + ' · ' + (VNAME[y.key] || y.key), String(x.T), signed(100 * (y.mid / x.mid - 1), 0) + '%', (y.nll / x.nll >= 2 ? '×' + fmt(y.nll / x.nll, 1) : signed(100 * (y.nll / x.nll - 1), 0) + '%')]; }),
        selCur: ctlState.equal, onPick: function (k) { ctlState.equal = k; renderControls(); },
        problem: EP.problem, items: EP.items, names: ['The solution', vname], yTop: 0.5,
        cols: ['', 'solution', 'control', 'same control on all ' + PP.n + ' problems'],
        rows: (function () {
          function dir(st) { return st.secondHigher >= st.secondLower ? 'control higher in ' + st.secondHigher + ' of ' + st.n : 'control lower in ' + st.secondLower + ' of ' + st.n; }
          return [
            { cells: ['middle-window BTE', fmt(n.mid, 4), fmt(p.mid, 4), dir(PP.mid)] },
            { cells: ['all-layer BTE', fmt(n.all, 4), fmt(p.all, 4), dir(PP.all)] },
            { cells: ['early-window BTE (0–7)', fmt(n.early, 4), fmt(p.early, 4), dir(PP.early)] },
            { cells: ['final-layer NLL', fmt(n.nll, 3), fmt(p.nll, 3), dir(PP.nll)] }
          ];
        })(),
        note: 'BTE is sensitive to content. Same length with the content removed: NLL goes down for repeated text and up for random or shuffled text, so likelihood does not see the content. The middle-window BTE falls in every case. Together with the wording control: likelihood tracks the style of the text, BTE tracks its content.'
      });
    }

    /* ================= 03 · detection: the same paper, two authors ================= */
    /* blind human evaluation of one review pair: nine dimensions × two evaluators */
    function humanEvalPanel(host, pair, dims, nameOf) {
      if (!pair) return;
      var box = html('div', 'heval', host);
      var ov = pair.judgments, evs = Object.keys(ov).sort();
      var head = html('div', 'heval-head', box); html('span', 'pair-lab', head, 'Blind human evaluation of this pair');
      html('span', 'heval-sub', head, 'two NLP researchers read the paper and both reviews without knowing who wrote them, and chose the better review on each dimension');
      var wrap = html('div', 'tbl-wrap', box), t = html('table', 'tbl dense heval-tbl', wrap), tr = html('tr', null, html('thead', null, t));
      html('th', null, tr, 'dimension'); evs.forEach(function (e) { html('th', null, tr, e); });
      var tb = html('tbody', null, t);
      dims.forEach(function (dm, i) {
        var r = html('tr', i === 0 ? 'hi' : null, tb); html('td', null, r, dm[1]);
        evs.forEach(function (e) { var v = ov[e][dm[0]]; var td = html('td', 'heval-c ' + (v === null ? 'na' : v === 'similar' ? 'sim' : v === 'human' ? 'hum' : 'mod'), r, v === null ? (ov[e].questions_missing ? 'no questions' : '—') : v === 'similar' ? 'similar' : nameOf(v) + ' better'); });
      });
      return box;
    }
    var detState = { key: 'P030', gen: null, setting: null, contrib: 'bte_raw', scorer: 'qwen' };   /* Qwen-3.5-9B is the default scorer here */   /* the NLL/layer detector is not shown */
    /* what each detector was fitted on; shown where its predictions are */
    var DET_TRAIN = {
      A: 'fitted on ICLR 2021 calibration papers with the three legacy generators (GPT-4o, Gemini 1.5 Pro, Claude 3.5 Sonnet)',
      B: 'fitted on ICLR 2021 calibration papers with the selected generator\'s whole family left out, so it has never seen a review by that family',
      C: 'fitted on calibration papers from all eight conference-years and all seven generators'
    };
    function renderDetect() {
      var host = sec('case-detect'); if (!host) return; clear(host);
      var cases = C.detect.cases, cur = null;
      cases.forEach(function (c) { if (c.key === detState.key) cur = c; });
      if (!detState.gen || !cur.gens[detState.gen]) detState.gen = cur.gen;
      if (!detState.setting) detState.setting = cur.main;
      var qwen = detState.scorer === 'qwen' && C.detect.qwen && C.detect.qwen.cases[cur.key];
      var SRCD = qwen ? C.detect.qwen.cases[cur.key] : cur;   /* reviews, scores and contributions under the selected scorer */
      var gen = detState.gen, G = SRCD.gens[gen], hum = SRCD.human, rev = G.review;
      if (!G.scores[detState.setting]) detState.setting = cur.main;   /* ICLR 2021 papers are calibration data for detectors A and B */
      var st = detState.setting, S = G.scores[st];
      var isMain = gen === cur.gen && !qwen;
      var scorerName = qwen ? 'Qwen-3.5-9B' : 'Llama-3.1-8B-Instruct';
      /* toolbar: paper, generator, detector */
      var hd = html('div', 'xp-head', host);
      seg(tbRow(hd, 'Scorer'), [['llama', 'Llama-3.1-8B-Instruct'], ['qwen', 'Qwen-3.5-9B']], detState.scorer, function (v) { detState.scorer = v; renderDetect(); });
      chips(tbRow(hd, 'Paper'), cases.map(function (c) { return [c.key, c.label, c.conf]; }), detState.key, function (v) { detState.key = v; detState.gen = null; detState.setting = null; renderDetect(); });
      var grow = tbRow(hd, 'Generator');
      C.detect.gens.forEach(function (g) {
        var r = SRCD.gens[g].review, b = html('button', 'chip' + (g === gen ? ' on' : ''), grow); b.type = 'button';
        logoSvg(b, r.fam, cssVar(SRC_STYLE[g][0])); html('span', 'cl', b, r.name);
        b.addEventListener('click', function () { detState.gen = g; renderDetect(); });
      });
      var drow = tbRow(hd, 'Detector');
      seg(drow, [['A', 'A · legacy generators'], ['B', 'B · family held out'], ['C', 'C · full coverage']].filter(function (o) { return !!G.scores[o[0]]; }), st, function (v) { detState.setting = v; renderDetect(); });
      if (!G.scores.A) html('span', 'tb-note', drow, 'this paper is calibration data for detectors A and B');
      if (detState.contrib === 'nll_layers') detState.contrib = 'bte_raw';
      seg(tbRow(hd, 'Features'), [['bte_raw', 'BTE raw'], ['bte_shape', 'BTE shape']], detState.contrib, function (v) { detState.contrib = v; renderDetect(); });
      var meta = html('div', 'case-meta', host);
      html('div', 'ttl', meta, cur.conf + ' · ' + cur.title);
      var vals = []; [hum, rev].forEach(function (r) { r.tokMid.forEach(function (v) { vals.push(v / 1000); }); });
      var rg = quantRange(vals);
      colorbar(html('div', 'shade-key', host), rg[0], rg[1], 'each token\'s middle-window BTE under ' + scorerName);
      var rgrid = html('div', 'rev-grid', host);
      [hum, rev].forEach(function (r) {
        var stl = SRC_STYLE[r.source], card = html('div', 'lab-resp', rgrid);
        var sc = S[detState.contrib === 'bte_shape' ? 'shape' : 'raw'][r.source === 'human' ? 'human' : 'generated'];
        respHead(card, stl[2], cssVar(stl[0]), stl[1], [['tokens', r.T], ['NLL', fmt(r.nll, 3)], ['mid BTE', fmt(r.mid, 4)], ['detector ' + st + ' p(generated)', fmt(sc, 2)]], r.source === 'human' ? null : 'generated');
        shaded(card, r.tokens, r.tokMid, rg[0], rg[1]);
      });
      /* charts */
      var two = html('div', 'two-col eq', host);
      var f1 = html('figure', 'fig', two), f2 = html('figure', 'fig', two);
      var c1 = html('div', 'chart', f1);
      var ymax = 0; [hum, rev].forEach(function (r) { r.profile.forEach(function (v) { ymax = Math.max(ymax, v); }); });
      U.lineChart(c1, { height: 240, table: false, title: 'Depth profiles of the two reviews · ' + scorerName, subtitle: 'shaded: 12–19', margin: { r: 14 }, x: LAYER_X, y: { domain: [0, ymax * 1.12], label: 'BTE (nats)' }, bands: BAND,
        series: [hum, rev].map(function (r) { var stl = SRC_STYLE[r.source]; return { name: stl[2], color: cssVar(stl[0]), width: 2.2, points: pts(r.profile) }; }), tooltip: LAYER_TIP });
      html('figcaption', null, f1, 'Mean elementary BTE per transition over the tokens of each review, with the parsed paper in the context' + (qwen ? '. Qwen-3.5-9B has 32 layers as well; its profiles are lower overall than Llama\'s' : '') + '.');
      var K = G.contrib[st];
      var c2 = html('div', 'chart', f2);
      var detName = detState.contrib === 'bte_raw' ? 'BTE raw' : 'BTE shape';
      vbars(c2, { height: 240, values: K[detState.contrib].per, title: narrow(c2) ? 'Detector ' + st + ', ' + detName + ': logit contributions' : 'Detector ' + st + ', ' + detName + ': per-transition contribution to the logit gap', subtitle: rev.name + ' − human, sum ' + signed(K[detState.contrib].sum, 2) + (K[detState.contrib].sum > 0 ? ' → generated' : ' → human'), unit: 'logits' });
      var fc2 = html('figcaption', null, f2);
      fc2.textContent = 'Each bar is one layer\'s share of the gap between the two scores: the detector\'s weight at that layer times the difference of the two standardized profiles there. The 32 bars add up to the logit gap; positive bars push the generated review toward “generated”, negative ones push it back toward “human” instead.';
      /* the aggregate, always visible */
      var A = qwen ? C.detect.qwen.auroc : C.detect.auroc, TR = { A: 'ICLR 2021 papers, three legacy generators', B: 'ICLR 2021 papers, one model family held out', C: 'eight conference-years, seven generators' };
      var wrap = table(host, [narrow(host) ? 'setting' : 'setting · calibration data', 'BTE raw', 'BTE shape', 'final likelihood'], ['A', 'B', 'C'].map(function (s) {
        var best = Math.max(A[s].bte_raw, A[s].bte_shape, A[s].final_likelihood);
        function cc(v) { return { text: fmt(v, 3), cls: v === best ? 'best' : null }; }
        return { cls: s === st ? 'cur' : null, cells: [narrow(host) ? s : s + ' · ' + TR[s], cc(A[s].bte_raw), cc(A[s].bte_shape), cc(A[s].final_likelihood)] };
      }));
      wrap.classList.add('detect-auroc');
    }

    /* ================= 04 · attribution: the per-layer mean is not enough ================= */
    var attrState = { key: 'B', paper: null, gen: 'claude-opus-5' };
    var PREF_NAME = { 'gpt-4o': 'GPT-4o', 'gemini-1.5-pro-002': 'Gemini 1.5 Pro', 'claude-sonnet-3.5v2': 'Claude 3.5 Sonnet', 'gpt-5.5': 'GPT-5.5', 'gpt-5.6-sol': 'GPT-5.6', 'gemini-3.1-pro-preview': 'Gemini 3.1 Pro', 'claude-opus-5': 'Claude Opus 5' };
    function prefOf(gen) { var P = (window.BTE_DATA && window.BTE_DATA.preference) || []; for (var i = 0; i < P.length; i++) if (P[i].g === PREF_NAME[gen]) return P[i]; return null; }
    function renderAttrCase() {
      var host = sec('case-attr'); if (!host) return; clear(host);
      var papers = C.attr.papers || [];   /* the blind human-evaluation papers */
      var items = papers.map(function (p) { return { key: p.uid, label: p.short || p.title, cv: p.conf, paper: p }; });
      if (!attrState.paper) attrState.paper = items[0].key;
      var it = null; items.forEach(function (x) { if (x.key === attrState.paper) it = x; }); if (!it) { it = items[0]; attrState.paper = it.key; }
      var hd = html('div', 'xp-head', host);
      chips(tbRow(hd, 'Paper'), items.map(function (x) { return [x.key, x.label, x.cv]; }), attrState.paper, function (v) { attrState.paper = v; renderAttrCase(); });
      var reviews, split, meta = null, gen = null;
      var grow = tbRow(hd, 'Generator');
      C.detect.gens.forEach(function (g) {
        var b = html('button', 'chip' + (g === attrState.gen ? ' on' : ''), grow); b.type = 'button';
        logoSvg(b, SRC_STYLE[g][1], cssVar(SRC_STYLE[g][0])); html('span', 'cl', b, SRC_STYLE[g][2]);
        b.addEventListener('click', function () { attrState.gen = g; renderAttrCase(); });
      });
      gen = attrState.gen; var p = it.paper;
      reviews = [p.reviews.human, p.reviews[gen]];
      split = 'C';
      var pf = prefOf(gen);
      meta = [p.conf + ' · ' + p.title, 'The human review and the ' + SRC_STYLE[gen][2] + ' review of the same paper, one of the 30 papers of the blind human evaluation. Classifier of split C: all eight conference-years. To decide: which of the eight sources wrote each one.'];
      var mt = html('div', 'case-meta', host); html('div', 'ttl', mt, meta[0]); html('div', 'sub', mt, meta[1]);
      var vals = []; reviews.forEach(function (r) { r.tokMid.forEach(function (v) { vals.push(v / 1000); }); });
      var rg = quantRange(vals);
      colorbar(html('div', 'shade-key', host), rg[0], rg[1], 'each token\'s middle-window BTE');
      var rgrid = html('div', 'rev-grid', host);
      reviews.forEach(function (r) {
        var st = SRC_STYLE[r.source], card = html('div', 'lab-resp', rgrid);
        function ans(clf) { var q = r.pred[clf]; return srcName(q.label) + (q.label === r.source ? ' ✓' : ' ✗'); }
        respHead(card, st[2], col(ATTR_COL[r.source]), st[1], [['tokens', r.T], ['mid BTE', fmt(r.mid, 4)], ['mean only →', ans('BTE32')], ['+ spread →', ans('BTE160')], ['+ position, dynamics →', ans('BTE352')]], r.source === 'human' ? null : 'generated');
        shaded(card, r.tokens, r.tokMid, rg[0], rg[1]);
      });
      if (it.paper.humanEval) humanEvalPanel(host, it.paper.humanEval[gen], C.attr.humanEvalDims, function (v) { return v === 'human' ? 'Human' : SRC_STYLE[v][2]; });
      var two = html('div', 'two-col eq', host);
      var f1 = html('figure', 'fig', two), f2 = html('figure', 'fig', two);
      var c1 = html('div', 'chart', f1);
      var ymax = 0; reviews.forEach(function (r) { r.mean.forEach(function (v) { ymax = Math.max(ymax, v); }); });
      U.lineChart(c1, { height: 230, table: false, title: 'Average revision per layer (mean over tokens)', subtitle: 'shaded: 12–19', margin: { r: 14 }, x: LAYER_X, y: { domain: [0, ymax * 1.12], label: 'mean BTE (nats)' }, bands: BAND,
        series: reviews.map(function (r, i) { return { name: srcName(r.source), color: col(ATTR_COL[r.source]), width: 2.2, dash: i === 1 && r.source !== 'human' && reviews[0].source !== 'human', points: pts(r.mean) }; }), tooltip: LAYER_TIP });
      html('figcaption', null, f1, 'At each layer, the average BTE over all tokens of the review: how much the belief was revised on average. These 32 numbers are the whole input of the first classifier, the 32-D one.');
      var c2 = html('div', 'chart', f2);
      var top = 0; reviews.forEach(function (r) { r.sd.forEach(function (v) { top = Math.max(top, v); }); });
      U.lineChart(c2, { height: 230, table: false, title: 'Unevenness of the revision per layer (SD over tokens)', subtitle: 'shaded: 12–19', margin: { r: 14 }, x: LAYER_X, y: { domain: [0, top * 1.1], label: 'SD across tokens (nats)' }, bands: BAND,
        series: reviews.map(function (r, i) { return { name: srcName(r.source), color: col(ATTR_COL[r.source]), width: 2.2, dash: i === 1 && r.source !== 'human' && reviews[0].source !== 'human', points: pts(r.sd) }; }), tooltip: LAYER_TIP });
      html('figcaption', null, f2, 'At each layer, the standard deviation of the same token values: how unevenly the revision is spread over the tokens. Two reviews can have the same average and a different spread; the second classifier adds this spread and three percentiles of the same values.');
      var wrap = table(host, ['split', 'reviews', '32-D', '160-D', '352-D', 'final 11-D'], ['A', 'B', 'C'].map(function (s) {
        var a = [C.attr.acc[s][0], C.attr.acc[s][1], C.attr.acc[s][2], C.attr.acc[s][4]], best = Math.max.apply(null, a);
        return { cls: s === split ? 'cur' : null, cells: [narrow(host) ? s : s + ' · ' + C.attr.split[s], C.attr.n[s].toLocaleString('en-US')].concat(a.map(function (v) { return { text: fmt(v, 1) + '%', cls: v === best ? 'best' : null }; })) };
      }));
      wrap.classList.add('detect-auroc');
      html('p', 'note tight small', host, 'Eight-way accuracy on generated reviews, Llama-3.1-8B-Instruct scorer: per-layer mean (32-D), + spread (160-D), + position and dynamics (352-D), and the final-layer statistics baseline (11-D). Of the 21 evaluation papers held out from both the attribution and the detection classifiers, the first three are those whose per-paper accuracy is closest to the split-C aggregate; Zero-shot retrieval is the paper whose human review the readers preferred in every overall judgment, and Adversarial attacks the paper where detector C ranks two pairs the wrong way.');
    }

    /* ================= 05 · training: the same solution, four checkpoints ================= */
    var trainState = { idx: 0, ck: 3 };
    function renderTrain() {
      var host = sec('case-train'); if (!host) return; clear(host);
      var T = C.train, cur = T.cases[trainState.idx], ck = cur.ckpts[trainState.ck], base = cur.ckpts[0];
      var popKey = cur.group === 'math500' ? 'math500' : 'gsm8k', PP = T.pop[popKey];
      var hd = html('div', 'xp-head', host);
      chips(tbRow(hd, 'Solution'), T.cases.map(function (c, i) { return [i, c.label, c.id.replace('math500-test-', '').replace('gsm8k-gsm8k-', '').replace('.json', '') + ' · ' + c.T + ' tok']; }), trainState.idx, function (v) { trainState.idx = v; renderTrain(); });
      var right = tbRow(hd, 'Scorer');
      seg(right, cur.ckpts.map(function (c, i) { return [i, i ? 'after ' + c.label + ' trajectories' : 'before fine-tuning']; }), trainState.ck, function (v) { trainState.ck = v; renderTrain(); });
      var vals = []; cur.ckpts.forEach(function (c) { c.tokMid.forEach(function (v) { vals.push(v / 1000); }); });
      var rg = quantRange(vals);
      colorbar(html('div', 'shade-key', host), rg[0], rg[1], 'each token\'s middle-window BTE, one scale for the four checkpoints');
      var pr = html('div', 'pair-problem', host); html('span', 'pair-lab', pr, 'Problem'); html('span', 'txt tex', pr, cur.problem);
      var grid = html('div', 'proof-grid', host);
      var card = html('div', 'pair-card', grid); card.style.setProperty('--card-accent', cssVar(RAMP5[[0, 1, 3, 4][trainState.ck]]));
      respHead(card, 'Official solution read ' + (trainState.ck ? 'after ' + ck.label + ' training trajectories' : 'before fine-tuning'), cssVar(RAMP5[[0, 1, 3, 4][trainState.ck]]), null, [['mid BTE', fmt(ck.mid, 4)], ['NLL', fmt(ck.nll, 3)], ['tokens', cur.T]]);
      var body = html('div', 'lab-text spans', card);
      cur.spans.forEach(function (s) {
        var g = html('span', 'sp', body);
        var lab = html('span', 'sp-label', g, s.label); lab.title = s.label + ': ' + fmt(s.byDose[trainState.ck], 4) + ' nats at this checkpoint';
        for (var i = s.t0; i <= s.t1; i++) {
          var tk = U.tokenFill(html('span', 'tk', g), cur.tokens[i], true), v = ck.tokMid[i] / 1000, c = U.heatColor((v - rg[0]) / Math.max(1e-6, rg[1] - rg[0]));
          tk.style.background = c.bg; tk.style.color = c.fg;
          tk.title = 'token ' + i + ' “' + tokLabel(cur.tokens[i]) + '” · middle-window BTE ' + fmt(v, 3) + ' nats (' + fmt(base.tokMid[i] / 1000, 3) + ' before fine-tuning)';
        }
      });
      var side = html('div', 'proof-metrics', grid);
      var c1 = html('div', 'chart', side), c2 = html('div', 'chart', side);
      var xspec = { domain: [-0.3, 3.3], ticks: [0, 1, 2, 3], format: function (v) { return ['0', '1,000', '5,000', '9,704'][v]; }, label: 'PRM800K training trajectories seen by the scorer' };
      var dtip = { title: function (x) { return ['before fine-tuning', 'after 1,000', 'after 5,000', 'after 9,704'][x]; }, format: function (v) { return fmt(v, 4); } };
      var benchName = popKey === 'math500' ? 'MATH-500' : 'GSM8K';
      /* one marker per checkpoint in its toolbar colour; the selected checkpoint gets the ring, as in the proof card */
      function ckSeries(key, col0) {
        var out = [{ name: 'this solution', color: cssVar(col0), width: 1.8, points: cur.ckpts.map(function (c, i) { return { x: i, y: c[key] }; }) },
          { name: 'mean of the ' + PP.n + ' ' + benchName + ' solutions', color: cssVar('--ink'), width: 1.2, dash: true, markers: true, points: PP[key === 'mid' ? 'midByDose' : 'nllByDose'].map(function (v, i) { return { x: i, y: v }; }) }];
        cur.ckpts.forEach(function (c, i) { var on = i === trainState.ck; out.push({ name: i ? 'after ' + c.label : 'before fine-tuning', color: key === 'mid' ? cssVar(RAMP5[[0, 1, 3, 4][i]]) : cssVar(col0), noLine: true, markers: true, r: on ? 7 : 4.5, ring: on, points: [{ x: i, y: c[key] }] }); });
        return out;
      }
      var nllAll = cur.ckpts.map(function (c) { return c.nll; }).concat(PP.nllByDose), nlo = Math.min.apply(null, nllAll), nhi = Math.max.apply(null, nllAll);
      function drawSmall(hgt) {
        U.lineChart(c1, { height: hgt, table: false, title: 'Middle-window BTE (nats) · ' + (trainState.ck ? 'after ' + ck.label : 'before') + ': ' + fmt(ck.mid, 4), subtitle: 'dashed: mean of the ' + PP.n + ' ' + benchName + ' solutions', margin: { r: 14, l: 50, b: 38 }, x: xspec, y: { domain: [0.12, 0.175], ticks: [0.12, 0.14, 0.16] },
          series: ckSeries('mid', '--accent'), tooltip: dtip });
        U.lineChart(c2, { height: hgt, table: false, title: 'Final-layer mean NLL (nats/token) · ' + (trainState.ck ? 'after ' + ck.label : 'before') + ': ' + fmt(ck.nll, 3), subtitle: 'dashed: mean of the ' + PP.n + ' ' + benchName + ' solutions', margin: { r: 14, l: 50, b: 38 }, x: xspec, y: { domain: [Math.max(0, nlo - 0.15), nhi + 0.15] },
          series: ckSeries('nll', '--s1'), tooltip: { title: dtip.title, format: function (v) { return fmt(v, 3); } } });
      }
      drawSmall(170);
      (function balance() {
        if (window.innerWidth < 860) return;
        var gap = 14, cardH = card.offsetHeight, sideH = side.offsetHeight;
        if (cardH > sideH + 4) drawSmall(Math.floor((cardH - gap) / 2));
        else if (sideH > cardH + 4) card.style.minHeight = sideH + 'px';
      })();
      var pc = html('div', 'chart', host);
      U.lineChart(pc, { height: 240, table: false, title: 'Depth profile of this solution at the four checkpoints', subtitle: 'shaded: 12–19', margin: { r: 14 }, x: LAYER_X, y: { domain: [0, 0.36], label: 'BTE (nats)' }, bands: BAND,
        series: cur.ckpts.map(function (c, i) { var on = i === trainState.ck; return { name: i ? 'after ' + c.label : 'before fine-tuning', color: cssVar(RAMP5[[0, 1, 3, 4][i]]), width: on ? 3 : 1.3, halo: on ? 11 : 0, points: pts(c.profile) }; }), tooltip: LAYER_TIP });
      html('p', 'note tight small', host, 'The solution cut into its steps (the labels in the text above); each row is the mean middle-window BTE of that step\'s tokens at each checkpoint. ▲ marks a step that rises from the previous checkpoint.');
      table(host, ['step of the solution', 'before', 'after 1,000', 'after 5,000', 'after 9,704', 'change'], cur.spans.map(function (s) {
        var cells = [s.label + ' · tokens ' + s.t0 + '–' + s.t1];
        s.byDose.forEach(function (v, i) { cells.push({ text: fmt(v, 4), mark: i && v > s.byDose[i - 1] ? '▲' : null, bad: true }); });
        cells.push({ text: signed(100 * (s.byDose[3] / s.byDose[0] - 1), 1) + '%', cls: 'best' });
        return { cells: cells };
      }));
      html('p', 'note tight', host, 'Same text, same model, fine-tuned on MATH solutions: the middle-window BTE falls by ' + fmt(100 * (1 - cur.ckpts[3].mid / cur.ckpts[0].mid), 0) + '% in every step, while the final-layer NLL does not improve. Over the benchmarks the drop is 22% on MATH-500 against 17% on GSM8K, which the fine-tuning did not target: the scorer is part of the measurement.');
      if (window.BTE_MATH) window.BTE_MATH(host);
    }

    /* ================= 05 · four response styles through the same four checkpoints ================= */
    var S = window.BTE_STYLECASES;
    var styleState = { set: 'math500', ck: 3 };
    var STYLE_ORDER = ['prm800k', 'math500', 'gsm8k', 'olympiad'];
    var STYLE_META = {
      prm800k: { name: 'PRM800K trajectory', short: 'PRM800K trajectories (unseen)', color: '--accent', tag: 'training style · unseen problems', about: 'GPT-4 solutions of MATH problems, every step verified by a human annotator: first person, one step per paragraph, closing with “# Answer”. This is the style of the 9,704 training trajectories; these problems are not among the 7,880 training problems.' },
      math500: { name: 'MATH-500 official solution', short: 'MATH-500 official', color: '--s2', tag: 'human-written', about: 'The reference solutions shipped with MATH: human-written derivations in LaTeX that end in a boxed answer. The fine-tuning targeted this benchmark but never saw this style.' },
      gsm8k: { name: 'GSM8K official solution', short: 'GSM8K official', color: '--s4', tag: 'human-written', about: 'The reference solutions shipped with GSM8K: a few sentences of arithmetic and a final answer line. Neither the style nor the benchmark was in the fine-tuning data.' },
      olympiad: { name: 'OlympiadBench official solution', short: 'OlympiadBench official', color: '--s5', tag: 'human-written', about: 'Official solutions of competition problems, OCR-cleaned from their sources. Neither the style nor the benchmark was in the fine-tuning data.' }
    };
    var ROLE_NAME = { median: 'typical', lo: 'largest NLL fall', hi: 'largest NLL rise' };
    function rgbOf(h) { h = (h || '#888').replace('#', ''); if (h.length === 3) h = h.replace(/(.)/g, '$1$1'); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
    function lum(c) { var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
    /* diverging colour for a change: blue = fell, red = rose; t in [-1, 1] */
    function divColor(t) {
      var bg = rgbOf(cssVar('--bg')), pole = rgbOf(cssVar(t < 0 ? '--s1' : '--s8')), k = Math.min(1, Math.abs(t));
      var c = [0, 1, 2].map(function (i) { return Math.round(bg[i] + (pole[i] - bg[i]) * k); });
      return { bg: 'rgb(' + c.join(',') + ')', fg: lum(c) > 0.3 ? '#1F1E1D' : '#FAF9F5' };
    }
    function divKey(host, label, lim, unit) {
      var cb = html('div', 'scale lab-scale', host);
      html('span', null, cb, label + ' fell by ' + lim + ' ' + unit + ' or more');
      var r = html('span', 'ramp', cb); r.style.background = 'linear-gradient(90deg,' + divColor(-1).bg + ',' + divColor(0).bg + ',' + divColor(1).bg + ')';
      html('span', null, cb, 'rose by ' + lim + ' ' + unit + ' or more');
    }
    var styleGroup = U.makeGroup();
    var STYLE_COL = { prm800k: '--ink', math500: '--s2', gsm8k: '--s4', olympiad: '--lv-5' };   /* warm palette for the BTE series: training style in ink, then orange, amber, brown */
    var STYLE_SHORT = { prm800k: 'PRM800K trajectory (training style)', math500: 'MATH-500 official solution', gsm8k: 'GSM8K official solution', olympiad: 'OlympiadBench official solution' };
    function renderStyle() {
      var host = sec('case-style'); if (!host || !S) return; clear(host);
      var st = styleState; if (!st.ck) st.ck = 3; if (!st.shade || st.shade === 'bte') st.shade = 'dnll';
      var SS = S.sets[st.set], ex = SS.examples[0], ck = ex.ckpts[st.ck], base = ex.ckpts[0];
      var xspec = { domain: [-0.3, 3.3], ticks: [0, 1, 2, 3], format: function (v) { return ['0', '1,000', '5,000', '9,704'][v]; }, label: 'PRM800K training trajectories seen by the scorer' };
      var dtitle = function (x) { return ['before fine-tuning', 'after 1,000', 'after 5,000', 'after 9,704'][x]; };
      function CKC(i) { return cssVar(RAMP5[[0, 1, 3, 4][i]]); }
      /* ---- controls ---- */
      var hd = html('div', 'xp-head', host);
      chips(tbRow(hd, 'Response'), STYLE_ORDER.map(function (k) { return [k, STYLE_SHORT[k], S.sets[k].examples[0].T + ' tok', cssVar(STYLE_COL[k])]; }), st.set, function (v) { st.set = v; renderStyle(); });
      seg(tbRow(hd, 'Scorer'), ex.ckpts.map(function (c, i) { return [i, i ? 'after ' + c.label + ' trajectories' : 'before fine-tuning']; }), st.ck, function (v) { st.ck = v; renderStyle(); });
      seg(tbRow(hd, 'Shade tokens by'), [['dnll', 'change in NLL since before fine-tuning'], ['dbte', 'change in middle-window BTE']], st.shade, function (v) { st.shade = v; renderStyle(); });
      /* ---- key ---- */
      var key = html('div', 'shade-key', host), lim = st.shade === 'dnll' ? 2 : 0.06;
      var cb = html('div', 'scale lab-scale', key);
      html('span', null, cb, (st.shade === 'dnll' ? 'NLL' : 'middle-window BTE') + ' fell by ' + lim + ' nats or more');
      var rp = html('span', 'ramp', cb); rp.style.background = 'linear-gradient(90deg,' + divColor(-1).bg + ',' + divColor(0).bg + ',' + divColor(1).bg + ')';
      html('span', null, cb, 'rose by ' + lim + ' or more · each token, this checkpoint against before fine-tuning');
      /* ---- the response ---- */
      var pr = html('div', 'pair-problem', host); html('span', 'pair-lab', pr, 'Problem'); html('span', 'txt' + (st.set === 'gsm8k' ? '' : ' tex'), pr, ex.problem);
      var grid = html('div', 'proof-grid', host);
      var card = html('div', 'pair-card', grid); card.style.setProperty('--card-accent', CKC(st.ck));
      respHead(card, STYLE_SHORT[st.set] + ', read ' + (st.ck ? 'after ' + ck.label + ' trajectories' : 'before fine-tuning'), CKC(st.ck), null,
        [['mid BTE', fmt(base.mid, 4) + ' → ' + fmt(ck.mid, 4)], ['NLL', fmt(base.nll, 3) + ' → ' + fmt(ck.nll, 3)], ['tokens', ex.T]]);
      var TC = ((C.train && C.train.cases) || []).filter(function (c) { return c.id === ex.id; })[0];
      var body = html('div', 'lab-text' + (TC ? ' spans' : ''), card), groups = {};
      if (TC) TC.spans.forEach(function (sp) { var g = html('span', 'sp', body); html('span', 'sp-label', g, sp.label); for (var q = sp.t0; q <= sp.t1; q++) groups[q] = g; });
      ex.tokens.forEach(function (tk, i) {
        var sp = U.tokenFill(html('span', 'tk', groups[i] || body), tk, false), tip = 'token ' + i + ' “' + tokLabel(tk) + '”', c;
        if (!st.ck) { c = { bg: 'transparent', fg: '' }; }
        else if (st.shade === 'dnll') {
          if (ck.tokNll[i] === null) { c = { bg: 'transparent', fg: '' }; tip += ' · first response token, no NLL'; }
          else { var d = (ck.tokNll[i] - base.tokNll[i]) / 1000; c = divColor(d / lim); tip += ' · NLL ' + fmt(base.tokNll[i] / 1000, 2) + ' → ' + fmt(ck.tokNll[i] / 1000, 2) + ' nats'; }
        } else { var e = (ck.tokMid[i] - base.tokMid[i]) / 1000; c = divColor(e / lim); tip += ' · middle-window BTE ' + fmt(base.tokMid[i] / 1000, 3) + ' → ' + fmt(ck.tokMid[i] / 1000, 3) + ' nats'; }
        sp.style.background = c.bg; sp.style.color = c.fg; sp.title = tip;
      });
      var side = html('div', 'proof-metrics', grid);
      var c1 = html('div', 'chart', side), c2 = html('div', 'chart', side);
      var P = SS.pop, popName = 'mean of the ' + P.n + ' ' + (st.set === 'prm800k' ? 'unseen trajectories' : SS.bench + ' solutions');
      function ser(key, col0) {
        var pop = key === 'mid' ? P.mid.mean : P.nll.mean;
        var out = [{ name: 'this response', color: cssVar(col0), width: 1.8, points: ex.ckpts.map(function (c, i) { return { x: i, y: c[key] }; }) },
          { name: popName, color: cssVar('--ink'), width: 1.2, dash: true, markers: true, points: pop.map(function (v, i) { return { x: i, y: v }; }) }];
        ex.ckpts.forEach(function (c, i) { var on = i === st.ck; out.push({ name: dtitle(i), color: key === 'mid' ? CKC(i) : cssVar(col0), noLine: true, markers: true, r: on ? 7 : 4.5, ring: on, points: [{ x: i, y: c[key] }] }); });
        return out;
      }
      var nAll = ex.ckpts.map(function (c) { return c.nll; }).concat(P.nll.mean), nlo = Math.min.apply(null, nAll), nhi = Math.max.apply(null, nAll);
      var mAll = ex.ckpts.map(function (c) { return c.mid; }).concat(P.mid.mean), mlo = Math.min.apply(null, mAll), mhi = Math.max.apply(null, mAll);
      function drawSmall(hgt) {
        U.lineChart(c1, { height: hgt, table: false, title: 'Middle-window BTE (nats) · ' + dtitle(st.ck) + ': ' + fmt(ck.mid, 4), subtitle: 'dashed: ' + popName, margin: { r: 14, l: 50, b: 38 }, x: xspec, y: { domain: [mlo - 0.01, mhi + 0.01] }, series: ser('mid', '--accent'), tooltip: { title: dtitle, format: function (v) { return fmt(v, 4); } } });
        U.lineChart(c2, { height: hgt, table: false, title: 'Final-layer mean NLL (nats/token) · ' + dtitle(st.ck) + ': ' + fmt(ck.nll, 3), subtitle: 'dashed: ' + popName, margin: { r: 14, l: 50, b: 38 }, x: xspec, y: { domain: [Math.max(0, nlo - 0.15), nhi + 0.15] }, series: ser('nll', '--s1'), tooltip: { title: dtitle, format: function (v) { return fmt(v, 3); } } });
      }
      drawSmall(170);
      (function balance() { if (window.innerWidth < 860) return; var gap = 14, cardH = card.offsetHeight, sideH = side.offsetHeight; if (cardH > sideH + 4) drawSmall(Math.floor((cardH - gap) / 2)); else if (sideH > cardH + 4) card.style.minHeight = sideH + 'px'; })();
      var pc = html('div', 'chart', host);
      U.lineChart(pc, { height: 240, table: false, title: 'Depth profile of this response at the four checkpoints', subtitle: 'shaded: 12–19', margin: { r: 14 }, x: LAYER_X, y: { domain: [0, 0.36], label: 'BTE (nats)' }, bands: BAND,
        series: ex.ckpts.map(function (c, i) { var on = i === st.ck; return { name: dtitle(i), color: CKC(i), width: on ? 3 : 1.3, halo: on ? 11 : 0, points: pts(c.profile) }; }), tooltip: LAYER_TIP });
      if (TC) {
        html('p', 'note tight small', host, 'The solution cut into its steps (the labels in the text above); each row is the mean middle-window BTE of that step\'s tokens at each checkpoint. ▼ fell from the previous checkpoint, ▲ rose; the last column is the change from before fine-tuning to after 9,704.');
        table(host, ['step of the solution', 'before', 'after 1,000', 'after 5,000', 'after 9,704', 'change'], TC.spans.map(function (sp) {
          var cells = [sp.label + ' · tokens ' + sp.t0 + '–' + sp.t1];
          sp.byDose.forEach(function (v, i) { cells.push({ text: fmt(v, 4), mark: i ? (v > sp.byDose[i - 1] ? '▲' : '▼') : null, bad: i > 0 && v > sp.byDose[i - 1] }); });
          cells.push({ text: signed(100 * (sp.byDose[3] / sp.byDose[0] - 1), 1) + '%', cls: 'best' });
          return { cells: cells };
        }));
      }
      /* ---- all responses of the four styles: the paper's figure on the left, the change per style on the right ---- */
      html('h4', 'case-sub', host, 'All responses of the four styles through the same checkpoints');
      var two = html('div', 'two-col eq', host), f1 = html('figure', 'fig', two), f2 = html('figure', 'fig', two);
      var lg = html('div', 'legend', html('div', 'fig-head', f1)), ch = html('div', 'chart', f1);
      styleGroup.renders = [];
      styleGroup.renders.push(function () {
        U.lineChart(ch, { group: styleGroup, height: 260, table: false, title: 'Middle-window BTE across fine-tuning', subtitle: 'mean per style · bars: 95% CI', margin: { r: 14, l: 50, b: 40 }, x: xspec, y: { domain: [0.12, 0.18], label: 'mean BTE over layers 12–19 (nats)' },
          series: STYLE_ORDER.map(function (k) { var p = S.sets[k].pop.mid; return { name: STYLE_SHORT[k], color: cssVar(STYLE_COL[k]), width: k === st.set ? 2.6 : 1.6, markers: true, errors: true, hidden: !!styleGroup.hidden[STYLE_SHORT[k]], points: p.mean.map(function (v, i) { return { x: i, y: v, lo: v - p.ci[i], hi: v + p.ci[i] }; }) }; }),
          tooltip: { title: dtitle, format: function (v) { return fmt(v, 4); } } });
      });
      styleGroup.rerender();
      U.legend(lg, STYLE_ORDER.map(function (k) { return { name: STYLE_SHORT[k], color: cssVar(STYLE_COL[k]) }; }), styleGroup);
      html('figcaption', null, f1, 'The middle-window BTE falls on all four styles, in parallel.');
      var bg = html('div', 'tbl-wrap', f2);
      U.barGrid(bg, { rowLabel: 'median change after 9,704',
        cols: [{ key: 'bte', label: 'middle-window BTE', dec: 0, unit: '%', signed: true, best: 'min' }, { key: 'nll', label: 'final-layer NLL', dec: 0, unit: '%', signed: true, best: 'min', color: cssVar('--s1') }],
        rows: STYLE_ORDER.map(function (k) { var p = S.sets[k].pop; return { label: { prm800k: 'PRM800K · training style', math500: 'MATH-500', gsm8k: 'GSM8K', olympiad: 'OlympiadBench' }[k], color: cssVar(STYLE_COL[k]), hi: k === st.set, values: { bte: p.mid.medianPct[3], nll: p.nll.medianPct[3] } }; }) });
      html('figcaption', null, f2, 'BTE falls by 17–23% for every style. NLL falls only for the training style (−44%) and rises for every official solution (+17% to +38%), MATH-500 included: likelihood follows how the text is written; BTE follows what the scorer learned, whatever the style.');
      if (window.BTE_MATH) window.BTE_MATH(host);
    }

    function renderAll() { [renderProof, renderControls, renderDetect, renderAttrCase, renderStyle].forEach(function (f) { try { f(); } catch (err) { if (window.console) console.error(err); } }); if (window.BTE_MATH) window.BTE_MATH(document.body); }
    window.BTE_CASE_RENDER = renderAll;
    /* debug: ?det=<detection case key>&attrcase=A|B|C&train=0|1&ck=0..3&depth=1..5&style=prm800k|math500|gsm8k|olympiad&sck=1..3 preselect a case */
    var Q = {}; location.search.replace(/[?&]([^=&]+)=([^&]*)/g, function (_, k, v) { Q[k] = decodeURIComponent(v); return ''; });
    if (Q.det) detState.key = Q.det; if (Q.gen) detState.gen = Q.gen; if (Q.setting) detState.setting = Q.setting; if (Q.scorer) detState.scorer = Q.scorer; if (Q.apaper) attrState.paper = Q.apaper; if (Q.agen) attrState.gen = Q.agen; if (Q.attrcase) attrState.key = Q.attrcase; if (Q.train) trainState.idx = +Q.train; if (Q.ck) trainState.ck = +Q.ck; if (Q.depth) proofState.depth = +Q.depth; if (Q.style && STYLE_META[Q.style]) styleState.set = Q.style; if (Q.sck) styleState.ck = Math.max(1, Math.min(3, +Q.sck));
    renderAll();
  }
  if (window.BTE_UI) start(); else { var prev = window.BTE_CONTRAST_READY; window.BTE_CONTRAST_READY = function () { if (prev) prev(); start(); }; }
})();
