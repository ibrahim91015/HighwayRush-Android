/* ===== Highway Rush — two-way traffic with AI =====
 * Cars live in the player's frame: each frame z += (playerSpeed - dir*speed) * dt
 * (dir=1 same direction as the player, dir=-1 oncoming).
 *
 * Rules the AI follows:
 *  - keep lane; follow a lead car at a speed-dependent safe gap
 *  - brake / match speed when the gap shrinks
 *  - overtake into the clearest lane when stuck behind slow traffic
 *  - occasionally drift lanes when the road is clear
 *  - flash the correct turn signal before every lane change (the rare
 *    very-aggressive drivers skip it) and never steer across the player
 *  - a lane-changing car occupies BOTH its lanes in every clearance check,
 *    so no car can mesh into another or drive through one
 */
"use strict";

const Traffic = {
  cars: [],          // { group, x, z, lane, dir, w, l, speed, baseSpeed, type, changing, targetLane, decideT }
  spawnTimer: 0,
  maxCars: 0,
  level: 1,

  init(scene) {
    this.scene = scene;
    this.cars = [];
    this.maxCars = trafficCount(1);
    this.level = 1;
  },

  clear() {
    for (const c of this.cars) {
      this.scene.remove(c.group);
      disposeVehicle(c.group);
    }
    this.cars = [];
  },

  // Called on level change.
  setLevel(level) {
    this.level = level;
    this.maxCars = trafficCount(level);
    // re-balance speeds for cars on road (keep variety, cap at new max)
    for (const c of this.cars) {
      const cap = playerMaxSpeed(level) * CONFIG.TRAFFIC_MAX_FRACTION;
      if (c.baseSpeed > cap) { c.baseSpeed = cap; c.speed = Math.min(c.speed, cap); }
    }
  },

  // Road widened / narrowed: remap every car onto the new lane structure.
  // Each car signals (unless it's a no-signal rube) and glides to its
  // nearest valid lane instead of snapping, and it will never steer across
  // the player to do so.
  onRoadChange() {
    const lanes = Road.laneCount;
    const onc = oncomingLanes(lanes);
    for (const c of this.cars) {
      const lane = this._nearestValidLane(c.x, c.dir, lanes, onc);
      // same index AND already on the new lane center -> nothing to do
      if (lane === c.lane && Math.abs(this._laneCenter(lane) - c.x) < 0.5) {
        c.changing = false; c.signalT = 0;
        continue;
      }
      c.roadShift = true;      // forced: must reach the new structure, no abort
      this._startLaneChange(c, lane);
    }
  },

  // Seed the road with traffic up to the target count (start / keep going).
  seed(playerZ) {
    for (let i = this.cars.length; i < this.maxCars; i++) {
      const car = this._makeCar(playerZ, true);
      if (car) this.cars.push(car);
    }
  },

  /* ---------- geometry helpers ---------- */

  _laneCenter(lane) { return laneCenter(lane, Road.laneCount); },

  _nearestLane(x) {
    const half = (Road.laneCount * CONFIG.LANE_WIDTH) / 2;
    const lane = Math.round((x + half) / CONFIG.LANE_WIDTH - 0.5);
    return Math.max(0, Math.min(Road.laneCount - 1, lane));
  },

  // Nearest lane that carries this car's direction of travel.
  _nearestValidLane(x, dir, lanes, onc) {
    const l = this._nearestLane(x);
    const valid = (i) => dir === 1 ? (i >= onc && i < lanes) : (i >= 0 && i < onc);
    if (valid(l)) return l;
    // flip to the closest lane on the correct side
    return dir === 1 ? Math.min(lanes - 1, Math.max(onc, l))
                     : Math.max(0, Math.min(onc - 1, l));
  },

  // A car counts as "in" a lane while driving in it, signaling toward it,
  // or crossing it.
  _inLane(c, lane) {
    return c.lane === lane || ((c.changing || c.signalT > 0) && c.targetLane === lane);
  },

  // Begin (or queue) a lane change to `lane`. Signals first unless the driver
  // is a no-signal rube, who yanks the wheel immediately.
  _startLaneChange(c, lane) {
    c.targetLane = lane;
    c.changing = false;
    c.signalT = c.noSignal ? 0 : CONFIG.SIGNAL_DELAY;
    if (c.noSignal) c.changing = true;
  },

  // Would gliding from the car's x into `lane` sweep across the player while
  // the car is close enough in z to actually reach them? (Blocks the change.)
  _playerBlocksChange(c, lane) {
    const tx = this._laneCenter(lane);
    if (Math.abs(tx - c.x) < 0.5) return false;         // not really crossing
    const half = (CONFIG.PLAYER_W + c.w) / 2 + 0.4;
    const lo = Math.min(c.x, tx) - half, hi = Math.max(c.x, tx) + half;
    if (hi < Player.x || lo > Player.x) return false;   // path misses the player
    return Math.abs(c.z) < CONFIG.PLAYER_BLOCK_Z;       // and they're near us
  },

  // Is the lane (from this car's viewpoint) free of anyone too close at z?
  // gapAhead/gapBehind are measured in world meters along the car's travel.
  _laneClear(c, lane, ahead, behind) {
    for (const o of this.cars) {
      if (o === c || o.dir !== c.dir || !this._inLane(o, lane)) continue;
      const gap = c.z - o.z;           // > 0: o is ahead of c (for dir=1)
      const g = c.dir === 1 ? gap : -gap;
      if (g > 0 && g < ahead) return false;
      if (g < 0 && -g < behind) return false;
    }
    return true;
  },

  _pickDir() {
    // keep the same-direction share near SAME_FRACTION
    let same = 0, total = 0;
    for (const c of this.cars) { total++; if (c.dir === 1) same++; }
    if (total === 0) return Math.random() < CONFIG.SAME_FRACTION ? 1 : -1;
    const frac = same / total;
    return frac < CONFIG.SAME_FRACTION ? 1 : (frac > CONFIG.SAME_FRACTION + 0.08 ? -1 : (Math.random() < 0.5 ? 1 : -1));
  },

  _randLane(dir, lanes, onc) {
    if (dir === 1) return onc + ((Math.random() * (lanes - onc)) | 0);
    return (Math.random() * onc) | 0;
  },

  _makeCar(playerZ, seeding) {
    const lanes = Road.laneCount;
    const onc = oncomingLanes(lanes);
    const dir = this._pickDir();
    const lane = this._randLane(dir, lanes, onc);
    const x = this._laneCenter(lane);

    // seed spread across the visible field; runtime spawns far ahead
    let z;
    if (seeding) {
      z = dir === 1
        ? playerZ - (80 + Math.random() * 340)      // -80 .. -420
        : playerZ - (260 + Math.random() * 300);    // -260 .. -560
    } else {
      z = dir === 1
        ? playerZ - (CONFIG.CLEAR_Z + Math.random() * (CONFIG.SPAWN_AHEAD_SAME - CONFIG.CLEAR_Z))
        : playerZ - (CONFIG.CLEAR_Z + 40 + Math.random() * (CONFIG.SPAWN_AHEAD_ONC - CONFIG.CLEAR_Z - 40));
    }

    if (!this._laneClear({ dir, z }, lane, 40, 40)) return null;

    const v = createTrafficVehicle(this.level);
    const cap = playerMaxSpeed(this.level) * CONFIG.TRAFFIC_MAX_FRACTION;

    // driver personality: every car gets one at spawn
    const p = CONFIG.AI_PERSONAS[(Math.random() * CONFIG.AI_PERSONAS.length) | 0];
    const baseSpeed = Math.max(CONFIG.TRAFFIC_MIN_SPEED,
      Math.min(cap, trafficSpeed(this.level) * p.speedMul));
    v.group.position.set(x, 0, z);
    if (dir === -1) v.group.rotation.y = Math.PI;   // face the player
    this.scene.add(v.group);
    return {
      group: v.group, x, z, lane, dir,
      w: v.w, l: v.l, speed: baseSpeed, baseSpeed, type: v.type,
      persona: p,
      // turn-signal clusters + whether this driver skips signaling
      indPlus: v.indPlus, indMinus: v.indMinus,
      noSignal: p.id === "aggressive" || (p.id === "racer" && Math.random() < 0.4),
      signalT: 0, indT: 0, indPhase: 0, roadShift: false,
      // sinusoidal speed wobble (some drivers cruise in a lullaby rhythm)
      wAmp: p.wobble[0], wFreq: p.wobble[1] * (0.8 + Math.random() * 0.4),
      wPhase: Math.random() * Math.PI * 2, t: 0,
      // erratic: sudden speed spikes
      spikeT: p.spikes ? 2 + Math.random() * 5 : Infinity,
      spikeV: 0, spikeDur: 0,
      changing: false, targetLane: lane,
      decideT: p.decide[0] + Math.random() * (p.decide[1] - p.decide[0])
    };
  },

  /* ---------- main update ---------- */

  update(dt, playerZ, playerSpeed) {
    const lanes = Road.laneCount;
    const onc = oncomingLanes(lanes);

    const cap = playerMaxSpeed(this.level) * CONFIG.TRAFFIC_MAX_FRACTION;

    // move + AI
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      c.t += dt;
      const P = c.persona;

      // --- follow / brake / overtake decisions (same direction only) ---
      let lead = null, leadGap = Infinity;
      if (!c.changing) {
        for (const o of this.cars) {
          if (o === c || o.dir !== c.dir || !this._inLane(o, c.lane)) continue;
          const g = c.dir === 1 ? (c.z - o.z) : (o.z - c.z);
          if (g > 0 && g < leadGap) { leadGap = g; lead = o; }
        }
      }

      // persona-modulated following distance & patience
      const safeGap = (CONFIG.SAFE_GAP_BASE + CONFIG.SAFE_GAP_SPEED * c.speed) * P.gapMul;
      if (lead && leadGap < safeGap) {
        // close: slow toward the lead's speed
        c.speed = Math.max(lead.speed, c.speed - CONFIG.AI_BRAKE * dt);
      } else if (c.signalT <= 0 && lead && leadGap < CONFIG.FOLLOW_TRIGGER * P.trigMul) {
        // stuck behind slow traffic: try to overtake into the clearest lane
        const best = this._overtakeLane(c, safeGap);
        if (best !== null) {
          this._startLaneChange(c, best);
        } else {
          c.speed = Math.min(c.speed, lead.speed * 1.05);
        }
      } else {
        // cruise back toward base speed (plus the driver's speed wobble)
        const effBase = c.baseSpeed +
          Math.sin(c.t * c.wFreq + c.wPhase) * c.wAmp;
        c.speed += (effBase - c.speed) * Math.min(1, CONFIG.AI_ACCEL / Math.max(1, Math.abs(effBase - c.speed) + 1) * dt);
        c.speed = Math.max(CONFIG.TRAFFIC_MIN_SPEED, Math.min(cap, c.speed));
      }

      // erratic drivers: sudden speed spikes (hard stomp or lift of a beat)
      if (P.spikes) {
        c.spikeT -= dt;
        if (c.spikeT <= 0) {
          c.spikeT = 2.5 + Math.random() * 5.5;
          c.spikeV = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 12);
          c.spikeDur = 0.4 + Math.random() * 0.5;
        }
        if (c.spikeDur > 0) {
          c.speed = Math.max(CONFIG.TRAFFIC_MIN_SPEED, Math.min(cap,
            c.speed + c.spikeV * dt));
          c.spikeDur -= dt;
        }
      }

      // --- random drift when the road ahead is clear ---
      c.decideT -= dt;
      if (c.decideT <= 0 && !c.changing && c.signalT <= 0 && !lead) {
        c.decideT = P.decide[0] + Math.random() * (P.decide[1] - P.decide[0]);
        if (Math.random() < P.drift) {
          const l = this._driftLane(c, lanes, onc);
          if (l !== null) this._startLaneChange(c, l);
        }
      }

      // --- lateral: signal, then drift toward target lane (or abort) ---
      if (c.signalT > 0 && !c.changing) {
        // waiting with the turn signal flashing; begin once the lane is
        // still clear and the player isn't sitting in the path
        c.signalT -= dt;
        if (c.signalT <= 0) {
          if (this._playerBlocksChange(c, c.targetLane)) {
            c.signalT = 0.3;             // keep signaling, re-check soon
          } else if (this._laneClear(c, c.targetLane, 30, 18) || c.roadShift) {
            c.changing = true;
          } else {
            c.signalT = 0;               // lane taken — give up quietly
            c.targetLane = c.lane;
          }
        }
      } else if (c.changing) {
        // mid-change abort (never for a forced road shift)
        if (!c.roadShift) {
          const distT = Math.abs(this._laneCenter(c.targetLane) - c.x);
          if (distT > 2.5 && !this._laneClear(c, c.targetLane, 30, 18)) {
            c.changing = false;
            c.targetLane = c.lane;
          }
        }
        if (c.changing) {
          const tx = this._laneCenter(c.targetLane);
          const step = CONFIG.LATERAL_SPEED * dt;
          if (Math.abs(tx - c.x) <= step) {
            c.x = tx;
            c.lane = c.targetLane;
            c.changing = false;
            c.roadShift = false;
          } else {
            c.x += Math.sign(tx - c.x) * step;
          }
        }
      }

      // --- turn signals: blink the cluster on the side being entered ---
      {
        const active = c.signalT > 0 || c.changing;
        if (active) {
          c.indT -= dt;
          if (c.indT <= 0) { c.indPhase = 1 - c.indPhase; c.indT = 0.32; }
        } else {
          c.indPhase = 0; c.indT = 0;
        }
        let plus = false, minus = false;
        if (active && c.indPhase === 1) {
          if (c.targetLane > c.lane) plus = true;
          else if (c.targetLane < c.lane) minus = true;
        }
        c.indPlus.visible = plus;
        c.indMinus.visible = minus;
      }

      // --- integrate (player frame) ---
      c.z += (playerSpeed - c.dir * c.speed) * dt;
      c.group.position.x = c.x;
      c.group.position.z = c.z;
      // subtle yaw while changing lanes
      const yaw = c.changing ? Math.sign(this._laneCenter(c.targetLane) - c.x) * 0.06 * c.dir : 0;
      c.group.rotation.y = (c.dir === -1 ? Math.PI : 0) + yaw;

      // despawn: far behind, or (for oncoming) far ahead after passing
      if (c.z - playerZ > CONFIG.DESPAWN_BEHIND || c.z - playerZ < -680) {
        this.scene.remove(c.group);
        disposeVehicle(c.group);
        this.cars.splice(i, 1);
      }
    }

    this._resolveOverlaps();

    // spawn new
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.cars.length < this.maxCars) {
      this.spawnTimer = 0.4;
      let guard = 0;
      while (this.cars.length < this.maxCars && guard++ < 4) {
        const car = this._makeCar(playerZ, false);
        if (car) this.cars.push(car);
      }
    }
  },

  // Best adjacent-ish lane to overtake into, or null.
  _overtakeLane(c, safeGap) {
    const lanes = Road.laneCount;
    const onc = oncomingLanes(lanes);
    const valid = (i) => c.dir === 1 ? (i >= onc && i < lanes) : (i >= 0 && i < onc);
    let best = null, bestScore = -Infinity;
    for (let l = Math.max(0, c.lane - 1); l <= Math.min(lanes - 1, c.lane + 1); l++) {
      if (l === c.lane || !valid(l)) continue;
      // needs room ahead and behind in the target lane
      if (!this._laneClear(c, l, safeGap + 30, 24)) continue;
      // score by how much faster the lane's traffic is / how empty it is
      let score = 10;
      for (const o of this.cars) {
        if (o === c || o.dir !== c.dir || !this._inLane(o, l)) continue;
        const g = c.dir === 1 ? (c.z - o.z) : (o.z - c.z);
        if (g > 0) score -= Math.max(0, 60 - g) * 0.2;
      }
      if (score > bestScore) { bestScore = score; best = l; }
    }
    return best;
  },

  // A quiet random lane change: adjacent valid lane, wide open both ways.
  _driftLane(c, lanes, onc) {
    const valid = (i) => c.dir === 1 ? (i >= onc && i < lanes) : (i >= 0 && i < onc);
    const options = [];
    for (const l of [c.lane - 1, c.lane + 1]) {
      if (valid(l) && this._laneClear(c, l, 90, 60)) options.push(l);
    }
    if (!options.length) return null;
    return options[(Math.random() * options.length) | 0];
  },

  // Backstop: same-direction cars that would overlap get pushed apart.
  // The rear car is shoved back along its own travel axis and matches speed.
  _resolveOverlaps() {
    for (const dir of [1, -1]) {
      const list = this.cars
        .filter(c => c.dir === dir)
        .sort((a, b) => dir === 1 ? a.z - b.z : b.z - a.z);  // front car first
      for (let i = 1; i < list.length; i++) {
        const lead = list[i - 1];
        const rear = list[i];
        // only cars sharing (or crossing) a lane can actually collide
        if (!this._inLane(lead, rear.lane) && !this._inLane(rear, lead.lane)) continue;
        const gap = dir === 1 ? (rear.z - lead.z) : (lead.z - rear.z);
        const minGap = (lead.l + rear.l) / 2 + 0.5;
        if (gap < minGap) {
          const push = minGap - gap;
          rear.z += dir * push;   // push the rear car back
          rear.speed = Math.min(rear.speed, lead.speed);
          rear.group.position.z = rear.z;
        }
      }
    }
  },

  // AABB overlap between player and all traffic. Returns the car hit or null.
  checkCollision(px, pz, pw, pl) {
    const inset = CONFIG.HITBOX_INSET;
    const pxh = (pw * (1 - inset)) / 2, plh = (pl * (1 - inset)) / 2;
    for (const c of this.cars) {
      const chw = (c.w * (1 - inset)) / 2, clh = (c.l * (1 - inset)) / 2;
      if (Math.abs(c.x - px) < pxh + chw && Math.abs(c.z - pz) < plh + clh) return c;
    }
    return null;
  }
};
