/* ===== Highway Rush — UI (HUD, screens, banners) ===== */
"use strict";

const UI = {
  els: {},

  init() {
    const ids = [
      "hud", "hud-level", "hud-lanes", "hud-miles", "hud-milesbar",
      "hud-total", "hud-speed", "hud-time", "hud-top",
      "banner", "banner-text",
      "start-screen", "btn-start", "start-best",
      "warn-oncoming",
      "crash-flash", "death-vignette",
      "crash-screen", "highscore-badge",
      "stat-miles", "stat-level", "stat-top", "stat-time",
      "lb-name", "btn-keep", "btn-reset"
    ];
    for (const id of ids) this.els[id] = document.getElementById(id);

    this.els["btn-start"].addEventListener("click", () => Game.start());
    this.els["btn-keep"].addEventListener("click", () => Game.keepGoing());
    this.els["btn-reset"].addEventListener("click", () => Game.resetRun());
    this.els["lb-name"].addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") Game.keepGoing();
    });
  },

  show(id) { this.els[id].classList.remove("hidden"); },
  hide(id) { this.els[id].classList.add("hidden"); },

  showStart() {
    this.hide("hud");
    this.hide("crash-screen");
    this.setOncomingWarn(false);
    const best = Leaderboard.best();
    this.els["start-best"].textContent =
      best > 0 ? "BEST RUN — " + best.toFixed(2) + " mi" : "";
    this.els["start-best"].classList.toggle("hidden", best <= 0);
    this.show("start-screen");
  },

  // blinking "ONCOMING" indicator when a head-on car is close on our side
  setOncomingWarn(on) {
    this.els["warn-oncoming"].classList.toggle("active", !!on);
  },

  showCrash() {
    this.hide("hud");
    this.setOncomingWarn(false);
    this.show("crash-screen");
  },

  hideAllScreens() {
    this.hide("start-screen");
    this.hide("crash-screen");
    this.show("hud");
  },

  // red impact flash, replayed each crash
  crashFlash() {
    const f = this.els["crash-flash"];
    f.classList.remove("active");
    void f.offsetWidth;
    f.classList.add("active");
  },

  // red vignette on the screen edges while the crash lingers
  deathVignette(on) {
    this.els["death-vignette"].classList.toggle("active", !!on);
  },

  banner(text) {
    const b = this.els["banner"];
    const t = this.els["banner-text"];
    t.textContent = text;
    // restart the animation
    b.classList.add("hidden");
    void b.offsetWidth;
    b.classList.remove("hidden");
  },

  updateHUD(state) {
    this.els["hud-level"].textContent = state.level;
    this.els["hud-lanes"].textContent = Road.laneCount + " LANES";
    const need = levelMiles(state.level);
    const prog = Math.min(1, state.levelMeters / (need * 1609.344));
    this.els["hud-miles"].textContent = (state.levelMeters * 0.000621371).toFixed(2) + " / " + need.toFixed(2) + " mi";
    this.els["hud-milesbar"].style.width = (prog * 100).toFixed(1) + "%";
    this.els["hud-total"].textContent = (state.totalMeters * 0.000621371).toFixed(2) + " mi";
    this.els["hud-speed"].textContent = Math.round(state.speed * 2.23694) + " mph";
    this.els["hud-time"].textContent = this._fmt(state.time);
    this.els["hud-top"].textContent = Math.round(state.topSpeed * 2.23694) + " mph";
  },

  showCrashScreen(stats) {
    this.els["stat-miles"].textContent = stats.miles.toFixed(2);
    this.els["stat-level"].textContent = stats.level;
    this.els["stat-top"].textContent = Math.round(stats.topSpeed * 2.23694);
    this.els["stat-time"].textContent = this._fmt(stats.time);
    if (stats.isHighScore) this.show("highscore-badge");
    else this.hide("highscore-badge");
    this.els["lb-name"].value = stats.prevName || "";
    this.showCrash();
    this.els["lb-name"].focus();
  },

  _fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
};
