/* ===== Highway Rush — vehicle factory =====
 * Every vehicle is a THREE.Group facing -Z (its front is at -z/2).
 *
 * Traffic vehicles are built from merged geometry (see merge.js):
 *   mesh 1 — body + wheels, MERGE_MAT (Lambert, vertex colors), castShadow
 *   mesh 2 — head/tail lights (+ underglow on some), GLOW_MAT (Basic)
 * => 2 draw calls per car, no per-vertex material churn.
 *
 * The player car keeps separate wheel meshes so the wheels can spin.
 *
 * Types register into V.types with:
 *   w, l         -> overall width / length (hitbox)
 *   weight       -> spawn weight at low levels
 *   minLevel     -> earliest level it appears
 *   build(color) -> { body: part[], glow: part[] }
 */
"use strict";

const V = { types: [], shared: {} };

// Part colors (baked into vertex colors)
const C = {
  TIRE:   0x14151a,
  GLASS:  0x35507a,
  DARK:   0x22252c,
  CHROME: 0xb8c4d4,
  HEAD:   0xfff7d6,
  TAIL:   0xff3b30,
  GOLD:   0xffd700,
  CYAN:   0x00e5ff
};

const PALETTE = [
  0xc0392b, 0x2980b9, 0x27ae60, 0xf1c40f, 0x8e44ad, 0x16a085,
  0xd35400, 0x7f8c8d, 0xecf0f1, 0x2c3e50, 0xe74c3c, 0x3498db,
  0x1abc9c, 0xf39c12, 0x9b59b6, 0x34495e, 0xbdc3c7, 0x6c5ce7,
  0xe84393, 0x00cec9
];
function randColor() { return PALETTE[(Math.random() * PALETTE.length) | 0]; }

function initVehicleShared() {
  if (!V.shared.tireMat) {
    // Phong so tires pick up the env map a touch (envMap set by Themes.apply)
    V.shared.tireMat = new THREE.MeshPhongMaterial({
      color: C.TIRE, shininess: 20, specular: 0x222222, reflectivity: 0.2
    });
  }
  if (!V.shared.indMat) {
    // Unlit amber so the turn signal reads as a glowing lamp at night.
    V.shared.indMat = new THREE.MeshBasicMaterial({ color: 0xffb300 });
  }
}

// A pair of turn-signal clusters for a vehicle of footprint w x l:
// one on the +x side, one on the -x side, each a merged front+rear lamp.
// Both start hidden; traffic.js toggles the right one while signaling.
function indicatorMeshes(w, l, y) {
  const offX = w / 2 + 0.04;      // just proud of the body side
  const zEnd = l / 2 - 0.14;      // a touch inboard of the front/rear face
  const make = (side) => {
    const sx = side * offX;
    const mesh = new THREE.Mesh(mergeBoxes([
      { w: 0.34, h: 0.16, d: 0.12, x: sx, y, z: -zEnd, c: 0xffffff },
      { w: 0.34, h: 0.16, d: 0.12, x: sx, y, z:  zEnd, c: 0xffffff }
    ]), V.shared.indMat);
    mesh.visible = false;
    return mesh;
  };
  return { plus: make(1), minus: make(-1) };
}

/* ---------- part helpers ---------- */

// One wheel (cylinder with its axle along X, baked at (x, r, z)).
function wheel(r, width, x, z) {
  const g = new THREE.CylinderGeometry(r, r, width, 10);
  g.rotateZ(Math.PI / 2);
  return { geo: g, x, y: r, z, c: C.TIRE };
}

// Standard 4-wheel layout for a body of footprint w x l.
function wheelParts(w, l, r, width) {
  const dx = w / 2 - 0.24, dz = l / 2 - 0.8;
  return [
    wheel(r, width, -dx, -dz), wheel(r, width, dx, -dz),
    wheel(r, width, -dx, dz),  wheel(r, width, dx, dz)
  ];
}

