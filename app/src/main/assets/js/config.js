/* ===== Highway Rush — tunable constants ===== */
"use strict";

const CONFIG = {
  // --- Units: 1 unit = 1 meter. Road runs along -Z (forward). ---
  METER_TO_MILES: 1 / 1609.344,

  LANE_WIDTH: 4.2,
  EDGE_LINE_INSET: 0.3,         // white edge lines sit this far inside the road edge
  ROAD_MARGIN: 6.0,             // extra empty space beyond walls before world edge

  MIN_LANES: 6,
  MAX_LANES: 10,

  // --- Speeds (m/s) ---
  PLAYER_MIN_SPEED: 16,         // ~36 mph, can't stop (rolling)
  PLAYER_MAX_SPEED: 56,         // ~125 mph at level 1
  PLAYER_MAX_GROWTH: 1.0,       // added per level
  PLAYER_MAX_CAP: 74,           // ~165 mph ceiling
  PLAYER_ACCEL: 26,             // m/s^2 at low speed (tapers near top speed)
  PLAYER_BRAKE: 40,             // m/s^2 at top speed (softer near rolling)
  PLAYER_HANDBRAKE: 55,         // space bar, always hardest
  PLAYER_COAST_RATE: 0.22,      // 1/s exponential decay toward rolling speed
  STEER_SPEED: 16,              // lateral m/s
  STEER_LERP: 10,               // smoothing

  TRAFFIC_MIN_SPEED: 12,        // slowest traffic at level 1 (grows +0.5/level)
  TRAFFIC_MAX_BASE: 36,         // fastest traffic at level 1 (grows +1.1/level)
  TRAFFIC_MAX_FRACTION: 0.92,   // traffic capped just under player top speed

  // --- Spawning (two-way: left half oncoming, right half same direction) ---
  BASE_CARS: 14,                // on road at level 1
  CARS_PER_LEVEL: 4,
  MAX_CARS: 80,
  SAME_FRACTION: 0.55,          // share of traffic driving same direction as player
  SPAWN_AHEAD_SAME: 420,        // same-dir spawn distance ahead of player
  SPAWN_AHEAD_ONC: 560,         // oncoming spawn distance (they approach fast)
  DESPAWN_BEHIND: 90,
  SPAWN_GAP: 26,                // min z gap between two new spawns
  CLEAR_Z: 55,                  // keep this zone in front of the player mostly clear at spawn

  // --- Traffic AI ---
  LATERAL_SPEED: 7,             // m/s while changing lanes
  SIGNAL_DELAY: 0.55,           // s a car flashes its turn signal before starting a change
  PLAYER_BLOCK_Z: 45,           // |z| (m) within which a car won't steer across the player
  FOLLOW_TRIGGER: 26,           // gap (m) under which a car looks for a lane to overtake
  SAFE_GAP_BASE: 8,             // base following gap (m)
  SAFE_GAP_SPEED: 0.55,         // extra gap per m/s of speed
  AI_CHANGE_INTERVAL: [2, 6],   // seconds between lane-change decisions (persona may narrow)
  AI_ACCEL: 3.0,                // m/s^2
  AI_BRAKE: 9.0,                // m/s^2

  // --- Driver personalities (assigned per car at spawn) ---
  // gapMul    — following gap multiplier
  // trigMul   — FOLLOW_TRIGGER multiplier (when to give up and overtake)
  // speedMul  — multiplier on its random cruise speed
  // decide    — [min,max] seconds between lane-change decisions
  // drift     — probability of an unscheduled lane change
  // wobble    — [amp m/s, freq 1/s] sinusoidal speed wobble
  // spikes    — erratic: random sudden speed spikes
  AI_PERSONAS: [
    { id: "aggressive", gapMul: 0.6,  trigMul: 1.4,  speedMul: 1.12, decide: [0.8, 2.5], drift: 0.35, wobble: [0, 0] },
    { id: "cautious",   gapMul: 1.6,  trigMul: 0.7,  speedMul: 0.85, decide: [4, 8],     drift: 0.08, wobble: [0, 0] },
    { id: "lazy",       gapMul: 1.0,  trigMul: 0.9,  speedMul: 0.72, decide: [6, 10],    drift: 0.05, wobble: [1.2, 0.25] },
    { id: "racer",      gapMul: 0.8,  trigMul: 1.3,  speedMul: 1.18, decide: [1, 3],     drift: 0.5,  wobble: [0, 0] },
    { id: "erratic",    gapMul: 0.9,  trigMul: 1.0,  speedMul: 1.0,  decide: [1, 4],     drift: 0.6,  wobble: [0, 0], spikes: true },
    { id: "cruiser",    gapMul: 1.0,  trigMul: 1.0,  speedMul: 1.0,  decide: [2, 6],     drift: 0.2,  wobble: [0.4, 0.4] }
  ],

  // --- Camera ---
  CAM_MODES: ["CHASE", "BIRD", "HOOD"],
  CAM_LERP: 6,                  // position smoothing (1/s)
  ZOOM_CHASE: [0.55, 1.9],      // wheel-zoom range, chase cam
  ZOOM_BIRD: [0.4, 2.2],        // wheel-zoom range, birds-eye (altitude multiplier)
  BIRD_HEIGHT: 20,              // default birds-eye altitude in meters (zoom = 1)
  LEAN_ACCEL_MAX: -0.16,        // pull-in factor at full throttle (chase dist)
  LEAN_BRAKE_MAX: 0.2,          // pull-back factor at full brake

  // --- Levels ---
  LEVEL_MILES: 0.5,             // base miles per level
  LEVEL_MILES_GROWTH: 0.15,     // added per level (level 1 = 0.5 mi, level 5 = 1.1 mi ...)
  CRASH_PENALTY: 2,             // levels lost on crash

  // --- Scenery ---
  BUILDING_SPACING: 46,
  BUILDINGS_PER_SIDE: 14,
  BUILDING_MIN_H: 8,
  BUILDING_MAX_H: 46,
  BUILDING_OFFSET: 22,          // distance from road edge to building center

  // --- Visuals ---
  FOG_COLOR: 0x0c1024,
  FOG_DENSITY: 0.0062,
  ROAD_COLOR: 0x1d222e,
  DASH_LENGTH: 6,
  DASH_GAP: 7,
  DASH_START: 160,              // dashes fill from +160 (behind camera) forward
  DASH_SEG: 56,                 // ~700 units of dashes per lane line
  SEGMENT_LENGTH: 800,          // road texture repeat distance

  // --- Collision ---
  HITBOX_INSET: 0.16,           // fraction of width/length removed for fair hits

  // --- Crash effect ---
  CRASH_TUMBLE_TIME: 1.6,       // seconds of tumbling before the screen shows
  CRASH_FLASH_TIME: 0.35,       // red flash duration

  // --- Player car dims ---
  PLAYER_W: 2.0,
  PLAYER_L: 4.4
};

