// The editor's state: one object the preview and the export both draw from.
// Photos live here as loaded Image objects; nothing is ever uploaded anywhere.

import { defaultState, LAYOUTS, SIZES } from './cover.js';

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Loads an image from a local file the user picked (read on this machine only). */
export function loadFileImage(file) {
  return loadImage(URL.createObjectURL(file));
}

/** The state's panel count for its current layout. */
export function panelCount(state) {
  return LAYOUTS[state.layout].panels;
}

/** The pixel size of the state's chosen export size. */
export function exportSize(state) {
  return SIZES[state.size];
}

/** Puts one photo into every panel that is still empty. */
export function fillEmptyPanels(state, photo) {
  for (const panel of state.panels) {
    if (!panel.photo) panel.photo = photo;
  }
}

/** Puts one photo into every panel of the current layout. */
export function fillAllPanels(state, photo) {
  for (let i = 0; i < panelCount(state); i++) {
    state.panels[i].photo = photo;
  }
}

/** Applies ?shot= / query parameters (layout, size, grade, caption, photo). */
export function applyQuery(state, query) {
  const layout = query.get('layout');
  if (layout && LAYOUTS[layout]) state.layout = layout;
  const size = query.get('size');
  if (size && SIZES[size]) state.size = size;
  const grade = query.get('grade');
  if (grade && ['sunset', 'neon', 'vice', 'gold'].includes(grade)) state.grade = grade;
  const caption = query.get('caption');
  if (caption) state.caption = caption;
  const sub = query.get('sub');
  if (sub !== null) state.subcaption = sub;
  if (query.get('halftone') === '0') state.halftone = false;
  if (query.get('vignette') === '0') state.vignette = false;
  if (query.get('grain') === '1') state.grain = true;
  return state;
}

/** A state preloaded for a screenshot scene, with sample photos in the panels. */
export async function sceneState(query) {
  const state = applyQuery(defaultState(), query);
  const photoName = query.get('photo') ?? 'boulevard';
  const secondName = query.get('photo2') ?? 'pier';
  try {
    const first = await loadImage(`samples/${photoName}.jpg`);
    const second = await loadImage(`samples/${secondName}.jpg`);
    const n = panelCount(state);
    for (let i = 0; i < n; i++) {
      state.panels[i].photo = i % 2 === 0 ? first : second;
    }
    // The hero panel reads better zoomed slightly into the subject.
    state.panels[0].zoom = 1.15;
    if (state.layout === 'grid') {
      // Grid panels are wide and short: shift the photos down so faces stay in frame.
      for (let i = 0; i < n; i++) { state.panels[i].zoom = 1; state.panels[i].oy = 0.7; }
    }
    if (state.layout === 'fullbleed') state.panels[0].oy = 0.3;
  } catch {
    // Samples missing: the cover still draws with its placeholders.
  }
  return state;
}
