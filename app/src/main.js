// Vice Coast editor: wires the controls to the state and the live preview.
// The preview canvas is drawn at the export's own pixel size and scaled by CSS,
// so what you see is exactly what the PNG export writes.

import { drawCover, exportFilename, layoutGeometry, defaultState } from './cover.js';
import {
  loadFileImage, loadImage, panelCount, exportSize,
  fillAllPanels, sceneState, applyQuery,
} from './state.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const preview = $('cover');
const status = $('status');
let state = null;
let selected = 0;
let drag = null;

function say(message) {
  status.textContent = message;
}

/** Redraws the preview at the state's export size. */
function redraw() {
  const size = exportSize(state);
  if (preview.width !== size.w || preview.height !== size.h) {
    preview.width = size.w;
    preview.height = size.h;
  }
  drawCover(preview, state);
  preview.style.aspectRatio = `${size.w} / ${size.h}`;
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.size);
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  renderPanelTabs();
  syncPanelControls();
}

/** The panel tabs (one per panel of the current layout). */
function renderPanelTabs() {
  const tabs = $('panelTabs');
  tabs.innerHTML = '';
  for (let i = 0; i < panelCount(state); i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab' + (i === selected ? ' active' : '');
    b.textContent = `Panel ${i + 1}`;
    b.addEventListener('click', () => { selected = i; redraw(); });
    tabs.appendChild(b);
  }
}

/** Syncs the per-panel sliders with the selected panel. */
function syncPanelControls() {
  const panel = state.panels[selected] || { zoom: 1, ox: 0, oy: 0 };
  $('zoom').value = panel.zoom || 1;
  $('posX').value = panel.ox || 0;
  $('posY').value = panel.oy || 0;
  $('zoomVal').textContent = `${Math.round((panel.zoom || 1) * 100)}%`;
  $('posVal').textContent = `${Math.round((panel.ox || 0) * 100)}, ${Math.round((panel.oy || 0) * 100)}`;
}

function bindOptionButtons(attr, apply) {
  document.querySelectorAll(`[data-${attr}]`).forEach((b) => {
    b.addEventListener('click', () => {
      apply(b.dataset[attr]);
      if (attr === 'layout') selected = 0;
      redraw();
    });
  });
}

function bindControls() {
  bindOptionButtons('layout', (v) => { state.layout = v; });
  bindOptionButtons('size', (v) => { state.size = v; });
  bindOptionButtons('grade', (v) => { state.grade = v; });

  $('caption').addEventListener('input', (e) => { state.caption = e.target.value; redraw(); });
  $('subcaption').addEventListener('input', (e) => { state.subcaption = e.target.value; redraw(); });
  $('captionSize').addEventListener('input', (e) => {
    state.captionSize = Number(e.target.value);
    $('captionSizeVal').textContent = `${Math.round(state.captionSize * 100)}%`;
    redraw();
  });
  $('halftone').addEventListener('change', (e) => { state.halftone = e.target.checked; redraw(); });
  $('vignette').addEventListener('change', (e) => { state.vignette = e.target.checked; redraw(); });
  $('grain').addEventListener('change', (e) => { state.grain = e.target.checked; redraw(); });

  $('zoom').addEventListener('input', (e) => {
    state.panels[selected].zoom = Number(e.target.value);
    syncPanelControls();
    redraw();
  });
  $('posX').addEventListener('input', (e) => {
    state.panels[selected].ox = Number(e.target.value);
    syncPanelControls();
    redraw();
  });
  $('posY').addEventListener('input', (e) => {
    state.panels[selected].oy = Number(e.target.value);
    syncPanelControls();
    redraw();
  });

  $('photoFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      state.panels[selected].photo = await loadFileImage(file);
      say(`Loaded ${file.name} into Panel ${selected + 1}.`);
      redraw();
    } catch {
      say('That file could not be read as a photo.');
    }
    e.target.value = '';
  });

  document.querySelectorAll('[data-sample]').forEach((b) => {
    b.addEventListener('click', async () => {
      try {
        state.panels[selected].photo = await loadImage(`samples/${b.dataset.sample}.jpg`);
        say(`Sample ${b.dataset.sample} into Panel ${selected + 1}.`);
        redraw();
      } catch {
        say('The sample could not be loaded.');
      }
    });
  });

  $('fillAll').addEventListener('click', () => {
    const photo = state.panels[selected].photo;
    if (!photo) { say('Put a photo in the selected panel first.'); return; }
    fillAllPanels(state, photo);
    say('Filled every panel with this photo.');
    redraw();
  });

  $('export').addEventListener('click', () => {
    const size = exportSize(state);
    const out = document.createElement('canvas');
    out.width = size.w;
    out.height = size.h;
    drawCover(out, state);
    out.toBlob((blob) => {
      if (!blob) { say('Export failed — try again.'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = exportFilename(state);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      say(`Saved ${exportFilename(state)} — ${size.label} PNG.`);
    }, 'image/png');
  });
}

/** Drag on the preview to pan the photo in the panel under the pointer. */
function bindDrag() {
  const toCanvas = (e) => {
    const r = preview.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * preview.width,
      y: ((e.clientY - r.top) / r.height) * preview.height,
    };
  };
  preview.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    drag = { start: p, panel: selected, ox: state.panels[selected].ox, oy: state.panels[selected].oy };
    preview.setPointerCapture(e.pointerId);
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toCanvas(e);
    const panel = state.panels[drag.panel];
    const geo = layoutGeometry(state.layout, preview.width, preview.height);
    const f = geo.panels[drag.panel];
    const dx = (p.x - drag.start.x) / (f.w * preview.width);
    const dy = (p.y - drag.start.y) / (f.h * preview.height);
    panel.ox = Math.max(-1, Math.min(1, drag.ox + dx * 2));
    panel.oy = Math.max(-1, Math.min(1, drag.oy + dy * 2));
    syncPanelControls();
    redraw();
  });
  preview.addEventListener('pointerup', () => { drag = null; });
  preview.addEventListener('pointercancel', () => { drag = null; });
}

/** Clicking a panel in the preview selects it for cropping. */
function bindPanelPick() {
  preview.addEventListener('click', (e) => {
    if (drag) return;
    const r = preview.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const geo = layoutGeometry(state.layout, 1, 1);
    for (let i = 0; i < geo.panels.length; i++) {
      const p = geo.panels[i];
      if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) {
        selected = i;
        redraw();
        break;
      }
    }
  });
}

async function boot() {
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    state = await runShot(shot, query, sceneState, applyQuery);
  } else {
    state = defaultState();
    applyQuery(state, query);
    try {
      const first = await loadImage('samples/boulevard.jpg');
      const second = await loadImage('samples/pier.jpg');
      state.panels[0].photo = first;
      state.panels[1].photo = second;
      state.panels[2].photo = first;
      state.panels[3].photo = second;
      state.panels[0].zoom = 1.15;
    } catch {
      // No samples: placeholders still draw.
    }
  }
  $('caption').value = state.caption;
  $('subcaption').value = state.subcaption;
  $('captionSize').value = state.captionSize;
  $('captionSizeVal').textContent = `${Math.round(state.captionSize * 100)}%`;
  $('halftone').checked = state.halftone;
  $('vignette').checked = state.vignette;
  $('grain').checked = state.grain;
  bindControls();
  bindDrag();
  bindPanelPick();
  // Lettering fonts are vendored files; wait for them so the first paint is final.
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px Pacifico'),
    ]);
  } catch { /* fallbacks still draw */ }
  redraw();
  if (shot) {
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
  }
}

boot();
