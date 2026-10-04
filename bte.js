/* Charts and the belief-trajectory animation for the BTE project page. Plain SVG, no dependencies. */
(function () {
  'use strict';
  var D = window.BTE_DATA;
  if (!D) return;
  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- small helpers ---------- */
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  /* token text: a newline inside a token is shown as ⏎ and the text keeps flowing, so every token stays a visible shaded block */
  function tokenFill(sp, tk, breaks) {
    if (tk.indexOf('\n') < 0) { sp.textContent = tk; return sp; }
    tk.split('\n').forEach(function (part, i) {
      if (i) { var nl = document.createElement('span'); nl.className = 'nl'; nl.textContent = '⏎'; sp.appendChild(nl); if (breaks) sp.appendChild(document.createTextNode('\n')); }   /* breaks: also break the line, for texts whose lines mean something */
      if (part) sp.appendChild(document.createTextNode(part));
    });
    return sp;
  }
  function html(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== null && text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function fmt(v, d) { return Number(v).toFixed(d); }
  function signed(v, d) {
    var s = fmt(Math.abs(v), d);
    if (Number(s) === 0) return s;
    return (v > 0 ? '+' : '−') + s;
  }
  function linear(d0, d1, r0, r1) {
    var f = function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); };
    f.invert = function (r) { return d0 + (r - r0) / (r1 - r0) * (d1 - d0); };
    return f;
  }
  function logScale(d0, d1, r0, r1) {
    var a = Math.log(d0), b = Math.log(d1);
    var f = function (v) { return r0 + (Math.log(v) - a) / (b - a) * (r1 - r0); };
    f.invert = function (r) { return Math.exp(a + (r - r0) / (r1 - r0) * (b - a)); };
    return f;
  }
  function niceTicks(lo, hi, n) {
    var span = hi - lo;
    if (!(span > 0)) return [lo];
    var raw = span / n, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), err = raw / mag, step = mag;
    if (err >= 7.5) step = 10 * mag; else if (err >= 3) step = 5 * mag; else if (err >= 1.5) step = 2 * mag;
    var out = [], k = Math.ceil(lo / step - 1e-9);
    for (; k * step <= hi + 1e-9; k++) out.push(k === 0 ? 0 : k * step);
    return out;
  }
  function decimals(ticks) {
    if (ticks.length < 2) return 2;
    var step = Math.abs(ticks[1] - ticks[0]);
    return Math.max(0, Math.ceil(-Math.log(step) / Math.LN10 - 1e-9));
  }
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mix(a, b, t) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')'; }
  function relLum(c) { var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
  function heatColor(t) {
    /* sequential ramp from the page background to the theme's ink: more revision = more ink (darker on the light theme, whiter on the dark theme) */
    t = Math.max(0, Math.min(1, t));
    var lo = hexToRgb(cssVar('--heat-lo')), md = hexToRgb(cssVar('--heat-mid')), hi = hexToRgb(cssVar('--heat-hi'));
    var a = t < 0.5 ? lo : md, b = t < 0.5 ? md : hi, k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    var c = [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * k); });
    return { bg: 'rgb(' + c.join(',') + ')', fg: relLum(c) > 0.3 ? '#1F1E1D' : '#FAF9F5', rgb: c };
  }
  function heatGradient() { return 'linear-gradient(90deg,' + heatColor(0).bg + ',' + heatColor(0.5).bg + ',' + heatColor(1).bg + ')'; }
  function placeTip(tip, host, e) {
    var hb = host.getBoundingClientRect();
    var px = e.clientX - hb.left, py = e.clientY - hb.top;
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = px + 14;
    if (left + tw > hb.width - 4) left = px - tw - 14;
    if (left < 0) left = 4;
    var top = py - th / 2;
    if (top < 0) top = 4;
    if (top + th > hb.height) top = Math.max(4, hb.height - th - 4);
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  /* ---------- table view attached below a chart ---------- */
  function attachTable(host, build) {
    var tools = host.nextElementSibling;
    if (!tools || !tools.classList.contains('chart-tools')) {
      tools = html('div', 'chart-tools');
      host.parentNode.insertBefore(tools, host.nextSibling);
      var btn = html('button', 'btn', tools, 'Show table');
      btn.type = 'button';
      var box = html('div', 'chart-table');
      box.hidden = true;
      tools.parentNode.insertBefore(box, tools.nextSibling);
      btn.addEventListener('click', function () {
        box.hidden = !box.hidden;
        btn.textContent = box.hidden ? 'Show table' : 'Hide table';
        if (!box.hidden) { clear(box); box.appendChild(tools._build()); }
      });
      tools._box = box;
    }
    tools._build = build;
    if (!tools._box.hidden) { clear(tools._box); tools._box.appendChild(build()); }
  }
  function seriesTable(spec, visible, xfmt) {
    var wrap = html('div', 'tbl-wrap');
    var t = html('table', 'tbl', wrap);
    var tr = html('tr', null, html('thead', null, t));
    html('th', null, tr, spec.x.label || '');
    visible.forEach(function (s) { html('th', 'num', tr, s.name); });
    var xsAll = [];
    visible.forEach(function (s) { s.points.forEach(function (p) { if (xsAll.indexOf(p.x) < 0) xsAll.push(p.x); }); });
    xsAll.sort(function (a, b) { return a - b; });
    var tb = html('tbody', null, t);
    xsAll.forEach(function (xv) {
      var r = html('tr', null, tb);
      html('td', null, r, spec.tooltip && spec.tooltip.title ? spec.tooltip.title(xv) : xfmt(xv));
      visible.forEach(function (s) {
        var p = null;
        for (var j = 0; j < s.points.length; j++) if (s.points[j].x === xv) { p = s.points[j]; break; }
        html('td', 'num', r, p ? (spec.tooltip && spec.tooltip.format ? spec.tooltip.format(p.y, p) : fmt(p.y, 4)) : '');
      });
    });
    return wrap;
  }

  /* ---------- legend groups (hover highlights, click hides) ---------- */
  function makeGroup() {
    var g = { renders: [], hidden: {}, svgs: [] };
    g.rerender = function () { g.svgs = []; g.renders.forEach(function (r) { r(); }); };
    g.focus = function (name) {
      g.svgs.forEach(function (s) {
        if (name) {
          s.classList.add('has-focus');
          var items = s.querySelectorAll('.series');
          for (var i = 0; i < items.length; i++) items[i].classList.toggle('focus', items[i].getAttribute('data-name') === name);
        } else {
          s.classList.remove('has-focus');
        }
      });
    };
    return g;
  }
  function legend(host, items, group) {
    if (!host) return;
    clear(host);
    items.forEach(function (it) {
      if (it.group) { html('span', 'group', host, it.group); return; }
      var off = !!group.hidden[it.name];
      var b = html('button', 'item' + (off ? ' off' : ''), host);
      b.type = 'button';
      b.setAttribute('aria-pressed', off ? 'false' : 'true');
      var key = html('span', 'key' + (it.dash ? ' dash' : ''), b);
      key.style.borderTopColor = it.color;
      html('span', 'name', b, it.name);
      var on = function () { if (!group.hidden[it.name]) group.focus(it.name); };
      var offf = function () { group.focus(null); };
      b.addEventListener('mouseenter', on); b.addEventListener('mouseleave', offf);
      b.addEventListener('focus', on); b.addEventListener('blur', offf);
      b.addEventListener('click', function () {
        group.hidden[it.name] = !group.hidden[it.name];
        group.rerender();
      });
    });
  }

  /* ---------- generic line chart ---------- */
  var clipId = 0;
  function lineChart(host, spec) {
    clear(host);
    var W = Math.max(240, Math.floor(host.clientWidth || (host.parentNode && host.parentNode.clientWidth) || 600));
    var H = spec.height || Math.round(Math.max(210, Math.min(330, W * 0.46)));
    var m = { t: (spec.title || spec.subtitle) ? 28 : 12, r: 14, b: spec.x.label ? 42 : 28, l: spec.y.label ? 54 : 44 };
    if (spec.margin) for (var k in spec.margin) m[k] = spec.margin[k];
    var pw = W - m.l - m.r, ph = H - m.t - m.b;
    var xd = spec.x.domain, yd = spec.y.domain;
    var xs = spec.x.type === 'log' ? logScale(xd[0], xd[1], m.l, m.l + pw) : linear(xd[0], xd[1], m.l, m.l + pw);
    var ys = linear(yd[0], yd[1], m.t + ph, m.t);
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': spec.aria || spec.title || 'line chart' }, host);
    if (spec.group) spec.group.svgs.push(el);
    var cid = 'clip' + (++clipId), glowId = null;
    var defs = svg('defs', {}, el);
    svg('rect', { x: m.l, y: m.t - 6, width: pw, height: ph + 6 }, svg('clipPath', { id: cid }, defs));

    (spec.bands || []).forEach(function (b) {
      svg('rect', { x: xs(b.x0), y: m.t, width: xs(b.x1) - xs(b.x0), height: ph, class: 'band' }, el);
    });
    var yt = spec.y.ticks || niceTicks(yd[0], yd[1], spec.small ? 4 : 5);
    var ydec = decimals(yt);
    var yfmt = spec.y.format || function (v) { return fmt(v, ydec); };
    var grid = svg('g', { class: 'grid' }, el);
    yt.forEach(function (v) {
      var y = ys(v);
      svg('line', { x1: m.l, x2: m.l + pw, y1: y, y2: y }, grid);
      svg('text', { x: m.l - 7, y: y + 3.5, 'text-anchor': 'end', class: 'tick' }, el).textContent = yfmt(v);
    });
    (spec.refLines || []).forEach(function (r) {
      if (r.y >= yd[0] && r.y <= yd[1]) svg('line', { x1: m.l, x2: m.l + pw, y1: ys(r.y), y2: ys(r.y), class: 'ref' }, el);
    });
    svg('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, class: 'axis' }, el);
    var xt = spec.x.ticks || niceTicks(xd[0], xd[1], 6);
    var xfmt = spec.x.format || function (v) { return String(v); };
    xt.forEach(function (v) {
      var x = xs(v);
      svg('line', { x1: x, x2: x, y1: m.t + ph, y2: m.t + ph + 4, class: 'axis' }, el);
      svg('text', { x: x, y: m.t + ph + 15, 'text-anchor': 'middle', class: 'tick' }, el).textContent = xfmt(v);
    });
    if (spec.x.label) svg('text', { x: m.l + pw / 2, y: H - 5, 'text-anchor': 'middle', class: 'label' }, el).textContent = spec.x.label;
    if (spec.y.label) svg('text', { x: 13, y: m.t + ph / 2, 'text-anchor': 'middle', class: 'label', transform: 'rotate(-90 13 ' + (m.t + ph / 2) + ')' }, el).textContent = spec.y.label;
    if (spec.title) svg('text', { x: m.l, y: 15, class: 'title' }, el).textContent = spec.title;
    if (spec.subtitle && W >= 560) svg('text', { x: m.l + pw, y: 15, 'text-anchor': 'end', class: 'subtitle' }, el).textContent = spec.subtitle;

    var visible = spec.series.filter(function (s) { return !s.hidden; });
    var layer = svg('g', { 'clip-path': 'url(#' + cid + ')' }, el);
    visible.forEach(function (s) {
      var g = svg('g', { class: 'series', 'data-name': s.name }, layer);
      if (s.opacity != null) g.style.opacity = s.opacity;
      if (!s.noLine && s.points.length > 1) {
        var d = s.points.map(function (p, i) { return (i ? 'L' : 'M') + fmt(xs(p.x), 1) + ',' + fmt(ys(p.y), 1); }).join(' ');
        if (s.halo) {   /* a blurred copy of the line underneath: the stroke fades out with a Gaussian edge */
          if (!glowId) { glowId = 'glow' + cid; var fl = svg('filter', { id: glowId, filterUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs); svg('feGaussianBlur', { stdDeviation: 4 }, fl); }
          var hp = svg('path', { d: d, stroke: s.color, class: 'halo', filter: 'url(#' + glowId + ')' }, g); hp.style.strokeWidth = s.halo + 'px';
        }
        var pth = svg('path', { d: d, stroke: s.color, 'stroke-dasharray': s.dash ? '6 4' : null }, g);
        if (s.width) pth.style.strokeWidth = s.width + 'px';
      }
      if (s.errors) s.points.forEach(function (p) {
        if (p.lo === undefined) return;
        svg('line', { x1: xs(p.x), x2: xs(p.x), y1: ys(p.lo), y2: ys(p.hi), stroke: s.color, class: 'err' }, g);
      });
      if (s.markers) s.points.forEach(function (p) {
        if (s.ring) svg('circle', { cx: xs(p.x), cy: ys(p.y), r: (s.r || 4) + 5, stroke: s.color, class: 'ring' }, g);
        svg('circle', { cx: xs(p.x), cy: ys(p.y), r: s.r || 4, fill: s.color, class: 'dot' }, g);
      });
    });

    /* hover: crosshair snaps to the nearest x, tooltip lists every visible series */
    var xsAll = [];
    visible.forEach(function (s) { s.points.forEach(function (p) { if (xsAll.indexOf(p.x) < 0) xsAll.push(p.x); }); });
    xsAll.sort(function (a, b) { return a - b; });
    var hoverG = svg('g', { visibility: 'hidden' }, el);
    var cross = svg('line', { y1: m.t, y2: m.t + ph, class: 'crosshair' }, hoverG);
    var dots = visible.map(function (s) { return svg('circle', { r: 4.5, fill: s.color, class: 'hover-dot' }, hoverG); });
    var tip = html('div', 'tip', host);
    tip.hidden = true;
    var hit = svg('rect', { x: m.l, y: m.t, width: pw, height: ph, class: 'hit' }, el);
    function show(xv, e) {
      hoverG.setAttribute('visibility', 'visible');
      cross.setAttribute('x1', xs(xv)); cross.setAttribute('x2', xs(xv));
      clear(tip);
      html('div', 't', tip, spec.tooltip && spec.tooltip.title ? spec.tooltip.title(xv) : xfmt(xv));
      var rows = [];
      visible.forEach(function (s, i) {
        var p = null;
        for (var j = 0; j < s.points.length; j++) if (s.points[j].x === xv) { p = s.points[j]; break; }
        if (!p) { dots[i].setAttribute('visibility', 'hidden'); return; }
        dots[i].setAttribute('visibility', 'visible');
        dots[i].setAttribute('cx', xs(p.x)); dots[i].setAttribute('cy', ys(p.y));
        rows.push({ s: s, p: p });
      });
      rows.sort(function (a, b) { return b.p.y - a.p.y; });
      rows.forEach(function (r) {
        var row = html('div', 'row', tip);
        var key = html('span', 'k' + (r.s.dash ? ' dash' : ''), row);
        key.style.borderTopColor = r.s.color;
        html('span', 'v', row, spec.tooltip && spec.tooltip.format ? spec.tooltip.format(r.p.y, r.p) : yfmt(r.p.y));
        html('span', 'n', row, r.s.name);
      });
      tip.hidden = false;
      placeTip(tip, host, e);
    }
    hit.addEventListener('pointermove', function (e) {
      var pt = el.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      var loc = pt.matrixTransform(el.getScreenCTM().inverse());
      var best = xsAll[0], bd = Infinity;
      xsAll.forEach(function (v) { var d = Math.abs(xs(v) - loc.x); if (d < bd) { bd = d; best = v; } });
      if (best !== undefined) show(best, e);
    });
    hit.addEventListener('pointerleave', function () { hoverG.setAttribute('visibility', 'hidden'); tip.hidden = true; });
    if (spec.table !== false) attachTable(host, function () { return seriesTable(spec, visible, xfmt); });
    return el;
  }

  function wireSeg(id, attr, onChange) {
    var seg = document.getElementById(id);
    if (!seg) return;
    var btns = seg.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        for (var j = 0; j < btns.length; j++) btns[j].setAttribute('aria-pressed', btns[j] === this ? 'true' : 'false');
        onChange(this.getAttribute(attr));
      });
    }
  }

  /* ================= 2. human vs LLM: generator profiles ================= */
  var GEN = D.sources.slice(1);
  var GEN_STYLE = {
    'GPT-4o': ['--legacy-1', false], 'Gemini 1.5 Pro': ['--legacy-2', false], 'Claude 3.5 Sonnet': ['--legacy-3', false],
    'GPT-5.5': ['--new-1', true], 'GPT-5.6': ['--new-2', true], 'Gemini 3.1 Pro': ['--new-3', true], 'Claude Opus 5': ['--new-4', true]
  };
  var SCORER_NAME = { llama: 'Llama-3.1-8B-Instruct', qwen: 'Qwen-3.5-9B' };
  var genGroup = makeGroup(), genScorer = 'llama';
  function renderGenerators() {
    var host = document.getElementById('chart-generators');
    if (!host) return;
    var prof = D.generators[genScorer], human = prof.Human;
    var series = GEN.map(function (g) {
      var st = GEN_STYLE[g];
      return { name: g, color: cssVar(st[0]), dash: st[1], hidden: !!genGroup.hidden[g],
        points: prof[g].map(function (v, l) { return { x: l, y: 100 * (v - human[l]) / human[l], abs: v }; }) };
    });
    lineChart(host, {
      group: genGroup, height: Math.round(Math.max(240, Math.min(340, host.clientWidth * 0.42))),
      x: { domain: [0, 31], ticks: [0, 5, 10, 15, 20, 25, 30], label: 'layer transition ℓ → ℓ+1' },
      y: { domain: [-45, 35], ticks: [-40, -30, -20, -10, 0, 10, 20, 30], label: 'generated − human (%)', format: function (v) { return signed(v, 0); } },
      bands: [{ x0: 12, x1: 19 }], refLines: [{ y: 0 }],
      subtitle: SCORER_NAME[genScorer] + ' scorer', series: series,
      tooltip: { title: function (x) { return 'layer ' + x + ' → ' + (x + 1) + ' · human e(ℓ) = ' + fmt(human[x], 3); },
        format: function (v) { return signed(v, 1) + '%'; } }
    });
    legend(document.getElementById('gen-legend'), [{ group: 'legacy' }].concat(GEN.slice(0, 3).map(function (g) { return { name: g, color: cssVar(GEN_STYLE[g][0]) }; }), [{ group: 'newer' }], GEN.slice(3).map(function (g) { return { name: g, color: cssVar(GEN_STYLE[g][0]), dash: true }; })), genGroup);
  }
  genGroup.renders.push(renderGenerators);
  wireSeg('gen-scorer', 'data-scorer', function (v) { genScorer = v; renderGenerators(); });

  /* ================= 1. difficulty small multiples ================= */
  var DIFF_SCORERS = [
    { key: 'Llama-3.1-8B-Instruct', name: 'Llama-3.1-8B-Instruct (main)', color: '--s1' },
    { key: 'DeepSeek-R1-Distill-Llama-8B', name: 'DeepSeek-R1-Distill-Llama-8B', color: '--s2' },
    { key: 'Nemotron-Nano-8B', name: 'Nemotron-Nano-8B', color: '--s3' },
    { key: 'OpenMath2-Llama-3.1-8B', name: 'OpenMath2-Llama-3.1-8B', color: '--s4' }
  ];
  var PROB_NAME = 'Llama, problem statement only';
  var diffGroup = makeGroup();
  function renderDifficulty() {
    var host = document.getElementById('chart-difficulty');
    if (!host) return;
    clear(host);
    D.benchmarks.forEach(function (b) {
      var panel = html('div', 'panel chart', host);
      var series = DIFF_SCORERS.map(function (s) {
        var vals = D.difficulty.scorers[s.key][b.key];
        return { name: s.name, color: cssVar(s.color), markers: true, hidden: !!diffGroup.hidden[s.name],
          points: vals.map(function (v, i) { return { x: i, y: v - vals[0], abs: v }; }) };
      });
      var po = D.difficulty.problemOnly[b.key];
      series.push({ name: PROB_NAME, color: cssVar('--s1'), dash: true, markers: true, hidden: !!diffGroup.hidden[PROB_NAME],
        points: po.map(function (v, i) { return { x: i, y: v - po[0], abs: v }; }) });
      var ys = [0];
      series.forEach(function (s) { if (!s.hidden) s.points.forEach(function (p) { ys.push(p.y); }); });
      var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
      if (hi - lo < 1e-6) hi = lo + 0.01;
      var pad = (hi - lo) * 0.15;
      var rho = D.difficultyRho[b.key];
      lineChart(panel, {
        group: diffGroup, height: 205, small: true, table: false, margin: { r: 10 },
        title: b.short || b.title, subtitle: 'ρ ' + fmt(rho.llama[0], 2) + ' [' + fmt(rho.llama[1], 2) + ', ' + fmt(rho.llama[2], 2) + ']',
        x: { domain: [0, b.levels.length - 1], ticks: b.levels.map(function (_, i) { return i; }), format: function (i) { return b.levels[i]; }, label: b.xlabel },
        y: { domain: [lo - pad, hi + pad], format: function (v) { return signed(v, 3); } },
        refLines: [{ y: 0 }], series: series,
        tooltip: { title: function (x) { return b.title + ' · ' + b.xlabel + ' ' + b.levels[x]; }, format: function (v, p) { return signed(v, 4) + '  (ē = ' + fmt(p.abs, 3) + ')'; } }
      });
    });
    legend(document.getElementById('diff-legend'),
      DIFF_SCORERS.map(function (s) { return { name: s.name, color: cssVar(s.color) }; }).concat([{ name: PROB_NAME, color: cssVar('--s1'), dash: true }]), diffGroup);
    attachTable(host, function () {
      var wrap = html('div', 'tbl-wrap');
      var t = html('table', 'tbl', wrap);
      var tr = html('tr', null, html('thead', null, t));
      html('th', null, tr, 'Benchmark'); html('th', null, tr, 'Level');
      DIFF_SCORERS.forEach(function (s) { html('th', 'num', tr, s.name); });
      html('th', 'num', tr, PROB_NAME);
      var tb = html('tbody', null, t);
      D.benchmarks.forEach(function (b) {
        b.levels.forEach(function (lv, i) {
          var r = html('tr', null, tb);
          html('td', null, r, i === 0 ? b.title : '');
          html('td', null, r, lv);
          DIFF_SCORERS.forEach(function (s) { html('td', 'num', r, fmt(D.difficulty.scorers[s.key][b.key][i], 4)); });
          html('td', 'num', r, fmt(D.difficulty.problemOnly[b.key][i], 4));
        });
      });
      html('p', 'note tight', wrap, 'Mean BTE over layers 12–19 (nats) per level; the chart shows each column minus its first row.');
      return wrap;
    });
  }
  diffGroup.renders.push(renderDifficulty);

  function renderRhoTable() {
    var host = document.getElementById('table-rho');
    if (!host) return;
    clear(host);
    var t = html('table', 'tbl', host);
    var tr = html('tr', null, html('thead', null, t));
    ['Benchmark', 'Llama-3.1-8B (95% CI)', 'Llama, problem only', 'DeepSeek-R1-Distill', 'Nemotron-Nano', 'OpenMath2', 'Mistral-7B'].forEach(function (h, i) { html('th', i ? 'num' : null, tr, h); });
    var tb = html('tbody', null, t);
    D.benchmarks.forEach(function (b) {
      var rho = D.difficultyRho[b.key];
      var r = html('tr', null, tb);
      html('td', null, r, b.title);
      var c = html('td', 'num best', r, fmt(rho.llama[0], 2));
      html('span', 'sub', c, '[' + fmt(rho.llama[1], 2) + ', ' + fmt(rho.llama[2], 2) + ']');
      ['problem', 'deepseek', 'nemotron', 'openmath2', 'mistral'].forEach(function (k) {
        html('td', 'num' + (rho[k] < 0 ? ' neg' : ''), r, signed(rho[k], 2));
      });
    });
    html('p', 'note tight', host, 'Item-level Spearman ρ between the middle-layer readout and the difficulty label. Negative values mark the cross-benchmark reversal discussed above.');
  }

  /* ================= detection tables ================= */
  function renderDetectionTable() {
    var host = document.getElementById('table-detection');
    if (!host) return;
    clear(host);
    var t = html('table', 'tbl dense', host);
    var tr = html('tr', null, html('thead', null, t));
    html('th', null, tr, 'Detector');
    D.detection.generators.forEach(function (g) { html('th', 'num', tr, g); });
    html('th', 'num', tr, 'Avg.'); html('th', 'num', tr, 'Avg., human reviews rewritten');
    var tb = html('tbody', null, t);
    var last = null;
    var labels = { baseline: 'Reference detectors, no BTE training', A: 'BTE, setting ' + D.detection.settings.A, B: 'BTE, setting ' + D.detection.settings.B, C: 'BTE, setting ' + D.detection.settings.C };
    D.detection.rows.forEach(function (r) {
      if (r.group !== last) { var gr = html('tr', 'group', tb); var td = html('td', null, gr, labels[r.group]); td.colSpan = 10; last = r.group; }
      var row = html('tr', null, tb);
      html('td', null, row, r.name);
      var cell = function (v, bold) {
        var c = html('td', 'heat', row, fmt(v, 3));
        var col = heatColor(Math.max(0, (v - 0.5) / 0.5));
        c.style.background = col.bg; c.style.color = col.fg;
        if (bold) c.style.fontWeight = '600';
      };
      r.values.forEach(function (v) { cell(v, false); });
      cell(r.avg, true); cell(r.rewriteAvg, true);
    });
  }
  function renderFamiliarityTable() {
    var host = document.getElementById('table-familiarity');
    if (!host) return;
    clear(host);
    var t = html('table', 'tbl', host);
    var tr = html('tr', null, html('thead', null, t));
    ['Scorer', 'NLL, human', 'NLL, generated', 'Gap', 'Mid-depth BTE deficit', 'AUROC, setting B', 'AUROC, setting C'].forEach(function (h, i) { html('th', i ? 'num' : null, tr, h); });
    var tb = html('tbody', null, t);
    D.familiarity.forEach(function (f) {
      var r = html('tr', null, tb);
      var c = html('td', null, r, f.scorer); html('span', 'sub', c, String(f.year));
      html('td', 'num', r, fmt(f.nllHuman, 3)); html('td', 'num', r, fmt(f.nllGen, 3));
      html('td', 'num', r, '−' + fmt(f.gap, 1) + '%'); html('td', 'num', r, signed(f.deficit, 0) + '%');
      html('td', 'num', r, fmt(f.B, 3)); html('td', 'num', r, fmt(f.C, 3));
    });
    html('p', 'note tight', host, 'Scorer familiarity in the review-only setting (no paper in the context). NLL is the mean final-layer next-token negative log-likelihood (nats) of human and generated reviews of the same papers; the gap is the relative reduction for generated reviews. The deficit is the mean energy of legacy-generator reviews relative to human reviews over the middle third of layers. AUROC values are for the full 32-D detector in that setting.');
  }
  function renderPreferenceTable() {
    var host = document.getElementById('table-preference');
    if (!host) return;
    clear(host);
    var t = html('table', 'tbl dense', host);
    var tr = html('tr', null, html('thead', null, t));
    ['Generator', 'Model wins / ties / human wins', 'Preference score (95% CI)', 'Mid-layer BTE vs human, Llama scorer', 'Mid-layer BTE vs human, Qwen scorer'].forEach(function (h, i) { html('th', i >= 3 ? 'num' : null, tr, h); });
    var tb = html('tbody', null, t);
    function shift(scorer, g) {
      var prof = D.generators[scorer], h = prof.Human, e = prof[g], a = 0, b = 0;
      for (var l = 12; l <= 19; l++) { a += e[l]; b += h[l]; }
      return 100 * (a / b - 1);
    }
    D.preference.slice().sort(function (a, b) { return b.p - a.p; }).forEach(function (p) {
      var r = html('tr', null, tb);
      var c = html('td', null, r, p.g); html('span', 'sub', c, GEN.indexOf(p.g) < 3 ? 'legacy' : 'newer');
      html('td', null, r, p.w + ' / ' + p.t + ' / ' + p.h);
      var bc = html('td', null, r);
      var wrap = html('span', 'barcell', bc);
      var track = html('span', 'track', wrap);
      var bar = html('span', 'bar', track); bar.style.width = (p.p * 100) + '%';
      var ci = html('span', 'ci', track); ci.style.left = (p.ci[0] * 100) + '%'; ci.style.width = ((p.ci[1] - p.ci[0]) * 100) + '%';
      var mid = html('span', 'mid', track); mid.style.left = '50%';
      html('span', null, wrap, fmt(p.p, 3) + ' [' + fmt(p.ci[0], 2) + ', ' + fmt(p.ci[1], 2) + ']');
      var sl = shift('llama', p.g), sq = shift('qwen', p.g);
      html('td', 'num' + (sl < 0 ? ' neg' : ''), r, signed(sl, 1) + '%');
      html('td', 'num' + (sq < 0 ? ' neg' : ''), r, signed(sq, 1) + '%');
    });
    html('p', 'note tight', host, 'Sorted by preference score; the vertical mark on each bar is parity (0.5). Across the seven generators, the paper reports Spearman ρ = 0.857 between the preference score and the signed middle-layer BTE shift (ρ = 0.786 under Llama alone, 0.857 under Qwen alone).');
  }
  function renderAttributionTable() {
    var host = document.getElementById('table-attribution');
    if (!host) return;
    clear(host);
    var t = html('table', 'tbl dense', host);
    var tr = html('tr', null, html('thead', null, t));
    ['Per-layer features', 'Llama-3.1-8B', 'Qwen-3.5-9B'].forEach(function (h, i) { html('th', i ? 'num' : null, tr, h); });
    var tb = html('tbody', null, t);
    var prev = null;
    D.attribution.forEach(function (a, i) {
      var r = html('tr', null, tb);
      var f = html('td', null, r, a.features);
      html('span', 'sub', f, a.dim + '-D');
      ['llama', 'qwen'].forEach(function (k, j) {
        var c = html('td', 'num' + (i === D.attribution.length - 1 ? ' best' : ''), r);
        var wrap = html('span', 'barcell', c);
        var track = html('span', 'track short', wrap);
        var bar = html('span', 'bar', track); bar.style.width = a[k] + '%'; bar.style.background = cssVar(j ? '--s2' : '--s1');
        html('span', null, wrap, fmt(a[k], 1));
        html('span', 'sub', wrap, prev ? signed(a[k] - prev[k], 1) : '\u00a0');
      });
      prev = a;
    });
  }

  /* ================= 3. attribution confusion heatmap ================= */
  var confScorer = 'llama', confFeat = '352D';
  var SHORT = ['Human', 'GPT-4o', 'Gemini 1.5', 'Claude 3.5', 'GPT-5.5', 'GPT-5.6', 'Gemini 3.1', 'Opus 5'];
  function renderConfusion() {
    var host = document.getElementById('chart-confusion');
    if (!host) return;
    clear(host);
    var M = D.confusion[confScorer][confFeat], n = M.length;
    var W = Math.max(260, Math.floor(host.clientWidth || 420));
    var left = 82, top = 74, right = 6, bottom = 6;
    var cell = Math.max(22, Math.min(48, Math.floor((W - left - right) / n)));
    var H = top + cell * n + bottom;
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'Confusion matrix of eight-way source attribution' }, host);
    svg('text', { x: left + cell * n / 2, y: 12, 'text-anchor': 'middle', class: 'label' }, el).textContent = 'predicted source · ' + SCORER_NAME[confScorer] + ' scorer, ' + (confFeat === '32D' ? '32-D profile' : '352-D features');
    svg('text', { x: 12, y: top + cell * n / 2, 'text-anchor': 'middle', class: 'label', transform: 'rotate(-90 12 ' + (top + cell * n / 2) + ')' }, el).textContent = 'true source';
    var tip = html('div', 'tip', host);
    tip.hidden = true;
    for (var j = 0; j < n; j++) {
      var cx = left + j * cell + cell / 2 + 3, cy = top - 7;
      svg('text', { x: cx, y: cy, class: 'tick', 'text-anchor': 'start', transform: 'rotate(-38 ' + cx + ' ' + cy + ')' }, el).textContent = SHORT[j];
    }
    var rows = [];
    for (var i = 0; i < n; i++) {
      svg('text', { x: left - 8, y: top + i * cell + cell / 2 + 3.5, 'text-anchor': 'end', class: 'tick' }, el).textContent = SHORT[i];
      var rowSum = M[i].reduce(function (a, b) { return a + b; }, 0);
      rows.push(rowSum);
      for (var j2 = 0; j2 < n; j2++) (function (i, j) {
        var frac = M[i][j] / rowSum;
        var col = heatColor(Math.sqrt(frac));
        var r = svg('rect', { x: left + j * cell, y: top + i * cell, width: cell, height: cell, fill: col.bg, class: 'cell' }, el);
        if (frac >= 0.01 && cell >= 26) {
          var tx = svg('text', { x: left + j * cell + cell / 2, y: top + i * cell + cell / 2 + 3.5, 'text-anchor': 'middle', class: 'cell-label' }, el);
          tx.style.fill = col.fg;
          tx.textContent = frac >= 0.995 ? '100' : fmt(100 * frac, frac >= 0.1 ? 0 : 1);
        }
        r.addEventListener('pointermove', function (e) {
          clear(tip);
          html('div', 't', tip, 'true ' + D.sources[i] + ' → predicted ' + D.sources[j]);
          var row = html('div', 'row', tip);
          html('span', 'v', row, fmt(100 * frac, 1) + '%');
          html('span', 'n', row, M[i][j].toLocaleString() + ' of ' + rowSum.toLocaleString());
          tip.hidden = false;
          placeTip(tip, host, e);
        });
        r.addEventListener('pointerleave', function () { tip.hidden = true; });
      })(i, j2);
    }
    attachTable(host, function () {
      var wrap = html('div', 'tbl-wrap');
      var t = html('table', 'tbl', wrap);
      var tr = html('tr', null, html('thead', null, t));
      html('th', null, tr, 'true ↓ / predicted →');
      SHORT.forEach(function (s) { html('th', 'num', tr, s); });
      var tb = html('tbody', null, t);
      M.forEach(function (row, i) {
        var r = html('tr', null, tb);
        html('td', null, r, D.sources[i]);
        row.forEach(function (v) { html('td', 'num', r, fmt(100 * v / rows[i], 1)); });
      });
      html('p', 'note tight', wrap, 'Percent of each true source’s ' + rows[0].toLocaleString() + ' held-out reviews.');
      return wrap;
    });
  }
  /* accuracy against the feature set, both scorers; the selected scorer is the solid line and the selected feature set is ringed */
  var FEAT_X = { '32D': 0, '352D': 3 };
  function renderAttrAcc() {
    var host = document.getElementById('chart-attr-acc'); if (!host || !D.attribution) return;
    clear(host);
    var conf = document.getElementById('chart-confusion'), csvg = conf && conf.querySelector('svg');
    var W = Math.max(260, Math.floor(host.clientWidth || 420));
    var H = csvg ? Math.round(csvg.getBoundingClientRect().height) || 420 : 420;
    var m = { t: 30, r: 22, b: 54, l: 46 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var rows = D.attribution, n = rows.length;
    var xs = linear(-0.35, n - 0.65, m.l, m.l + pw), ys = linear(84, 98, m.t + ph, m.t);
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'Eight-way attribution accuracy as token-level statistics are added' }, host);
    svg('text', { x: m.l, y: 15, class: 'title' }, el).textContent = 'Eight-way accuracy as statistics are added';
    var grid = svg('g', { class: 'grid' }, el);
    [86, 88, 90, 92, 94, 96].forEach(function (v) { svg('line', { x1: m.l, x2: m.l + pw, y1: ys(v), y2: ys(v) }, grid); svg('text', { x: m.l - 7, y: ys(v) + 3.5, 'text-anchor': 'end', class: 'tick' }, el).textContent = v + '%'; });
    svg('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, class: 'axis' }, el);
    var short = ['mean', '+ spread', '+ position', '+ dynamics'];
    rows.forEach(function (r, i) {
      svg('text', { x: xs(i), y: m.t + ph + 15, 'text-anchor': 'middle', class: 'tick' }, el).textContent = short[i];
      svg('text', { x: xs(i), y: m.t + ph + 28, 'text-anchor': 'middle', class: 'tick' }, el).textContent = r.dim + '-D';
    });
    svg('text', { x: m.l + pw / 2, y: H - 6, 'text-anchor': 'middle', class: 'label' }, el).textContent = 'per-layer features of the token-level BTE';
    [['llama', '--lv-5', 'Llama-3.1-8B'], ['qwen', '--lv-2', 'Qwen-3.5-9B']].forEach(function (p) {
      var on = p[0] === confScorer, col = cssVar(p[1]);
      var g = svg('g', { class: 'series' }, el); if (!on) g.style.opacity = 0.45;
      var d = rows.map(function (r, i) { return (i ? 'L' : 'M') + fmt(xs(i), 1) + ',' + fmt(ys(r[p[0]]), 1); }).join(' ');
      var pth = svg('path', { d: d, stroke: col, 'stroke-dasharray': on ? null : '5 4' }, g); pth.style.strokeWidth = on ? '2.6px' : '1.6px';
      rows.forEach(function (r, i) {
        var sel = on && FEAT_X[confFeat] === i;
        if (sel) svg('circle', { cx: xs(i), cy: ys(r[p[0]]), r: 10, stroke: col, class: 'ring' }, g);
        svg('circle', { cx: xs(i), cy: ys(r[p[0]]), r: sel ? 5.5 : 4, fill: col, class: 'dot' }, g);
        var lab = svg('text', { x: xs(i), y: ys(r[p[0]]) + (p[0] === 'qwen' ? -12 : 20), 'text-anchor': 'middle', class: 'tick' + (on ? ' strong' : '') }, g);
        lab.textContent = fmt(r[p[0]], 1) + (i ? ' (' + signed(r[p[0]] - rows[i - 1][p[0]], 1) + ')' : '');
      });
      var lx = m.l + 8, ly = m.t + 14 + (p[0] === 'qwen' ? 0 : 16);
      svg('line', { x1: lx, x2: lx + 18, y1: ly - 4, y2: ly - 4, stroke: col, 'stroke-dasharray': on ? null : '5 4' }, g).style.strokeWidth = on ? '2.6px' : '1.6px';
      svg('text', { x: lx + 24, y: ly, class: 'tick' + (on ? ' strong' : '') }, g).textContent = p[2] + (on ? ' · selected' : '');
    });
  }
  function renderConfusionBlock() { renderConfusion(); renderAttrAcc(); }
  wireSeg('conf-scorer', 'data-scorer', function (v) { confScorer = v; renderConfusionBlock(); });
  wireSeg('conf-feat', 'data-feat', function (v) { confFeat = v; renderConfusionBlock(); });

  /* ================= 4. familiarity: pretraining and fine-tuning ================= */
  var OLMO_SEL = ['1B', '5B', '21B', '51B', '101B', '198B', '0.5T', '1T', '2T', 'final (annealed)'];
  var olmoGroup = makeGroup();
  function olmoByLabel() { var m = {}; D.olmo.forEach(function (o) { m[o.label] = o; }); return m; }
  function renderOlmoProfiles() {
    var host = document.getElementById('chart-olmo-profiles');
    if (!host) return;
    var by = olmoByLabel();
    function pts(o) { return o.profile.map(function (v, l) { return { x: l, y: v }; }); }
    var series = [{ name: 'Gaussian init, same architecture', color: cssVar('--muted'), dash: true, points: pts(by['Random init']) }];
    OLMO_SEL.forEach(function (lab, i) {
      var name = lab === 'final (annealed)' ? 'OLMo-2 final, 4T annealed' : 'OLMo-2 ' + lab + ' tokens';
      series.push({ name: name, color: cssVar('--ramp-' + (i + 1)), points: pts(by[lab]) });
    });
    series.push({ name: 'Llama-3.1-8B base, ~15T tokens', color: cssVar('--ink'), dash: true, points: pts(by['Llama-3.1-8B base (~15T)']) });
    series.forEach(function (s) { s.hidden = !!olmoGroup.hidden[s.name]; });
    var maxY = 0;
    series.forEach(function (s) { if (!s.hidden) s.points.forEach(function (p) { if (p.y > maxY) maxY = p.y; }); });
    lineChart(host, {
      group: olmoGroup, height: 290,
      x: { domain: [0, 31], ticks: [0, 5, 10, 15, 20, 25, 30], label: 'layer transition ℓ → ℓ+1' },
      y: { domain: [0, Math.max(0.05, Math.min(maxY, 0.36) * 1.06)], label: 'mean BTE on MATH-500 solutions (nats)' },
      bands: [{ x0: 12, x1: 19 }], series: series,
      tooltip: { title: function (x) { return 'layer ' + x + ' → ' + (x + 1); }, format: function (v) { return fmt(v, 3); } }
    });
    legend(document.getElementById('olmo-legend'), series.map(function (s) { return { name: s.name, color: s.color, dash: s.dash }; }), olmoGroup);
  }
  olmoGroup.renders.push(renderOlmoProfiles);

  var trendGroup = makeGroup();
  function tokFmt(v) { if (v >= 1e12) return fmt(v / 1e12, v / 1e12 >= 10 || Math.abs(v / 1e12 - Math.round(v / 1e12)) < 0.05 ? 0 : 1) + 'T'; if (v >= 1e9) return fmt(v / 1e9, 0) + 'B'; return String(v); }
  function renderOlmoTrend() {
    var host = document.getElementById('chart-olmo-trend');
    if (!host) return;
    clear(host);
    var wrap = html('div', 'stack', host);
    var olmo = D.olmo.filter(function (o) { return o.tokens > 0 && o.label.indexOf('Llama') !== 0; });
    var base = olmoByLabel()['Llama-3.1-8B base (~15T)'], inst = olmoByLabel()['Llama-3.1-8B-Instruct (~15T)'];
    var p1 = html('div', 'panel chart', wrap), p2 = html('div', 'panel chart', wrap);
    var xspec = { type: 'log', domain: [6e8, 4e13], ticks: [1e9, 1e10, 1e11, 1e12, 1e13], format: tokFmt, label: 'pretraining tokens (log scale)' };
    function mk(field, withCI) {
      var s = [{ name: 'OLMo-2-7B checkpoints', color: cssVar('--s1'), markers: true, errors: withCI, hidden: !!trendGroup.hidden['OLMo-2-7B checkpoints'],
        points: olmo.map(function (o) { var p = { x: o.tokens, y: o[field], label: 'OLMo-2 ' + o.label }; if (withCI) { p.lo = o.rho_ci[0]; p.hi = o.rho_ci[1]; } return p; }) },
      { name: 'Llama-3.1-8B base', color: cssVar('--ink'), markers: true, noLine: true, errors: withCI, hidden: !!trendGroup.hidden['Llama-3.1-8B base'],
        points: [{ x: base.tokens, y: base[field], lo: withCI ? base.rho_ci[0] : undefined, hi: withCI ? base.rho_ci[1] : undefined, label: base.label }] },
      { name: 'Llama-3.1-8B-Instruct', color: cssVar('--s2'), markers: true, noLine: true, errors: withCI, hidden: !!trendGroup.hidden['Llama-3.1-8B-Instruct'],
        points: [{ x: inst.tokens * 1.35, y: inst[field], lo: withCI ? inst.rho_ci[0] : undefined, hi: withCI ? inst.rho_ci[1] : undefined, label: inst.label }] }];
      return s;
    }
    lineChart(p1, { group: trendGroup, height: 215, small: true, table: false, title: 'Middle-layer BTE (L12–19)', x: xspec, y: { domain: [0, 0.2] }, series: mk('mid', false),
      tooltip: { title: function (x) { return tokFmt(x) + ' tokens'; }, format: function (v, p) { return fmt(v, 3) + (p.label ? ' · ' + p.label : ''); } } });
    lineChart(p2, { group: trendGroup, height: 215, small: true, table: false, title: 'Spearman ρ with MATH level', x: xspec, y: { domain: [-0.35, 0.6], format: function (v) { return signed(v, 1); } }, refLines: [{ y: 0 }], series: mk('rho', true),
      tooltip: { title: function (x) { return tokFmt(x) + ' tokens'; }, format: function (v, p) { return signed(v, 2) + (p.lo !== undefined ? ' [' + signed(p.lo, 2) + ', ' + signed(p.hi, 2) + ']' : '') + (p.label ? ' · ' + p.label : ''); } } });
    legend(document.getElementById('trend-legend'), [{ name: 'OLMo-2-7B checkpoints', color: cssVar('--s1') }, { name: 'Llama-3.1-8B base', color: cssVar('--ink') }, { name: 'Llama-3.1-8B-Instruct', color: cssVar('--s2') }], trendGroup);
    attachTable(host, function () {
      var w = html('div', 'tbl-wrap');
      var t = html('table', 'tbl', w);
      var tr = html('tr', null, html('thead', null, t));
      ['Model', 'Pretraining tokens', 'Middle-layer BTE', 'Spearman ρ', '95% CI'].forEach(function (h, i) { html('th', i ? 'num' : null, tr, h); });
      var tb = html('tbody', null, t);
      D.olmo.forEach(function (o) {
        var r = html('tr', null, tb);
        html('td', null, r, o.label.indexOf('Llama') === 0 ? o.label : (o.tokens > 0 ? 'OLMo-2-7B ' + o.label : 'Gaussian init'));
        html('td', 'num', r, o.tokens > 0 ? tokFmt(o.tokens) : '0');
        html('td', 'num', r, fmt(o.mid, 3)); html('td', 'num', r, signed(o.rho, 2));
        html('td', 'num', r, '[' + signed(o.rho_ci[0], 2) + ', ' + signed(o.rho_ci[1], 2) + ']');
      });
      return w;
    });
  }
  trendGroup.renders.push(renderOlmoTrend);

  var sftGroup = makeGroup();
  function renderSft() {
    var host = document.getElementById('chart-sft');
    if (!host) return;
    var S = D.sft, labels = ['before fine-tuning', '1,000 solutions', '5,000 solutions', '9,704 solutions'];
    var defs = [['GSM8K', 'gsm8k', '--s1'], ['MATH-500', 'math500', '--s2'], ['OlympiadBench', 'olympiadbench', '--s3']];
    var series = defs.map(function (d) {
      return { name: d[0], color: cssVar(d[2]), markers: true, hidden: !!sftGroup.hidden[d[0]],
        points: S[d[1]].map(function (v, i) { return { x: i, y: v, base: S[d[1]][0] }; }) };
    });
    lineChart(host, {
      group: sftGroup, height: 250,
      x: { domain: [0, 3], ticks: [0, 1, 2, 3], format: function (i) { return labels[i]; }, label: 'MATH solutions seen in fine-tuning (Llama-3.1-8B-Instruct)' },
      y: { domain: [0.125, 0.18], label: 'middle-layer BTE (nats)' }, series: series,
      tooltip: { title: function (x) { return labels[x]; }, format: function (v, p) { return fmt(v, 4) + '  (' + signed(100 * (v / p.base - 1), 1) + '% vs before)'; } }
    });
    legend(document.getElementById('sft-legend'), series.map(function (s) { return { name: s.name, color: s.color }; }), sftGroup);
  }
  sftGroup.renders.push(renderSft);

  /* ================= token-level case explorers ================= */
  var CS = window.BTE_CASES || null;
  var DEBUG_LAYER = (function () { var m = /[?&]layer=(\d+)/.exec(location.search); return m ? Math.max(0, Math.min(32, +m[1])) : null; })();
  var WINDOWS = { mid: { lo: 12, hi: 20, label: 'Middle 12–19' }, late: { lo: 24, hi: 32, label: 'Late 24–31' }, all: { lo: 0, hi: 32, label: 'All layers' } };
  function winMean(row, w) { var r = WINDOWS[w], s = 0; for (var l = r.lo; l < r.hi; l++) s += row[l]; return s / (r.hi - r.lo) / 1000; }
  function quantile(arr, q) { if (!arr.length) return 0; var a = arr.slice().sort(function (x, y) { return x - y; }); var i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); }
  function tokLabel(t) { return t.replace(/\n/g, '⏎').replace(/^ /, '␣'); }
  function readoutName(L) { return L === 0 ? 'embedding readout, before layer 1' : L === 32 ? 'final readout, after layer 32' : 'readout after layer ' + L; }
  function variantItems(v) {
    if (v.positions) return v.positions.map(function (p, j) { return { text: j === 0 ? '' : (v.tokens ? v.tokens[j - 1] : p.tok), next: p.next, row: v.bte[j], start: j === 0 }; });
    return v.tokens.map(function (t, j) { return { text: t, next: v.tokens[j + 1] || '', row: v.bte[j], start: false }; });
  }
  function midMean(profile) { var s = 0; for (var l = 12; l < 20; l++) s += profile[l]; return s / 8; }

  function renderEnergy(host, it, nextp, layer, onLayer) {
    clear(host);
    var W = Math.max(240, Math.floor(host.clientWidth || 360));
    var hasSlider = layer !== null && layer !== undefined;
    var m = { t: 24, r: 10, b: 20, l: 36 }, barsH = 92;
    var H = m.t + barsH + m.b + (nextp ? 86 : 0);
    var pw = W - m.l - m.r;
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'energy', role: 'img', 'aria-label': 'Elementary BTE of the selected token per layer transition' }, host);
    var row = it.row.map(function (v) { return v / 1000; });
    var maxV = Math.max(0.05, Math.max.apply(null, row));
    var xs = linear(0, 32, m.l, m.l + pw);
    var y0 = m.t + barsH, ys = linear(0, maxV, y0, m.t);
    svg('rect', { x: xs(12), y: m.t, width: xs(20) - xs(12), height: barsH, class: 'band' }, el);
    svg('text', { x: m.l, y: 13, class: 'title' }, el).textContent = 'Revision per layer transition (JSD, nats)';
    svg('text', { x: (xs(12) + xs(20)) / 2, y: m.t + 11, 'text-anchor': 'middle', class: 'tick' }, el).textContent = '12–19';
    [0, maxV / 2, maxV].forEach(function (v) {
      svg('line', { x1: m.l, x2: m.l + pw, y1: ys(v), y2: ys(v), class: 'grid' }, el);
      svg('text', { x: m.l - 5, y: ys(v) + 3.5, 'text-anchor': 'end', class: 'tick' }, el).textContent = fmt(v, 2);
    });
    var bars = [];
    var bw = Math.max(2, xs(1) - xs(0) - 2);
    row.forEach(function (v, l) {
      var r = svg('rect', { x: xs(l) + 1, y: ys(v), width: bw, height: Math.max(0, y0 - ys(v)), rx: 1.5, class: 'ebar' }, el);
      if (hasSlider) { r.style.cursor = 'pointer'; r.addEventListener('click', function () { onLayer(l + 1); }); }
      bars.push(r);
    });
    [0, 8, 16, 24, 32].forEach(function (v) { svg('text', { x: xs(v), y: y0 + 13, 'text-anchor': 'middle', class: 'tick' }, el).textContent = String(v); });
    var cursor = svg('line', { y1: m.t - 3, y2: y0 + 3, class: 'cursor', visibility: 'hidden' }, el);
    var dot = null, ys2 = null;
    if (nextp) {
      var t2 = y0 + 40, h2 = 46;
      ys2 = linear(0, 1, t2 + h2, t2);
      svg('text', { x: m.l, y: t2 - 8, class: 'title' }, el).textContent = 'Probability of the actual next token, by readout';
      [0, 0.5, 1].forEach(function (v) {
        svg('line', { x1: m.l, x2: m.l + pw, y1: ys2(v), y2: ys2(v), class: 'grid' }, el);
        svg('text', { x: m.l - 5, y: ys2(v) + 3.5, 'text-anchor': 'end', class: 'tick' }, el).textContent = v === 0 ? '0' : v === 1 ? '1' : '.5';
      });
      var d = nextp.map(function (p, L) { return (L ? 'L' : 'M') + fmt(xs(L), 1) + ',' + fmt(ys2(p / 1000), 1); }).join(' ');
      svg('path', { d: d, class: 'pline' }, el);
      dot = svg('circle', { r: 4, class: 'pdot' }, el);
    }
    var inp = null, lab = null;
    var api = { setLayer: function (L) {
      bars.forEach(function (b, l) { b.classList.toggle('on', hasSlider && l === L - 1); });
      if (hasSlider) { cursor.setAttribute('x1', xs(L)); cursor.setAttribute('x2', xs(L)); cursor.setAttribute('visibility', 'visible'); }
      if (dot) { dot.setAttribute('cx', xs(L)); dot.setAttribute('cy', ys2(nextp[L] / 1000)); }
      if (inp) { inp.value = L; lab.textContent = readoutName(L); }
    } };
    if (hasSlider) {
      var sl = html('div', 'slider', host);
      inp = html('input', null, sl); inp.type = 'range'; inp.min = 0; inp.max = 32; inp.step = 1; inp.value = layer; inp.setAttribute('aria-label', 'readout');
      lab = html('span', 'slab', sl, readoutName(layer));
      html('div', 'shint', host, 'drag the slider or use ← → · click a bar to jump to that transition');
      if (nextp) html('p', 'xp-note', host, 'Each bar is the Jensen–Shannon divergence between two consecutive readouts for this token: how much that layer revised the prediction. The shaded middle window is what the paper averages into its training-free scalar.');
      inp.addEventListener('input', function () { onLayer(+inp.value); });
      api.setLayer(layer);
    } else if (dot) api.setLayer(32);
    return api;
  }

  function renderBelief(host, it, V, j, L) {
    clear(host);
    var rows = V.topk[j][L];
    html('div', 'title', host, 'Top guesses for the next token · ' + readoutName(L));
    var seen = false;
    rows.forEach(function (r) {
      var t = V.vocab[r[0]], p = r[1] / 10, hit = t === it.next;
      if (hit) seen = true;
      var line = html('div', 'bel' + (hit ? ' hit' : ''), host);
      html('span', 'bt', line, tokLabel(t));
      var bar = html('span', 'bb', line); var fill = html('span', null, bar); fill.style.width = Math.max(0.6, p) + '%';
      html('span', 'bp', line, p >= 10 ? fmt(p, 0) + '%' : fmt(p, 1) + '%');
    });
    if (it.next && !seen && V.nextp) {
      var np = V.nextp[j][L] / 10;
      var line2 = html('div', 'bel hit dim', host);
      html('span', 'bt', line2, tokLabel(it.next));
      var bar2 = html('span', 'bb', line2); var f2 = html('span', null, bar2); f2.style.width = Math.max(0.6, np) + '%';
      html('span', 'bp', line2, (np < 0.1 ? '<0.1' : fmt(np, 1)) + '%');
    }
    html('div', 'foot', host, it.next ? 'highlighted: the token that actually follows' : 'last token of the response');
  }

  function caseExplorer(host, spec) {
    var st = host._st;
    if (!st) st = host._st = { variant: spec.selected || spec.variants[0].key, window: spec.window || 'mid', token: null, layer: DEBUG_LAYER != null ? DEBUG_LAYER : (spec.layer != null ? spec.layer : 20) };
    clear(host);
    var byKey = {};
    spec.variants.forEach(function (v) { byKey[v.key] = v; v.items = variantItems(v); });
    var V = byKey[st.variant] || spec.variants[0]; st.variant = V.key;
    var vals = [];
    spec.variants.forEach(function (v) { v.items.forEach(function (it) { if (!it.start) vals.push(winMean(it.row, st.window)); }); });
    var lo = quantile(vals, 0.05), hi = quantile(vals, 0.95); if (hi - lo < 1e-6) hi = lo + 1e-6;
    function tone(val) { return heatColor(Math.max(0, Math.min(1, (val - lo) / (hi - lo)))); }
    function argmaxItem(v) { var best = 0, bv = -1; v.items.forEach(function (it, j) { if (it.start) return; var m = winMean(it.row, 'mid'); if (m > bv) { bv = m; best = j; } }); return best; }
    if (st.token == null || st.token >= V.items.length) st.token = spec.defaultToken ? spec.defaultToken(V) : argmaxItem(V);

    var head = html('div', 'xp-head', host);
    var chips = html('div', 'chips', head);
    spec.variants.forEach(function (v) {
      var b = html('button', 'chip' + (v.key === st.variant ? ' on' : ''), chips); b.type = 'button';
      if (v.color) { var sw = html('span', 'sw', b); sw.style.background = v.color; }
      html('span', 'cl', b, v.label);
      if (v.profile) html('span', 'cv', b, 'ē ' + fmt(midMean(v.profile), 3));
      b.addEventListener('click', function () { st.variant = v.key; st.token = null; caseExplorer(host, spec); });
    });
    if (spec.windows !== false) {
      var right = html('div', 'xp-right', head);
      var seg = html('div', 'seg', right);
      Object.keys(WINDOWS).forEach(function (w) {
        var b = html('button', null, seg, WINDOWS[w].label); b.type = 'button';
        b.setAttribute('aria-pressed', w === st.window ? 'true' : 'false');
        b.addEventListener('click', function () { st.window = w; caseExplorer(host, spec); });
      });
      var lg = html('div', 'scale', right);
      html('span', null, lg, fmt(lo, 2));
      var ramp = html('span', 'ramp', lg); ramp.style.background = heatGradient();
      html('span', null, lg, fmt(hi, 2) + ' nats');
    }
    if (spec.prompt) {
      var pr = html('div', 'xp-prompt', host);
      html('span', 'lab', pr, spec.promptLabel || 'Prompt');
      var ptxt = typeof spec.prompt === 'function' ? spec.prompt(V) : spec.prompt;
      if (ptxt && ptxt.nodeType) pr.appendChild(ptxt); else html('span', 'txt tex', pr, ptxt);
    }
    var body = html('div', 'xp-body' + (spec.beliefs ? ' with-beliefs' : ''), host);
    var flowWrap = html('div', 'xp-flowwrap', body);
    html('div', 'lab', flowWrap, spec.flowLabel || 'Response, token by token · shade: mean BTE of the token in the selected window · hover or click a token');
    var flow = html('div', 'xp-flow ' + (spec.style === 'chips' ? 'chips' : 'flow'), flowWrap);
    var tokEls = [];
    V.items.forEach(function (it, j) {
      var el = html('span', 'tk' + (it.start ? ' start' : ''), flow, it.start ? '▸' : it.text);
      if (it.start) el.title = 'before the first response token';
      else { var c = tone(winMean(it.row, st.window)); el.style.background = c.bg; el.style.color = c.fg; }
      el.setAttribute('tabindex', '0');
      el.addEventListener('mouseenter', function () { showDetail(j, true); });
      el.addEventListener('mouseleave', function () { showDetail(st.token, false); });
      el.addEventListener('click', function () { st.token = j; mark(); showDetail(j, false); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); st.token = j; mark(); showDetail(j, false); } });
      tokEls.push(el);
    });
    function mark() { tokEls.forEach(function (el, j) { el.classList.toggle('sel', j === st.token); }); }
    mark();
    var chipsStyle = spec.style === 'chips';
    var detail = html('div', 'xp-detail', body);
    var dHead = html('div', 'xp-dhead', chipsStyle ? flowWrap : detail);
    var belief = spec.beliefs ? html('div', 'xp-belief' + (chipsStyle ? ' wide' : ''), chipsStyle ? flowWrap : detail) : null;
    var energy = html('div', 'xp-energy', detail);
    var energyApi = null;
    function showDetail(j, hover) {
      var it = V.items[j];
      clear(dHead);
      html('span', 'lab', dHead, hover ? 'hover' : 'selected');
      html('span', 'txt', dHead, (it.start ? 'Before the first token' : 'After “' + tokLabel(it.text) + '”') + (it.next ? ' → next token “' + tokLabel(it.next) + '”' : ' → end of response'));
      html('span', 'val', dHead, 'ē₁₂₋₁₉ = ' + fmt(winMean(it.row, 'mid'), 3) + ' · sum over layers ' + fmt(winMean(it.row, 'all') * 32, 2) + ' nats');
      energyApi = renderEnergy(energy, it, V.nextp ? V.nextp[j] : null, spec.beliefs ? st.layer : null, function (L) {
        st.layer = L;
        if (belief) renderBelief(belief, it, V, j, L);
        energyApi.setLayer(L);
      });
      if (belief) renderBelief(belief, it, V, j, st.layer);
    }
    showDetail(st.token, false);
    if (spec.profiles !== false) {
      var pc = html('div', 'xp-profiles chart', host);
      var maxY = 0;
      spec.variants.forEach(function (v) { v.profile.forEach(function (y) { if (y > maxY) maxY = y; }); });
      lineChart(pc, { height: 235, small: true, table: false, margin: { r: 12 }, title: spec.profileTitle || 'Depth profile of each variant, mean over tokens', subtitle: 'shaded: layers 12–19',
        x: { domain: [0, 31], ticks: [0, 5, 10, 15, 20, 25, 30], label: 'layer transition ℓ → ℓ+1' },
        y: { domain: [0, Math.min(0.36, maxY * 1.08)], label: 'mean BTE (nats)' }, bands: [{ x0: 12, x1: 19 }],
        series: spec.variants.map(function (v) { return { name: v.label, color: v.color || cssVar('--s1'), width: v.key === st.variant ? 2.6 : 1.3, opacity: v.key === st.variant ? 1 : 0.5, points: v.profile.map(function (y, l) { return { x: l, y: y }; }) }; }),
        tooltip: { title: function (x) { return 'layer ' + x + ' → ' + (x + 1); }, format: function (v) { return fmt(v, 3); } } });
    }
  }

  function renderHero() {
    var host = document.getElementById('xp-hero');
    if (!host || !CS) return;
    var keyNext = { paris: ' Paris', decimal: ' larger', times: '51' };
    caseExplorer(host, {
      variants: CS.hero.map(function (h) { return { key: h.id, label: h.title, positions: h.positions, bte: h.bte, topk: h.topk, vocab: h.vocab, nextp: h.nextp, question: h.question }; }),
      style: 'chips', beliefs: true, windows: false, window: 'all', profiles: false, layer: 20,
      promptLabel: 'Question', prompt: function (v) { return v.question; },
      flowLabel: 'Answer, token by token · shade: how much the layers revised the prediction of the token that follows · click a token',
      defaultToken: function (v) { var idx = 0; v.items.forEach(function (it, j) { if (it.next === keyNext[v.key]) idx = j; }); return idx; }
    });
  }
  function renderCaseControls() {
    var host = document.getElementById('xp-controls');
    if (!host || !CS) return;
    var cols = ['--s1', '--s2', '--s3', '--s4', '--s5'];
    var order = ['normal', 'shuffled_tokens', 'random_words', 'repeated_word', 'repeated_sentence'];
    caseExplorer(host, {
      variants: order.map(function (k, i) { var v = CS.controls.variants[k]; return { key: k, label: v.label, tokens: v.tokens, bte: v.bte, profile: v.profile, color: cssVar(cols[i]) }; }),
      style: 'flow', beliefs: false, window: 'mid', profiles: true, promptLabel: 'Problem · GSM8K', prompt: CS.controls.problem,
      profileTitle: 'Depth profile of the five responses, 79 tokens each'
    });
  }
  function renderCaseMath() {
    var host = document.getElementById('xp-math');
    if (!host || !CS) return;
    var vs = [['easy', '--s1'], ['hard', '--s2']].map(function (p) {
      var m = CS.math[p[0]];
      return { key: p[0], label: 'Level ' + m.level + ' · ' + m.subject, positions: m.positions, tokens: m.tokens, bte: m.bte, topk: m.topk, vocab: m.vocab, nextp: m.nextp, profile: m.profile, color: cssVar(p[1]), problem: m.problem };
    });
    caseExplorer(host, { variants: vs, style: 'flow', beliefs: true, window: 'mid', profiles: true, layer: 32, promptLabel: 'Problem · MATH-500', prompt: function (v) { return v.problem; }, profileTitle: 'Depth profile of the two reference solutions',
      defaultToken: function (v) {
        /* the position that predicts the first token of the boxed answer */
        var b = -1;
        v.items.forEach(function (it, j) { if (b < 0 && it.text.indexOf('boxed') >= 0) b = j; });
        for (var j = b + 1; b >= 0 && j < v.items.length; j++) { if (v.items[j].next && v.items[j].next.trim() && v.items[j].next.trim() !== '{') return j; }
        return 1;
      } });
  }
  function renderCaseReviews() {
    var host = document.getElementById('xp-reviews');
    if (!host || !CS) return;
    var cols = { 'Human': '--ink', 'GPT-4o': '--legacy-1', 'GPT-5.6': '--new-2', 'Claude Opus 5': '--new-4' };
    var vs = ['Human', 'GPT-4o', 'GPT-5.6', 'Claude Opus 5'].map(function (k) { var v = CS.reviews.sources[k]; return { key: k, label: k, tokens: v.tokens, bte: v.bte, profile: v.profile, color: cssVar(cols[k]) }; });
    var node = document.createElement('span'); node.className = 'txt';
    node.appendChild(document.createTextNode('Four reviews of one ' + CS.reviews.conference + ' submission, each scored with the parsed paper in the context. '));
    var a = html('a', null, node, 'OpenReview forum ' + CS.reviews.forum); a.href = 'https://openreview.net/forum?id=' + CS.reviews.forum; a.target = '_blank'; a.rel = 'noopener';
    caseExplorer(host, { variants: vs, style: 'flow', beliefs: false, window: 'mid', profiles: true, promptLabel: 'Setting', prompt: node, profileTitle: 'Depth profile of the four reviews' });
  }

  /* ================= hero: same destination, different paths ================= */
  function energyPair(host, A, B) {
    clear(host);
    var W = Math.max(260, Math.floor(host.clientWidth || 420)), H = 230;
    var m = { t: 30, r: 12, b: 40, l: 40 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'Elementary BTE per layer transition for the two tokens' }, host);
    var rows = [A.row.map(function (v) { return v / 1000; }), B.row.map(function (v) { return v / 1000; })];
    var maxV = Math.max(0.05, Math.max.apply(null, rows[0].concat(rows[1])));
    var xs = linear(0, 32, m.l, m.l + pw), ys = linear(0, maxV, m.t + ph, m.t);
    svg('rect', { x: xs(12), y: m.t, width: xs(20) - xs(12), height: ph, class: 'band' }, el);
    svg('text', { x: m.l, y: 15, class: 'title' }, el).textContent = 'Revision per layer transition (JSD, nats)';
    niceTicks(0, maxV, 4).forEach(function (v) { svg('line', { x1: m.l, x2: m.l + pw, y1: ys(v), y2: ys(v), class: 'grid' }, svg('g', { class: 'grid' }, el)); svg('text', { x: m.l - 6, y: ys(v) + 3.5, 'text-anchor': 'end', class: 'tick' }, el).textContent = fmt(v, 2); });
    var slot = xs(1) - xs(0), bw = Math.max(1.5, slot / 2 - 1.2);
    rows.forEach(function (row, k) {
      var g = svg('g', { class: 'series', 'data-name': k ? 'B' : 'A' }, el);
      row.forEach(function (v, l) {
        var r = svg('rect', { x: xs(l) + 0.6 + k * (bw + 0.8), y: ys(v), width: bw, height: Math.max(0, m.t + ph - ys(v)), rx: 1, fill: k ? B.color : A.color }, g);
        svg('title', {}, r).textContent = (k ? 'B' : 'A') + ' · transition ' + l + ' → ' + (l + 1) + ': ' + fmt(v, 3) + ' nats';
      });
    });
    svg('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, class: 'axis' }, el);
    [0, 8, 16, 24, 32].forEach(function (v) { svg('text', { x: xs(v), y: m.t + ph + 15, 'text-anchor': 'middle', class: 'tick' }, el).textContent = String(v); });
    svg('text', { x: m.l + pw / 2, y: H - 5, 'text-anchor': 'middle', class: 'label' }, el).textContent = 'layer transition ℓ → ℓ+1 · shaded: 12–19';
    if (W >= 560) svg('text', { x: m.l + pw, y: 15, 'text-anchor': 'end', class: 'subtitle' }, el).textContent = 'Σ A ' + fmt(A.path, 2) + ' · Σ B ' + fmt(B.path, 2) + ' nats';
  }
  function pathHero() {
    var host = document.getElementById('path-hero');
    if (!host || !CS || !CS.hero) return;
    var Hd = CS.hero, toks = Hd.tokens;
    var st = host._st || (host._st = { A: Hd.defaultA, B: Hd.defaultB, pick: 'B' });
    clear(host);
    var lo = Hd.path_min, hi = Hd.path_max;
    var head = html('div', 'xp-head', host);
    var lab = html('div', 'ph-lab lab', head);
    lab.textContent = Hd.n_certain + ' of ' + (toks.length - 1) + ' tokens end with the model ≥ 97% certain of the next token. They are clickable and shaded by path length; the rest are greyed out.';
    var right = html('div', 'xp-right', head);
    var pick = html('div', 'seg', right);
    [['A', 'click sets A'], ['B', 'click sets B']].forEach(function (p) {
      var b = html('button', null, pick, p[1]); b.type = 'button';
      b.setAttribute('aria-pressed', st.pick === p[0] ? 'true' : 'false');
      b.addEventListener('click', function () { st.pick = p[0]; pathHero(); });
    });
    var scale = html('div', 'scale', right);
    html('span', null, scale, fmt(lo, 1));
    var ramp = html('span', 'ramp', scale); ramp.style.background = 'linear-gradient(90deg,' + heatColor(0).bg + ',' + heatColor(1).bg + ')';
    html('span', null, scale, fmt(hi, 1) + ' nats of path');
    var pr = html('div', 'xp-prompt', host);
    html('span', 'lab', pr, 'Problem · MATH-500 level 1');
    html('span', 'txt tex', pr, Hd.problem);
    var flow = html('div', 'xp-flow flow ph-flow', host);
    toks.forEach(function (t, j) {
      if (j === 0) return;
      var el = html('span', 'tk' + (t.certain ? '' : ' dim'), flow, t.t);
      if (t.certain) {
        var c = heatColor((t.path - lo) / Math.max(1e-6, hi - lo));
        el.style.background = c.bg; el.style.color = c.fg;
        el.setAttribute('tabindex', '0');
        el.title = 'after “' + tokLabel(t.t) + '” → “' + tokLabel(t.next) + '” · path ' + fmt(t.path, 2) + ' nats · final belief ' + fmt(100 * t.pf, 0) + '%';
        el.addEventListener('click', function () { st[st.pick] = j; pathHero(); });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); st[st.pick] = j; pathHero(); } });
      } else el.title = 'final belief below 97%, not comparable';
      if (j === st.A) el.classList.add('selA');
      if (j === st.B) el.classList.add('selB');
    });
    var stats = html('div', 'ph-stats', host);
    var picks = [['A', st.A, cssVar('--s1')], ['B', st.B, cssVar('--s2')]];
    picks.forEach(function (p) {
      var t = toks[p[1]];
      var card = html('div', 'ph-card', stats); card.style.borderColor = p[2];
      var h = html('div', 'ph-ct', card); var sw = html('span', 'sw', h); sw.style.background = p[2];
      html('span', null, h, p[0] + ' · after “' + tokLabel(t.t) + '”, the next token is “' + tokLabel(t.next) + '”');
      var g = html('div', 'ph-nums', card);
      var arrive = null; for (var L = 0; L < 33; L++) { if (Math.exp(Hd.logp[p[1]][L]) >= 0.5) { arrive = L; break; } }
      [['final belief in that token', fmt(100 * t.pf, 0) + '%', 'what likelihood sees'], ['endpoint distance JSD(p⁽⁰⁾, p⁽³²⁾)', fmt(t.end, 2) + ' nats', 'saturated at ln 2'], ['path length Σ BTE', fmt(t.path, 2) + ' nats', 'what BTE sees'], ['first readout with belief ≥ 50%', arrive === null ? '—' : 'readout ' + arrive, '']].forEach(function (r) {
        var d = html('div', 'ph-num', g); html('span', 'k', d, r[0]); html('span', 'v', d, r[1]); if (r[2]) html('span', 's', d, r[2]);
      });
    });
    var grid = html('div', 'ph-grid', host);
    var c1 = html('div', 'chart', grid), c2 = html('div', 'chart', grid);
    function ser(name, j, color) { return { name: name + ' “' + tokLabel(toks[j].t) + '”', color: color, width: 2.4, markers: false, points: Hd.logp[j].map(function (lp, L) { return { x: L, y: Math.exp(lp) }; }) }; }
    lineChart(c1, { height: 230, small: true, table: false, title: 'Belief in the actual next token, by readout', margin: { r: 12 },
      x: { domain: [0, 32], ticks: [0, 8, 16, 24, 32], label: 'readout (0 = embedding, 32 = final)' }, y: { domain: [0, 1], ticks: [0, 0.5, 1], label: 'probability' },
      bands: [{ x0: 12, x1: 20 }], series: [ser('A', st.A, picks[0][2]), ser('B', st.B, picks[1][2])],
      tooltip: { title: function (x) { return 'readout ' + x; }, format: function (v) { return fmt(v, 3); } } });
    energyPair(c2, { row: Hd.bte[st.A], path: toks[st.A].path, color: picks[0][2] }, { row: Hd.bte[st.B], path: toks[st.B].path, color: picks[1][2] });
  }

  /* ================= comparison widgets ================= */
  function barGrid(host, spec) {
    clear(host);
    var t = html('table', 'tbl bg', host);
    var tr = html('tr', null, html('thead', null, t));
    html('th', null, tr, spec.rowLabel || '');
    spec.cols.forEach(function (c) { var th = html('th', null, tr, c.label); if (c.sub) html('span', 'sub', th, c.sub); });
    var tb = html('tbody', null, t);
    spec.cols.forEach(function (c) { c._max = Math.max.apply(null, spec.rows.map(function (r) { return Math.abs(r.values[c.key]); })) || 1; });
    spec.rows.forEach(function (r) {
      var row = html('tr', r.hi ? 'hi' : null, tb);
      var td = html('td', null, row); if (r.color) { var sw = html('span', 'sw', td); sw.style.background = r.color; } td.appendChild(document.createTextNode(r.label));
      spec.cols.forEach(function (c) {
        var v = r.values[c.key];
        var cell = html('td', 'bgc', row);
        var wrap = html('span', 'barcell', cell);
        var track = html('span', 'track wide', wrap);
        var bar = html('span', 'bar', track);
        bar.style.width = (100 * Math.abs(v) / c._max) + '%';
        bar.style.background = c.color || r.color || cssVar('--s1');
        var best = c.best === 'min' ? Math.min.apply(null, spec.rows.map(function (q) { return q.values[c.key]; })) : Math.max.apply(null, spec.rows.map(function (q) { return q.values[c.key]; }));
        var lbl = html('span', 'val' + (v === best ? ' best' : ''), wrap, (c.signed ? signed(v, c.dec) : fmt(v, c.dec)) + (c.unit || ''));
        if (v === best && c.bestNote) lbl.title = c.bestNote;
      });
    });
    if (spec.note) html('p', 'note tight', host, spec.note);
  }
  function dumbbell(host, spec) {
    clear(host);
    var W = Math.max(280, Math.floor(host.clientWidth || 480));
    var rowH = 30, m = { t: 36, r: 40, b: 34, l: 112 };
    var H = m.t + rowH * spec.rows.length + m.b, pw = W - m.l - m.r;
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': spec.aria || 'dumbbell chart' }, host);
    var xs = linear(spec.domain[0], spec.domain[1], m.l, m.l + pw);
    svg('text', { x: m.l, y: 14, class: 'title' }, el).textContent = spec.title || '';
    var ticks = spec.ticks || niceTicks(spec.domain[0], spec.domain[1], 5);
    ticks.forEach(function (v) {
      svg('line', { x1: xs(v), x2: xs(v), y1: m.t, y2: H - m.b, class: 'grid' }, svg('g', { class: 'grid' }, el));
      svg('text', { x: xs(v), y: H - m.b + 14, 'text-anchor': 'middle', class: 'tick' }, el).textContent = fmt(v, 1);
    });
    if (spec.ref != null) { svg('line', { x1: xs(spec.ref), x2: xs(spec.ref), y1: m.t, y2: H - m.b, class: 'ref' }, el); svg('text', { x: xs(spec.ref), y: m.t - 4, 'text-anchor': 'middle', class: 'tick' }, el).textContent = spec.refLabel || ''; }
    spec.rows.forEach(function (r, i) {
      var y = m.t + rowH * i + rowH / 2;
      svg('text', { x: m.l - 10, y: y + 4, 'text-anchor': 'end', class: 'tick' }, el).textContent = r.label;
      var g = svg('g', { class: 'series' }, el);
      svg('line', { x1: xs(r.a), x2: xs(r.b), y1: y, y2: y, class: 'db-line' }, g);
      var ca = svg('circle', { cx: xs(r.a), cy: y, r: 6, fill: spec.aColor, class: 'dot' }, g); svg('title', {}, ca).textContent = spec.aLabel + ': ' + fmt(r.a, 3);
      var cb = svg('circle', { cx: xs(r.b), cy: y, r: 6, fill: spec.bColor, class: 'dot' }, g); svg('title', {}, cb).textContent = spec.bLabel + ': ' + fmt(r.b, 3);
      var left = Math.min(r.a, r.b), rightv = Math.max(r.a, r.b);
      svg('text', { x: xs(left) - 9, y: y + 4, 'text-anchor': 'end', class: 'tick' }, el).textContent = fmt(left, 2);
      svg('text', { x: xs(rightv) + 9, y: y + 4, class: 'tick' }, el).textContent = fmt(rightv, 2);
    });
    if (spec.xLabel) svg('text', { x: m.l + pw / 2, y: H - 2, 'text-anchor': 'middle', class: 'label' }, el).textContent = spec.xLabel;
  }
  function rhoBars(host, model) {
    clear(host);
    var R = D.rhoCompare[model];
    var W = Math.max(280, Math.floor(host.clientWidth || 600));
    var rowH = 40, m = { t: 30, r: 44, b: 34, l: 230 };
    if (W < 620) { m.l = 118; m.r = 40; }
    var H = m.t + rowH * R.rows.length + m.b, pw = W - m.l - m.r;
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'Spearman correlation with MATH difficulty level for several readouts' }, host);
    var dom = [-0.25, 0.5];
    var xs = linear(dom[0], dom[1], m.l, m.l + pw);
    svg('text', { x: W < 620 ? 8 : m.l, y: 14, class: 'title' }, el).textContent = W < 620 ? 'Spearman ρ with MATH-500 level · ' + R.label : 'Spearman ρ with the MATH-500 difficulty level · ' + R.label + ', 500 reference solutions';
    legend(document.getElementById('rho-legend'), [{ name: 'raw', color: cssVar('--lv-2') }, { name: 'solution length removed (rank partial)', color: cssVar('--lv-5') }, { name: 'output-level quantities, raw / length removed', color: cssVar('--legacy-2') }], makeGroup());
    [-0.2, 0, 0.2, 0.4].forEach(function (v) {
      svg('line', { x1: xs(v), x2: xs(v), y1: m.t, y2: H - m.b, class: v === 0 ? 'ref' : 'grid' }, svg('g', { class: 'grid' }, el));
      svg('text', { x: xs(v), y: H - m.b + 14, 'text-anchor': 'middle', class: 'tick' }, el).textContent = signed(v, 1);
    });
    R.rows.forEach(function (r, i) {
      var y0 = m.t + rowH * i;
      var lab = svg('text', { x: m.l - 10, y: y0 + rowH / 2 + 4, 'text-anchor': 'end', class: 'tick' + (i === 0 ? ' strong' : '') }, el); lab.textContent = W < 620 && r.short ? r.short : r.label;
      [r.raw, r.ctrl].forEach(function (v, k) {
        var y = y0 + 6 + k * 15, hgt = 12;
        var x0 = Math.min(xs(0), xs(v)), wd = Math.abs(xs(v) - xs(0));
        var rect = svg('rect', { x: x0, y: y, width: Math.max(1, wd), height: hgt, rx: 2, fill: i === 0 ? cssVar(k ? '--lv-5' : '--lv-2') : cssVar(k ? '--legacy-3' : '--legacy-1') }, el);
        svg('title', {}, rect).textContent = r.label + (k ? ', length removed: ' : ', raw: ') + signed(v, 3);
        var lx = v >= 0 ? xs(v) + 5 : (W < 620 ? xs(0) + 5 : xs(v) - 5);
        svg('text', { x: lx, y: y + 10, 'text-anchor': v >= 0 || W < 620 ? 'start' : 'end', class: 'tick' }, el).textContent = signed(v, 2);
      });
    });
    svg('text', { x: m.l + pw / 2, y: H - 4, 'text-anchor': 'middle', class: 'label' }, el).textContent = W < 620 ? 'Spearman ρ (harder = higher)' : 'item-level Spearman ρ (positive: harder problems score higher)';
  }

  /* ================= case renderers ================= */
  var CTRL_ORDER = ['normal', 'shuffled_tokens', 'random_words', 'repeated_word', 'repeated_sentence'];
  var CTRL_COLS = ['--s1', '--s2', '--s3', '--s4', '--s5'];
  function ctrlVariants() { return CTRL_ORDER.map(function (k, i) { var v = CS.controls.variants[k]; return { key: k, label: v.label, tokens: v.tokens, bte: v.bte, profile: v.profile, nll: v.nll, color: cssVar(CTRL_COLS[i]) }; }); }
  function renderCaseControls() {
    var cmp = document.getElementById('cmp-controls'), pc = document.getElementById('prof-controls');
    if (!cmp || !CS) return;
    var vs = ctrlVariants();
    barGrid(cmp, { rowLabel: 'Response (79 tokens each)',
      cols: [{ key: 'nll', label: 'Final-layer NLL per token', sub: 'what perplexity sees · nats', dec: 2, best: 'min' },
             { key: 'mid', label: 'BTE, middle window 12–19', sub: 'nats', dec: 3, best: 'max' },
             { key: 'late', label: 'BTE, late window 24–31', sub: 'nats', dec: 3, best: 'max' },
             { key: 'all', label: 'BTE, all-layer mean', sub: 'nats', dec: 3, best: 'max' }],
      rows: vs.map(function (v) { return { label: v.label, color: v.color, hi: v.key === 'normal', values: { nll: v.nll, mid: midMean(v.profile), late: v.profile.slice(24, 32).reduce(function (a, c) { return a + c; }, 0) / 8, all: v.profile.reduce(function (a, c) { return a + c; }, 0) / 32 } }; }),
      note: 'Bold: the best value in each column. Likelihood puts the real solution third; the middle window puts it first; the late window rewards surface regularity; the all-layer mean barely moves.' });
    var maxY = 0; vs.forEach(function (v) { v.profile.forEach(function (y) { if (y > maxY) maxY = y; }); });
    lineChart(pc, { height: 250, small: true, title: 'Depth profile of the five responses', subtitle: 'shaded: layers 12–19 and 24–31', margin: { r: 12 },
      x: { domain: [0, 31], ticks: [0, 5, 10, 15, 20, 25, 30], label: 'layer transition ℓ → ℓ+1' }, y: { domain: [0, Math.min(0.36, maxY * 1.08)], label: 'mean BTE (nats)' },
      bands: [{ x0: 12, x1: 19 }, { x0: 24, x1: 31 }],
      series: vs.map(function (v) { return { name: v.label, color: v.color, width: v.key === 'normal' ? 2.6 : 1.4, points: v.profile.map(function (y, l) { return { x: l, y: y }; }) }; }),
      tooltip: { title: function (x) { return 'layer ' + x + ' → ' + (x + 1); }, format: function (v) { return fmt(v, 3); } } });
    legend(document.getElementById('prof-controls-legend'), vs.map(function (v) { return { name: v.label, color: v.color }; }), makeGroup());
  }
  function renderXpControls() {
    var host = document.getElementById('xp-controls-body'); if (!host || !CS) return;
    caseExplorer(host, { variants: ctrlVariants(), style: 'flow', beliefs: false, window: 'mid', profiles: false, promptLabel: 'Problem · GSM8K', prompt: CS.controls.problem });
  }
  var REV_ORDER = ['Human', 'GPT-4o', 'GPT-5.6', 'Claude Opus 5'];
  var REV_COLS = { 'Human': '--ink', 'GPT-4o': '--legacy-1', 'GPT-5.6': '--new-2', 'Claude Opus 5': '--new-4' };
  function revVariants() { return REV_ORDER.map(function (k) { var v = CS.reviews.sources[k]; return { key: k, label: k, tokens: v.tokens, bte: v.bte, profile: v.profile, nll: v.nll, color: cssVar(REV_COLS[k]) }; }); }
  function renderCaseReviews() {
    var db = document.getElementById('dumb-reviews'), cmp = document.getElementById('cmp-reviews'), rel = document.getElementById('rel-reviews');
    if (!db || !CS) return;
    var rowsD = D.detection.rows;
    function find(name, group) { for (var i = 0; i < rowsD.length; i++) if (rowsD[i].name === name && rowsD[i].group === group) return rowsD[i]; return null; }
    var ll = find('Log-likelihood (Llama-3.1-8B)', 'baseline'), bte = find('Llama-3.1-8B · full', 'C');
    dumbbell(db, { title: 'Macro-AUROC per generator · Llama-3.1-8B scorer', aria: 'AUROC per generator for likelihood and BTE', domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1], ref: 0.5, refLabel: 'chance',
      aLabel: 'mean log-likelihood', bLabel: 'BTE profile', aColor: cssVar('--ramp-3'), bColor: cssVar('--accent'),
      rows: D.detection.generators.map(function (g, i) { return { label: g, a: ll.values[i], b: bte.values[i] }; }), xLabel: 'AUROC, LLM-written reviews as the positive class' });
    legend(document.getElementById('dumb-reviews-legend'), [{ name: 'mean log-likelihood of the review (final layer)', color: cssVar('--ramp-3') }, { name: 'logistic regression on the 32-D BTE profile', color: cssVar('--accent') }], makeGroup());
    var vs = revVariants(), human = vs[0];
    barGrid(cmp, { rowLabel: 'Review',
      cols: [{ key: 'nll', label: 'Final-layer NLL per token', sub: 'what perplexity sees · nats', dec: 2, best: 'min' },
             { key: 'mid', label: 'BTE, middle window 12–19', sub: 'relative to the human review', dec: 1, signed: true, unit: '%', best: 'max' },
             { key: 'late', label: 'BTE, late window 24–31', sub: 'relative to the human review', dec: 1, signed: true, unit: '%', best: 'max' }],
      rows: vs.map(function (v) { var mh = midMean(human.profile), lh = human.profile.slice(24, 32).reduce(function (a, c) { return a + c; }, 0) / 8; return { label: v.label, color: v.color, hi: v.key === 'Human', values: { nll: v.nll, mid: 100 * (midMean(v.profile) / mh - 1), late: 100 * (v.profile.slice(24, 32).reduce(function (a, c) { return a + c; }, 0) / 8 / lh - 1) } }; }) });
    lineChart(rel, { height: 230, small: true, table: false, title: 'Generated reviews relative to the human review, per layer', margin: { r: 12 },
      x: { domain: [0, 31], ticks: [0, 5, 10, 15, 20, 25, 30], label: 'layer transition ℓ → ℓ+1' }, y: { domain: [-30, 40], ticks: [-20, 0, 20, 40], label: 'generated − human (%)', format: function (v) { return signed(v, 0); } },
      bands: [{ x0: 12, x1: 19 }], refLines: [{ y: 0 }],
      series: vs.slice(1).map(function (v) { return { name: v.label, color: v.color, width: 2, dash: v.key !== 'GPT-4o', points: v.profile.map(function (y, l) { return { x: l, y: 100 * (y - human.profile[l]) / human.profile[l] }; }) }; }),
      tooltip: { title: function (x) { return 'layer ' + x + ' → ' + (x + 1); }, format: function (v) { return signed(v, 1) + '%'; } } });
  }
  function renderXpReviews() {
    var host = document.getElementById('xp-reviews-body'); if (!host || !CS) return;
    var node = document.createElement('span'); node.className = 'txt';
    node.appendChild(document.createTextNode('Four reviews of one ' + CS.reviews.conference + ' submission, each scored with the parsed paper in the context. '));
    var a = html('a', null, node, 'OpenReview forum ' + CS.reviews.forum); a.href = 'https://openreview.net/forum?id=' + CS.reviews.forum; a.target = '_blank'; a.rel = 'noopener';
    caseExplorer(host, { variants: revVariants(), style: 'flow', beliefs: false, window: 'mid', profiles: false, promptLabel: 'Setting', prompt: node });
  }
  var rhoModel = 'llama';
  function renderCaseDifficulty() { var host = document.getElementById('rho-bars'); if (!host || !D.rhoCompare) return; rhoBars(host, rhoModel); }
  wireSeg('rho-scorer', 'data-scorer', function (v) { rhoModel = v; renderCaseDifficulty(); });
  function renderXpMath() {
    var host = document.getElementById('xp-math-body'); if (!host || !CS) return;
    var vs = [['easy', '--s1'], ['hard', '--s2']].map(function (p) { var m = CS.math[p[0]]; return { key: p[0], label: 'Level ' + m.level + ' · ' + m.subject + ' · NLL ' + fmt(m.nll, 2), positions: m.positions, tokens: m.tokens, bte: m.bte, profile: m.profile, color: cssVar(p[1]), problem: m.problem }; });
    caseExplorer(host, { variants: vs, style: 'flow', beliefs: false, window: 'mid', profiles: true, promptLabel: 'Problem · MATH-500', prompt: function (v) { return v.problem; }, profileTitle: 'Depth profile of the two reference solutions' });
  }
  function renderReadout() {
    var host = document.getElementById('readout-body'); if (!host || !CS || !CS.readout) return;
    var keyNext = { paris: ' Paris', decimal: ' larger', times: '51' };
    caseExplorer(host, { variants: CS.readout.map(function (h) { return { key: h.id, label: h.title, positions: h.positions, bte: h.bte, topk: h.topk, vocab: h.vocab, nextp: h.nextp, question: h.question }; }),
      style: 'chips', beliefs: true, windows: false, window: 'all', profiles: false, layer: 20, promptLabel: 'Question', prompt: function (v) { return v.question; },
      flowLabel: 'Answer, token by token · click a token, then move through the readouts',
      defaultToken: function (v) { var idx = 0; v.items.forEach(function (it, j) { if (it.next === keyNext[v.key]) idx = j; }); return idx; } });
  }

  /* ---------- render everything; content inside collapsed details renders when it opens ---------- */
  var mainRenders = [pathHero, renderCaseControls, renderCaseReviews, renderGenerators, renderCaseDifficulty, renderDifficulty, renderAttributionTable, renderConfusion, renderAttrAcc, renderOlmoProfiles, renderOlmoTrend, renderSft];
  var lazy = { 'xp-controls': [renderXpControls], 'xp-reviews': [renderXpReviews], 'xp-math': [renderXpMath], 'readout-viewer': [renderReadout],
    'more-results': [renderRhoTable, renderDetectionTable, renderFamiliarityTable, renderPreferenceTable] };
  function run(r) { try { r(); } catch (err) { if (window.console) console.error(err); } }
  function renderLazy(id) { var d = document.getElementById(id); if (!d || !d.open) return; lazy[id].forEach(run); if (window.BTE_MATH) window.BTE_MATH(d); }
  function renderAll() {
    [genGroup, diffGroup, olmoGroup, trendGroup, sftGroup].forEach(function (g) { g.svgs = []; });
    mainRenders.forEach(run);
    Object.keys(lazy).forEach(renderLazy);
    if (window.BTE_CONTRAST_RENDER) run(window.BTE_CONTRAST_RENDER);
    if (window.BTE_LAB_RENDER) run(window.BTE_LAB_RENDER);
    if (window.BTE_SET_RENDER) run(window.BTE_SET_RENDER);
    if (window.BTE_CASE_RENDER) run(window.BTE_CASE_RENDER);
    if (window.BTE_METHOD_RENDER) run(window.BTE_METHOD_RENDER);
  }
  renderAll();
  Object.keys(lazy).forEach(function (id) { var d = document.getElementById(id); if (d) d.addEventListener('toggle', function () { if (d.open) renderLazy(id); }); });
  var rt = null, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(rt); rt = setTimeout(renderAll, 160);
  });
  if ('MutationObserver' in window) {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) if (muts[i].attributeName === 'data-theme') { renderAll(); break; }
    }).observe(document.documentElement, { attributes: true });
  }
  window.BTE_UI = { tokenFill: tokenFill, placeTip: placeTip, heatGradient: heatGradient, renderAttributionTable: renderAttributionTable, renderConfusion: renderConfusion, renderOlmoProfiles: renderOlmoProfiles, renderOlmoTrend: renderOlmoTrend, renderSft: renderSft, lineChart: lineChart, legend: legend, makeGroup: makeGroup, barGrid: barGrid, dumbbell: dumbbell, rhoBars: rhoBars, cssVar: cssVar, html: html, svg: svg, clear: clear, fmt: fmt, signed: signed, linear: linear, niceTicks: niceTicks, heatColor: heatColor, caseExplorer: caseExplorer, midMean: midMean };
  if (window.BTE_CONTRAST_READY) window.BTE_CONTRAST_READY();
  /* debug helpers: ?open=all opens every collapsed block, ?showtables=1 expands table views, ?hover=1 opens tooltips */
  if (/[?&]open=all/.test(location.search)) { Object.keys(lazy).forEach(function (id) { var d = document.getElementById(id); if (d && !d.open) { d.open = true; renderLazy(id); } }); }
  if (/[?&]showtables/.test(location.search)) { var tb = document.querySelectorAll('.chart-tools .btn'); for (var q = 0; q < tb.length; q++) tb[q].click(); }
  if (/[?&]hover/.test(location.search)) setTimeout(function () {   /* after the other renderers have drawn */
    var targets = document.querySelectorAll('.hit, .cell');
    for (var h = 0; h < targets.length; h++) {
      var rc = targets[h].getBoundingClientRect();
      targets[h].dispatchEvent(new PointerEvent('pointermove', { clientX: rc.left + rc.width * 0.62, clientY: rc.top + rc.height * 0.5, bubbles: true }));
    }
  }, 300);
})();
