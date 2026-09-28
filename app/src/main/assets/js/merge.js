/* ===== Highway Rush — geometry merge helper =====
 * mergeBoxes(parts) bakes a list of axis-aligned parts into a single
 * non-indexed BufferGeometry with position / normal / per-vertex color
 * attributes. This lets every traffic vehicle render in 1-2 draw calls.
 *
 * A part is: { w, h, d, x, y, z, c }            (box, c = hex color)
 * or         { geo, x, y, z, s?, c }            (custom geometry, s = scale)
 *
 * Note: caller-provided p.geo is consumed and disposed (it may be shared by
 * several parts — disposing twice is harmless).
 */
"use strict";

// Shared materials for merged meshes (must NOT be disposed per-vehicle).
// MERGE_MAT is Phong so car bodies / buildings pick up the per-theme env
// map (envMap is set by Themes.apply); specular + reflectivity give the
// paint that wet-gloss shine.
const MERGE_MAT = new THREE.MeshPhongMaterial({
  vertexColors: true,
  shininess: 90,
  specular: 0x778899,
  reflectivity: 0.5
});
const GLOW_MAT  = new THREE.MeshBasicMaterial({ vertexColors: true });

function mergeBoxes(parts) {
  const geos = [];
  let total = 0;
  for (const p of parts) {
    let g = p.geo ? p.geo : new THREE.BoxGeometry(p.w, p.h, p.d);
    // always produce our own copy we may transform + dispose
    if (g.index) g = g.toNonIndexed();
    else if (p.geo) g = g.clone();
    if (p.s) {
      const s = Array.isArray(p.s) ? p.s : [p.s, p.s, p.s];
      g.applyMatrix4(new THREE.Matrix4().makeScale(s[0], s[1], s[2]));
    }
    if (p.x || p.y || p.z) {
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(p.x || 0, p.y || 0, p.z || 0));
    }
    geos.push(g);
    total += g.attributes.position.count;
  }

  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const cc = new THREE.Color();
  let off = 0;
  for (let i = 0; i < parts.length; i++) {
    const g = geos[i];
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    cc.set(parts[i].c);
    const n = g.attributes.position.count;
    for (let v = 0; v < n; v++) {
      const o = (off + v) * 3;
      col[o] = cc.r; col[o + 1] = cc.g; col[o + 2] = cc.b;
    }
    off += n;
    g.dispose();
    if (parts[i].geo && parts[i].geo !== g) parts[i].geo.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}
