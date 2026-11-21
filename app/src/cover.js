// Vice Coast — the cover engine. Draws a multi-panel GTA-style poster onto any
// 2D canvas: photos in white-guttered panels, a sunset/neon grade, halftone and
// vignette effects, and big Anton caption lettering with a Pacifico script
// sub-caption. Everything is drawn from the state object, so the live preview
// and the full-resolution export share one code path.

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  landscape: { w: 1920, h: 1080, label: '1920 x 1080' },
};

export const LAYOUTS = {
  hero: { label: 'Hero + two', panels: 3 },
  strip: { label: 'Three strip', panels: 3 },
  grid: { label: 'Four grid', panels: 4 },
  fullbleed: { label: 'Full bleed', panels: 1 },
};

export const GRADES = {
  sunset: { label: 'Sunset' },
  neon: { label: 'Neon nights' },
  vice: { label: 'Vice purple' },
  gold: { label: 'Golden hour' },
};

/** A fresh default state: hero layout, portrait size, sunset grade. */
export function defaultState() {
  return {
    size: 'portrait',
    layout: 'hero',
    grade: 'sunset',
    caption: 'VICE CITY',
    subcaption: 'Neon nights, fast cars',
    captionSize: 1,
    halftone: true,
    vignette: true,
    grain: false,
    panels: [
      { photo: null, zoom: 1, ox: 0, oy: 0 },
      { photo: null, zoom: 1, ox: 0, oy: 0 },
      { photo: null, zoom: 1, ox: 0, oy: 0 },
      { photo: null, zoom: 1, ox: 0, oy: 0 },
    ],
  };
}

/** Panel rectangles (fractions of the canvas) for a layout, plus the title band. */
export function layoutGeometry(layout, w, h) {
  const bandH = layout === 'fullbleed' ? 0.30 : 0.27;
  const photoH = 1 - bandH;
  const panels = [];
  if (layout === 'hero') {
    panels.push({ x: 0, y: 0, w: 0.62, h: photoH });
    panels.push({ x: 0.62, y: 0, w: 0.38, h: photoH / 2 });
    panels.push({ x: 0.62, y: photoH / 2, w: 0.38, h: photoH / 2 });
  } else if (layout === 'strip') {
    for (let i = 0; i < 3; i++) panels.push({ x: i / 3, y: 0, w: 1 / 3, h: photoH });
  } else if (layout === 'grid') {
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) panels.push({ x: c / 2, y: (r * photoH) / 2, w: 0.5, h: photoH / 2 });
    }
  } else {
    panels.push({ x: 0, y: 0, w: 1, h: 1 });
  }
  return { panels, band: { x: 0, y: photoH, w: 1, h: bandH } };
}

/** Draws one photo into a panel rect, cover-fit, with zoom and pan offsets.
 *  ox / oy run -1..1 across the photo's overflow, so 1 puts the photo's edge
 *  at the panel's edge and the face never slides out of reach. */