// Headlight pair on the front (-z face at frontZ) / taillight pair.
function headParts(w, frontZ, y, size = 0.42) {
  const off = w / 2 - 0.35;
  return [
    { w: size, h: 0.18, d: 0.1, x: -off, y, z: -frontZ + 0.05, c: C.HEAD },
    { w: size, h: 0.18, d: 0.1, x: off,  y, z: -frontZ + 0.05, c: C.HEAD }
  ];
}
function tailParts(w, rearZ, y, size = 0.42) {
  const off = w / 2 - 0.35;
  return [
    { w: size, h: 0.18, d: 0.1, x: -off, y, z: rearZ - 0.05, c: C.TAIL },
    { w: size, h: 0.18, d: 0.1, x: off,  y, z: rearZ - 0.05, c: C.TAIL }
  ];
}

/* ================= vehicle builders =================
 * Each returns { body: [...], glow: [...] } for a given color. */

function buildSedan(color) {
  return {
    body: [
      { w: 2.0, h: 0.3, d: 4.4, x: 0, y: 0.22, z: 0, c: C.DARK },
      { w: 2.0, h: 0.85, d: 4.4, x: 0, y: 0.62, z: 0, c: color },
      { w: 1.8, h: 0.62, d: 2.3, x: 0, y: 1.32, z: 0.15, c: C.GLASS },
      ...wheelParts(2.0, 4.4, 0.34, 0.26)
    ],
    glow: [...headParts(2.0, 2.2, 0.72), ...tailParts(2.0, 2.2, 0.72)]
  };
}

function buildHatch(color) {
  return {
    body: [
      { w: 1.9, h: 0.3, d: 4.0, x: 0, y: 0.22, z: 0, c: C.DARK },
      { w: 1.9, h: 0.8, d: 4.0, x: 0, y: 0.6, z: 0, c: color },
      { w: 1.7, h: 0.62, d: 2.9, x: 0, y: 1.24, z: 0.25, c: C.GLASS },  // tall hatch glass to the rear
      ...wheelParts(1.9, 4.0, 0.33, 0.25)
    ],
    glow: [...headParts(1.9, 2.0, 0.66), ...tailParts(1.9, 2.0, 0.66)]
  };
}

function buildSports(color) {
  return {
    body: [
      { w: 1.9, h: 0.6, d: 4.5, x: 0, y: 0.5, z: 0, c: color },
      { w: 1.6, h: 0.45, d: 1.9, x: 0, y: 1.0, z: 0.35, c: C.GLASS },
      { w: 1.95, h: 0.12, d: 0.5, x: 0, y: 0.42, z: -2.15, c: C.DARK },  // splitter
      { w: 1.95, h: 0.3, d: 0.25, x: 0, y: 0.72, z: 2.2, c: color },    // wing
      { w: 0.12, h: 0.28, d: 0.12, x: -0.7, y: 0.55, z: 2.2, c: C.DARK },
      { w: 0.12, h: 0.28, d: 0.12, x: 0.7, y: 0.55, z: 2.2, c: C.DARK },
      ...wheelParts(1.9, 4.5, 0.3, 0.28)
    ],
    glow: [...headParts(1.9, 2.25, 0.55), ...tailParts(1.9, 2.25, 0.55)]
  };
}

function buildSUV(color) {
  return {
    body: [
      { w: 2.1, h: 1.2, d: 4.8, x: 0, y: 0.95, z: 0, c: color },
      { w: 1.9, h: 0.55, d: 2.6, x: 0, y: 1.78, z: 0.1, c: C.GLASS },
      { w: 2.14, h: 0.2, d: 4.84, x: 0, y: 0.34, z: 0, c: C.DARK },
      { w: 1.9, h: 0.1, d: 4.5, x: 0, y: 1.56, z: 0, c: C.CHROME },  // roof rail
      ...wheelParts(2.1, 4.8, 0.42, 0.3)
    ],
    glow: [...headParts(2.1, 2.4, 1.1), ...tailParts(2.1, 2.4, 1.1)]
  };
}

function buildVan(color) {
  return {
    body: [
      { w: 2.2, h: 2.0, d: 5.4, x: 0, y: 1.35, z: 0, c: color },
      { w: 2.0, h: 0.5, d: 1.2, x: 0, y: 1.75, z: -2.1, c: C.GLASS },
      { w: 2.24, h: 0.24, d: 5.44, x: 0, y: 0.4, z: 0, c: C.DARK },
      { w: 2.22, h: 0.08, d: 5.0, x: 0, y: 1.05, z: 0, c: C.CHROME },
      ...wheelParts(2.2, 5.4, 0.45, 0.3)
    ],
    glow: [...headParts(2.2, 2.7, 1.3), ...tailParts(2.2, 2.7, 1.3)]
    };
}

