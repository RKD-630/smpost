/* =========================================================
   PostCraft – app.js
   ========================================================= */

'use strict';

const UNSPLASH_ACCESS_KEY = 'YOUR_UNSPLASH_ACCESS_KEY'; // Replace this with your actual Unsplash API Key

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
const State = {
  ratio: '1:1',
  mode: 'post',          // post | cover
  canvasW: 600,
  canvasH: 600,
  zoom: 1,
  background: {
    type: 'solid',          // solid | gradient | image
    solidColor: '#ffffff',
    gradient: {
      angle: 135,
      stops: [
        { color: '#d946ef', pos: 0 },
        { color: '#06b6d4', pos: 100 },
      ],
    },
    image: {
      src: null,
      size: 'cover',
      position: 'center center',
      repeat: false,
    },
  },
  layers: [],            // array of layer objects
  selectedId: null,
  nextId: 1,
  activeStops: 2,        // gradient stops count 2-4
  textProps: {           // current text tool state
    content: 'Your Text',
    fontFamily: 'Inter, sans-serif',
    fontSize: 32,
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    colorType: 'solid',
    color: '#ffffff',
    color2: '#06b6d4',
    bgEnabled: false,
    bgColor: '#000000',
    bgOpacity: 50,
    lineHeight: 1.3,
    letterSpacing: 0,
  },
};

// ─────────────────────────────────────────────
// RATIOS → DIMENSIONS  (canvas display size)
// ─────────────────────────────────────────────
const RATIO_DIMS = {
  post: {
    '1:1':  { w: 600, h: 600  },
    '4:5':  { w: 560, h: 700  },
    '16:9': { w: 700, h: 394  },
    '9:16': { w: 394, h: 700  },
  },
  cover: {
    'facebook': { w: 820, h: 312 },
    'youtube':  { w: 700, h: 394 }, // 2560x1440 scaled
    'twitter':  { w: 750, h: 250 }, // 1500x500 scaled
    'instagram': { w: 600, h: 600 },
    'whatsapp': { w: 600, h: 600 },
  }
};

const EXPORT_DIMS = {
  post: {
    '1:1':  { w: 1080, h: 1080 },
    '4:5':  { w: 1080, h: 1350 },
    '16:9': { w: 1200, h: 675  },
    '9:16': { w: 1080, h: 1920 },
  },
  cover: {
    'facebook': { w: 820, h: 312 },
    'youtube':  { w: 2560, h: 1440 },
    'twitter':  { w: 1500, h: 500 },
    'instagram': { w: 1080, h: 1080 },
    'whatsapp': { w: 1080, h: 1080 },
  }
};

// ─────────────────────────────────────────────
// DOM REFS
// ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const canvas       = $('designCanvas');
const canvasWrapper= $('canvasWrapper');
const layersList   = $('layersList');
const exportCanvas = $('exportCanvas');

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
function uid() { return State.nextId++; }

function showToast(msg, dur = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), dur);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return {r,g,b};
}

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

function isValidImage(file) {
  if (!file) return false;
  // Check MIME type
  if (file.type && file.type.startsWith('image/')) return true;
  // Check extension as fallback for formats like .jfif, .heic, etc.
  if (!file.name) return false;
  const parts = file.name.split('.');
  if (parts.length < 2) return false;
  const ext = parts.pop().toLowerCase();
  const commonExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'jfif', 'pjpeg', 'pjp', 'avif', 'tiff', 'tif', 'heic', 'heif'];
  return commonExts.includes(ext);
}



// ─────────────────────────────────────────────
// CANVAS SIZE
// ─────────────────────────────────────────────
function applyCanvasSize() {
  const d = State.mode === 'post' ? RATIO_DIMS.post[State.ratio] : RATIO_DIMS.cover[State.ratio];
  if (!d) return;
  State.canvasW = d.w;
  State.canvasH = d.h;
  canvas.style.width  = d.w + 'px';
  canvas.style.height = d.h + 'px';
  $('infoRatio').textContent = State.ratio;
  const ed = State.mode === 'post' ? EXPORT_DIMS.post[State.ratio] : EXPORT_DIMS.cover[State.ratio];
  $('infoSize').textContent = `${ed.w} × ${ed.h}`;
  fitZoom();
}

function fitZoom() {
  const area = document.querySelector('.canvas-area');
  const aw = area.clientWidth  - 80;
  const ah = area.clientHeight - 80;
  const zw = aw / State.canvasW;
  const zh = ah / State.canvasH;
  setZoom(Math.min(zw, zh, 1));
}

function setZoom(z) {
  State.zoom = clamp(z, 0.1, 4);
  canvasWrapper.style.transform = `scale(${State.zoom})`;
  $('zoomVal').textContent = Math.round(State.zoom * 100) + '%';
}

// ─────────────────────────────────────────────
// BACKGROUND RENDERING
// ─────────────────────────────────────────────
function renderBackground() {
  const bg = State.background;
  canvas.classList.add('has-bg');

  // Reset ALL background related properties to avoid shorthand conflicts and persistence
  canvas.style.backgroundColor    = 'transparent';
  canvas.style.backgroundImage    = 'none';
  canvas.style.backgroundSize     = 'auto';
  canvas.style.backgroundPosition = 'center center';
  canvas.style.backgroundRepeat   = 'no-repeat';

  if (bg.type === 'solid') {
    canvas.style.backgroundColor = bg.solidColor;
  } else if (bg.type === 'gradient') {
    const { angle, stops } = bg.gradient;
    const active = stops.slice(0, State.activeStops);
    const parts = active.map(s => `${s.color} ${s.pos}%`).join(', ');
    canvas.style.backgroundImage = `linear-gradient(${angle}deg, ${parts})`;
  } else if (bg.type === 'image') {
    if (bg.image.src) {
      canvas.style.backgroundImage    = `url('${bg.image.src}')`;
      canvas.style.backgroundSize     = bg.image.size;
      canvas.style.backgroundPosition = bg.image.position;
      canvas.style.backgroundRepeat   = bg.image.repeat ? 'repeat' : 'no-repeat';
      canvas.style.backgroundColor    = '#000';
    } else {
      canvas.style.backgroundColor    = '#1a1a2e';
    }
  }
}

// ─────────────────────────────────────────────
// LAYER MANAGEMENT
// ─────────────────────────────────────────────
function createLayer(type, extra = {}) {
  const id = uid();
  const layer = {
    id,
    type,          // 'image' | 'text'
    x: 50, y: 50,
    w: type === 'text' ? 200 : 300,
    h: type === 'text' ? 80  : 200,
    rotate: 0,
    locked: false,
    zIndex: State.layers.length + 1,
    crop: { t: 0, r: 0, b: 0, l: 0 },
    ...extra,
  };
  State.layers.push(layer);
  renderLayer(layer);
  refreshLayersList();
  selectLayer(id);
  updateLayerCount();
  return layer;
}

function findLayer(id) {
  return State.layers.find(l => l.id === id);
}

function renderLayer(layer) {
  let el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
  const isNew = !el;

  if (isNew) {
    el = document.createElement('div');
    el.dataset.lid = layer.id;
    el.className = 'design-layer';
    canvas.appendChild(el);
    attachLayerEvents(el, layer);
  }

  el.style.left     = layer.x + 'px';
  el.style.top      = layer.y + 'px';
  el.style.width    = layer.w + 'px';
  el.style.height   = layer.h + 'px';
  el.style.zIndex   = layer.zIndex;
  el.style.transform = `rotate(${layer.rotate}deg)`;

  if (layer.type === 'image') {
    el.classList.add('image-layer');
    if (isNew && layer.src) {
      const img = document.createElement('img');
      img.src = layer.src;
      img.draggable = false;
      el.appendChild(img);
    }
    const img = el.querySelector('img');
    if (img) {
      img.style.width = (layer.imgSize || 100) + '%';
      img.style.height = (layer.imgSize || 100) + '%';
    }
    applyImageFilters(el, layer);
  } else if (layer.type === 'text') {
    el.classList.add('text-layer');
    if (isNew) {
      const contentEl = document.createElement('div');
      contentEl.className = 'text-content';
      el.appendChild(contentEl);
    }
    applyTextStyle(el, layer);
  }

  el.classList.toggle('locked-layer', layer.locked);
  return el;
}

