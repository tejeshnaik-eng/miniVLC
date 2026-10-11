/* ─────────────────────────────────────────────────────────
   Liquid Glass
   ─────────────────────────────────────────────────────────
   Real refraction, not a blur. For every element marked [data-glass]
   we render a displacement map that models a convex, rounded bezel
   (a squircle lens): pixels near the edge sample the backdrop from
   further inside, bending whatever sits underneath. The map is fed to
   an SVG <feDisplacementMap> through `backdrop-filter: url(#…)`.
   Red, green and blue are displaced by slightly different amounts to
   get the faint dispersion you see on the edge of real glass.

   Chromium only (Electron ships it), which is why Lumen is Electron.
   ───────────────────────────────────────────────────────── */

(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const PRESETS = {
    // Toolbars, dock, zoom: nearly clear, strong lens at the rim.
    clear: { bezel: 18, refract: 22, blur: 1.2, saturate: 1.55, brightness: 1.08, dispersion: 0.07 },
    // Sidebar and big panels: calmer lens, more frost so text stays legible.
    thick: { bezel: 30, refract: 16, blur: 14, saturate: 1.7, brightness: 1.06, dispersion: 0.05 },
  };

  const supported =
    /Chrome\//.test(navigator.userAgent) && CSS.supports('backdrop-filter', 'url(#x)');

  if (!supported) {
    document.documentElement.classList.add('glass-fallback');
    return;
  }

  const defs = document.createElementNS(SVG_NS, 'svg');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  document.body.appendChild(defs);

  let uid = 0;
  const mapCache = new Map();
  const filterKeyToId = new Map();

  /** Signed distance from a point to a rounded rect centred at origin. */
  function roundedRectSDF(px, py, hw, hh, r) {
    const qx = Math.abs(px) - (hw - r);
    const qy = Math.abs(py) - (hh - r);
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
  }

  /** Build the displacement map as a PNG data URL. R = dx, G = dy. */
  function buildMap(w, h, radius, bezel) {
    // Normal maps are scale-independent gradients. Scale down large elements to max 220px:
    const scale = Math.min(1, 220 / Math.max(w, h));
    const cw = Math.max(8, Math.round(w * scale));
    const ch = Math.max(8, Math.round(h * scale));
    const cr = Math.max(2, Math.round(radius * scale));
    const cb = Math.max(2, Math.round(bezel * scale));

    const mapKey = `${cw}x${ch}x${cr}x${cb}`;
    if (mapCache.has(mapKey)) return mapCache.get(mapKey);

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(cw, ch);
    const data = img.data;

    const hw = cw / 2;
    const hh = ch / 2;
    const r = Math.min(cr, hw, hh);

    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const px = x + 0.5 - hw;
        const py = y + 0.5 - hh;
        const sdf = roundedRectSDF(px, py, hw, hh, r);
        const depth = -sdf; // >0 inside
        let dx = 0;
        let dy = 0;

        if (depth > 0 && depth < cb) {
          const t = depth / cb; // 0 at the rim, 1 where the lens flattens out
          // Convex squircle profile: strongest bend right at the rim, easing to flat.
          const mag = 1 - Math.sqrt(1 - (1 - t) * (1 - t));

          // Outward normal of the rounded rect
          const qx = Math.abs(px) - (hw - r);
          const qy = Math.abs(py) - (hh - r);
          let nx;
          let ny;
          if (qx > 0 && qy > 0) {
            const l = Math.hypot(qx, qy) || 1;
            nx = (qx / l) * Math.sign(px);
            ny = (qy / l) * Math.sign(py);
          } else if (qx > qy) {
            nx = Math.sign(px);
            ny = 0;
          } else {
            nx = 0;
            ny = Math.sign(py);
          }
          // Sample from further inside the glass.
          dx = -nx * mag;
          dy = -ny * mag;
        }

        const i = (y * cw + x) * 4;
        data[i] = Math.round(128 + dx * 127);
        data[i + 1] = Math.round(128 + dy * 127);
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    mapCache.set(mapKey, dataUrl);
    return dataUrl;
  }

  function channel(id, source, scale, matrix, result) {
    const disp = document.createElementNS(SVG_NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'map');
    disp.setAttribute('scale', String(scale));
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    disp.setAttribute('result', `${result}-d`);

    const cm = document.createElementNS(SVG_NS, 'feColorMatrix');
    cm.setAttribute('in', `${result}-d`);
    cm.setAttribute('type', 'matrix');
    cm.setAttribute('values', matrix);
    cm.setAttribute('result', result);
    return [disp, cm];
  }

  function render(el) {
    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 8 || h < 8) return;

    const preset = PRESETS[el.dataset.glass] || PRESETS.clear;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const bezel = Math.min(
      parseFloat(el.dataset.bezel) || preset.bezel,
      Math.min(w, h) / 2
    );
    const refract = parseFloat(el.dataset.refract) || preset.refract;
    const blur = el.dataset.blur !== undefined ? parseFloat(el.dataset.blur) : preset.blur;
    const d = preset.dispersion;
    const saturate = el.dataset.saturate !== undefined ? parseFloat(el.dataset.saturate) : preset.saturate;
    const brightness = el.dataset.brightness !== undefined ? parseFloat(el.dataset.brightness) : preset.brightness;

    const key = `${w}x${h}x${radius}x${bezel}x${refract}x${blur}x${saturate}x${brightness}`;
    if (el._glassKey === key) return;
    el._glassKey = key;

    let id = filterKeyToId.get(key);
    if (!id) {
      id = `lg-${++uid}`;
      filterKeyToId.set(key, id);

      const filter = document.createElementNS(SVG_NS, 'filter');
      filter.setAttribute('id', id);
      filter.setAttribute('filterUnits', 'userSpaceOnUse');
      filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
      filter.setAttribute('x', '0');
      filter.setAttribute('y', '0');
      filter.setAttribute('width', String(w));
      filter.setAttribute('height', String(h));
      filter.setAttribute('color-interpolation-filters', 'sRGB');

      const map = document.createElementNS(SVG_NS, 'feImage');
      const url = buildMap(w, h, radius, bezel);
      map.setAttribute('href', url);
      map.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
      map.setAttribute('x', '0');
      map.setAttribute('y', '0');
      map.setAttribute('width', String(w));
      map.setAttribute('height', String(h));
      map.setAttribute('preserveAspectRatio', 'none');
      map.setAttribute('result', 'map');
      filter.appendChild(map);

      const s = refract * 2; // map range is ±0.5 → scale = 2 × max offset
      const [rD, rC] = channel(id, 'SourceGraphic', s * (1 + d), '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'r');
      const [gD, gC] = channel(id, 'SourceGraphic', s, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'g');
      const [bD, bC] = channel(id, 'SourceGraphic', s * (1 - d), '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'b');
      [rD, rC, gD, gC, bD, bC].forEach((n) => filter.appendChild(n));

      const rg = document.createElementNS(SVG_NS, 'feBlend');
      rg.setAttribute('in', 'r');
      rg.setAttribute('in2', 'g');
      rg.setAttribute('mode', 'screen');
      rg.setAttribute('result', 'rg');
      const rgb = document.createElementNS(SVG_NS, 'feBlend');
      rgb.setAttribute('in', 'rg');
      rgb.setAttribute('in2', 'b');
      rgb.setAttribute('mode', 'screen');
      filter.appendChild(rg);
      filter.appendChild(rgb);

      defs.appendChild(filter);
    }

    el._glassId = id;

    // Chromium quietly weakens a heavy blur that comes AFTER an SVG url() filter, leaving a ghost of
    // the content underneath. So frosted glass blurs first and refracts second; near-clear glass
    // refracts first (sharper edge bending) with only a light blur after.
    const chain = blur >= 8
      ? `blur(${blur}px) url(#${id}) saturate(${saturate}) brightness(${brightness})`
      : `url(#${id}) blur(${blur}px) saturate(${saturate}) brightness(${brightness})`;
    el.style.backdropFilter = chain;
    el.style.webkitBackdropFilter = chain;
    el.classList.add('glass--refracting');
  }

  const pending = new Set();
  let raf = 0;
  const flush = () => {
    raf = 0;
    pending.forEach(render);
    pending.clear();
  };
  const schedule = (el) => {
    pending.add(el);
    if (!raf) raf = requestAnimationFrame(flush);
  };

  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const cr = e.contentRect;
      if (cr && cr.width >= 8 && cr.height >= 8) {
        schedule(e.target);
      }
    }
  });

  function observe(root = document) {
    if (!root.querySelectorAll) return;
    const targets = root.hasAttribute && root.hasAttribute('data-glass')
      ? [root, ...root.querySelectorAll('[data-glass]')]
      : root.querySelectorAll('[data-glass]');

    targets.forEach((el) => {
      if (!el._glassObserved) {
        el._glassObserved = true;
        ro.observe(el);
      }
      schedule(el);
    });
  }

  function refresh(root = document) {
    observe(root);
    if (root.querySelectorAll) {
      root.querySelectorAll('[data-glass]').forEach(schedule);
    }
  }

  // Observe dynamically inserted nodes (cards, rows) with data-glass
  if (typeof MutationObserver !== 'undefined') {
    const mo = new MutationObserver((mutations) => {
      let foundNew = false;
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              if (node.hasAttribute && node.hasAttribute('data-glass')) {
                observe(node);
                foundNew = true;
              } else if (node.querySelector && node.querySelector('[data-glass]')) {
                observe(node);
                foundNew = true;
              }
            }
          }
        }
      }
      if (foundNew && !raf) {
        raf = requestAnimationFrame(flush);
      }
    });

    // Only observe childList additions on body; do NOT observe style/class attributes
    mo.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  window.LumenGlass = { observe, refresh, schedule };
  observe();
})();