function buildTaxi() {
  const color = 0xf5c518;
  return {
    body: [
      { w: 2.0, h: 0.3, d: 4.4, x: 0, y: 0.22, z: 0, c: C.DARK },
      { w: 2.0, h: 0.9, d: 4.4, x: 0, y: 0.62, z: 0, c: color },
      { w: 1.8, h: 0.6, d: 2.3, x: 0, y: 1.32, z: 0.15, c: C.GLASS },
      { w: 2.02, h: 0.14, d: 4.4, x: 0, y: 0.5, z: 0, c: C.DARK },  // checker band
      { w: 0.55, h: 0.12, d: 0.4, x: 0, y: 1.66, z: -0.5, c: C.DARK },
      ...wheelParts(2.0, 4.4, 0.34, 0.26)
    ],
    glow: [
      ...headParts(2.0, 2.2, 0.72), ...tailParts(2.0, 2.2, 0.72),
      { w: 0.55, h: 0.16, d: 0.4, x: 0, y: 1.78, z: -0.5, c: C.GOLD }  // roof sign
    ]
  };
}

function buildPickup(color) {
  return {
    body: [
      { w: 2.1, h: 0.9, d: 5.2, x: 0, y: 0.75, z: 0, c: color },
      { w: 1.8, h: 0.5, d: 2.0, x: 0, y: 1.45, z: -1.4, c: C.GLASS },
      { w: 1.9, h: 0.4, d: 2.2, x: 0, y: 0.95, z: 1.5, c: C.DARK },  // bed interior
      { w: 2.14, h: 0.16, d: 5.24, x: 0, y: 0.3, z: 0.3, c: C.DARK },
      ...wheelParts(2.1, 5.2, 0.45, 0.3)
    ],
    glow: [...headParts(2.1, 2.9, 0.9), ...tailParts(2.1, 2.9, 0.9)]
  };
}

function buildMuscle(color) {
  return {
    body: [
      { w: 2.05, h: 0.7, d: 4.9, x: 0, y: 0.55, z: 0, c: color },
      { w: 1.7, h: 0.5, d: 2.1, x: 0, y: 1.05, z: 0.4, c: C.GLASS },
      { w: 0.5, h: 0.16, d: 0.9, x: 0, y: 0.95, z: -1.55, c: C.DARK },  // hood scoop
      { w: 2.09, h: 0.12, d: 4.92, x: 0, y: 0.86, z: 0, c: C.CHROME },
      ...wheelParts(2.05, 4.9, 0.33, 0.26)
    ],
    glow: [...headParts(2.05, 2.45, 0.6), ...tailParts(2.05, 2.45, 0.6)]
  };
}

function buildBus() {
  const color = 0x2f6fb2;
  const wheels = [
    wheel(0.5, 0.32, -1.1, -3.8), wheel(0.5, 0.32, 1.1, -3.8),
    wheel(0.5, 0.32, -1.1, 0),    wheel(0.5, 0.32, 1.1, 0),
    wheel(0.5, 0.32, -1.1, 3.8),  wheel(0.5, 0.32, 1.1, 3.8)
  ];
  return {
    body: [
      { w: 2.5, h: 2.8, d: 11.5, x: 0, y: 1.9, z: 0, c: color },
      { w: 2.54, h: 0.7, d: 10.2, x: 0, y: 2.35, z: 0, c: C.GLASS },
      { w: 2.54, h: 0.3, d: 11.54, x: 0, y: 0.55, z: 0, c: C.DARK },
      { w: 2.52, h: 0.1, d: 11.0, x: 0, y: 1.35, z: 0, c: C.CHROME },
      ...wheels
    ],
    glow: [...headParts(2.5, 5.75, 2.0), ...tailParts(2.5, 5.75, 2.0)]
  };
}

