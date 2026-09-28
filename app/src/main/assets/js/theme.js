/* ===== Highway Rush — level themes (weather / lighting / scenery) =====
 * Every run shuffles CONFIG.THEMES and cycles through it one-per-level,
 * so each level gets a different sky, fog, lighting, road palette and
 * skyline. apply() re-tints the scene lights, fog, road/walls/ground,
 * line colors, skyline and star field, and regenerates the procedural
 * cube map used for body reflections (Phong envMap — scene.environment
 * does not reach Lambert/Phong/Basic materials in r128).
 */
"use strict";

const Themes = {
  current: null,
  order: [],          // shuffled theme indices for the current run
  _env: null,         // current cube texture (disposed on theme change)

  // Shuffle the per-run theme order. Called at boot (menu backdrop) and at
  // every fresh run start.
  newRun() {
    this.order = CONFIG.THEMES.map((t, i) => i);
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = this.order[i];
      this.order[i] = this.order[j];
      this.order[j] = tmp;
    }
  },

  // Theme object for a 1-based level (cycles the shuffled order).
  themeFor(level) {
    if (!this.order.length) this.newRun();
    return CONFIG.THEMES[this.order[(level - 1) % this.order.length]];
  },

  apply(t) {
    if (this.current === t) return;
    this.current = t;

    const scene = Game.scene;
    scene.background.set(t.sky);
    scene.fog.color.set(t.fog);
    scene.fog.density = t.fogDensity;

    Game.ambLight.color.set(t.ambient.c);
    Game.ambLight.intensity = t.ambient.i;
    Game.sun.color.set(t.sun.c);
    Game.sun.intensity = t.sun.i;
    Game.hemiLight.color.set(t.hemi.sky);
    Game.hemiLight.groundColor.set(t.hemi.ground);
    Game.hemiLight.intensity = t.hemi.i;

    // fresh reflections: dispose the old cube map, build a per-theme one
    if (this._env) this._env.dispose();
    this._env = makeEnvCube(t.envTop, t.envHorizon, t.envGround);
    MERGE_MAT.envMap = this._env;
    V.shared.tireMat.envMap = this._env;

    Road.applyTheme(t);
  }
};

/* ---------- procedural environment map ----------
 * 64x64 canvas cube: top face = envTop, bottom face = envGround, the four
 * sides are a vertical gradient from top color to horizon. Good enough for
 * glossy car bodies to pick up the current sky without any external assets.
 * Face order: +x, -x, +y (top), -y (bottom), +z, -z.
 */
function makeEnvCube(top, horizon, ground) {
  const S = 64;
  const hex = (c) => "#" + c.toString(16).padStart(6, "0");
  const face = (fn) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = S;
    fn(cv.getContext("2d"));
    return cv;
  };
  const side = (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, hex(top));
    g.addColorStop(0.55, hex(horizon));
    g.addColorStop(1, hex(horizon));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  };
  const flat = (color) => (ctx) => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(0, 0, S, S);
  };
  const tex = new THREE.CubeTexture([
    face(side), face(side),
    face(flat(top)), face(flat(ground)),
    face(side), face(side)
  ]);
  tex.needsUpdate = true;
  return tex;
}
