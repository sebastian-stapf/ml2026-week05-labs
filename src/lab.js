/* Shared helpers for the Week 05 interactive labs: plotting on canvas, dragging,
   tabs, small linear algebra, kernels and an SMO solver for the SVM dual. */
(function () {
  'use strict';
  const L = {};
  window.Lab = L;

  L.$ = (s, r = document) => r.querySelector(s);
  L.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  L.css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  L.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  L.fmt = (v, d = 3) => {
    if (!isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : '—';
    const s = Math.abs(v) >= 1e4 || (Math.abs(v) > 0 && Math.abs(v) < 1e-3) ? v.toExponential(2) : v.toFixed(d);
    return s.replace('-', '−');
  };
  L.rgb = name => {
    const s = L.css(name);
    if (s.startsWith('#')) {
      const h = s.length === 4 ? s.slice(1).split('').map(c => c + c).join('') : s.slice(1, 7);
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    const m = s.match(/[\d.]+/g) || [0, 0, 0];
    return [+m[0], +m[1], +m[2]];
  };
  L.reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme change → redraw ---------- */
  const themeListeners = new Set();
  L.onTheme = fn => themeListeners.add(fn);
  const fireTheme = () => themeListeners.forEach(f => f());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fireTheme);
  new MutationObserver(fireTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts) { document.fonts.addEventListener('loadingdone', fireTheme); document.fonts.ready.then(fireTheme); }

  /* ---------- theme picker (Auto / Light / Reading / Dark); Reading is the default ---------- */
  L.themePicker = () => {
    const sel = document.getElementById('theme-select');
    if (!sel) return;
    let cur = 'reading';
    try { cur = localStorage.getItem('w05-theme') || 'reading'; } catch (e) { /* storage unavailable */ }
    sel.value = cur;
    sel.addEventListener('change', () => {
      const v = sel.value;
      if (v === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', v);
      try { localStorage.setItem('w05-theme', v); } catch (e) { /* storage unavailable */ }
    });
  };
  L.themePicker();

  /* ---------- MathJax re-typeset for dynamic content ---------- */
  L.typeset = els => {
    if (window.MathJax && MathJax.typesetPromise) {
      (MathJax.startup && MathJax.startup.promise ? MathJax.startup.promise : Promise.resolve())
        .then(() => MathJax.typesetPromise(els)).catch(() => {});
    }
  };

  /* ---------- controls ---------- */
  // Bind a range input to an <output>; returns a getter. map converts slider value to model value.
  L.range = (id, { map = v => v, show = v => v, on } = {}) => {
    const el = document.getElementById(id);
    const out = document.querySelector(`output[for="${id}"]`);
    const get = () => map(parseFloat(el.value));
    const upd = () => { if (out) out.textContent = show(get()); };
    el.addEventListener('input', () => { upd(); on && on(get()); });
    upd();
    get.el = el;
    get.set = raw => { el.value = raw; upd(); };
    get.refresh = upd;
    return get;
  };
  // Segmented buttons: container with buttons[data-v]; returns getter
  L.seg = (id, on) => {
    const box = document.getElementById(id);
    let val = (box.querySelector('[aria-pressed="true"]') || box.querySelector('button')).dataset.v;
    const set = v => {
      val = v;
      box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    };
    box.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      set(b.dataset.v); on && on(val);
    });
    set(val);
    const get = () => val;
    get.set = set;
    return get;
  };
  // Preset chips: row with buttons[data-preset]
  L.presets = (rowId, explainerId, table, apply) => {
    const row = document.getElementById(rowId);
    const exp = explainerId && document.getElementById(explainerId);
    const select = key => {
      row.querySelectorAll('button[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === key)));
      if (exp && table[key]) { exp.querySelector('p').innerHTML = table[key].text; L.typeset([exp]); }
      apply(key, table[key]);
    };
    row.addEventListener('click', e => {
      const b = e.target.closest('button[data-preset]');
      if (b) select(b.dataset.preset);
    });
    return {
      select,
      clear: () => row.querySelectorAll('button[data-preset]').forEach(b => b.setAttribute('aria-pressed', 'false'))
    };
  };

  /* ---------- tabs ---------- */
  L.tabs = (navId) => {
    const nav = document.getElementById(navId);
    const btns = L.$$('button[role="tab"]', nav);
    const show = id => {
      btns.forEach(b => {
        const on = b.getAttribute('aria-controls') === id;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        document.getElementById(b.getAttribute('aria-controls')).hidden = !on;
      });
      try { localStorage.setItem('tab:' + location.pathname + navId, id); } catch (e) { /* storage unavailable */ }
    };
    nav.addEventListener('click', e => {
      const b = e.target.closest('button[role="tab"]');
      if (b) show(b.getAttribute('aria-controls'));
    });
    nav.addEventListener('keydown', e => {
      const i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const j = (i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length;
        btns[j].focus(); show(btns[j].getAttribute('aria-controls'));
        e.preventDefault();
      }
    });
    const ids = btns.map(b => b.getAttribute('aria-controls'));
    const fromHash = location.hash.slice(1);
    let start = ids.includes(fromHash) ? fromHash : null;
    if (!start) { try { const s = localStorage.getItem('tab:' + location.pathname + navId); if (ids.includes(s)) start = s; } catch (e) { /* ignore */ } }
    show(start || ids[0]);
    L.$$('a[data-tab]').forEach(a => a.addEventListener('click', ev => {
      ev.preventDefault(); show(a.dataset.tab);
      document.getElementById(navId).scrollIntoView({ behavior: L.reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }));
    return { show };
  };

  /* ---------- Plot ---------- */
  class Plot {
    constructor(canvas, opts = {}) {
      this.c = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
      this.ctx = this.c.getContext('2d');
      this.o = Object.assign({ xmin: -1, xmax: 1, ymin: -1, ymax: 1, equal: false, pad: { l: 44, r: 14, t: 28, b: 36 } }, opts);
      this.o.pad = Object.assign({ l: 44, r: 14, t: 28, b: 36 }, opts.pad || {});
      this.draw = () => {};
      this._raf = 0;
      new ResizeObserver(() => this.render()).observe(this.c);
      L.onTheme(() => this.render());
    }
    range(xmin, xmax, ymin, ymax) { Object.assign(this.o, { xmin, xmax, ymin, ymax }); return this; }
    layout() {
      const dpr = window.devicePixelRatio || 1;
      const w = this.c.clientWidth, h = this.c.clientHeight;
      if (this.c.width !== Math.round(w * dpr) || this.c.height !== Math.round(h * dpr)) {
        this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
      }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w; this.h = h;
      const p = this.o.pad;
      let { xmin, xmax, ymin, ymax } = this.o;
      const pw = Math.max(10, w - p.l - p.r), ph = Math.max(10, h - p.t - p.b);
      if (this.o.equal) {
        const s = Math.min(pw / (xmax - xmin), ph / (ymax - ymin));
        const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
        xmin = cx - pw / s / 2; xmax = cx + pw / s / 2; ymin = cy - ph / s / 2; ymax = cy + ph / s / 2;
      }
      this.v = { xmin, xmax, ymin, ymax };
      this.pw = pw; this.ph = ph;
      this.sx = pw / (xmax - xmin); this.sy = ph / (ymax - ymin);
    }
    X(x) { return this.o.pad.l + (x - this.v.xmin) * this.sx; }
    Y(y) { return this.o.pad.t + (this.v.ymax - y) * this.sy; }
    wx(px) { return this.v.xmin + (px - this.o.pad.l) / this.sx; }
    wy(py) { return this.v.ymax - (py - this.o.pad.t) / this.sy; }
    render() {
      if (!this.c.clientWidth || !this.c.clientHeight) return;
      this.layout();
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.fillStyle = L.css('--plot-bg');
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.save();
      this.draw(this, ctx);
      ctx.restore();
    }
    request() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this.render(); });
    }
    clip(fn) {
      const ctx = this.ctx, p = this.o.pad;
      ctx.save(); ctx.beginPath(); ctx.rect(p.l, p.t, this.pw, this.ph); ctx.clip();
      fn(ctx); ctx.restore();
    }
    static niceStep(span, target) {
      const raw = span / target, mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const r = raw / mag;
      return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
    }
    axes({ xlabel = '', ylabel = '', xticks = 6, yticks = 5, xfmt, yfmt, zero = true } = {}) {
      const ctx = this.ctx, v = this.v, p = this.o.pad;
      const grid = L.css('--plot-grid'), axis = L.css('--plot-axis'), ink = L.css('--plot-ink');
      const sx = Plot.niceStep(v.xmax - v.xmin, Math.max(2, Math.min(xticks, this.pw / 60)));
      const sy = Plot.niceStep(v.ymax - v.ymin, Math.max(2, Math.min(yticks, this.ph / 40)));
      const dec = s => Math.max(0, -Math.floor(Math.log10(s) + 1e-9));
      xfmt = xfmt || (t => t.toFixed(dec(sx)).replace('-', '−'));
      yfmt = yfmt || (t => t.toFixed(dec(sy)).replace('-', '−'));
      ctx.lineWidth = 1;
      ctx.font = `12.5px ${L.css('--font-mono')}`;
      ctx.fillStyle = ink;
      ctx.strokeStyle = grid;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let t = Math.ceil(v.xmin / sx) * sx; t <= v.xmax + 1e-9; t += sx) {
        const x = Math.round(this.X(t)) + .5;
        ctx.beginPath(); ctx.moveTo(x, p.t); ctx.lineTo(x, p.t + this.ph); ctx.stroke();
        ctx.fillText(xfmt(Math.abs(t) < 1e-12 ? 0 : t), x, p.t + this.ph + 5);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let t = Math.ceil(v.ymin / sy) * sy; t <= v.ymax + 1e-9; t += sy) {
        const y = Math.round(this.Y(t)) + .5;
        ctx.beginPath(); ctx.moveTo(p.l, y); ctx.lineTo(p.l + this.pw, y); ctx.stroke();
        ctx.fillText(yfmt(Math.abs(t) < 1e-12 ? 0 : t), p.l - 6, y);
      }
      ctx.strokeStyle = axis;
      if (zero) {
        if (v.ymin < 0 && v.ymax > 0) { const y = Math.round(this.Y(0)) + .5; ctx.beginPath(); ctx.moveTo(p.l, y); ctx.lineTo(p.l + this.pw, y); ctx.stroke(); }
        if (v.xmin < 0 && v.xmax > 0) { const x = Math.round(this.X(0)) + .5; ctx.beginPath(); ctx.moveTo(x, p.t); ctx.lineTo(x, p.t + this.ph); ctx.stroke(); }
      }
      ctx.strokeRect(p.l + .5, p.t + .5, this.pw - 1, this.ph - 1);
      ctx.font = `italic 14.5px ${L.css('--font-display')}`;
      ctx.fillStyle = ink;
      if (xlabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(xlabel, p.l + this.pw - 6, p.t + this.ph - 4); }
      if (ylabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(ylabel, p.l + 6, p.t + 5); }
    }
    // Heat map of f over the plot area; color(value) → [r,g,b,a(0..255)]
    heat(f, color, res = 4) {
      const cols = Math.ceil(this.pw / res), rows = Math.ceil(this.ph / res);
      if (!this._off) this._off = document.createElement('canvas');
      const off = this._off; off.width = cols; off.height = rows;
      const octx = off.getContext('2d');
      const img = octx.createImageData(cols, rows);
      for (let j = 0; j < rows; j++) {
        const y = this.wy(this.o.pad.t + (j + .5) * this.ph / rows);
        for (let i = 0; i < cols; i++) {
          const x = this.wx(this.o.pad.l + (i + .5) * this.pw / cols);
          const c = color(f(x, y));
          const k = 4 * (j * cols + i);
          img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = c[3];
        }
      }
      octx.putImageData(img, 0, 0);
      const ctx = this.ctx;
      ctx.save(); ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, this.o.pad.l, this.o.pad.t, this.pw, this.ph);
      ctx.restore();
    }
    // Marching-squares contour of f = level, drawn as line segments
    contour(f, level, { res = 5, color, width = 2, dash = [] } = {}) {
      const cols = Math.ceil(this.pw / res) + 1, rows = Math.ceil(this.ph / res) + 1;
      const vals = new Float64Array(cols * rows);
      const px = i => this.o.pad.l + i * this.pw / (cols - 1), py = j => this.o.pad.t + j * this.ph / (rows - 1);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) vals[j * cols + i] = f(this.wx(px(i)), this.wy(py(j))) - level;
      const ctx = this.ctx;
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath();
      const lerp = (a, b) => a / (a - b);
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = vals[j * cols + i], b = vals[j * cols + i + 1], c = vals[(j + 1) * cols + i + 1], d = vals[(j + 1) * cols + i];
        const pts = [];
        const x0 = px(i), x1 = px(i + 1), y0 = py(j), y1 = py(j + 1);
        if ((a > 0) !== (b > 0)) pts.push([x0 + (x1 - x0) * lerp(a, b), y0]);
        if ((b > 0) !== (c > 0)) pts.push([x1, y0 + (y1 - y0) * lerp(b, c)]);
        if ((d > 0) !== (c > 0)) pts.push([x0 + (x1 - x0) * lerp(d, c), y1]);
        if ((a > 0) !== (d > 0)) pts.push([x0, y0 + (y1 - y0) * lerp(a, d)]);
        if (pts.length >= 2) { ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); }
        if (pts.length === 4) { ctx.moveTo(pts[2][0], pts[2][1]); ctx.lineTo(pts[3][0], pts[3][1]); }
      }
      ctx.stroke(); ctx.restore();
    }
    // Draw an infinite line a*x + b*y + c = 0 clipped to the view
    line(a, b, c, style = {}) {
      const v = this.v, ctx = this.ctx;
      let p1, p2;
      if (Math.abs(b) > Math.abs(a)) { p1 = [v.xmin, -(a * v.xmin + c) / b]; p2 = [v.xmax, -(a * v.xmax + c) / b]; }
      else if (Math.abs(a) > 1e-12) { p1 = [-(b * v.ymin + c) / a, v.ymin]; p2 = [-(b * v.ymax + c) / a, v.ymax]; }
      else return;
      this.clip(() => {
        ctx.strokeStyle = style.color || L.css('--fg'); ctx.lineWidth = style.width || 2; ctx.setLineDash(style.dash || []);
        ctx.beginPath(); ctx.moveTo(this.X(p1[0]), this.Y(p1[1])); ctx.lineTo(this.X(p2[0]), this.Y(p2[1])); ctx.stroke();
      });
    }
    curve(f, { color, width = 2.2, dash = [], x0, x1, n } = {}) {
      const ctx = this.ctx;
      x0 = x0 ?? this.v.xmin; x1 = x1 ?? this.v.xmax; n = n || Math.max(100, Math.round(this.pw / 2));
      this.clip(() => {
        ctx.strokeStyle = color || L.css('--fg'); ctx.lineWidth = width; ctx.setLineDash(dash);
        ctx.beginPath();
        let pen = false;
        for (let i = 0; i <= n; i++) {
          const x = x0 + (x1 - x0) * i / n, y = f(x);
          if (!isFinite(y)) { pen = false; continue; }
          const Y = L.clamp(this.Y(y), -1e4, 1e4);
          if (!pen) { ctx.moveTo(this.X(x), Y); pen = true; } else ctx.lineTo(this.X(x), Y);
        }
        ctx.stroke();
      });
    }
    // Class marker: +1 = filled circle (blue), −1 = filled square (orange)
    marker(x, y, label, { r = 6, ring = false, faded = false, ringColor } = {}) {
      const ctx = this.ctx, X = this.X(x), Y = this.Y(y);
      ctx.save();
      ctx.globalAlpha = faded ? .35 : 1;
      ctx.fillStyle = label > 0 ? L.css('--pos') : L.css('--neg');
      ctx.strokeStyle = L.css('--plot-bg'); ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (label > 0) ctx.arc(X, Y, r, 0, 2 * Math.PI); else ctx.rect(X - r * .9, Y - r * .9, r * 1.8, r * 1.8);
      ctx.fill(); ctx.stroke();
      if (ring) {
        ctx.globalAlpha = 1; ctx.strokeStyle = ringColor || L.css('--fg'); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X, Y, r + 5, 0, 2 * Math.PI); ctx.stroke();
      }
      ctx.restore();
    }
    dot(x, y, { r = 4, color } = {}) {
      const ctx = this.ctx;
      ctx.fillStyle = color || L.css('--fg');
      ctx.beginPath(); ctx.arc(this.X(x), this.Y(y), r, 0, 2 * Math.PI); ctx.fill();
    }
    arrow(x0, y0, x1, y1, { color, width = 2 } = {}) {
      const ctx = this.ctx, X0 = this.X(x0), Y0 = this.Y(y0), X1 = this.X(x1), Y1 = this.Y(y1);
      const a = Math.atan2(Y1 - Y0, X1 - X0), h = 9;
      ctx.save(); ctx.strokeStyle = ctx.fillStyle = color || L.css('--fg'); ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X1, Y1);
      ctx.lineTo(X1 - h * Math.cos(a - .4), Y1 - h * Math.sin(a - .4));
      ctx.lineTo(X1 - h * Math.cos(a + .4), Y1 - h * Math.sin(a + .4)); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    label(text, x, y, { color, align = 'left', base = 'middle', font, dx = 0, dy = 0 } = {}) {
      const ctx = this.ctx;
      ctx.save(); ctx.fillStyle = color || L.css('--plot-ink');
      ctx.font = font || `13.5px ${L.css('--font-body')}`;
      ctx.textAlign = align; ctx.textBaseline = base;
      ctx.fillText(text, this.X(x) + dx, this.Y(y) + dy); ctx.restore();
    }
  }
  L.Plot = Plot;

  // Diverging blue/orange fill for decision values. s = soft scale.
  L.divergingColor = (scale = 1, maxAlpha = 0.42) => {
    const pos = L.rgb('--pos'), neg = L.rgb('--neg');
    return v => {
      const t = Math.min(1, Math.abs(v) / scale);
      const c = v >= 0 ? pos : neg;
      return [c[0], c[1], c[2], Math.round(255 * maxAlpha * Math.sqrt(t))];
    };
  };
  // Sequential single-hue fill (primary)
  L.seqColor = (lo, hi, maxAlpha = 0.85, token = '--primary') => {
    const c = L.rgb(token);
    return v => {
      const t = L.clamp((v - lo) / (hi - lo || 1), 0, 1);
      return [c[0], c[1], c[2], Math.round(255 * maxAlpha * t)];
    };
  };

  /* ---------- dragging points ---------- */
  // pts: () => array of {x,y}; onMove(i, x, y); hitPx radius
  L.drag = (plot, { pts, onMove, onEnd, onHover, hitPx = 16, bounds }) => {
    const c = plot.c;
    let active = -1;
    const pos = e => {
      const r = c.getBoundingClientRect();
      return [plot.wx(e.clientX - r.left), plot.wy(e.clientY - r.top), e.clientX - r.left, e.clientY - r.top];
    };
    const hit = (px, py) => {
      let best = -1, bd = hitPx * hitPx;
      pts().forEach((p, i) => {
        const dx = plot.X(p.x) - px, dy = plot.Y(p.y) - py, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    };
    c.addEventListener('pointerdown', e => {
      const [, , px, py] = pos(e);
      active = hit(px, py);
      if (active >= 0) { c.setPointerCapture(e.pointerId); e.preventDefault(); c.style.cursor = 'grabbing'; }
    });
    c.addEventListener('pointermove', e => {
      const [x, y, px, py] = pos(e);
      if (active >= 0) {
        const v = plot.v, b = bounds || v;
        onMove(active, L.clamp(x, b.xmin, b.xmax), L.clamp(y, b.ymin, b.ymax));
      } else {
        c.style.cursor = hit(px, py) >= 0 ? 'grab' : 'crosshair';
        onHover && onHover(x, y);
      }
    });
    const end = e => {
      if (active >= 0) { active = -1; c.style.cursor = 'grab'; try { c.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ } onEnd && onEnd(); }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', () => { if (active < 0 && onHover) onHover(null, null); });
  };

  /* ---------- linear algebra ---------- */
  L.dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  L.dist2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return s; };
  // Solve A x = b (Gaussian elimination with partial pivoting); returns null if singular
  L.solve = (A, b) => {
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      if (Math.abs(M[p][k]) < 1e-14) return null;
      [M[k], M[p]] = [M[p], M[k]];
      for (let i = k + 1; i < n; i++) {
        const f = M[i][k] / M[k][k];
        for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = M[i][n];
      for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  };
  // Symmetric eigen-decomposition (cyclic Jacobi). Returns {values, vectors} with vectors[k] the k-th eigenvector, sorted descending.
  L.eigSym = A0 => {
    const n = A0.length, A = A0.map(r => r.slice());
    const V = A.map((r, i) => r.map((_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
        }
      }
    }
    const idx = [...Array(n).keys()].sort((a, b) => A[b][b] - A[a][a]);
    return { values: idx.map(i => A[i][i]), vectors: idx.map(i => V.map(r => r[i])) };
  };
  // Largest eigenvalue of a symmetric PSD matrix via power iteration
  L.lambdaMax = K => {
    const n = K.length; let v = new Array(n).fill(1 / Math.sqrt(n)), lam = 0;
    for (let it = 0; it < 200; it++) {
      const w = K.map(r => L.dot(r, v));
      const nrm = Math.sqrt(L.dot(w, w)) || 1;
      const l2 = L.dot(v, w);
      v = w.map(x => x / nrm);
      if (Math.abs(l2 - lam) < 1e-10 * Math.abs(l2)) { lam = l2; break; }
      lam = l2;
    }
    return lam;
  };

  /* ---------- kernels ---------- */
  L.kernel = (type, p = {}) => {
    switch (type) {
      case 'linear': return (a, b) => L.dot(a, b);
      case 'poly': return (a, b) => Math.pow(L.dot(a, b) + p.c, p.k);
      case 'cubic': return (a, b) => { const t = L.dot(a, b); return 1 + t + t * t + t * t * t; };
      case 'rbf': return (a, b) => Math.exp(-L.dist2(a, b) / (2 * p.sigma * p.sigma));
      default: throw new Error('unknown kernel ' + type);
    }
  };

  /* ---------- SMO for the SVM dual ----------
     Lecture form: max W(α) = Σα − ½ΣΣ y_i y_j α_i α_j K_ij, 0 ≤ α ≤ C, Σ α_i y_i = 0.
     Internally we minimise f(α) = −W(α) with gradient G = Qα − 1, Q_ij = y_i y_j K_ij,
     choosing the maximal-violating pair each step (Keerthi et al.; LIBSVM's first-order rule). */
  class SMO {
    constructor(X, y, kfn, C, tol = 1e-3) {
      this.X = X; this.y = y; this.k = kfn; this.C = C; this.tol = tol;
      const n = this.n = X.length;
      this.K = X.map(a => X.map(b => kfn(a, b)));
      this.alpha = new Array(n).fill(0);
      this.G = new Array(n).fill(-1);
      this.iter = 0;
    }
    up(t) { const a = this.alpha[t]; return (this.y[t] > 0 && a < this.C - 1e-12) || (this.y[t] < 0 && a > 1e-12); }
    low(t) { const a = this.alpha[t]; return (this.y[t] < 0 && a < this.C - 1e-12) || (this.y[t] > 0 && a > 1e-12); }
    select() {
      let m = -Infinity, M = Infinity, i = -1, j = -1;
      for (let t = 0; t < this.n; t++) {
        const v = -this.y[t] * this.G[t];
        if (this.up(t) && v > m) { m = v; i = t; }
        if (this.low(t) && v < M) { M = v; j = t; }
      }
      return { i, j, gap: m - M };
    }
    // One SMO step. Returns info about the pair or null when converged.
    step() {
      const { i, j, gap } = this.select();
      if (i < 0 || j < 0 || gap < this.tol) return null;
      const y = this.y, K = this.K, a = this.alpha, C = this.C, G = this.G;
      const before = [a[i], a[j]];
      const Qij = y[i] * y[j] * K[i][j];
      if (y[i] !== y[j]) {
        let quad = K[i][i] + K[j][j] + 2 * Qij; if (quad <= 0) quad = 1e-12;
        const delta = (-G[i] - G[j]) / quad, diff = a[i] - a[j];
        a[i] += delta; a[j] += delta;
        if (diff > 0) { if (a[j] < 0) { a[j] = 0; a[i] = diff; } } else if (a[i] < 0) { a[i] = 0; a[j] = -diff; }
        if (diff > 0) { if (a[i] > C) { a[i] = C; a[j] = C - diff; } } else if (a[j] > C) { a[j] = C; a[i] = C + diff; }
      } else {
        let quad = K[i][i] + K[j][j] - 2 * Qij; if (quad <= 0) quad = 1e-12;
        const delta = (G[i] - G[j]) / quad, sum = a[i] + a[j];
        a[i] -= delta; a[j] += delta;
        if (sum > C) { if (a[i] > C) { a[i] = C; a[j] = sum - C; } } else if (a[j] < 0) { a[j] = 0; a[i] = sum; }
        if (sum > C) { if (a[j] > C) { a[j] = C; a[i] = sum - C; } } else if (a[i] < 0) { a[i] = 0; a[j] = sum; }
      }
      const di = a[i] - before[0], dj = a[j] - before[1];
      for (let t = 0; t < this.n; t++) G[t] += y[t] * (y[i] * K[i][t] * di + y[j] * K[j][t] * dj);
      this.iter++;
      return { i, j, gap, before, after: [a[i], a[j]] };
    }
    solve(maxIter = 50000) { while (this.iter < maxIter && this.step()); return this; }
    converged() { return this.select().gap < this.tol; }
    get b() {
      let ub = Infinity, lb = -Infinity, sum = 0, nf = 0;
      for (let t = 0; t < this.n; t++) {
        const yG = this.y[t] * this.G[t], a = this.alpha[t];
        if (a >= this.C - 1e-9) { if (this.y[t] < 0) ub = Math.min(ub, yG); else lb = Math.max(lb, yG); }
        else if (a <= 1e-9) { if (this.y[t] > 0) ub = Math.min(ub, yG); else lb = Math.max(lb, yG); }
        else { nf++; sum += yG; }
      }
      const rho = nf > 0 ? sum / nf : (isFinite(ub) && isFinite(lb) ? (ub + lb) / 2 : (isFinite(ub) ? ub : isFinite(lb) ? lb : 0));
      return -rho;
    }
    // Decision value Σ α_i y_i K(x_i, x) + b
    f(x, b = this.b) {
      let s = b;
      for (let t = 0; t < this.n; t++) if (this.alpha[t] > 1e-10) s += this.alpha[t] * this.y[t] * this.k(this.X[t], x);
      return s;
    }
    fTrain(t, b = this.b) { let s = b; for (let u = 0; u < this.n; u++) s += this.alpha[u] * this.y[u] * this.K[u][t]; return s; }
    W() {
      let s = 0;
      for (let i = 0; i < this.n; i++) {
        s += this.alpha[i];
        for (let j = 0; j < this.n; j++) s -= .5 * this.y[i] * this.y[j] * this.alpha[i] * this.alpha[j] * this.K[i][j];
      }
      return s;
    }
    w() { // linear kernel only: w = Σ α_i y_i x_i
      const d = this.X[0].length, w = new Array(d).fill(0);
      for (let t = 0; t < this.n; t++) for (let k = 0; k < d; k++) w[k] += this.alpha[t] * this.y[t] * this.X[t][k];
      return w;
    }
  }
  L.SMO = SMO;

  /* ---------- seeded random ---------- */
  L.rng = (seed = 1) => {
    let s = seed >>> 0;
    const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.normal = () => { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    return r;
  };
})();