function buildSemi(color) {
  const trailer = 0xd8dde6;
  const wheels = [
    wheel(0.55, 0.34, -1.2, -2.6), wheel(0.55, 0.34, 1.2, -2.6),   // cab axle
    wheel(0.55, 0.34, -1.2, 0.8),  wheel(0.55, 0.34, 1.2, 0.8),    // trailer front
    wheel(0.55, 0.34, -1.2, 8.6),  wheel(0.55, 0.34, 1.2, 8.6),    // twin rear
    wheel(0.55, 0.34, -1.2, 9.5),  wheel(0.55, 0.34, 1.2, 9.5)
  ];
  return {
    body: [
      { w: 2.5, h: 3.0, d: 10.2, x: 0, y: 1.95, z: 4.6, c: trailer },
      { w: 2.54, h: 0.4, d: 10.24, x: 0, y: 0.45, z: 4.6, c: C.DARK },
      { w: 2.52, h: 2.4, d: 0.06, x: 0, y: 2.0, z: 9.7, c: C.CHROME },
      { w: 1.6, h: 0.7, d: 0.05, x: 0, y: 2.5, z: 9.68, c: 0xd63031 },  // door logo
      { w: 2.4, h: 2.9, d: 3.2, x: 0, y: 1.75, z: -1.9, c: color },
      { w: 2.1, h: 0.7, d: 0.9, x: 0, y: 2.35, z: -3.0, c: C.GLASS },
      { w: 2.44, h: 0.3, d: 3.24, x: 0, y: 0.4, z: -1.9, c: C.DARK },
      { w: 2.45, h: 0.15, d: 0.3, x: 0, y: 0.75, z: -3.5, c: C.CHROME },
      { w: 0.18, h: 1.4, d: 0.2, x: -1.1, y: 1.6, z: -3.4, c: C.CHROME },  // exhaust stacks
      { w: 0.18, h: 1.4, d: 0.2, x: 1.1, y: 1.6, z: -3.4, c: C.CHROME },
      ...wheels
    ],
    glow: [...headParts(2.4, 3.45, 1.5), ...tailParts(2.5, 9.7, 1.5)]
  };
}

function buildRace(color) {
  return {
    body: [
      { w: 1.9, h: 0.55, d: 4.6, x: 0, y: 0.45, z: 0, c: color },
      { w: 1.55, h: 0.4, d: 1.8, x: 0, y: 0.85, z: 0.45, c: C.GLASS },
      { w: 1.95, h: 0.35, d: 0.3, x: 0, y: 0.75, z: 2.25, c: color },  // big wing
      { w: 0.1, h: 0.3, d: 0.1, x: -0.8, y: 0.6, z: 2.25, c: C.DARK },
      { w: 0.1, h: 0.3, d: 0.1, x: 0.8, y: 0.6, z: 2.25, c: C.DARK },
      { w: 1.9, h: 0.1, d: 0.5, x: 0, y: 0.35, z: -2.2, c: C.DARK },  // splitter
      ...wheelParts(1.9, 4.6, 0.3, 0.3)
    ],
    glow: [
      ...headParts(1.9, 2.3, 0.5), ...tailParts(1.9, 2.3, 0.5),
      { w: 1.7, h: 0.06, d: 4.2, x: 0, y: 0.08, z: 0, c: C.CYAN }  // underglow
    ]
  };
}

/* ---------- type registry ---------- */
function initVehicleTypes() {
  initVehicleShared();
  if (V.types.length) return;

  const reg = (t) => V.types.push(t);
  reg({ name: "sedan",  w: 2.0,  l: 4.4,  weight: 30, minLevel: 1, build: buildSedan  });
  reg({ name: "hatch",  w: 1.9,  l: 4.0,  weight: 18, minLevel: 1, build: buildHatch  });
  reg({ name: "suv",    w: 2.1,  l: 4.8,  weight: 22, minLevel: 1, build: buildSUV    });
  reg({ name: "van",    w: 2.2,  l: 5.4,  weight: 12, minLevel: 2, build: buildVan    });
  reg({ name: "taxi",   w: 2.0,  l: 4.4,  weight: 8,  minLevel: 2, build: buildTaxi   });
  reg({ name: "pickup", w: 2.1,  l: 5.2,  weight: 10, minLevel: 2, build: buildPickup });
  reg({ name: "sports", w: 1.9,  l: 4.5,  weight: 8,  minLevel: 3, build: buildSports });
  reg({ name: "muscle", w: 2.05, l: 4.9,  weight: 7,  minLevel: 4, build: buildMuscle });
  reg({ name: "race",   w: 1.9,  l: 4.6,  weight: 6,  minLevel: 4, build: buildRace   });
  reg({ name: "bus",    w: 2.5,  l: 11.5, weight: 5,  minLevel: 5, build: buildBus    });
  reg({ name: "semi",   w: 2.5,  l: 14.0, weight: 4,  minLevel: 6, build: buildSemi   });
}

