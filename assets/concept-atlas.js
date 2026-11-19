(function () {
  'use strict';

  const minZoom = 0.7;
  const maxZoom = 48;
  const fullCircle = 2 * Math.PI;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const fallbackTheme = { bg: 'white', ink: 'black', ink3: 'gray', line: 'gainsboro', font: 'sans-serif' };

  function readTheme(element) {
    try {
      if (typeof globalThis.getComputedStyle !== 'function') return fallbackTheme;
      const style = globalThis.getComputedStyle(element);
      const read = (name, fallback) => (style.getPropertyValue(name) || '').trim() || fallback;
      return {
        bg: read('--color-bg', fallbackTheme.bg),
        ink: read('--color-ink', fallbackTheme.ink),
        ink3: read('--color-ink-3', fallbackTheme.ink3),
        line: read('--color-line', fallbackTheme.line),
        font: read('--font-sans', fallbackTheme.font),
      };
    } catch (_) {
      return fallbackTheme;
    }
  }

  function overviewTitle(title) {
    const shortTitle = title.split(/[(:：]/, 1)[0].trim();
    return /[,，/;]/.test(shortTitle) ? '' : shortTitle;
  }

  function mount(root, model, opts = {}) {
    const canvas = root.querySelector('[data-atlas-canvas]');
    const context = canvas.getContext('2d', { alpha: false });
    const level = root.querySelector('[data-atlas-level]');
    const overlays = [...root.querySelectorAll('[data-atlas-overlay]')];
    const state = opts.state || {};
    let theme = readTheme(root);
    const nodes = model.nodes.map((node) => {
      const importance = Math.min(1, Math.log2(1 + (node.degree || 0)) / 5);
      return { ...node, importance, shortTitle: overviewTitle(node.title), screenX: 0, screenY: 0, radius: 1 };
    });
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const neighbors = new Map(nodes.map((node) => [node, []]));
    const edges = [];
    for (const [from, to] of model.edges) {
      const source = nodes[from];
      const target = nodes[to];
      if (!source || !target || source === target) continue;
      edges.push([source, target]);
      neighbors.get(source).push(target);
      neighbors.get(target).push(source);
    }
    const ranked = [...nodes].sort((a, b) => b.importance - a.importance || b.degree - a.degree);
    const representatives = new Map();
    for (const node of ranked) {
      if (node.group >= 0 && !representatives.has(node.group)) representatives.set(node.group, node);
    }
    const overviewRanks = [...new Set([...representatives.values(), ...ranked])];

    const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (const { x, y } of nodes) {
      bounds.left = Math.min(bounds.left, x);
      bounds.top = Math.min(bounds.top, y);
      bounds.right = Math.max(bounds.right, x);
      bounds.bottom = Math.max(bounds.bottom, y);
    }
    if (!nodes.length) Object.assign(bounds, { left: -0.5, top: -0.5, right: 0.5, bottom: 0.5 });
    const spanX = Math.max(1, bounds.right - bounds.left);
    const spanY = Math.max(1, bounds.bottom - bounds.top);
    const originX = (bounds.left + bounds.right) / 2;
    const originY = (bounds.top + bounds.bottom) / 2;

    let zoom = Number.isFinite(state.zoom) ? clamp(state.zoom, minZoom, maxZoom) : 1;
    let centerX = Number.isFinite(state.panX) ? originX + state.panX * spanX : originX;
    let centerY = Number.isFinite(state.panY) ? originY + state.panY * spanY : originY;
    let selected = nodeById.get(state.selectedId) || null;
    let hovered = null;
    let width = 0;
    let height = 0;
    let viewTop = 0;
    let viewBottom = 0;
    let viewCenterY = 0;
    let pixelRatio = 1;
    let rotated = false;
    let fit = 1;
    let positionsDirty = true;
    let frame = 0;
    let destroyed = false;
    let moved = false;
    let start = null;
    let labelRects = [];
    const pointers = new Map();
    const labelWidths = new Map();
    const listeners = new AbortController();
    const listen = (target, event, handler, options) => {
      target.addEventListener(event, handler, { ...options, signal: listeners.signal });
    };

    function scale() {
      return fit * zoom;
    }

    function worldOffset(x, y, atScale = scale()) {
      return rotated ? { x: y / atScale, y: -x / atScale } : { x: x / atScale, y: y / atScale };
    }

    function updatePositions() {
      if (!positionsDirty) return;
      positionsDirty = false;
      const atScale = scale();
      for (const node of nodes) {
        const x = (node.x - centerX) * atScale;
        const y = (node.y - centerY) * atScale;
        node.screenX = width / 2 + (rotated ? -y : x);
        node.screenY = viewCenterY + (rotated ? x : y);
        node.radius = (0.72 + node.importance * 1.24) * Math.min(1.65, 1 + Math.log2(Math.max(zoom, 1)) * 0.15);
      }
    }

    function requestDraw() {
      if (frame || destroyed) return;
      frame = requestAnimationFrame(draw);
    }

    function saveCamera() {
      centerX = clamp(centerX, bounds.left - spanX * 0.05, bounds.right + spanX * 0.05);
      centerY = clamp(centerY, bounds.top - spanY * 0.05, bounds.bottom + spanY * 0.05);
      state.zoom = zoom;
      state.panX = (centerX - originX) / spanX;
      state.panY = (centerY - originY) / spanY;
      state.selectedId = selected?.id || null;
      canvas.dataset.zoom = zoom.toFixed(3);
      if (level) level.textContent = `${Math.round(zoom * 100)}%`;
      positionsDirty = true;
      labelRects = [];
      requestDraw();
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const nextWidth = rect.width;
      const nextHeight = rect.height;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      if (!nextWidth || !nextHeight) return;
      const resized = width !== nextWidth || height !== nextHeight || pixelRatio !== ratio;
      if (resized) {
        width = nextWidth;
        height = nextHeight;
        pixelRatio = ratio;
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
      }

      let top = Math.min(42, height * 0.13);
      let bottom = height - top;
      for (const overlay of overlays) {
        const box = overlay.getBoundingClientRect();
        if (!box.width || !box.height) continue;
        if (overlay.dataset.atlasOverlay === 'top') top = Math.max(top, box.bottom - rect.top + 10);
        if (overlay.dataset.atlasOverlay === 'bottom') bottom = Math.min(bottom, box.top - rect.top - 10);
      }
      top = Math.min(top, height * 0.33);
      bottom = Math.max(bottom, height * 0.67);
      if (!resized && viewTop === top && viewBottom === bottom) return;
      viewTop = top;
      viewBottom = bottom;
      viewCenterY = (top + bottom) / 2;

      const availableWidth = width - 2 * Math.min(55, width * 0.12);
      const availableHeight = bottom - top;
      const normalFit = Math.min(availableWidth / spanX, availableHeight / spanY);
      const rotatedFit = Math.min(availableWidth / spanY, availableHeight / spanX);
      rotated = rotatedFit > normalFit * 1.08;
      fit = rotated ? rotatedFit : normalFit;
      positionsDirty = true;
      labelRects = [];
      requestDraw();
    }

    function drawLinks(active) {
      context.strokeStyle = active ? theme.line : theme.ink3;
      context.globalAlpha = active ? 1 : 0.32;
      context.lineWidth = zoom < 2 ? 0.6 : 0.8;
      context.beginPath();
      for (const [a, b] of edges) {
        if ((a.screenX < 0 && b.screenX < 0) || (a.screenX > width && b.screenX > width) ||
            (a.screenY < 0 && b.screenY < 0) || (a.screenY > height && b.screenY > height)) continue;
        context.moveTo(a.screenX, a.screenY);
        context.lineTo(b.screenX, b.screenY);
      }
      context.stroke();
      context.globalAlpha = 1;

      if (!active) return;
      context.strokeStyle = theme.ink;
      context.globalAlpha = 0.7;
      context.lineWidth = 1.2;
      context.beginPath();
      for (const node of neighbors.get(active)) {
        context.moveTo(active.screenX, active.screenY);
        context.lineTo(node.screenX, node.screenY);
      }
      context.stroke();
      context.globalAlpha = 1;
    }

    function drawStars(visible, active, connected) {
      context.fillStyle = theme.ink;
      for (const node of visible) {
        const { screenX: x, screenY: y, radius } = node;
        const emphasized = node === active || connected.has(node);
        const starRadius = radius + (node === active ? 2.6 : emphasized ? 0.8 : 0);
        context.globalAlpha = active && !emphasized ? 0.28 : 0.92;
        context.beginPath();
        context.arc(x, y, starRadius, 0, fullCircle);
        context.fill();
      }
      context.globalAlpha = 1;
      if (selected && visible.includes(selected)) {
        context.strokeStyle = theme.ink;
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(selected.screenX, selected.screenY, selected.radius + 2.6 + 5.5, 0, fullCircle);
        context.stroke();
      }
    }

    function drawLabels(visible, active, connected) {
      labelRects = [];
      const compact = width < 500;
      const overview = zoom < 1.25;
      const maxLabels = clamp(Math.floor(width * height / 5400), 12, 80);
      const cap = Math.min(maxLabels, (compact ? 4 : 6) + Math.ceil(8 * Math.log2(Math.max(1, zoom))));
      const ranks = overview ? overviewRanks : ranked;
      const visibleSet = new Set(visible);
      const candidates = new Set([active, selected, ...connected, ...ranks]);
      context.textBaseline = 'middle';
      context.lineJoin = 'round';

      for (const node of candidates) {
        if (labelRects.length >= cap) break;
        if (!node || !visibleSet.has(node) || !node.title) continue;
        const emphasized = node === active || node === selected;
        const related = connected.has(node);
        if (overview && active && !emphasized && !related) continue;
        if (overview && node.degree < 3 && !emphasized && !related) continue;
        const shortLabel = zoom < 1.85 && !emphasized;
        const title = shortLabel ? node.shortTitle : node.title;
        if (!title) continue;
        const fontSize = emphasized ? 13 : overview && compact ? 10 : 11;
        const font = `${emphasized ? 700 : 500} ${fontSize}px ${theme.font}`;
        context.font = font;
        const key = `${font}:${title}`;
        if (!labelWidths.has(key)) labelWidths.set(key, context.measureText(title).width);
        const labelWidth = Math.min(labelWidths.get(key), width - 16);
        if (shortLabel && labelWidth > (compact ? 82 : 104)) continue;
        const lineHeight = fontSize + 6;
        const { screenX: x, screenY: y } = node;
        const gap = node.radius + (emphasized ? 12 : 4);
        const positions = [
          [x + gap, y - lineHeight / 2],
          [x - gap - labelWidth, y - lineHeight / 2],
          [x - labelWidth / 2, y - gap - lineHeight],
          [x - labelWidth / 2, y + gap],
        ];
        if (emphasized) positions.push([
          clamp(x + gap, 8, width - labelWidth - 8),
          clamp(y - lineHeight / 2, viewTop + 1, viewBottom - lineHeight - 1),
        ]);
        let placement;
        let leastCrowded = Infinity;
        for (const [left, top] of positions) {
          const right = left + labelWidth;
          const bottom = top + lineHeight;
          if (left < 7 || right > width - 7 || top < viewTop || bottom > viewBottom) continue;
          if (labelRects.some((rect) => (
            left < rect.right + 8 && right + 8 > rect.left && top < rect.bottom + 3 && bottom > rect.top - 3
          ))) continue;

          let crowding = 0;
          if (overview && !emphasized) {
            for (const star of visible) {
              if (star.screenX > left - 1 && star.screenX < right + 1 &&
                  star.screenY > top + 1 && star.screenY < bottom - 1) {
                crowding += star.importance > 0.55 ? 2 : 1;
                if (crowding >= Math.min(leastCrowded, 5)) break;
              }
            }
          }
          if (crowding >= Math.min(leastCrowded, 5)) continue;
          placement = { left, top, right, bottom, node };
          leastCrowded = crowding;
          if (!crowding) break;
        }
        if (!placement) continue;
        labelRects.push(placement);
        const { left, top } = placement;
        context.lineWidth = emphasized ? 3.5 : 2.4;
        context.strokeStyle = theme.bg;
        context.strokeText(title, left, top + lineHeight / 2, labelWidth);
        context.fillStyle = active && !emphasized && !related ? theme.ink3 : theme.ink;
        context.fillText(title, left, top + lineHeight / 2, labelWidth);
      }
    }

    function draw() {
      frame = 0;
      if (destroyed || !width || !height) return;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = theme.bg;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      updatePositions();
      const visible = nodes.filter(({ screenX: x, screenY: y }) => (
        x > -10 && x < width + 10 && y > -10 && y < height + 10
      ));
      const active = hovered || selected;
      const connected = new Set(active ? neighbors.get(active) : []);
      drawLinks(active);
      drawStars(visible, active, connected);
      drawLabels(visible, active, connected);
    }

    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function hitTest({ x, y }) {
      updatePositions();
      let closest = null;
      let distance = Infinity;
      for (const node of nodes) {
        const dx = node.screenX - x;
        const dy = node.screenY - y;
        const squared = dx * dx + dy * dy;
        if (squared < distance && squared <= (node.radius + 5) ** 2) {
          closest = node;
          distance = squared;
        }
      }
      return closest || labelRects.find((rect) => (
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      ))?.node || null;
    }

    function changeCamera(factor, from, to = from) {
      if (!width || !height) return;
      const before = worldOffset(from.x - width / 2, from.y - viewCenterY);
      zoom = clamp(zoom * factor, minZoom, maxZoom);
      const after = worldOffset(to.x - width / 2, to.y - viewCenterY);
      centerX += before.x - after.x;
      centerY += before.y - after.y;
      hovered = null;
      canvas.style.cursor = '';
      saveCamera();
    }

    function zoomBy(factor) {
      changeCamera(factor, { x: width / 2, y: viewCenterY });
    }

    function fitView() {
      zoom = 1;
      centerX = originX;
      centerY = originY;
      hovered = selected = null;
      canvas.style.cursor = '';
      saveCamera();
    }

    function focus(id) {
      const node = nodeById.get(id);
      if (!node || destroyed) return;
      hovered = null;
      selected = node;
      centerX = node.x;
      centerY = node.y;
      zoom = Math.max(zoom, 3.5);
      saveCamera();
    }

    function open(node) {
      selected = node;
      saveCamera();
      if (node) opts.onOpen?.(node.id);
    }

    function pinch() {
      const [a, b] = pointers.values();
      return {
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        length: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      };
    }

    function pointerDown(event) {
      if (event.button !== 0) return;
      const position = point(event);
      if (!pointers.size) {
        start = position;
        moved = false;
      }
      pointers.set(event.pointerId, position);
      if (pointers.size > 1) moved = true;
      canvas.setPointerCapture(event.pointerId);
    }

    function pointerMove(event) {
      const position = point(event);
      if (!pointers.size && event.pointerType !== 'touch') {
        const next = hitTest(position);
        if (next === hovered) return;
        hovered = next;
        canvas.style.cursor = hovered ? 'pointer' : '';
        requestDraw();
        return;
      }
      if (!pointers.has(event.pointerId)) return;
      const previous = pointers.get(event.pointerId);
      const before = pointers.size > 1 ? pinch() : null;
      pointers.set(event.pointerId, position);
      if (before) {
        const after = pinch();
        changeCamera(after.length / before.length, before.center, after.center);
      } else if (moved) {
        changeCamera(1, previous, position);
        canvas.style.cursor = 'grabbing';
      } else if (Math.hypot(position.x - start.x, position.y - start.y) > 5) {
        moved = true;
        changeCamera(1, start, position);
        canvas.style.cursor = 'grabbing';
      }
    }

    function pointerEnd(event) {
      if (!pointers.has(event.pointerId)) return;
      const position = point(event);
      const wasTap = event.type === 'pointerup' && pointers.size === 1 && !moved &&
        Math.hypot(position.x - start.x, position.y - start.y) <= 5;
      if (event.type !== 'pointerup') moved = true;
      pointers.delete(event.pointerId);
      if (!pointers.size) {
        start = null;
        canvas.style.cursor = '';
      }
      if (wasTap) open(hitTest(position));
    }

    function keyDown(event) {
      const movement = event.shiftKey ? 110 : 45;
      const center = { x: width / 2, y: viewCenterY };
      switch (event.key) {
        case '+':
        case '=': zoomBy(1.35); break;
        case '-': zoomBy(1 / 1.35); break;
        case '0':
        case 'Home': fitView(); break;
        case 'ArrowLeft': changeCamera(1, center, { ...center, x: center.x + movement }); break;
        case 'ArrowRight': changeCamera(1, center, { ...center, x: center.x - movement }); break;
        case 'ArrowUp': changeCamera(1, center, { ...center, y: center.y + movement }); break;
        case 'ArrowDown': changeCamera(1, center, { ...center, y: center.y - movement }); break;
        case '[':
        case ']': {
          const index = selected ? ranked.indexOf(selected) : event.key === ']' ? -1 : 0;
          const next = ranked[(index + (event.key === ']' ? 1 : -1) + ranked.length) % ranked.length];
          if (next) focus(next.id);
          break;
        }
        case 'Enter': if (selected || hovered) open(selected || hovered); break;
        default: return;
      }
      event.preventDefault();
    }

    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
    canvas.style.touchAction = 'none';
    listen(canvas, 'pointerdown', pointerDown);
    listen(canvas, 'pointermove', pointerMove);
    listen(canvas, 'pointerup', pointerEnd);
    listen(canvas, 'pointercancel', pointerEnd);
    listen(canvas, 'lostpointercapture', pointerEnd);
    listen(canvas, 'pointerleave', () => {
      if (pointers.size || !hovered) return;
      hovered = null;
      canvas.style.cursor = '';
      requestDraw();
    });
    listen(canvas, 'wheel', (event) => {
      event.preventDefault();
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
      const amount = clamp(-event.deltaY * units * 0.002, -0.65, 0.65);
      changeCamera(Math.exp(amount), point(event));
    }, { passive: false });
    listen(canvas, 'keydown', keyDown);
    for (const button of root.querySelectorAll('[data-atlas-zoom]')) {
      const action = button.dataset.atlasZoom;
      const handler = action === 'fit' ? fitView : () => zoomBy(action === 'in' ? 1.35 : 1 / 1.35);
      listen(button, 'click', handler);
    }

    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    for (const overlay of overlays) observer?.observe(overlay);
    listen(window, 'resize', resize);

    function refreshTheme() {
      if (destroyed) return;
      theme = readTheme(root);
      labelWidths.clear();
      requestDraw();
    }
    const scheme = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(prefers-color-scheme: dark)') : null;
    if (scheme?.addEventListener) listen(scheme, 'change', refreshTheme);
    const page = typeof document === 'object' ? document.documentElement : null;
    const themeObserver = page && typeof MutationObserver === 'function' ? new MutationObserver(refreshTheme) : null;
    themeObserver?.observe(page, { attributes: true, attributeFilter: ['data-theme'] });
    if (typeof document === 'object') document.fonts?.ready?.then(refreshTheme);
    resize();
    saveCamera();

    return {
      focus,
      destroy() {
        destroyed = true;
        observer?.disconnect();
        themeObserver?.disconnect();
        listeners.abort();
        for (const pointerId of pointers.keys()) {
          if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
        }
        pointers.clear();
        if (frame) cancelAnimationFrame(frame);
        canvas.style.cursor = '';
      },
    };
  }

  globalThis.ConceptAtlas = { mount };
}());
