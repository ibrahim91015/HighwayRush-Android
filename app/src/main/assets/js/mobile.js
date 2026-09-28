/* ===== Highway Rush — mobile / touch controls ===== */
"use strict";

const MobileControls = {
  _activePointers: new Map(),
  _pressedCounts: Object.create(null),

  init() {
    const root = document.getElementById("touch-controls");
    if (!root) return;

    const holdButtons = root.querySelectorAll("[data-hold]");
    holdButtons.forEach((btn) => {
      const action = btn.dataset.hold;

      const press = (e) => {
        e.preventDefault();
        if (this._activePointers.has(e.pointerId)) return;
        this._activePointers.set(e.pointerId, { btn, action });
        this._pressedCounts[action] = (this._pressedCounts[action] || 0) + 1;
        this._setAction(action, true);
        btn.classList.add("pressed");
        if (btn.setPointerCapture) {
          try { btn.setPointerCapture(e.pointerId); } catch (_) {}
        }
      };

      const release = (e) => {
        const held = this._activePointers.get(e.pointerId);
        if (!held || held.btn !== btn) return;
        e.preventDefault();
        this._activePointers.delete(e.pointerId);
        this._pressedCounts[action] = Math.max(0, (this._pressedCounts[action] || 1) - 1);
        if (this._pressedCounts[action] === 0) {
          this._setAction(action, false);
          btn.classList.remove("pressed");
        }
      };

      btn.addEventListener("pointerdown", press, { passive: false });
      btn.addEventListener("pointerup", release, { passive: false });
      btn.addEventListener("pointercancel", release, { passive: false });
      btn.addEventListener("lostpointercapture", release, { passive: false });
      btn.addEventListener("contextmenu", (e) => e.preventDefault());
    });

    root.querySelectorAll("[data-tap]").forEach((btn) => {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        btn.classList.add("pressed");
      }, { passive: false });
      const finish = (e) => {
        e.preventDefault();
        btn.classList.remove("pressed");
      };
      btn.addEventListener("pointerup", finish, { passive: false });
      btn.addEventListener("pointercancel", finish, { passive: false });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this._tap(btn.dataset.tap);
      });
    });

    // Release held inputs if Android backgrounds the WebView or focus changes.
    const clearAll = () => this.releaseAll();
    window.addEventListener("blur", clearAll);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearAll();
    });

    // Helpful class for coarse-pointer layouts without relying only on CSS support.
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      document.documentElement.classList.add("touch-device");
    }
  },

  _setAction(action, down) {
    if (typeof Player === "undefined") return;
    const map = {
      left: "arrowleft",
      right: "arrowright",
      gas: "arrowup",
      brake: "arrowdown",
      handbrake: "space"
    };
    const key = map[action];
    if (key) Player.keys[key] = !!down;
  },

  _tap(action) {
    AudioFX.unlock();
    if (action === "camera") {
      if (Game.state === "running") Game.camMode = (Game.camMode + 1) % 3;
    } else if (action === "mute") {
      const muted = AudioFX.toggleMute();
      const b = document.querySelector('[data-tap="mute"]');
      if (b) {
        b.classList.toggle("muted", muted);
        b.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
        const label = b.querySelector(".touch-action-label");
        if (label) label.textContent = muted ? "SOUND OFF" : "SOUND";
      }
    }
  },

  releaseAll() {
    this._activePointers.clear();
    this._pressedCounts = Object.create(null);
    ["left", "right", "gas", "brake", "handbrake"].forEach((a) => this._setAction(a, false));
    document.querySelectorAll("#touch-controls .pressed").forEach((b) => b.classList.remove("pressed"));
  }
};

window.MobileControls = MobileControls;
window.addEventListener("load", () => MobileControls.init());
