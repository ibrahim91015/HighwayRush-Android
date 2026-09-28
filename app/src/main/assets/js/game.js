/* ===== Highway Rush — main game loop & state machine =====
 * States: "menu" | "running" | "crashing" | "crashed"
 */
"use strict";

const Game = {
  scene: null,
  camera: null,
  renderer: null,
  sun: null,
  state: "menu",
  clock: null,
  crashTimer: 0,

  level: 1,
  levelMeters: 0,
  totalMeters: 0,
  time: 0,
  crashResult: null,
  prevName: "",

  /* ---------- boot ---------- */
  init() {
    this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("game"), antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.THEMES[0].sky);
    this.scene.fog = new THREE.FogExp2(CONFIG.THEMES[0].fog, CONFIG.THEMES[0].fogDensity);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

    // camera modes: 0 chase, 1 birds-eye, 2 hood — cycled with C
    this.camMode = 0;
    this._zoomChase = 1;            // wheel zoom, chase cam
    this._zoomBird = 1;             // wheel zoom, birds-eye
    this._lean = 0;                 // accel/brake dynamic zoom (smoothed)
    this._camTarget = new THREE.Vector3();
    this._camLook = new THREE.Vector3();

    // lights (kept as refs so Themes.apply can re-tint them per level)
    this.ambLight = new THREE.AmbientLight(0x8899bb, 0.75);
    this.scene.add(this.ambLight);
    this.sun = new THREE.DirectionalLight(0xffffff, 0.9);
    this.sun.position.set(30, 60, -40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 300;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.hemiLight = new THREE.HemisphereLight(0x334466, 0x0c1024, 0.5);
    this.scene.add(this.hemiLight);

    this._placeCamera(0, 0.016);

    // C: cycle camera mode (chase / birds-eye / hood), edge-triggered
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key.toLowerCase() === "c" && this.state === "running") {
        this.camMode = (this.camMode + 1) % 3;
      }
    });

    // mouse wheel: zoom in chase and birds-eye (none in hood cam)
    window.addEventListener("wheel", (e) => {
      const f = 1 - e.deltaY * 0.0008;
      if (this.camMode === 0) {
        const [lo, hi] = CONFIG.ZOOM_CHASE;
        this._zoomChase = Math.max(lo, Math.min(hi, this._zoomChase * f));
      } else if (this.camMode === 1) {
        const [lo, hi] = CONFIG.ZOOM_BIRD;
        this._zoomBird = Math.max(lo, Math.min(hi, this._zoomBird * f));
      }
    }, { passive: true });

    // modules
    AudioFX.attach();
    UI.init();
    Leaderboard.load();
    initVehicleShared();
    Road.init(this.scene);

    // first theme for the menu backdrop (re-shuffled at every run start)
    Themes.newRun();
    this._applyThemeFor(1);
    Traffic.init(this.scene);
    Player.init(this.scene);
    Player.reset();
    UI.showStart();

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.clock = new THREE.Clock();
    this._animate();
  },

  _placeCamera(x, dt) {
    dt = dt || 0.016;
    const p = Player;

    // --- acceleration lean: throttle pulls the chase cam in, braking pulls it back ---
    const a = p.accel || 0;
    let leanT = 0;
    if (a > 4) leanT = CONFIG.LEAN_ACCEL_MAX * Math.min(1, a / 25);
    else if (a < -12) leanT = CONFIG.LEAN_BRAKE_MAX * Math.min(1, -a / 45);
    this._lean += (leanT - this._lean) * Math.min(1, 3 * dt);

    // --- per-mode targets ---
    const T = this._camTarget, L = this._camLook;
    if (this.camMode === 0) {                       // chase
      const zc = this._zoomChase * (1 + this._lean);
      T.set(x * 0.55, 5.4 * zc, 13.5 * zc);
      L.set(x * 0.8, 1.3, -40);
      this.camera.up.set(0, 1, 0);
    } else if (this.camMode === 1) {                // birds-eye: straight down, car dead-center
      // Wheel zoom only changes altitude — the angle stays flat (straight down).
      const h = CONFIG.BIRD_HEIGHT * this._zoomBird * (1 - this._lean * 0.5);
      T.set(x, h, p.z);
      L.set(x, 0, p.z);
      // up = forward (-z) so the road ahead reads as "up" on screen, and to
      // avoid the degenerate lookAt when the default up (0,1,0) is parallel
      // to the view direction.
      this.camera.up.set(0, 0, -1);
    } else {                                        // hood: front-mounted, car not visible
      T.set(x, 1.1, p.z - 2.8);
      L.set(x, 0.9, p.z - 80);
      this.camera.up.set(0, 1, 0);
    }

    // --- smooth the position (hood tracks tightest) ---
    const k = Math.min(1, (this.camMode === 2 ? 14 : CONFIG.CAM_LERP) * dt);
    this.camera.position.lerp(T, k);
    this.camera.lookAt(L);

    // keep the shadow frustum centered on the player
    this.sun.target.position.set(x, 0, p.z);
    this.sun.position.set(x + 30, 60, p.z - 40);
  },

  // Apply the theme for a 1-based level (lights, fog, reflections, road).
  _applyThemeFor(level) {
    const t = Themes.themeFor(level);
    Themes.apply(t);
    return t;
  },

  /* ---------- state transitions ---------- */

  start() {
    // fresh run
    this.level = 1;
    this.levelMeters = 0;
    this.totalMeters = 0;
    this.time = 0;
    this.prevName = "";
    Leaderboard.newRun();
    Player.topSpeed = 0;
    Themes.newRun();            // fresh random theme order for this run
    Road.setLanes(lanesForLevel(1), true);
    const t = this._applyThemeFor(1);
    Traffic.clear();
    Traffic.setLevel(1);
    Traffic.seed(Player.z);
    Player.reset();
    this._beginRunning("LEVEL 1 • " + t.name);
  },

  // "Keep going" after a crash: back 2 levels, keep total distance & stats
  keepGoing() {
    if (!this.crashResult) { this.start(); return; }
    const name = UI.els["lb-name"].value.trim();
    if (name) { Leaderboard.rename(name); this.prevName = name; }
    UI.els["lb-name"].blur();
    this._resumeAt(this.crashResult.nextLevel, false);
  },

  // "Reset": full restart from level 1
  resetRun() {
    const name = UI.els["lb-name"].value.trim();
    if (name) { Leaderboard.rename(name); this.prevName = name; }
    UI.els["lb-name"].blur();
    this.start();
  },

  _resumeAt(level, fresh) {
    this.level = Math.max(1, level);
    this.levelMeters = 0;
    Road.setLanes(lanesForLevel(this.level), true);
    const t = this._applyThemeFor(this.level);
    Traffic.clear();
    Traffic.setLevel(this.level);
    Traffic.seed(Player.z);
    Player.reset();
    if (fresh) { this.levelMeters = 0; this.totalMeters = 0; this.time = 0; }
    this._beginRunning("LEVEL " + this.level + " • " + t.name);
  },

  _beginRunning(bannerText) {
    this.state = "running";
    UI.hideAllScreens();
    UI.setOncomingWarn(false);
    UI.deathVignette(false);
    UI.banner(bannerText);
  },

  _crash() {
    // short tumble + red flash, THEN show the crash screen
    this.state = "crashing";
    this.crashTimer = CONFIG.CRASH_TUMBLE_TIME;
    this.speedAtCrash = Player.speed;
    AudioFX.crash();
    AudioFX.engineOff();
    UI.hide("hud");
    UI.setOncomingWarn(false);
    UI.crashFlash();
    UI.deathVignette(true);

    const miles = this.totalMeters * CONFIG.METER_TO_MILES;
    const prevBest = Leaderboard.best();
    const res = Leaderboard.submit(
      this.prevName,
      miles, this.level, Player.topSpeed, this.time
    );
    // highlight this run's row (only if it made the top 10)
    let highlight = null;
    if (res.rank) {
      highlight = Leaderboard.entries.findIndex(e => e === res.entry);
    }
    const newHigh = res.isHighScore && (miles > 0);
    this.crashResult = {
      miles,
      level: this.level,
      topSpeed: Player.topSpeed,
      time: this.time,
      isHighScore: newHigh,
      prevBest,
      prevName: this.prevName,
      nextLevel: Math.max(1, this.level - CONFIG.CRASH_PENALTY),
      highlight
    };
    this._tumbleDir = (Math.random() < 0.5 ? -1 : 1);
  },

  // Called when the tumble animation finishes.
  _showCrashScreen() {
    this.state = "crashed";
    const r = this.crashResult;
    UI.showCrashScreen(r);
    Leaderboard.render(r.highlight);
  },

  /* ---------- per-level bookkeeping ---------- */
  _checkLevelUp() {
    const need = levelMiles(this.level) * 1609.344;
    if (this.levelMeters < need) return;
    this.level += 1;
    this.levelMeters -= need;
    const oldLanes = Road.laneCount;
    Road.setLanes(lanesForLevel(this.level));
    if (Road.laneCount !== oldLanes) Traffic.onRoadChange();
    Traffic.setLevel(this.level);
    const t = this._applyThemeFor(this.level);
    AudioFX.levelUp();
    UI.banner("LEVEL " + this.level + " • " + t.name);
  },

  // Blink the HUD indicator when an oncoming car is about to reach our lane.
  _oncomingWarn() {
    let warn = false;
    for (const c of Traffic.cars) {
      if (c.dir !== -1) continue;
      const dz = c.z - Player.z;
      if (dz > -110 && dz < -6 && Math.abs(c.x - Player.x) < 4.6) { warn = true; break; }
    }
    UI.setOncomingWarn(warn);
  },

  /* ---------- main loop ---------- */
  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = Math.min(0.05, this.clock.getDelta());

    if (this.state === "running") {
      const speed = Player.update(dt, this.level);
      this.time += dt;
      this.totalMeters += speed * dt;
      this.levelMeters += speed * dt;
      this._checkLevelUp();

      Road.scroll(dt, speed);
      Traffic.update(dt, Player.z, speed);
      this._placeCamera(Player.x, dt);
      this._oncomingWarn();

      // FOV widens with speed for a sense of rush
      const t = speed / playerMaxSpeed(this.level);
      const fov = 62 + 16 * t * t;
      if (Math.abs(this.camera.fov - fov) > 0.05) {
        this.camera.fov += (fov - this.camera.fov) * Math.min(1, 4 * dt);
        this.camera.updateProjectionMatrix();
      }

      const hit = Traffic.checkCollision(Player.x, Player.z, CONFIG.PLAYER_W, CONFIG.PLAYER_L);
      if (hit) {
        this._crash();
      } else {
        UI.updateHUD({
          level: this.level,
          levelMeters: this.levelMeters,
          totalMeters: this.totalMeters,
          speed,
          topSpeed: Player.topSpeed,
          time: this.time
        });
      }
    } else if (this.state === "crashing") {
      // tumble the wrecked car, coast to a stop, then show the crash screen
      this.crashTimer -= dt;
      const g = Player.group;
      g.rotation.z += this._tumbleDir * 3.4 * dt;
      g.rotation.x += this._tumbleDir * 2.2 * dt;
      g.position.y = Math.max(0.1, Math.abs(Math.sin((CONFIG.CRASH_TUMBLE_TIME - this.crashTimer) * 4)) * 0.9);
      const coast = this.speedAtCrash * Math.max(0, this.crashTimer / CONFIG.CRASH_TUMBLE_TIME);
      Road.scroll(dt, coast);
      Traffic.update(dt, Player.z, coast);
      this._placeCamera(Player.x, dt);
      if (this.crashTimer <= 0) this._showCrashScreen();
    } else {
      // menu / crashed: keep the world drifting slowly so the scene feels alive
      Road.scroll(dt, 8);
      Traffic.update(dt, Player.z, 8);
      this._placeCamera(Player.x, dt);
    }

    this.renderer.render(this.scene, this.camera);
  }
};

window.addEventListener("load", () => Game.init());