function applyImageFilters(el, layer) {
  const f = layer.filters || {};
  const brightness  = f.brightness  ?? 100;
  const contrast    = f.contrast    ?? 100;
  const blur        = f.blur        ?? 0;
  const sepia       = f.sepia       ?? 0;
  const hue         = f.hue         ?? 0;
  const saturation  = f.saturation  ?? 100;

  // Darkness overlay via opacity on a pseudo-style trick: we use mix-blend-mode
  const darkness    = f.darkness    ?? 0;
  const warmthR     = f.warmth      ?? 0;   // warmth: shift red+yellow
  const tintG       = f.tint        ?? 0;   // tint: shift green/magenta
  const opacity     = (f.opacity    ?? 100) / 100;

  el.style.opacity = opacity;
  const img = el.querySelector('img');
  if (!img) return;

  // Build SVG filter for warmth/tint
  let filterStr = `brightness(${brightness}%) contrast(${contrast}%) sepia(${sepia}%) blur(${blur}px) hue-rotate(${hue}deg) saturate(${saturation}%)`;

  // Apply darkness as a brightness multiplier (reduce)
  if (darkness > 0) {
    const darkFactor = 1 - darkness / 100;
    filterStr = `brightness(${(brightness * darkFactor).toFixed(1)}%) contrast(${contrast}%) sepia(${sepia}%) blur(${blur}px) hue-rotate(${hue}deg) saturate(${saturation}%)`;
  }

  img.style.filter = filterStr;

  // Apply Crop (clip-path inset)
  const cp = layer.crop || { t: 0, r: 0, b: 0, l: 0 };
  if (cp.t || cp.r || cp.b || cp.l) {
    img.style.clipPath = `inset(${cp.t}% ${cp.r}% ${cp.b}% ${cp.l}%)`;
    // Center/Scale the clipped image slightly to keep visual weight
    img.style.transform = `scale(${1 + (cp.t + cp.b + cp.l + cp.r) / 200}) translate(${(cp.l - cp.r) / 4}%, ${(cp.t - cp.b) / 4}%)`;
  } else {
    img.style.clipPath = 'none';
    img.style.transform = 'none';
  }

  // Warmth / Tint via SVG color-matrix overlay approach:
  // We use a sibling div overlay
  let overlay = el.querySelector('.filter-overlay');
  if (warmthR !== 0 || tintG !== 0) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'filter-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;';
      el.appendChild(overlay);
    }
    const r = warmthR > 0 ? Math.round(warmthR * 0.8) : 0;
    const g = tintG   > 0 ? Math.round(tintG   * 0.5) : 0;
    const b = warmthR < 0 ? Math.round(-warmthR * 0.6) : 0;
    overlay.style.backgroundColor = `rgba(${r},${g},${b},0.35)`;
    overlay.style.display = 'block';
  } else if (overlay) {
    overlay.style.display = 'none';
  }
}

function applyTextStyle(el, layer) {
  const t = layer.textProps || {};
  const contentEl = el.querySelector('.text-content') || el;
  const content = t.content !== undefined ? t.content : 'Text';
  
  if (contentEl !== el) {
    contentEl.textContent = content || 'Text';
  } else {
    // Fallback for old layers if any, but new ones will have .text-content
    el.textContent = content || 'Text';
  }

  contentEl.style.fontFamily    = t.fontFamily || 'Inter, sans-serif';
  contentEl.style.fontSize      = (t.fontSize || 32) + 'px';
  contentEl.style.fontWeight    = t.bold ? '700' : '400';
  contentEl.style.fontStyle     = t.italic ? 'italic' : 'normal';
  contentEl.style.textDecoration= t.underline ? 'underline' : 'none';
  contentEl.style.textAlign     = t.align || 'left';
  contentEl.style.lineHeight    = t.lineHeight || 1.3;
  contentEl.style.letterSpacing = (t.letterSpacing || 0) + 'px';

  if (t.colorType === 'gradient') {
    contentEl.style.background = `linear-gradient(90deg, ${t.color || '#ffffff'}, ${t.color2 || '#ec4899'})`;
    contentEl.style.webkitBackgroundClip = 'text';
    contentEl.style.webkitTextFillColor = 'transparent';
    contentEl.style.color = 'transparent';
    contentEl.style.display = 'inline-block';
    contentEl.style.width = '100%';
  } else {
    contentEl.style.background = 'none';
    contentEl.style.webkitBackgroundClip = '';
    contentEl.style.webkitTextFillColor = '';
    contentEl.style.color = t.color || '#ffffff';
    contentEl.style.display = 'block';
  }

  if (t.bgEnabled) {
    const { r, g, b } = hexToRgb(t.bgColor || '#000000');
    contentEl.style.backgroundColor = `rgba(${r},${g},${b},${(t.bgOpacity ?? 50) / 100})`;
    contentEl.style.borderRadius = '4px';
  } else {
    contentEl.style.backgroundColor = 'transparent';
  }

  // Auto-size height to fit text
  el.style.height = 'auto';
  requestAnimationFrame(() => {
    const natural = Math.max(el.scrollHeight, 30);
    if (!layer.locked) {
        layer.h = natural;
        el.style.height = natural + 'px';
        if (State.selectedId === layer.id) {
          // Update the H input in the sidebar if it exists
          const hInput = $('layerH');
          if (hInput && !hInput.matches(':focus')) hInput.value = Math.round(natural);
          showLayerControls(layer);
        }
    }
  });
}

function toggleLock(id = State.selectedId) {
  const layer = findLayer(id);
  if (!layer) return;
  layer.locked = !layer.locked;
  const el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
  if (el) {
    el.classList.toggle('locked-layer', layer.locked);
    const contentEl = el.querySelector('.text-content');
    if (contentEl) contentEl.contentEditable = !layer.locked;
  }
  if (layer.locked) clearResizeHandles(layer.id);
  else if (State.selectedId === layer.id) attachResizeHandles(layer);
  
  refreshLayersList();
  if (State.selectedId === layer.id) {
    updateFloatingBar(layer);
    showLayerControls(layer);
  }
  showToast(layer.locked ? 'Layer locked' : 'Layer unlocked');
}

function deleteLayer(id) {
  const el = document.querySelector(`.design-layer[data-lid="${id}"]`);
  if (el) el.remove();
  State.layers = State.layers.filter(l => l.id !== id);
  if (State.selectedId === id) deselectAll();
  refreshLayersList();
  updateLayerCount();
}

function selectLayer(id) {
  State.selectedId = id;
  // Visual highlight
  document.querySelectorAll('.design-layer').forEach(el => el.classList.remove('selected-layer'));
  const el = document.querySelector(`.design-layer[data-lid="${id}"]`);
  if (el) el.classList.add('selected-layer');

  // Update layers list
  document.querySelectorAll('.layer-item').forEach(li => li.classList.remove('selected'));
  const li = document.querySelector(`.layer-item[data-lid="${id}"]`);
  if (li) li.classList.add('selected');

  const layer = findLayer(id);
  if (!layer) return deselectAll();

  showLayerControls(layer);
  updateFloatingBar(layer);
  if (State.selectedId) $('layerQuickActions').classList.remove('hidden');
  
  if (layer.type === 'text') {
    loadTextProps(layer);
    switchPanel('text');
    
    // If it's a text layer, make sure content is synced
    const contentEl = document.querySelector(`.design-layer[data-lid="${layer.id}"] .text-content`);
    if (contentEl) $('textContent').value = contentEl.textContent;
    
    // Toggle Text Panel sections
    if ($('addTextHeader')) $('addTextHeader').classList.add('hidden');
    if ($('textEditorSection')) $('textEditorSection').classList.remove('hidden');
  } else if (layer.type === 'image') {
    loadImageFilters(layer);
    loadCropProps(layer);
    switchPanel('image');
    $('imageAdjustSection').classList.remove('hidden');
    $('imageCropSection').classList.add('hidden');
    $('textEditorSection').classList.add('hidden');
    // Show add text button even if image selected
    if ($('addTextHeader')) $('addTextHeader').classList.remove('hidden');
  } else {
    $('textEditorSection').classList.add('hidden');
    if ($('addTextHeader')) $('addTextHeader').classList.remove('hidden');
  }
}

function deselectAll() {
  State.selectedId = null;
  document.querySelectorAll('.design-layer').forEach(el => el.classList.remove('selected-layer'));
  document.querySelectorAll('.layer-item').forEach(li => li.classList.remove('selected'));
  $('selectedLayerInfo').classList.remove('hidden');
  $('selectedLayerInfo').textContent = 'Nothing selected';
  $('selectedLayerControls').classList.add('hidden');
  $('layerQuickActions').classList.add('hidden');
  $('textEditorSection').classList.add('hidden');
  const bar = document.querySelector('.layer-float-bar');
  if (bar) bar.remove();
  
  // Show the "Add New" button again
  if ($('addTextHeader')) $('addTextHeader').classList.remove('hidden');
}

function updateFloatingBar(layer) {
  let bar = document.querySelector('.layer-float-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'layer-float-bar';
    
    // Prevent dragging when interacting with the floating bar
    const stopProp = e => e.stopPropagation();
    bar.addEventListener('mousedown', stopProp);
    bar.addEventListener('touchstart', stopProp);
    bar.addEventListener('touchend', stopProp);
    
    document.body.appendChild(bar); // Will move to correct layer in render
  }
  
  const el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
  if (!el) return bar.remove();
  
  // Attach the bar to the layer's element
  el.appendChild(bar);
  
  bar.innerHTML = `
    <button id="floatFront" title="To Front"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v14M19 9l-7-7-7 7M5 21h14"/></svg></button>
    <div class="sep"></div>
    <button id="floatBack" title="To Back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22V8M5 15l7 7 7-7M5 3h14"/></svg></button>
    <div class="sep"></div>
    <button id="floatDelete" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2 0 01-2,2H7a2,2 0 01-2-2V6m3,0V4a1,1 0 011-1h4a1,1 0 011,1v2"/></svg></button>
    <div class="sep"></div>
    <button id="floatDuplicate" title="Duplicate"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
    <div class="sep"></div>
    <button id="floatLock" title="Lock">${layer.locked ? '🔓' : '🔒'}</button>
    ${layer.type === 'text' ? '<div class="sep"></div><button id="floatEdit" title="Edit Properties">✍️</button>' : ''}
    ${layer.type === 'image' ? '<div class="sep"></div><button id="floatCrop" title="Crop">✂️</button>' : ''}
  `;
  
  bar.querySelector('#floatFront').onclick = (e) => { e.stopPropagation(); bringToFront(); };
  bar.querySelector('#floatBack').onclick = (e) => { e.stopPropagation(); sendToBack(); };
  bar.querySelector('#floatDelete').onclick = (e) => { e.stopPropagation(); deleteLayer(layer.id); };
  bar.querySelector('#floatDuplicate').onclick = (e) => { e.stopPropagation(); duplicateLayer(layer); };
  bar.querySelector('#floatLock').onclick = (e) => { e.stopPropagation(); toggleLock(layer.id); };
  if (layer.type === 'text') bar.querySelector('#floatEdit').onclick = () => {
    switchPanel('text');
    $('textContent').focus();
  };
  if (layer.type === 'image') bar.querySelector('#floatCrop').onclick = () => {
    switchPanel('image');
    $('imageAdjustSection').classList.add('hidden');
    $('imageCropSection').classList.remove('hidden');
  };
}

