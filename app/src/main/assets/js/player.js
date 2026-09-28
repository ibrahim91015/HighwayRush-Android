/* ===== Highway Rush — player =====
 * The player car stays near z=0; the world scrolls past it.
 * Lateral movement is clamped to the roadway (walls), so the player
 * can never drive off the road. SPACE = handbrake (hard deceleration).
 */
"use strict";

const Player = {
  group: null,
  wheels: [],
  wheelRadius: 0.34,
  x: 0,
  z: 0,
  speed: 0,
  accel: 0,
  steerVel: 0,
  topSpeed: 0,
  keys: {},

  init(scene) {
    this.scene = scene;
    const car = createPlayerCar();
    this.group = car.group;
    this.wheels = car.wheels;
    this.scene.add(this.group);

    // input
    window.addEventListener("keydown", (e) => {
      // don't hijack keys while the player is typing (e.g. leaderboard name)
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
      this.keys[e.key.toLowerCase()] = true;
      if (e.key === " ") this.keys["space"] = true;
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
      if (e.key === " ") this.keys["space"] = false;
    });
  },

  reset() {
    const lanes = Road.laneCount;
    this.x = laneCenter(playerStartLane(lanes), lanes);
    this.z = 0;
    this.speed = CONFIG.PLAYER_MIN_SPEED;
    this.accel = 0;
    this.steerVel = 0;
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.set(0, 0, 0);
  },

  update(dt, level) {
    const max = playerMaxSpeed(level);
    const oldSpeed = this.speed;

    // --- longitudinal (smooth taper: strong at the ends, gentle in the
    //     middle, so the throttle feels like a curve, not a step) ---
    const k = this.keys;
    const frac = (this.speed - CONFIG.PLAYER_MIN_SPEED) /
      Math.max(1, max - CONFIG.PLAYER_MIN_SPEED);   // 0 = rolling, 1 = top
    if (k["space"]) {
      // handbrake: hardest deceleration, always wins over gas/brake
      this.speed -= CONFIG.PLAYER_HANDBRAKE * dt;
    } else if (k["arrowup"] || k["w"]) {
      // full punch out of corners, eases out as top speed is approached
      this.speed += CONFIG.PLAYER_ACCEL * (1.15 - 0.85 * frac) * dt;
    } else if (k["arrowdown"] || k["s"]) {
      // soft tap at low speed, firm at high speed
      this.speed -= CONFIG.PLAYER_BRAKE * (0.35 + 0.65 * frac) * dt;
    } else {
      // coast: exponential decay toward rolling speed — releasing the
      // throttle bleeds speed smoothly instead of holding it
      this.speed += (CONFIG.PLAYER_MIN_SPEED - this.speed) *
        Math.min(1, CONFIG.PLAYER_COAST_RATE * dt);
    }
    this.speed = Math.max(CONFIG.PLAYER_MIN_SPEED, Math.min(max, this.speed));

    // longitudinal acceleration (m/s^2) — the camera uses this for zoom
    this.accel = (this.speed - oldSpeed) / Math.max(dt, 1e-4);

    // --- lateral ---
    let steer = 0;
    if (k["arrowleft"] || k["a"]) steer -= 1;
    if (k["arrowright"] || k["d"]) steer += 1;
    this.steerVel += (steer * CONFIG.STEER_SPEED - this.steerVel) * Math.min(1, CONFIG.STEER_LERP * dt);
    this.x += this.steerVel * dt;

    // never leave the roadway — the car's outer edge stops at the white
    // edge line (there is no shoulder to drive on)
    const limit = Road.halfWidth - CONFIG.EDGE_LINE_INSET - CONFIG.PLAYER_W / 2;
    if (this.x > limit)  { this.x = limit;  if (this.steerVel > 0) this.steerVel = 0; }
    if (this.x < -limit) { this.x = -limit; if (this.steerVel < 0) this.steerVel = 0; }

    // --- body attitude: yaw + roll from steering velocity ---
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.steerVel * 0.012;
    this.group.rotation.z = -this.steerVel * 0.02;

    // --- wheels spin with ground speed ---
    const dTheta = this.speed * dt / this.wheelRadius;
    for (const w of this.wheels) w.rotation.x -= dTheta;

    // --- top speed for this run ---
    this.topSpeed = Math.max(this.topSpeed, this.speed);

    // --- engine sound tracks throttle/speed ---
    AudioFX.engine(this.speed / max);

    return this.speed;
  }
};