// Miles required to clear a given level (1-based).
function levelMiles(level) {
  return CONFIG.LEVEL_MILES + (level - 1) * CONFIG.LEVEL_MILES_GROWTH;
}

// Number of lanes at a level: 6 -> 10, clamped.
function lanesForLevel(level) {
  return Math.min(CONFIG.MAX_LANES, CONFIG.MIN_LANES + Math.floor((level - 1) / 3));
}

// Target number of traffic vehicles at a level.
function trafficCount(level) {
  return Math.min(CONFIG.MAX_CARS, CONFIG.BASE_CARS + (level - 1) * CONFIG.CARS_PER_LEVEL);
}

// Random traffic speed (m/s) at a level. Capped just under the player's top
// speed so the player can always overtake; faster traffic still creates gaps.
function trafficSpeed(level) {
  const min = CONFIG.TRAFFIC_MIN_SPEED + (level - 1) * 0.5;
  const cap = Math.min(CONFIG.TRAFFIC_MAX_BASE + (level - 1) * 1.1,
    playerMaxSpeed(level) * CONFIG.TRAFFIC_MAX_FRACTION);
  return min + Math.random() * Math.max(2, cap - min);
}

// Player max speed grows gently with level, capped.
function playerMaxSpeed(level) {
  return Math.min(CONFIG.PLAYER_MAX_CAP,
    CONFIG.PLAYER_MAX_SPEED + (level - 1) * CONFIG.PLAYER_MAX_GROWTH);
}

// Road half-width for a lane count. No shoulders — the white edge lines are
// the playable boundary and walls sit right at the road edge.
function roadHalfWidth(lanes) {
  return (lanes * CONFIG.LANE_WIDTH) / 2;
}

