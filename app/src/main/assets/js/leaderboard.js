/* ===== Highway Rush — leaderboard =====
 * Stored in localStorage. Score = total miles driven (2 decimals).
 */
"use strict";

const Leaderboard = {
  KEY: "highwayrush_leaderboard_v1",
  MAX: 10,
  entries: [],
  lastEntry: null,

  // Update the name on the most recently submitted run (user typed it on the crash screen).
  rename(name) {
    const clean = (name || "").replace(/[^\w\s-]/g, "").trim().slice(0, 14);
    if (this.lastEntry && clean) {
      this.lastEntry.name = clean;
      this.save();
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      this.entries = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(this.entries)) this.entries = [];
    } catch (e) {
      this.entries = [];
    }
  },

  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.entries.slice(0, this.MAX)));
    } catch (e) { /* storage unavailable — play on */ }
  },

  best() {
    return this.entries.length ? this.entries[0].miles : 0;
  },

  // A brand-new run starts a fresh leaderboard entry (called by Game.start,
  // NOT by keep-going — keep-going continues the same entry).
  newRun() {
    this.lastEntry = null;
  },

  // Record a crash. If this run already has an entry (player crashed, kept
  // going, crashed again) the entry is refreshed instead of duplicated.
  // Returns { rank, isHighScore } (rank 1-based, or null if not on board).
  submit(name, miles, level, topSpeed, seconds) {
    const clean = (name || "").replace(/[^\w\s-]/g, "").trim().slice(0, 14);
    let entry = this.lastEntry;
    if (!entry) {
      entry = { name: "", miles: 0, level: 0, top: 0, time: 0 };
      this.entries.push(entry);
      this.lastEntry = entry;
    }
    if (clean) entry.name = clean;
    if (!entry.name) entry.name = "DRIVER";
    entry.miles = Math.round(miles * 100) / 100;
    entry.level = Math.max(entry.level, level);
    entry.top = Math.round(topSpeed * 2.23694);   // m/s -> mph
    entry.time = Math.round(seconds);
    this.entries.sort((a, b) => b.miles - a.miles || b.level - a.level);
    this.entries = this.entries.slice(0, this.MAX);
    this.save();
    const rank = this.entries.indexOf(entry) + 1;
    // "new high score" = this run is #1 on the board
    return { rank: rank || null, isHighScore: rank === 1 && entry.miles > 0, entry };
  },

  render(highlightKey) {
    const list = document.getElementById("lb-list");
    list.innerHTML = "";
    if (!this.entries.length) {
      list.innerHTML = '<li class="lb-empty">No drivers yet — be the first!</li>';
      return;
    }
    this.entries.forEach((e, i) => {
      const li = document.createElement("li");
      if (highlightKey === i) li.className = "lb-new";
      li.innerHTML =
        '<span class="lb-rank">' + (i + 1) + '</span>' +
        '<span class="lb-name">' + this._esc(e.name) + '</span>' +
        '<span class="lb-score">' + e.miles.toFixed(2) + ' mi &middot; LVL ' + e.level + ' &middot; ' + e.top + ' mph</span>';
      list.appendChild(li);
    });
  },

  _esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
};