function duplicateLayer(layer) {
  const copy = JSON.parse(JSON.stringify(layer));
  copy.id = uid();
  copy.x += 20; copy.y += 20;
  State.layers.push(copy);
  renderLayer(copy);
  selectLayer(copy.id);
  refreshLayersList();
}

function showLayerControls(layer) {
  $('selectedLayerInfo').classList.add('hidden');
  $('selectedLayerControls').classList.remove('hidden');
  $('layerX').value = Math.round(layer.x);
  $('layerY').value = Math.round(layer.y);
  $('layerW').value = Math.round(layer.w);
  $('layerH').value = Math.round(layer.h);
  $('layerRotate').value = layer.rotate;
  $('layerRotateVal').textContent = layer.rotate + '°';
}

function refreshLayersList() {
  if (State.layers.length === 0) {
    layersList.innerHTML = '<div class="layers-empty">No layers yet.<br>Add an image or text.</div>';
    return;
  }
  // Show in reverse z-order
  const sorted = [...State.layers].sort((a, b) => b.zIndex - a.zIndex);
  layersList.innerHTML = '';
  sorted.forEach(layer => {
    const li = document.createElement('div');
    li.className = 'layer-item' + (layer.id === State.selectedId ? ' selected' : '') + (layer.locked ? ' locked' : '');
    li.dataset.lid = layer.id;

    const icon = layer.type === 'image'
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4,7 4,4 20,4 20,7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;

    const lockIcon = layer.locked
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`
      : '';

    const name = layer.type === 'text'
      ? (layer.textProps.content || 'Text').substring(0, 18)
      : `Image ${layer.id}`;

    li.innerHTML = `
      <div class="layer-icon">${icon}</div>
      <span class="layer-name">${name}</span>
      <span class="layer-lock-icon">${lockIcon}</span>`;

    li.addEventListener('click', () => selectLayer(layer.id));
    layersList.appendChild(li);
  });
}

function updateLayerCount() {
  $('infoLayers').textContent = State.layers.length;
}

function reorderZIndex() {
  State.layers.forEach((l, i) => {
    l.zIndex = i + 1;
    const el = document.querySelector(`.design-layer[data-lid="${l.id}"]`);
    if (el) el.style.zIndex = l.zIndex;
  });
}

// ─────────────────────────────────────────────
// DRAG / RESIZE / ROTATE
// ─────────────────────────────────────────────
function attachLayerEvents(el, layer) {
  let dragging = false;
  let startX, startY, origX, origY;

  el.addEventListener('mousedown', e => {
    if (e.target.classList.contains('handle')) return;
    if (layer.locked) return;
    e.stopPropagation();
    selectLayer(layer.id);

    dragging = true;
    startX = e.clientX; startY = e.clientY;
    origX = layer.x; origY = layer.y;

    const onMove = e => {
      if (!dragging) return;
      const dx = (e.clientX - startX) / State.zoom;
      const dy = (e.clientY - startY) / State.zoom;
      layer.x = origX + dx;
      layer.y = origY + dy;
      el.style.left = layer.x + 'px';
      el.style.top  = layer.y + 'px';
      if ($('layerX')) { $('layerX').value = Math.round(layer.x); $('layerY').value = Math.round(layer.y); }
    };
    const onUp = () => {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Touch drag
  el.addEventListener('touchstart', e => {
    if (layer.locked) return;
    e.stopPropagation();
    selectLayer(layer.id);
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    origX = layer.x; origY = layer.y;
    const onMove = e => {
      const tt = e.touches[0];
      const dx = (tt.clientX - startX) / State.zoom;
      const dy = (tt.clientY - startY) / State.zoom;
      layer.x = origX + dx; layer.y = origY + dy;
      el.style.left = layer.x + 'px'; el.style.top = layer.y + 'px';
    };
    const onEnd = () => {
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd);
  }, { passive: true });

  // Double click to focus editor
  el.addEventListener('dblclick', () => {
    if (layer.type === 'text') {
      const contentEl = el.querySelector('.text-content');
      if (contentEl && !layer.locked) {
        contentEl.focus();
        // Select all text on double click
        const range = document.createRange();
        range.selectNodeContents(contentEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        switchPanel('text');
        $('textContent').focus();
      }
    } else if (layer.type === 'image') {
      switchPanel('image');
    }
  });

  // Direct Text Editing
  if (layer.type === 'text') {
    const contentEl = el.querySelector('.text-content');
    if (contentEl) {
      contentEl.contentEditable = !layer.locked;
      contentEl.addEventListener('input', () => {
        const text = contentEl.innerText; // Use innerText to preserve formatting better
        layer.textProps.content = text;
        if (State.selectedId === layer.id) {
          $('textContent').value = text;
          State.textProps.content = text; // Keep global state in sync
        }
        // Don't call updateTextLayer here as it would call applyTextStyle and reset cursor
        refreshLayersList();
        
        // Only update height
        el.style.height = 'auto';
        requestAnimationFrame(() => {
          const natural = Math.max(el.scrollHeight, 30);
          if (!layer.locked) {
            layer.h = natural;
            el.style.height = natural + 'px';
          }
        });
      });
      // Prevent drag while typing
      contentEl.addEventListener('mousedown', e => {
        if (document.activeElement === contentEl) e.stopPropagation();
      });
      // Handle focus to show editing state
      contentEl.addEventListener('focus', () => {
        el.classList.add('editing-text');
      });
      contentEl.addEventListener('blur', () => {
        el.classList.remove('editing-text');
        // Final sync
        applyTextStyle(el, layer);
      });
    }
  }
}

// Resize handles
function attachResizeHandles(layer) {
  const el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
  if (!el) return;

  // Remove old handles
  el.querySelectorAll('.resize-handle').forEach(h => h.remove());

  // Create corner handles
  const handles = [
    { cls: 'tl', cursor: 'nwse-resize', dx: -1, dy: -1 },
    { cls: 'tr', cursor: 'nesw-resize', dx:  1, dy: -1 },
    { cls: 'bl', cursor: 'nesw-resize', dx: -1, dy:  1 },
    { cls: 'br', cursor: 'nwse-resize', dx:  1, dy:  1 },
  ];

  handles.forEach(({ cls, cursor, dx, dy }) => {
    const h = document.createElement('div');
    h.className = `resize-handle ${cls}`;
    h.style.cssText = `position:absolute;width:10px;height:10px;background:white;border:2px solid #7c3aed;border-radius:2px;z-index:10000;`;
    if (cls === 'tl') h.style.cssText += 'top:-5px;left:-5px;cursor:nwse-resize;';
    if (cls === 'tr') h.style.cssText += 'top:-5px;right:-5px;cursor:nesw-resize;';
    if (cls === 'bl') h.style.cssText += 'bottom:-5px;left:-5px;cursor:nesw-resize;';
    if (cls === 'br') h.style.cssText += 'bottom:-5px;right:-5px;cursor:nwse-resize;';

    let startX, startY, origW, origH, origX, origY;
    h.addEventListener('mousedown', e => {
      if (layer.locked) return;
      e.stopPropagation(); e.preventDefault();
      startX = e.clientX; startY = e.clientY;
      origW = layer.w; origH = layer.h;
      origX = layer.x; origY = layer.y;

      const onMove = e => {
        const ddx = (e.clientX - startX) / State.zoom;
        const ddy = (e.clientY - startY) / State.zoom;
        if (dx > 0) layer.w = Math.max(40, origW + ddx);
        else { layer.w = Math.max(40, origW - ddx); layer.x = origX + (origW - layer.w); }
        if (dy > 0) layer.h = Math.max(20, origH + ddy);
        else { layer.h = Math.max(20, origH - ddy); layer.y = origY + (origH - layer.h); }
        el.style.width  = layer.w + 'px';
        el.style.height = layer.h + 'px';
        el.style.left   = layer.x + 'px';
        el.style.top    = layer.y + 'px';
        showLayerControls(layer);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    el.appendChild(h);
  });

  // Rotate handle
  const rh = document.createElement('div');
  rh.className = 'resize-handle rotate-h';
  rh.style.cssText = `position:absolute;width:22px;height:22px;background:#7c3aed;border-radius:50%;z-index:10000;top:-30px;left:50%;transform:translateX(-50%);cursor:grab;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;`;
  rh.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;

  rh.addEventListener('mousedown', e => {
    if (layer.locked) return;
    e.stopPropagation(); e.preventDefault();
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    const onMove = e => {
      const dx2 = e.clientX - cx;
      const dy2 = e.clientY - cy;
      let angle = Math.atan2(dy2, dx2) * 180 / Math.PI + 90;
      angle = Math.round(angle);
      layer.rotate = angle;
      el.style.transform = `rotate(${angle}deg)`;
      $('layerRotate').value = angle;
      $('layerRotateVal').textContent = angle + '°';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  el.appendChild(rh);
}

function clearResizeHandles(id) {
  const el = document.querySelector(`.design-layer[data-lid="${id}"]`);
  if (el) el.querySelectorAll('.resize-handle').forEach(h => h.remove());
}

// Observe selection change to show/hide handles
let lastSelectedId = null;
function syncHandles() {
  if (State.selectedId !== lastSelectedId) {
    if (lastSelectedId !== null) clearResizeHandles(lastSelectedId);
    if (State.selectedId !== null) {
      const layer = findLayer(State.selectedId);
      if (layer && !layer.locked) attachResizeHandles(layer);
    }
    lastSelectedId = State.selectedId;
  }
  requestAnimationFrame(syncHandles);
}
syncHandles();

// Deselect on canvas background click
canvas.addEventListener('mousedown', e => {
  if (e.target === canvas) deselectAll();
});

// ─────────────────────────────────────────────
// BACKGROUND PANEL
// ─────────────────────────────────────────────
// BG Type buttons
document.querySelectorAll('.bg-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bg-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const type = btn.dataset.bgtype;
    State.background.type = type;
    $('bgSolidSection').classList.toggle('hidden', type !== 'solid');
    $('bgGradientSection').classList.toggle('hidden', type !== 'gradient');
    $('bgImageSection').classList.toggle('hidden', type !== 'image');
    
    if (type === 'image') syncBackgroundImageUI();
    renderBackground();
  });
});

function syncBackgroundImageUI() {
  const img = State.background.image;
  document.querySelectorAll('[data-bgsize]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.bgsize === img.size);
  });
  $('bgPosition').value = img.position;
  $('bgRepeat').checked = img.repeat;
}

// Solid color
$('bgSolidColor').addEventListener('input', e => {
  State.background.solidColor = e.target.value;
  $('bgSolidColorLabel').textContent = e.target.value;
  renderBackground();
});

// Gradient angle
$('gradAngle').addEventListener('input', e => {
  State.background.gradient.angle = +e.target.value;
  $('gradAngleVal').textContent = e.target.value + '°';
  renderBackground();
});

// Gradient stop colors/positions
[1,2,3,4].forEach(i => {
  const col = $(`gradColor${i}`);
  const pos = $(`gradPos${i}`);
  if (col) col.addEventListener('input', e => {
    State.background.gradient.stops[i-1].color = e.target.value;
    renderBackground();
  });
  if (pos) pos.addEventListener('input', e => {
    State.background.gradient.stops[i-1].pos = +e.target.value;
    $(`gradPos${i}Val`).textContent = e.target.value + '%';
    renderBackground();
  });
});

$('btnAddStop').addEventListener('click', () => {
  if (State.activeStops >= 4) return showToast('Maximum 4 gradient stops');
  State.activeStops++;
  $(`gradStop${State.activeStops}Row`).classList.remove('hidden');
  State.background.gradient.stops[State.activeStops - 1] = {
    color: State.background.gradient.stops[State.activeStops - 1]?.color || '#f59e0b',
    pos:   State.background.gradient.stops[State.activeStops - 1]?.pos   || 50,
  };
  renderBackground();
  
  // Sync UI inputs for stops
  for (let i = 1; i <= 4; i++) {
    const row = $(`gradStop${i}Row`);
    if (row) {
      const stop = State.background.gradient.stops[i-1];
      if (stop) {
        $(`gradColor${i}`).value = stop.color;
        $(`gradPos${i}`).value = stop.pos;
        $(`gradPos${i}Val`).textContent = stop.pos + '%';
      }
    }
  }
});
// Gradient presets
const GRADIENT_PRESETS = [
  { angle: 135, stops: [{ color: '#7c3aed', pos: 0 }, { color: '#ec4899', pos: 100 }] },
  { angle: 45,  stops: [{ color: '#06b6d4', pos: 0 }, { color: '#3b82f6', pos: 100 }] },
  { angle: 135, stops: [{ color: '#f59e0b', pos: 0 }, { color: '#ef4444', pos: 100 }] },
  { angle: 90,  stops: [{ color: '#10b981', pos: 0 }, { color: '#06b6d4', pos: 100 }] },
  { angle: 180, stops: [{ color: '#1e293b', pos: 0 }, { color: '#0f172a', pos: 100 }] },
  { angle: 135, stops: [{ color: '#ff0080', pos: 0 }, { color: '#7928ca', pos: 100 }] },
  { angle: 135, stops: [{ color: '#f093fb', pos: 0 }, { color: '#f5576c', pos: 100 }] },
  { angle: 45,  stops: [{ color: '#4facfe', pos: 0 }, { color: '#00f2fe', pos: 100 }] },
  { angle: 135, stops: [{ color: '#43e97b', pos: 0 }, { color: '#38f9d7', pos: 100 }] },
  { angle: 135, stops: [{ color: '#fa709a', pos: 0 }, { color: '#fee140', pos: 100 }] },
];

function initGradientPresets() {
  const container = $('gradPresets');
  if (!container) return;
  
  GRADIENT_PRESETS.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'grad-preset-btn';
    const parts = p.stops.map(s => `${s.color} ${s.pos}%`).join(', ');
    btn.style.background = `linear-gradient(${p.angle}deg, ${parts})`;
    btn.title = `Preset ${i+1}`;
    btn.onclick = () => {
      State.background.type = 'gradient';
      State.background.gradient = JSON.parse(JSON.stringify(p));
      State.activeStops = p.stops.length;
      
      // Update UI
      syncGradientUI();
      renderBackground();
      
      // Ensure gradient section is visible
      document.querySelectorAll('.bg-type-btn').forEach(b => b.classList.remove('active'));
      $('bgTypeGradient').classList.add('active');
      $('bgSolidSection').classList.add('hidden');
      $('bgGradientSection').classList.remove('hidden');
      $('bgImageSection').classList.add('hidden');
      
      document.querySelectorAll('.grad-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
    container.appendChild(btn);
  });
}

function syncGradientUI() {
  const g = State.background.gradient;
  $('gradAngle').value = g.angle;
  $('gradAngleVal').textContent = g.angle + '°';
  
  // Update stop rows visibility
  for (let i = 1; i <= 4; i++) {
    const row = $(`gradStop${i}Row`);
    if (i <= State.activeStops) {
      if (row) row.classList.remove('hidden');
      const stop = g.stops[i-1];
      if (stop) {
        $(`gradColor${i}`).value = stop.color;
        $(`gradPos${i}`).value = stop.pos;
        $(`gradPos${i}Val`).textContent = stop.pos + '%';
      }
    } else {
      if (row) row.classList.add('hidden');
    }
  }
}

$('btnRemoveStop').addEventListener('click', () => {
  if (State.activeStops <= 2) return showToast('Minimum 2 gradient stops');
  $(`gradStop${State.activeStops}Row`).classList.add('hidden');
  State.activeStops--;
  renderBackground();
});

// BG image upload
setupUploadZone($('bgImgUploadZone'), $('bgImgInput'), src => {
  State.background.image.src = src;
  State.background.type = 'image';
  
  // Update UI state
  document.querySelectorAll('.bg-type-btn').forEach(b => b.classList.remove('active'));
  $('bgTypeImage').classList.add('active');
  $('bgSolidSection').classList.add('hidden');
  $('bgGradientSection').classList.add('hidden');
  $('bgImageSection').classList.remove('hidden');
  
  renderBackground();
  showToast('Background image updated');
});

// BG image size
document.querySelectorAll('[data-bgsize]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-bgsize]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    State.background.image.size = btn.dataset.bgsize;
    renderBackground();
  });
});
$('bgPosition').addEventListener('change', e => {
  State.background.image.position = e.target.value;
  renderBackground();
});
$('bgRepeat').addEventListener('change', e => {
  State.background.image.repeat = e.target.checked;
  renderBackground();
});

