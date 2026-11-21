// Fixed scenes for screenshots: ?shot=cover draws one exported-style cover full
// frame; ?shot=editor shows the editor with sample photos loaded. `layout`,
// `size`, `grade`, `caption`, `sub` and `photo`/`photo2` pick the scene.
// window.__shotReady is set once the cover is painted.

/**
 * Builds the scene state for a shot and hands it back to main.js.
 * `buildScene` is state.sceneState; `apply` is state.applyQuery.
 */
export async function runShot(shot, query, buildScene, apply) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const state = await buildScene(query);
  apply(state, query);
  return state;
}