/* ===== Level themes =====
 * Each run shuffles this list (see theme.js) and cycles through it, one
 * theme per level, so every level gets a different sky / fog / lighting /
 * scenery. `stars: null` hides the star field (daytime themes).
 */
CONFIG.THEMES = [
  {
    id: "midnight", name: "MIDNIGHT",
    sky: 0x0c1024, fog: 0x0c1024, fogDensity: 0.0062,
    ambient: { c: 0x8899bb, i: 0.75 },
    sun: { c: 0xffffff, i: 0.9 },
    hemi: { sky: 0x334466, ground: 0x0c1024, i: 0.5 },
    road: 0x1d222e, ground: 0x0a1a12,
    edge: 0xd8d8d8, yellow: 0xf5d442, dash: 0xf2e86d,
    wall: 0x39415a, wallCap: 0xf5d442,
    buildings: [0x1b2438, 0x232f47, 0x182236, 0x2a3350],
    windowLit: 0xffe9a8, windowDark: 0x101522,
    stars: 0xbfd4ff,
    envTop: 0x1a2c55, envHorizon: 0x0c1024, envGround: 0x05070f,
    clouds: false, cloudColor: 0xffffff, roofs: false
  },
  {
    id: "neon-violet", name: "NEON VIOLET",
    sky: 0x150528, fog: 0x2a0a4a, fogDensity: 0.0058,
    ambient: { c: 0x9a6bff, i: 0.7 },
    sun: { c: 0xd9a6ff, i: 0.85 },
    hemi: { sky: 0x6a2fd4, ground: 0x150528, i: 0.55 },
    road: 0x221536, ground: 0x0d0518,
    edge: 0xb9a8ff, yellow: 0x9d5cff, dash: 0x00ffd5,
    wall: 0x4a2a7a, wallCap: 0xff3df5,
    buildings: [0x2b1650, 0x3a1e6e, 0x241143, 0x442a7d],
    windowLit: 0x00ffd5, windowDark: 0x120a24,
    stars: 0xd9b8ff,
    envTop: 0x5a2ab0, envHorizon: 0x2a0a4a, envGround: 0x0d0518,
    clouds: false, cloudColor: 0xffffff, roofs: false
  },
  {
    id: "pink-dream", name: "PINK DREAM",
    sky: 0xffc2dd, fog: 0xffc9e0, fogDensity: 0.0045,
    ambient: { c: 0xffd9ec, i: 0.9 },
    sun: { c: 0xfff0f7, i: 1.0 },
    hemi: { sky: 0xffb8d9, ground: 0xff9ec6, i: 0.6 },
    road: 0x4a3a52, ground: 0xc78fb5,
    edge: 0xfff1f9, yellow: 0xffd700, dash: 0xffffff,
    wall: 0xb98bb0, wallCap: 0xfff1f9,
    buildings: [0xf3d1e3, 0xe8bcd8, 0xf7e0ee, 0xd9a8cc],
    windowLit: 0xfff3b0, windowDark: 0x5a4468,
    stars: null,
    envTop: 0xffd1e6, envHorizon: 0xffc2dd, envGround: 0xb57ea6,
    clouds: true, cloudColor: 0xfff0f7, roofs: "cone"
  },
  {
    id: "sunset-amber", name: "SUNSET AMBER",
    sky: 0x3a1830, fog: 0x5a2a33, fogDensity: 0.0055,
    ambient: { c: 0xffb07a, i: 0.75 },
    sun: { c: 0xff9a4d, i: 1.0 },
    hemi: { sky: 0xff8a5a, ground: 0x2a1233, i: 0.55 },
    road: 0x2e2233, ground: 0x1f1428,
    edge: 0xffe0b3, yellow: 0xffb347, dash: 0xffd9a0,
    wall: 0x6e4a55, wallCap: 0xffb347,
    buildings: [0x4a2a3d, 0x5d3548, 0x3d2233, 0x6e4052],
    windowLit: 0xffc46b, windowDark: 0x241420,
    stars: 0xffc9a0,
    envTop: 0x8a3a55, envHorizon: 0x5a2a33, envGround: 0x1f1428,
    clouds: false, cloudColor: 0xffc9a0, roofs: false
  },
  {
    id: "toxic-green", name: "TOXIC GREEN",
    sky: 0x0a1a12, fog: 0x143524, fogDensity: 0.007,
    ambient: { c: 0x7affb0, i: 0.5 },
    sun: { c: 0xbaffd0, i: 0.7 },
    hemi: { sky: 0x2aff8a, ground: 0x0a1a12, i: 0.5 },
    road: 0x16241c, ground: 0x08130c,
    edge: 0xa8ff9e, yellow: 0x5cff8a, dash: 0x7affb0,
    wall: 0x2a5a44, wallCap: 0xa8ff9e,
    buildings: [0x16352a, 0x1e4636, 0x122a20, 0x255844],
    windowLit: 0xa8ff9e, windowDark: 0x0a1a12,
    stars: 0x7affb0,
    envTop: 0x145534, envHorizon: 0x143524, envGround: 0x05130a,
    clouds: false, cloudColor: 0x7affb0, roofs: false
  },
  {
    id: "arctic-cyan", name: "ARCTIC CYAN",
    sky: 0xbfe8f5, fog: 0xcdeef8, fogDensity: 0.005,
    ambient: { c: 0xdff4ff, i: 0.85 },
    sun: { c: 0xffffff, i: 1.0 },
    hemi: { sky: 0xa8dcf0, ground: 0xe8f6fc, i: 0.7 },
    road: 0x3a4a55, ground: 0xdceef5,
    edge: 0xffffff, yellow: 0x4a7a8f, dash: 0xf0fbff,
    wall: 0x8fb8cc, wallCap: 0xffffff,
    buildings: [0x9fc4d8, 0xb8d8e8, 0x88b0c8, 0xcde8f2],
    windowLit: 0xfff6c0, windowDark: 0x3a5568,
    stars: null,
    envTop: 0xd8f2fc, envHorizon: 0xbfe8f5, envGround: 0xc0d8e4,
    clouds: false, cloudColor: 0xffffff, roofs: false
  },
  {
    id: "blood-red", name: "BLOOD STORM",
    sky: 0x1a0508, fog: 0x3a0a10, fogDensity: 0.0075,
    ambient: { c: 0xff5a4a, i: 0.55 },
    sun: { c: 0xff7a5a, i: 0.8 },
    hemi: { sky: 0xaa1a1a, ground: 0x1a0508, i: 0.5 },
    road: 0x1c1216, ground: 0x120608,
    edge: 0xff8a7a, yellow: 0xff2a1a, dash: 0xff5a4a,
    wall: 0x4a1a1a, wallCap: 0xff2a1a,
    buildings: [0x2a0f12, 0x3a1418, 0x220a0c, 0x4a1c22],
    windowLit: 0xff6a3a, windowDark: 0x160608,
    stars: 0xff8a7a,
    envTop: 0x5a1520, envHorizon: 0x3a0a10, envGround: 0x120608,
    clouds: false, cloudColor: 0xff5a4a, roofs: false
  }
];

// Two-way traffic: lane indices 0..onc-1 (left, x<0) carry oncoming cars,
// lanes onc..lanes-1 (right) carry same-direction traffic. No median —
// the double yellow line is the only thing between them.
function oncomingLanes(lanes) {
  return Math.floor(lanes / 2);
}

// World x of the center of a lane (0-based, left to right).
function laneCenter(lane, lanes) {
  const half = (lanes * CONFIG.LANE_WIDTH) / 2;
  return -half + CONFIG.LANE_WIDTH * (lane + 0.5);
}

// Lane the player starts in: the middle lane of the same-direction (right) side.
function playerStartLane(lanes) {
  const onc = oncomingLanes(lanes);
  return onc + Math.floor((lanes - 1 - onc) / 2);
}

// x of the double-yellow center line, and the divider index it replaces.
// Even lane counts: the line sits on the center divider (x = 0).
// Odd lane counts: it sits on the divider between the oncoming and
// same-direction sides (x = -LANE_WIDTH / 2).
function centerLine(lanes) {
  const onc = oncomingLanes(lanes);
  if (lanes % 2 === 0) return { x: 0, divider: lanes / 2 - 1 };
  return { x: -CONFIG.LANE_WIDTH / 2, divider: onc - 1 };
}