// Pick a weighted-random type available at the current level.
function pickVehicleType(level) {
  const pool = V.types.filter(t => level >= t.minLevel);
  let total = 0;
  for (const t of pool) total += t.weight;
  let r = Math.random() * total;
  for (const t of pool) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return pool[0];
}

// Create a traffic vehicle: { group, w, l, type, indPlus, indMinus }
function createTrafficVehicle(level) {
  initVehicleTypes();
  const t = pickVehicleType(level);
  const built = t.build(randColor());
  const group = new THREE.Group();
  const body = new THREE.Mesh(mergeBoxes(built.body), MERGE_MAT);
  body.castShadow = true;
  group.add(body);
  if (built.glow.length) {
    group.add(new THREE.Mesh(mergeBoxes(built.glow), GLOW_MAT));
  }
  // turn-signal clusters (hidden until the driver signals a lane change)
  const ind = indicatorMeshes(t.w, t.l, 0.72);
  group.add(ind.plus, ind.minus);
  return { group, w: t.w, l: t.l, type: t.name, indPlus: ind.plus, indMinus: ind.minus };
}

// Player car: merged body + separate spinning wheels.
// Returns { group, wheels, wheelGeo, wheelMat }.
function createPlayerCar() {
  initVehicleShared();
  const color = 0xff4400;
  const g = new THREE.Group();

  const body = new THREE.Mesh(mergeBoxes([
    { w: CONFIG.PLAYER_W, h: 0.3, d: CONFIG.PLAYER_L + 0.02, x: 0, y: 0.22, z: 0, c: C.DARK },
    { w: CONFIG.PLAYER_W, h: 0.7, d: CONFIG.PLAYER_L, x: 0, y: 0.55, z: 0, c: color },
    { w: 1.7, h: 0.5, d: 1.9, x: 0, y: 1.02, z: 0.3, c: C.GLASS },
    { w: 0.28, h: 0.04, d: CONFIG.PLAYER_L, x: -0.4, y: 0.93, z: 0, c: 0xffffff },  // stripes
    { w: 0.28, h: 0.04, d: CONFIG.PLAYER_L, x: 0.4, y: 0.93, z: 0, c: 0xffffff },
    { w: 1.9, h: 0.1, d: 0.35, x: 0, y: 0.95, z: CONFIG.PLAYER_L / 2 - 0.15, c: color }
  ]), MERGE_MAT);
  body.castShadow = true;
  g.add(body);

  g.add(new THREE.Mesh(mergeBoxes([
    ...headParts(CONFIG.PLAYER_W, CONFIG.PLAYER_L / 2, 0.6),
    ...tailParts(CONFIG.PLAYER_W, CONFIG.PLAYER_L / 2, 0.6),
    { w: 1.7, h: 0.05, d: CONFIG.PLAYER_L - 0.3, x: 0, y: 0.08, z: 0, c: C.CYAN }  // underglow
  ]), GLOW_MAT));

  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  const dx = CONFIG.PLAYER_W / 2 - 0.22, dz = CONFIG.PLAYER_L / 2 - 0.7;
  [[-dx, -dz], [dx, -dz], [-dx, dz], [dx, dz]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wheelGeo, V.shared.tireMat);
    w.position.set(x, 0.34, z);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  });
  return { group: g, wheels, wheelGeo, wheelMat: V.shared.tireMat };
}

// Fully dispose a vehicle: geometry always, per-vehicle materials too.
// Shared materials (MERGE_MAT, GLOW_MAT, V.shared) must survive.
function disposeVehicle(group) {
  const sharedMats = new Set(Object.values(V.shared));
  sharedMats.add(MERGE_MAT);
  sharedMats.add(GLOW_MAT);
  group.traverse(o => {
    if (o.isMesh) {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m && !sharedMats.has(m)) m.dispose();
      }
    }
  });
}