// Unsplash API Helper
async function searchUnsplash(query, containerId, onClick) {
  if (UNSPLASH_ACCESS_KEY === 'YOUR_UNSPLASH_ACCESS_KEY') {
    showToast('Please update UNSPLASH_ACCESS_KEY with a real key!');
    return;
  }
  const container = $(containerId);
  container.innerHTML = '<p class="text-muted" style="font-size:12px; grid-column: 1/-1;">Searching...</p>';
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=9&client_id=${UNSPLASH_ACCESS_KEY}`);
    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    container.innerHTML = '';
    if (data.results && data.results.length > 0) {
      data.results.forEach(photo => {
        const img = document.createElement('img');
        img.className = 'api-img-thumb';
        img.src = photo.urls.thumb;
        img.crossOrigin = 'anonymous';
        img.addEventListener('click', () => onClick(photo.urls.regular));
        container.appendChild(img);
      });
    } else {
      container.innerHTML = '<p class="text-muted" style="font-size:12px; grid-column: 1/-1;">No results found.</p>';
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="text-muted" style="font-size:12px; grid-column: 1/-1;">Error fetching images.</p>';
  }
}

$('btnSearchBgUnsplash').addEventListener('click', () => {
  const query = $('bgUnsplashSearch').value.trim() || 'background';
  searchUnsplash(query, 'bgUnsplashResults', (src) => {
    State.background.image.src = src;
    State.background.type = 'image';
    
    document.querySelectorAll('.bg-type-btn').forEach(b => b.classList.remove('active'));
    $('bgTypeImage').classList.add('active');
    $('bgSolidSection').classList.add('hidden');
    $('bgGradientSection').classList.add('hidden');
    $('bgImageSection').classList.remove('hidden');
    
    renderBackground();
    showToast('Background updated from Unsplash');
  });
});

$('bgUnsplashSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('btnSearchBgUnsplash').click();
});

// ─────────────────────────────────────────────
// IMAGE IMPORT & FILTERS
// ─────────────────────────────────────────────

$('btnSearchFgUnsplash').addEventListener('click', () => {
  const query = $('fgUnsplashSearch').value.trim() || 'object';
  searchUnsplash(query, 'fgUnsplashResults', (src) => {
    const layer = createLayer('image', {
      src, x: 50, y: 50, w: 300, h: 300,
      filters: {
        brightness: 100, contrast: 100, darkness: 0, blur: 0,
        opacity: 100, sepia: 0, warmth: 0, tint: 0, hue: 0, saturation: 100,
      }
    });
    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.src = src;
    imgEl.onload = () => {
      const el = document.createElement('div');
      el.className = 'layer image-layer';
      el.id = layer.id;
      el.style.left = layer.x + 'px';
      el.style.top = layer.y + 'px';
      el.style.width = layer.w + 'px';
      el.style.height = layer.h + 'px';
      imgEl.style.width = '100%';
      imgEl.style.height = '100%';
      el.appendChild(imgEl);
      bindLayerEvents(el, layer);
      $('canvas').appendChild(el);
      updateLayerList();
      selectLayer(layer.id);
      applyFilters(el, layer);
      showToast('Image added from Unsplash');
    };
  });
});

$('fgUnsplashSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('btnSearchFgUnsplash').click();
});
setupUploadZone($('imgUploadZone'), $('imgInput'), src => {
  const layer = createLayer('image', {
    src, x: 50, y: 50, w: 300, h: 300,
    filters: {
      brightness: 100, contrast: 100, darkness: 0, blur: 0,
      opacity: 100, sepia: 0, warmth: 0, tint: 0, hue: 0, saturation: 100,
    }
  });
  // Create img element
  const el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
  if (el && !el.querySelector('img')) {
    const img = document.createElement('img');
    img.src = src;
    img.draggable = false;
    el.prepend(img);
  }
  switchPanel('image');
});

let activeFilterProp = 'brightness';

const filterConfigs = {
  brightness: { min: 0, max: 200, def: 100, label: 'Brightness', fmt: v => v },
  contrast:   { min: 0, max: 200, def: 100, label: 'Contrast', fmt: v => v },
  darkness:   { min: 0, max: 100, def: 0,   label: 'Darkness', fmt: v => v },
  blur:       { min: 0, max: 20,  def: 0,   label: 'Blur', fmt: v => v, step: 0.5 },
  opacity:    { min: 0, max: 100, def: 100, label: 'Opacity', fmt: v => v },
  sepia:      { min: 0, max: 100, def: 0,   label: 'Sepia', fmt: v => v },
  warmth:     { min: -100, max: 100, def: 0,label: 'Warmth', fmt: v => v },
  tint:       { min: -100, max: 100, def: 0,label: 'Tint', fmt: v => v },
  hue:        { min: 0, max: 360, def: 0,   label: 'Hue', fmt: v => v + '°' },
  saturation: { min: 0, max: 200, def: 100, label: 'Saturation', fmt: v => v },
  imgSize:    { min: 10, max: 500, def: 100,label: 'Image Size', fmt: v => v + '%' },
};

function setActiveFilter(prop) {
  activeFilterProp = prop;
  const config = filterConfigs[prop];
  
  // Update buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === prop);
  });
  
  // Update slider UI
  $('masterSliderLabel').textContent = config.label;
  const slider = $('masterFilterSlider');
  if (!slider) return;
  slider.min = config.min;
  slider.max = config.max;
  slider.step = config.step || 1;
  
  // Sync value from layer or default
  const layer = findLayer(State.selectedId);
  let val = config.def;
  if (layer && layer.type === 'image') {
    if (prop === 'imgSize') {
      val = layer.imgSize ?? 100;
    } else {
      val = (layer.filters || {})[prop] ?? config.def;
    }
  }
  slider.value = val;
  $('masterFilterVal').textContent = config.fmt(val);
}

// Listen to filter button clicks
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => setActiveFilter(btn.dataset.filter));
});

// Listen to master slider
const masterSlider = $('masterFilterSlider');
if (masterSlider) {
  masterSlider.addEventListener('input', e => {
    const config = filterConfigs[activeFilterProp];
    $('masterFilterVal').textContent = config.fmt(e.target.value);
    
    const layer = findLayer(State.selectedId);
    if (!layer || layer.type !== 'image') return;
    const el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
    if (!el) return;
    
    if (activeFilterProp === 'imgSize') {
      const oldSize = layer.imgSize || 100;
      layer.imgSize = +e.target.value;
      const ratio = layer.imgSize / oldSize;
      
      const cx = layer.x + layer.w / 2;
      const cy = layer.y + layer.h / 2;
      
      layer.w = layer.w * ratio;
      layer.h = layer.h * ratio;
      layer.x = cx - layer.w / 2;
      layer.y = cy - layer.h / 2;
      
      el.style.width = layer.w + 'px';
      el.style.height = layer.h + 'px';
      el.style.left = layer.x + 'px';
      el.style.top = layer.y + 'px';
    } else {
      layer.filters = layer.filters || {};
      layer.filters[activeFilterProp] = +e.target.value;
      applyImageFilters(el, layer);
    }
  });
}

function loadImageFilters(layer) {
  setActiveFilter(activeFilterProp);
}

$('btnResetFilters').addEventListener('click', () => {
  const layer = findLayer(State.selectedId);
  if (!layer || layer.type !== 'image') return;
  layer.filters = { brightness: 100, contrast: 100, darkness: 0, blur: 0, opacity: 100, sepia: 0, warmth: 0, tint: 0, hue: 0, saturation: 100 };
  loadImageFilters(layer);
  const el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
  if (el) applyImageFilters(el, layer);
  showToast('Filters reset');
});

$('btnResetCrop').addEventListener('click', () => {
  const layer = findLayer(State.selectedId);
  if (!layer || layer.type !== 'image') return;
  layer.crop = { t: 0, r: 0, b: 0, l: 0 };
  loadCropProps(layer);
  const el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
  if (el) applyImageFilters(el, layer);
});

function loadCropProps(layer) {
  const cp = layer.crop || { t: 0, r: 0, b: 0, l: 0 };
  $('cropTop').value = cp.t;
  $('cropRight').value = cp.r;
  $('cropBottom').value = cp.b;
  $('cropLeft').value = cp.l;
}

['Top','Right','Bottom','Left'].forEach(side => {
  $(`crop${side}`).addEventListener('input', e => {
    const layer = findLayer(State.selectedId);
    if (!layer || layer.type !== 'image') return;
    if (!layer.crop) layer.crop = { t: 0, r: 0, b: 0, l: 0 };
    layer.crop[side[0].toLowerCase()] = +e.target.value;
    const el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
    if (el) applyImageFilters(el, layer);
  });
});

// ─────────────────────────────────────────────
// TEXT TOOL
// ─────────────────────────────────────────────
$('btnAddText').addEventListener('click', () => {
  const tp = { ...State.textProps, content: 'Your Text' };
  const layer = createLayer('text', {
    x: 80, y: 80, w: 220, h: 60,
    textProps: { ...tp },
  });
  loadTextProps(layer);
  switchPanel('text');
  setTimeout(() => $('textContent').focus(), 50);
});

document.querySelectorAll('.text-template-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.template;
    const props = {
      content: 'New Text',
      fontFamily: 'Inter, sans-serif',
      fontSize: 32,
      colorType: 'solid',
      color: '#ffffff',
      bold: false,
      italic: false,
      align: 'center',
      lineHeight: 1.2,
      letterSpacing: 0,
      color2: '#ec4899',
      bgEnabled: false,
      bgColor: '#000000',
      bgOpacity: 50
    };
    if (t === 'montserrat') {
      props.content = 'ELEGANT MODERN';
      props.fontFamily = "'Montserrat', sans-serif";
      props.fontSize = 48;
      props.bold = true;
      props.letterSpacing = 2;
    } else if (t === 'oswald') {
      props.content = 'STRONG HEADER';
      props.fontFamily = "'Oswald', sans-serif";
      props.fontSize = 56;
      props.bold = true;
      props.color = '#eab308';
      props.letterSpacing = 1;
    } else if (t === 'bebas') {
      props.content = 'MASSIVE IMPACT';
      props.fontFamily = "'Bebas Neue', sans-serif";
      props.fontSize = 72;
      props.color = '#ef4444';
      props.letterSpacing = 2;
    } else if (t === 'playfair') {
      props.content = 'Sophisticated';
      props.fontFamily = "'Playfair Display', serif";
      props.fontSize = 56;
      props.italic = true;
      props.bold = true;
      props.color = '#d4af37';
    } else if (t === 'cinzel') {
      props.content = 'CINEMATIC';
      props.fontFamily = "'Cinzel', serif";
      props.fontSize = 52;
      props.colorType = 'gradient';
      props.color = '#fbbf24';
      props.color2 = '#d97706';
      props.bold = true;
    } else if (t === 'dancing') {
      props.content = 'Beautiful Script';
      props.fontFamily = "'Dancing Script', cursive";
      props.fontSize = 64;
      props.color = '#ec4899';
    } else if (t === 'pacifico') {
      props.content = 'Laid-back Fun';
      props.fontFamily = "'Pacifico', cursive";
      props.fontSize = 56;
      props.color = '#06b6d4';
    } else if (t === 'righteous') {
      props.content = 'FUTURISTIC';
      props.fontFamily = "'Righteous', cursive";
      props.fontSize = 56;
      props.color = '#8b5cf6';
    }
    
    const selectedLayer = findLayer(State.selectedId);
    if (selectedLayer && selectedLayer.type === 'text') {
      const oldContent = selectedLayer.textProps.content;
      selectedLayer.textProps = props;
      selectedLayer.textProps.content = oldContent;
      const el = document.querySelector(`.design-layer[data-lid="${selectedLayer.id}"]`);
      if (el) applyTextStyle(el, selectedLayer);
      loadTextProps(selectedLayer);
    } else {
      const layer = createLayer('text', {
        x: 50, y: 50, w: 300, h: 80,
        textProps: props,
      });
      loadTextProps(layer);
      switchPanel('text');
    }
  });
});

function loadTextProps(layer) {
  const t = layer.textProps || {};
  // Sync global state to this layer so subsequent updates work correctly
  // Use fallbacks for every property
  State.textProps = {
    content:       t.content !== undefined ? t.content : 'Text',
    fontFamily:    t.fontFamily || 'Inter, sans-serif',
    fontSize:      t.fontSize || 32,
    bold:          !!t.bold,
    italic:        !!t.italic,
    underline:     !!t.underline,
    align:         t.align || 'left',
    colorType:     t.colorType || 'solid',
    color:         t.color || '#ffffff',
    color2:        t.color2 || '#ec4899',
    bgEnabled:     !!t.bgEnabled,
    bgColor:       t.bgColor || '#000000',
    bgOpacity:     t.bgOpacity ?? 50,
    lineHeight:    t.lineHeight ?? 1.3,
    letterSpacing: t.letterSpacing ?? 0,
  };

  const st = State.textProps;
  $('textContent').value        = st.content;
  $('fontFamily').value         = st.fontFamily;
  $('fontSize').value           = st.fontSize;
  $('fontSizeVal').textContent  = st.fontSize + 'px';
  $('textBold').classList.toggle('active', st.bold);
  $('textItalic').classList.toggle('active', st.italic);
  $('textUnderline').classList.toggle('active', st.underline);
  $('textAlignLeft').classList.toggle('active',   st.align === 'left');
  $('textAlignCenter').classList.toggle('active', st.align === 'center');
  $('textAlignRight').classList.toggle('active',  st.align === 'right');
  $('textColor').value          = st.color;
  $('textColor2').value         = st.color2;
  
  // Sync Color Type buttons
  $('btnColorSolid').classList.toggle('active', st.colorType === 'solid');
  $('btnColorGrad').classList.toggle('active', st.colorType === 'gradient');
  $('textGradRow').classList.toggle('hidden', st.colorType !== 'gradient');
  $('textBgColor').value        = st.bgColor;
  $('textBgEnabled').checked    = st.bgEnabled;
  $('textBgOpacity').value      = st.bgOpacity;
  $('textBgOpacityVal').textContent = st.bgOpacity + '%';
  $('textLineHeight').value     = st.lineHeight;
  $('textLineHeightVal').textContent = st.lineHeight;
  $('textLetterSpacing').value  = st.letterSpacing;
  $('textLetterSpacingVal').textContent = st.letterSpacing + 'px';
}

function updateTextLayer() {
  const layer = findLayer(State.selectedId);
  if (!layer || layer.type !== 'text') return;
  // Use a deep copy to avoid direct reference issues if needed, but simple assign is mostly ok here
  layer.textProps = { ...State.textProps };
  const el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
  if (el) applyTextStyle(el, layer);
  refreshLayersList();
}

// Text control bindings
$('textContent').addEventListener('input', e => { 
  State.textProps.content = e.target.value; 
  updateTextLayer(); 
  // Update the layer name in the layers list in real-time
  const liName = document.querySelector(`.layer-item[data-lid="${State.selectedId}"] .layer-name`);
  if (liName) liName.textContent = (e.target.value || 'Text').substring(0, 18);
});
$('fontFamily').addEventListener('change', e => { State.textProps.fontFamily = e.target.value; updateTextLayer(); });

const fontSizeSlider = $('fontSize');
fontSizeSlider.addEventListener('input', e => {
  State.textProps.fontSize = +e.target.value;
  $('fontSizeVal').textContent = e.target.value + 'px';
  updateTextLayer();
});

['Bold','Italic','Underline'].forEach(style => {
  const prop = style.toLowerCase();
  $(`text${style}`).addEventListener('click', () => {
    State.textProps[prop] = !State.textProps[prop];
    $(`text${style}`).classList.toggle('active', State.textProps[prop]);
    updateTextLayer();
  });
});

['Left','Center','Right'].forEach(a => {
  $(`textAlign${a}`).addEventListener('click', () => {
    State.textProps.align = a.toLowerCase();
    ['Left','Center','Right'].forEach(x => $(`textAlign${x}`).classList.remove('active'));
    $(`textAlign${a}`).classList.add('active');
    updateTextLayer();
  });
});

$('textColor').addEventListener('input', e => { State.textProps.color = e.target.value; updateTextLayer(); });

$('btnColorSolid').addEventListener('click', () => {
  State.textProps.colorType = 'solid';
  $('btnColorSolid').classList.add('active');
  $('btnColorGrad').classList.remove('active');
  $('textGradRow').classList.add('hidden');
  updateTextLayer();
});
$('btnColorGrad').addEventListener('click', () => {
  State.textProps.colorType = 'gradient';
  $('btnColorSolid').classList.remove('active');
  $('btnColorGrad').classList.add('active');
  $('textGradRow').classList.remove('hidden');
  updateTextLayer();
});
$('textColor2').addEventListener('input', e => { State.textProps.color2 = e.target.value; updateTextLayer(); });
$('textBgColor').addEventListener('input', e => { State.textProps.bgColor = e.target.value; updateTextLayer(); });
$('textBgEnabled').addEventListener('change', e => { State.textProps.bgEnabled = e.target.checked; updateTextLayer(); });
$('textBgOpacity').addEventListener('input', e => {
  State.textProps.bgOpacity = +e.target.value;
  $('textBgOpacityVal').textContent = e.target.value + '%';
  updateTextLayer();
});
$('textLineHeight').addEventListener('input', e => {
  State.textProps.lineHeight = +e.target.value;
  $('textLineHeightVal').textContent = e.target.value;
  updateTextLayer();
});
$('textLetterSpacing').addEventListener('input', e => {
  State.textProps.letterSpacing = +e.target.value;
  $('textLetterSpacingVal').textContent = e.target.value + 'px';
  updateTextLayer();
});

// Slider increment/decrement helpers
function setupSliderBtns(decId, incId, sliderId, valId, step, unit = '') {
  $(decId).addEventListener('click', () => {
    const s = $(sliderId);
    s.value = (+s.value - step).toFixed(1);
    s.dispatchEvent(new Event('input'));
  });
  $(incId).addEventListener('click', () => {
    const s = $(sliderId);
    s.value = (+s.value + step).toFixed(1);
    s.dispatchEvent(new Event('input'));
  });
}

setupSliderBtns('btnFontSizeDec', 'btnFontSizeInc', 'fontSize', 'fontSizeVal', 2, 'px');
setupSliderBtns('btnBgOpacityDec', 'btnBgOpacityInc', 'textBgOpacity', 'textBgOpacityVal', 5, '%');
setupSliderBtns('btnLineHeightDec', 'btnLineHeightInc', 'textLineHeight', 'textLineHeightVal', 0.1);
setupSliderBtns('btnLetterSpacingDec', 'btnLetterSpacingInc', 'textLetterSpacing', 'textLetterSpacingVal', 0.5, 'px');

// New Text Actions
$('btnDeleteTextLayer').addEventListener('click', () => {
  if (State.selectedId) {
    deleteLayer(State.selectedId);
    showToast('Text layer deleted');
  }
});

$('btnDeselectText').addEventListener('click', () => {
  deselectAll();
});

// ─────────────────────────────────────────────
// LAYER CONTROLS (Right Panel)
// ─────────────────────────────────────────────
['layerX','layerY','layerW','layerH'].forEach(id => {
  $(id).addEventListener('input', e => {
    const layer = findLayer(State.selectedId);
    if (!layer || layer.locked) return;
    const prop = { layerX:'x', layerY:'y', layerW:'w', layerH:'h' }[id];
    layer[prop] = +e.target.value;
    const el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
    if (el) {
      el.style.left   = layer.x + 'px';
      el.style.top    = layer.y + 'px';
      el.style.width  = layer.w + 'px';
      el.style.height = layer.h + 'px';
    }
  });
});

$('layerRotate').addEventListener('input', e => {
  const layer = findLayer(State.selectedId);
  if (!layer) return;
  layer.rotate = +e.target.value;
  $('layerRotateVal').textContent = e.target.value + '°';
  const el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
  if (el) el.style.transform = `rotate(${layer.rotate}deg)`;
});

// Global Keyboard Shortcuts
document.addEventListener('keydown', e => {
  // If editing text or in an input, ignore delete shortcuts
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
    // Escape to blur contentEditable
    if (e.key === 'Escape' && e.target.isContentEditable) {
      e.target.blur();
      deselectAll();
    }
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (State.selectedId) {
      e.preventDefault();
      deleteLayer(State.selectedId);
      showToast('Layer deleted');
    }
  }
  
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'd') {
      e.preventDefault();
      const layer = findLayer(State.selectedId);
      if (layer) duplicateLayer(layer);
    }
  }
});

function bringForward() {
  const layer = findLayer(State.selectedId);
  if (!layer || layer.locked) return;
  const idx = State.layers.indexOf(layer);
  if (idx < State.layers.length - 1) {
    State.layers.splice(idx, 1);
    State.layers.splice(idx + 1, 0, layer);
    reorderZIndex();
    refreshLayersList();
  }
}

function sendBackward() {
  const layer = findLayer(State.selectedId);
  if (!layer || layer.locked) return;
  const idx = State.layers.indexOf(layer);
  if (idx > 0) {
    State.layers.splice(idx, 1);
    State.layers.splice(idx - 1, 0, layer);
    reorderZIndex();
    refreshLayersList();
  }
}

function bringToFront() {
  const layer = findLayer(State.selectedId);
  if (!layer || layer.locked) return;
  const idx = State.layers.indexOf(layer);
  if (idx < State.layers.length - 1) {
    State.layers.splice(idx, 1);
    State.layers.push(layer);
    reorderZIndex();
    refreshLayersList();
  }
}

function sendToBack() {
  const layer = findLayer(State.selectedId);
  if (!layer || layer.locked) return;
  const idx = State.layers.indexOf(layer);
  if (idx > 0) {
    State.layers.splice(idx, 1);
    State.layers.unshift(layer);
    reorderZIndex();
    refreshLayersList();
  }
}

$('btnBringToFront').addEventListener('click', bringToFront);
$('btnBringForward').addEventListener('click', bringForward);
$('btnSendBack').addEventListener('click', sendBackward);
$('btnSendToBack').addEventListener('click', sendToBack);

$('btnLockLayer').addEventListener('click', () => {
  toggleLock();
});

$('btnDeleteLayer').addEventListener('click', () => {
  if (!State.selectedId) return;
  deleteLayer(State.selectedId);
  showToast('Layer deleted');
});

// Map secondary buttons (Layers Panel)
const secondaryActions = {
  btnBringToFront2: bringToFront,
  btnBringForward2: bringForward,
  btnSendBack2:     sendBackward,
  btnSendToBack2:   sendToBack,
  btnLockLayer2:    toggleLock,
  btnDeleteLayer2:  () => deleteLayer(State.selectedId)
};
Object.entries(secondaryActions).forEach(([id, fn]) => {
  const btn = $(id);
  if (btn) btn.addEventListener('click', fn);
});

// ─────────────────────────────────────────────
// PANEL & TAB SWITCHING
// ─────────────────────────────────────────────
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  $(`panel${name.charAt(0).toUpperCase() + name.slice(1)}`).classList.remove('hidden');
  const tab = document.querySelector(`.sidebar-tab[data-panel="${name}"]`);
  if (tab) tab.classList.add('active');
}

document.querySelectorAll('.sidebar-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (window.innerWidth <= 600) {
      if (tab.classList.contains('active')) {
        $('leftSidebar').classList.toggle('open');
      } else {
        $('leftSidebar').classList.add('open');
        switchPanel(tab.dataset.panel);
      }
    } else {
      switchPanel(tab.dataset.panel);
    }
  });
});

// ─────────────────────────────────────────────
// RATIO SELECTOR
// ─────────────────────────────────────────────
document.querySelectorAll('.ratio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    State.ratio = btn.dataset.ratio;
    applyCanvasSize();
  });
});

// Platform quick-set
document.querySelectorAll('.platform-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const map = {
      instagram: '1:1',
      facebook:  '16:9',
      twitter:   '16:9',
      whatsapp:  '1:1',
      youtube:   '16:9'
    };
    if (State.mode === 'cover') {
        State.ratio = btn.dataset.platform;
    } else {
        const r = map[btn.dataset.platform];
        if (r) State.ratio = r;
    }
    
    document.querySelectorAll('.ratio-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.ratio === State.ratio);
    });
    applyCanvasSize();
    showToast(`Set to ${btn.dataset.platform} format`);
  });
});

// Preset list
document.querySelectorAll('.preset-item').forEach(item => {
  item.addEventListener('click', () => {
    const r = item.dataset.ratio;
    document.querySelectorAll('.ratio-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.ratio === r);
    });
    State.ratio = r;
    applyCanvasSize();
    showToast(`Preset: ${item.querySelector('.preset-platform').textContent} (${item.dataset.w}×${item.dataset.h})`);
  });
});

// ─────────────────────────────────────────────
// ZOOM CONTROLS
// ─────────────────────────────────────────────
$('btnZoomIn').addEventListener('click',  () => setZoom(State.zoom * 1.2));
$('btnZoomOut').addEventListener('click', () => setZoom(State.zoom / 1.2));
$('btnZoomFit').addEventListener('click', fitZoom);

// Mousewheel zoom on canvas
document.querySelector('.canvas-area').addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    setZoom(State.zoom * (e.deltaY < 0 ? 1.1 : 0.9));
  }
}, { passive: false });

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────
async function exportImage(format) {
  showToast('Preparing export…');

  const baseEd = State.mode === 'post' ? EXPORT_DIMS.post[State.ratio] : EXPORT_DIMS.cover[State.ratio];
  
  // Multiply dimensions by 2 for ultra-high quality export
  const ed = { w: baseEd.w * 2, h: baseEd.h * 2 };
  const scale = ed.w / State.canvasW;

  const cvs = exportCanvas;
  cvs.width  = ed.w;
  cvs.height = ed.h;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, ed.w, ed.h);

  // Draw background
  await drawBackground(ctx, ed.w, ed.h);

  // Draw layers in z-order
  const sorted = [...State.layers].sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of sorted) {
    ctx.save();
    const cx = (layer.x + layer.w / 2) * scale;
    const cy = (layer.y + layer.h / 2) * scale;
    ctx.translate(cx, cy);
    ctx.rotate(layer.rotate * Math.PI / 180);

    if (layer.type === 'image') {
      const img = document.querySelector(`.design-layer[data-lid="${layer.id}"] img`);
      if (!img) { ctx.restore(); continue; }

      const f = layer.filters || {};
      const opacity = (f.opacity ?? 100) / 100;
      ctx.globalAlpha = opacity;

      // Apply filters via canvas filter
      const brightness = f.brightness ?? 100;
      const contrast   = f.contrast   ?? 100;
      const sepia      = f.sepia      ?? 0;
      const blur       = f.blur       ?? 0;
      const hue        = f.hue        ?? 0;
      const saturation = f.saturation ?? 100;
      const darkness   = f.darkness   ?? 0;
      const brightFinal = brightness * (1 - darkness / 100);

      ctx.filter = `brightness(${brightFinal}%) contrast(${contrast}%) sepia(${sepia}%) blur(${blur}px) hue-rotate(${hue}deg) saturate(${saturation}%)`;
      
      const cp = layer.crop || { t: 0, r: 0, b: 0, l: 0 };
      const sx = img.naturalWidth * (cp.l / 100);
      const sy = img.naturalHeight * (cp.t / 100);
      const sw = img.naturalWidth * (1 - (cp.l + cp.r) / 100);
      const sh = img.naturalHeight * (1 - (cp.t + cp.b) / 100);

      ctx.drawImage(img, sx, sy, sw, sh, -layer.w * scale / 2, -layer.h * scale / 2, layer.w * scale, layer.h * scale);
      ctx.filter = 'none';

      // Warmth / Tint overlay
      const warmth = f.warmth ?? 0;
      const tint   = f.tint   ?? 0;
      if (warmth !== 0 || tint !== 0) {
        const r2 = warmth > 0 ? Math.round(warmth * 0.8) : 0;
        const g2 = tint   > 0 ? Math.round(tint   * 0.5) : 0;
        const b2 = warmth < 0 ? Math.round(-warmth * 0.6) : 0;
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `rgba(${r2},${g2},${b2},0.35)`;
        ctx.fillRect(-layer.w * scale / 2, -layer.h * scale / 2, layer.w * scale, layer.h * scale);
        ctx.globalCompositeOperation = 'source-over';
      }
    } else if (layer.type === 'text') {
      await drawTextLayer(ctx, layer, scale);
    }

    ctx.restore();
  }

  // Download
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpg' ? 1.0 : undefined;
  const url = cvs.toDataURL(mime, quality);
  const a = document.createElement('a');
  a.href = url;
  a.download = `postcraft-${Date.now()}.${format}`;
  a.click();
  showToast(`Downloaded as ${format.toUpperCase()}!`);
}

async function drawBackground(ctx, w, h) {
  const bg = State.background;
  if (bg.type === 'solid') {
    ctx.fillStyle = bg.solidColor;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.type === 'gradient') {
    const { angle, stops } = bg.gradient;
    const active = stops.slice(0, State.activeStops);
    const rad = angle * Math.PI / 180;
    const cx = w / 2, cy = h / 2;
    const r  = Math.sqrt(w * w + h * h) / 2;
    const grd = ctx.createLinearGradient(
      cx - Math.sin(rad) * r, cy - Math.cos(rad) * r,
      cx + Math.sin(rad) * r, cy + Math.cos(rad) * r
    );
    active.forEach(s => grd.addColorStop(s.pos / 100, s.color));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.type === 'image' && bg.image.src) {
    await new Promise(res => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
        res();
      };
      img.onerror = res;
      img.crossOrigin = 'anonymous';
      img.src = bg.image.src;
    });
  }
}

async function drawTextLayer(ctx, layer, scale) {
  const t = layer.textProps;
  const x = -layer.w * scale / 2;
  const y = -layer.h * scale / 2;
  const w = layer.w * scale;
  const h = layer.h * scale;

  // Background
  if (t.bgEnabled) {
    const { r, g, b } = hexToRgb(t.bgColor);
    ctx.fillStyle = `rgba(${r},${g},${b},${t.bgOpacity / 100})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
  }

  const fsize = t.fontSize * scale;
  let weight = t.bold ? '700' : '400';
  let style  = t.italic ? 'italic ' : '';
  ctx.font = `${style}${weight} ${fsize}px ${t.fontFamily || 'Inter, sans-serif'}`;
  ctx.textAlign = t.align;
  ctx.letterSpacing = (t.letterSpacing * scale) + 'px';

  // Color
  if (t.colorType === 'gradient') {
    const grd = ctx.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, t.color);
    grd.addColorStop(1, t.color2);
    ctx.fillStyle = grd;
  } else {
    ctx.fillStyle = t.color;
  }

  // Text decoration
  ctx.save();
  if (t.underline) {
    ctx.strokeStyle = t.colorType === 'solid' ? t.color : t.color;
    ctx.lineWidth = Math.max(1, fsize * 0.05);
  }

  // Wrap & draw lines
  const lineH = fsize * (t.lineHeight || 1.3);
  const lines = wrapText(ctx, t.content || '', w - 12 * scale);
  const startY = y + fsize + 6 * scale;
  const alignX = t.align === 'center' ? x + w / 2 : t.align === 'right' ? x + w - 6 * scale : x + 6 * scale;

  lines.forEach((line, i) => {
    const ly = startY + i * lineH;
    ctx.fillText(line, alignX, ly);
    if (t.underline) {
      const tw = ctx.measureText(line).width;
      const ux = t.align === 'center' ? alignX - tw/2 : t.align === 'right' ? alignX - tw : alignX;
      ctx.fillRect(ux, ly + fsize * 0.1, tw, ctx.lineWidth);
    }
  });
  ctx.restore();
}