function drawPanelPhoto(ctx, photo, rect, panel) {
  if (!photo) return;
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * (panel.zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const ex = Math.max(0, dw - rect.w);
  const ey = Math.max(0, dh - rect.h);
  const cx = rect.x + rect.w / 2 + (panel.ox || 0) * ex / 2;
  const cy = rect.y + rect.h / 2 + (panel.oy || 0) * ey / 2;
  ctx.drawImage(photo, cx - dw / 2, cy - dh / 2, dw, dh);
}

/** The colour grade: translucent sunset / neon washes over a photo rect. */
function gradePhoto(ctx, rect, grade) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  if (grade === 'neon') {
    g.addColorStop(0, 'rgba(255, 0, 128, 0.22)');
    g.addColorStop(0.55, 'rgba(120, 0, 180, 0.10)');
    g.addColorStop(1, 'rgba(0, 229, 255, 0.22)');
  } else if (grade === 'vice') {
    g.addColorStop(0, 'rgba(123, 47, 247, 0.30)');
    g.addColorStop(1, 'rgba(0, 180, 200, 0.24)');
  } else if (grade === 'gold') {
    g.addColorStop(0, 'rgba(255, 190, 60, 0.28)');
    g.addColorStop(1, 'rgba(255, 90, 0, 0.18)');
  } else {
    g.addColorStop(0, 'rgba(255, 140, 40, 0.16)');
    g.addColorStop(0.6, 'rgba(255, 80, 90, 0.10)');
    g.addColorStop(1, 'rgba(200, 40, 140, 0.26)');
  }
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  const warm = ctx.createLinearGradient(rect.x, rect.y + rect.h * 0.5, rect.x, rect.y + rect.h);
  warm.addColorStop(0, 'rgba(255, 110, 60, 0)');
  warm.addColorStop(1, 'rgba(255, 60, 120, 0.16)');
  ctx.fillStyle = warm;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** Halftone dots across a rect, denser toward its bottom edge. */
function halftone(ctx, rect, scale) {
  const step = 13 * scale;
  const cols = Math.ceil(rect.w / step);
  const rows = Math.ceil(rect.h / step);
  ctx.save();
  ctx.fillStyle = 'rgba(20, 0, 40, 0.20)';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const depth = 0.4 + (r / Math.max(rows - 1, 1)) * 0.9;
      const rad = (1.6 + 1.8 * depth) * scale;
      const x = rect.x + c * step + (r % 2 ? step / 2 : 0);
      const y = rect.y + r * step + step / 2;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A seeded speck of grain, stable between preview and export. */
function grain(ctx, w, h) {
  let seed = 20261121;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let i = 0; i < 2200; i++) {
    ctx.fillRect(next() * w, next() * h, 1.6, 1.6);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  for (let i = 0; i < 2200; i++) {
    ctx.fillRect(next() * w, next() * h, 1.6, 1.6);
  }
  ctx.restore();
}

/** The title band: sunset gradient, big Anton caption, Pacifico sub-caption. */
function drawTitleBand(ctx, state, band, scale) {
  const grad = ctx.createLinearGradient(band.x, band.y, band.x + band.w, band.y + band.h);
  if (state.grade === 'neon') {
    grad.addColorStop(0, '#ff2e88');
    grad.addColorStop(0.5, '#7b2ff7');
    grad.addColorStop(1, '#00c2ff');
  } else if (state.grade === 'vice') {
    grad.addColorStop(0, '#5b2ee5');
    grad.addColorStop(0.55, '#c026d3');
    grad.addColorStop(1, '#ff5e3a');
  } else if (state.grade === 'gold') {
    grad.addColorStop(0, '#ffb347');
    grad.addColorStop(0.55, '#ff7a18');
    grad.addColorStop(1, '#e6399b');
  } else {
    grad.addColorStop(0, '#ff8c1a');
    grad.addColorStop(0.5, '#ff2e63');
    grad.addColorStop(1, '#7b2ff7');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(band.x, band.y, band.w, band.h);

  // A thin white rule above the band, like a poster border.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(band.x, band.y, band.w, 4 * scale);

  const text = (state.caption || '').trim().toUpperCase();
  const sub = (state.subcaption || '').trim();
  if (text) {
    let size = band.h * 0.52 * (state.captionSize || 1);
    const setFont = (s) => { ctx.font = `${s}px Anton, 'Arial Black', sans-serif`; };
    setFont(size);
    try { ctx.letterSpacing = `${Math.max(1, size * 0.02)}px`; } catch { /* older canvas */ }
    while (ctx.measureText(text).width > band.w * 0.92 && size > 14) {
      size -= 2;
      setFont(size);
    }
    const cy = band.y + band.h * (sub ? 0.46 : 0.56);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.strokeStyle = 'rgba(30, 0, 50, 0.85)';
    ctx.strokeText(text, band.x + band.w / 2, cy);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 0, 140, 0.55)';
    ctx.shadowBlur = size * 0.18;
    ctx.fillText(text, band.x + band.w / 2, cy);
    ctx.shadowBlur = 0;
  }
  if (sub) {
    const subSize = band.h * 0.20;
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe600';
    ctx.shadowColor = 'rgba(255, 0, 140, 0.8)';
    ctx.shadowBlur = subSize * 0.4;
    ctx.fillText(sub, band.x + band.w / 2, band.y + band.h * 0.82);
    ctx.shadowBlur = 0;
  }
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
}

/**
 * Draws the whole cover for `state` onto `canvas` (its own pixel size).
 * Panels with no photo get a sunset placeholder so the poster always looks done.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const scale = w / 1080;
  const gap = Math.max(3, Math.round(9 * scale));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const geo = layoutGeometry(state.layout, w, h);
  const count = LAYOUTS[state.layout].panels;
  for (let i = 0; i < count; i++) {
    const f = geo.panels[i];
    const rect = {
      x: f.x * w + gap,
      y: f.y * h + gap,
      w: f.w * w - gap * 2,
      h: f.h * h - gap * 2,
    };
    const panel = state.panels[i] || { photo: null, zoom: 1, ox: 0, oy: 0 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (panel.photo) {
      drawPanelPhoto(ctx, panel.photo, rect, panel);
    } else {
      const ph = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      ph.addColorStop(0, '#ff9a3d');
      ph.addColorStop(0.5, '#ff2e63');
      ph.addColorStop(1, '#5b2ee5');
      ctx.fillStyle = ph;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `bold ${Math.max(14, 22 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    gradePhoto(ctx, rect, state.grade);
    ctx.restore();
  }

  const band = {
    x: geo.band.x * w,
    y: geo.band.y * h,
    w: geo.band.w * w,
    h: geo.band.h * h,
  };
  if (state.layout === 'fullbleed') {
    // The band is a scrim over the photo, not a solid block.
    const scrim = ctx.createLinearGradient(0, band.y, 0, h);
    scrim.addColorStop(0, 'rgba(40, 0, 60, 0)');
    scrim.addColorStop(0.35, 'rgba(40, 0, 60, 0.55)');
    scrim.addColorStop(1, 'rgba(40, 0, 60, 0.92)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, band.y, w, h);
    drawTitleBandTextOnly(ctx, state, band, scale);
  } else {
    drawTitleBand(ctx, state, band, scale);
  }

  if (state.halftone) halftone(ctx, band, scale);
  if (state.vignette) {
    const vg = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(10, 0, 30, 0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
  if (state.grain) grain(ctx, w, h);
}

/** Caption + sub-caption only (no band background), for the full-bleed scrim. */
function drawTitleBandTextOnly(ctx, state, band, scale) {
  const text = (state.caption || '').trim().toUpperCase();
  const sub = (state.subcaption || '').trim();
  if (text) {
    let size = band.h * 0.52 * (state.captionSize || 1);
    const setFont = (s) => { ctx.font = `${s}px Anton, 'Arial Black', sans-serif`; };
    setFont(size);
    try { ctx.letterSpacing = `${Math.max(1, size * 0.02)}px`; } catch { /* older canvas */ }
    while (ctx.measureText(text).width > band.w * 0.92 && size > 14) {
      size -= 2;
      setFont(size);
    }
    const cy = band.y + band.h * (sub ? 0.46 : 0.56);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.strokeStyle = 'rgba(30, 0, 50, 0.85)';
    ctx.strokeText(text, band.x + band.w / 2, cy);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 0, 140, 0.55)';
    ctx.shadowBlur = size * 0.18;
    ctx.fillText(text, band.x + band.w / 2, cy);
    ctx.shadowBlur = 0;
  }
  if (sub) {
    const subSize = band.h * 0.20;
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe600';
    ctx.shadowColor = 'rgba(255, 0, 140, 0.8)';
    ctx.shadowBlur = subSize * 0.4;
    ctx.fillText(sub, band.x + band.w / 2, band.y + band.h * 0.82);
    ctx.shadowBlur = 0;
  }
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
}

/** The filename for an export at the state's size. */
export function exportFilename(state) {
  const size = SIZES[state.size];
  return `vice-coast-cover-${size.w}x${size.h}.png`;
}