function wrapText(ctx, text, maxW) {
  const lines = [];
  const paragraphs = text.split('\n');
  paragraphs.forEach(para => {
    const words = para.split(' ');
    let line = '';
    words.forEach(word => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
  });
  return lines.length ? lines : [''];
}

$('btnExportPNG').addEventListener('click', () => exportImage('png'));
$('btnExportJPG').addEventListener('click', () => exportImage('jpg'));

// ─────────────────────────────────────────────
// UPLOAD ZONE SETUP HELPER
// ─────────────────────────────────────────────
function setupUploadZone(zone, input, callback) {
  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    readImageFile(file, callback);
    e.target.value = '';
  });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('hover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('hover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('hover');
    const file = e.dataTransfer.files[0];
    if (isValidImage(file)) {
      readImageFile(file, callback);
    } else if (file) {
      const ext = (file.name || '').split('.').pop().toUpperCase();
      showToast('Format not supported: ' + (ext || 'Unknown'));
    }
  });
}



function readImageFile(file, callback) {
  const ext = (file.name || '').split('.').pop().toLowerCase();
  if (ext === 'heic' || ext === 'heif') {
    showToast('HEIC/HEIF may not be supported in all browsers.', 3000);
  }
  
  const reader = new FileReader();
  reader.onload = e => callback(e.target.result);
  reader.onerror = () => showToast('Error reading file: ' + file.name);
  reader.readAsDataURL(file);
}


// ─────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if ((e.key === 'Delete' || e.key === 'Backspace') && State.selectedId) {
    deleteLayer(State.selectedId);
    return;
  }
  // Arrow keys to nudge
  if (State.selectedId && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const layer = findLayer(State.selectedId);
    if (!layer || layer.locked) return;
    if (e.key === 'ArrowUp')    layer.y -= step;
    if (e.key === 'ArrowDown')  layer.y += step;
    if (e.key === 'ArrowLeft')  layer.x -= step;
    if (e.key === 'ArrowRight') layer.x += step;
    const el = document.querySelector(`.design-layer[data-lid="${layer.id}"]`);
    if (el) { el.style.left = layer.x + 'px'; el.style.top = layer.y + 'px'; }
    showLayerControls(layer);
  }
  // Ctrl+D duplicate
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    const layer = findLayer(State.selectedId);
    if (!layer) return;
    const copy = JSON.parse(JSON.stringify(layer));
    copy.id = uid();
    copy.x += 20; copy.y += 20;
    copy.zIndex = State.layers.length + 1;
    State.layers.push(copy);
    renderLayer(copy);
    refreshLayersList();
    selectLayer(copy.id);
    updateLayerCount();
    showToast('Layer duplicated (Ctrl+D)');
  }

  // Escape deselect
  if (e.key === 'Escape') deselectAll();
});

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function init() {
  applyCanvasSize();
  renderBackground();
  initGradientPresets();
  switchPanel('background');
  
  // Mobile menu toggle
  const btnMenu = $('btnMobileMenu');
  if (btnMenu) {
    btnMenu.addEventListener('click', () => {
      const sidebar = $('leftSidebar');
      sidebar.classList.remove('open');
      sidebar.classList.toggle('hide-tabs');
    });
  }

  // Mobile drag handles
  let dragStartY = 0;
  
  const setupDragHandle = (handleId, onDragDown) => {
    const handle = $(handleId);
    if (!handle) return;
    handle.addEventListener('touchstart', e => {
      dragStartY = e.touches[0].clientY;
    }, {passive: true});
    handle.addEventListener('touchend', e => {
      const dragEndY = e.changedTouches[0].clientY;
      if (dragEndY - dragStartY > 30) {
        onDragDown();
      }
    });
    // Mouse support
    let isDragging = false;
    handle.addEventListener('mousedown', e => {
      isDragging = true;
      dragStartY = e.clientY;
    });
    document.addEventListener('mouseup', e => {
      if (!isDragging) return;
      isDragging = false;
      const dragEndY = e.clientY;
      if (dragEndY - dragStartY > 30) {
        onDragDown();
      }
    });
  };

  setupDragHandle('tabsDragHandle', () => {
    $('leftSidebar').classList.add('hide-tabs');
  });

  // Advanced panel drag (drag down to close, drag up to increase height)
  const panelHandle = $('panelDragHandle');
  const panelsWrapper = $('mobilePanelsWrapper');
  if (panelHandle && panelsWrapper) {
    let panelIsDragging = false;
    let panelDragStartY = 0;
    let initialHeight = 0;

    const startDrag = (clientY) => {
      panelIsDragging = true;
      panelDragStartY = clientY;
      initialHeight = panelsWrapper.getBoundingClientRect().height;
      panelsWrapper.style.transition = 'none';
    };

    const moveDrag = (clientY) => {
      if (!panelIsDragging) return;
      const delta = clientY - panelDragStartY;
      if (delta > 0) {
        panelsWrapper.style.transform = `translateY(${delta}px)`;
      } else {
        panelsWrapper.style.transform = `translateY(0)`;
        const newHeight = Math.min(window.innerHeight * 0.85, initialHeight - delta);
        panelsWrapper.style.height = `${newHeight}px`;
        document.querySelectorAll('.panel').forEach(p => {
            p.style.maxHeight = 'none';
            p.style.height = `${newHeight - 24}px`;
        });
      }
    };

    const endDrag = (clientY) => {
      if (!panelIsDragging) return;
      panelIsDragging = false;
      panelsWrapper.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      const delta = clientY - panelDragStartY;
      if (delta > 50) {
        $('leftSidebar').classList.remove('open');
        setTimeout(() => { 
          panelsWrapper.style.height = ''; 
          document.querySelectorAll('.panel').forEach(p => {
              p.style.height = '';
              p.style.maxHeight = '';
          });
        }, 300);
      }
      panelsWrapper.style.transform = '';
    };

    panelHandle.addEventListener('touchstart', e => startDrag(e.touches[0].clientY), {passive: true});
    panelHandle.addEventListener('touchmove', e => moveDrag(e.touches[0].clientY), {passive: true});
    panelHandle.addEventListener('touchend', e => endDrag(e.changedTouches[0].clientY));

    panelHandle.addEventListener('mousedown', e => startDrag(e.clientY));
    document.addEventListener('mousemove', e => { if (panelIsDragging) moveDrag(e.clientY); });
    document.addEventListener('mouseup', e => { if (panelIsDragging) endDrag(e.clientY); });
  }

  // Global Drop Zone
  const gdz = $('globalDropZone');
  window.addEventListener('dragenter', (e) => {
    if (e.dataTransfer.types.includes('Files')) gdz.classList.add('open');
  });
  gdz.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) gdz.classList.remove('open');
  });
  gdz.addEventListener('dragover', (e) => e.preventDefault());
  gdz.addEventListener('drop', (e) => {
    e.preventDefault();
    gdz.classList.remove('open');
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (isValidImage(file)) {
        readImageFile(file, (src) => {
          createLayer('image', { src, name: file.name });
        });
      } else {
        const ext = (file.name || '').split('.').pop().toUpperCase();
        showToast('Unsupported format: ' + (ext || 'Unknown'));
      }
    });
  });
  // Mode Toggle
  $('modePost').onclick = () => {
    State.mode = 'post';
    State.ratio = '1:1';
    $('modePost').classList.add('active');
    $('modeCover').classList.remove('active');
    $('ratioSelector').classList.remove('hidden');
    applyCanvasSize();
  };
  $('modeCover').onclick = () => {
    State.mode = 'cover';
    State.ratio = 'facebook';
    $('modePost').classList.remove('active');
    $('modeCover').classList.add('active');
    $('ratioSelector').classList.add('hidden');
    applyCanvasSize();
  };



  showToast('Welcome to PostCraft! 🎨');
}

window.addEventListener('resize', () => {
  clearTimeout(window._resizeTimer);
  window._resizeTimer = setTimeout(fitZoom, 150);
});

// Fullscreen Toggle
if ($('btnFullscreen')) {
  $('btnFullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });
}

$('btnThemeToggle').addEventListener('click', () => {
  const body = document.body;
  if (body.getAttribute('data-theme') === 'light') {
    body.removeAttribute('data-theme');
    $('iconThemeMoon').style.display = 'block';
    $('iconThemeSun').style.display = 'none';
  } else {
    body.setAttribute('data-theme', 'light');
    $('iconThemeMoon').style.display = 'none';
    $('iconThemeSun').style.display = 'block';
  }
});

init();
