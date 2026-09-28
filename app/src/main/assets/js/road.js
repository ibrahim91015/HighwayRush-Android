/* ===== Highway Rush — road, walls & scenery =====
 * The world scrolls toward the player: everything is moved +z by speed*dt
 * each frame, and recycled when it falls behind the camera.
 *
 * Two-way road: left half oncoming, right half same direction, no median.
 * The only separation is the double-yellow center line (static, merged).
 * All lane-divider dashes are baked into ONE merged mesh and scrolled via
 * a position offset (the pattern is periodic over dash+gap).
 *
 * No shoulders: the white edge lines sit just inside the road edge and the
 * walls sit right on the edge — the edge lines are the playable boundary.
 *
 * Theme support: Road.applyTheme(t) re-tints every material in place and
 * rebuilds the vertex-baked line meshes + skyline. Line colors are baked
 * into geometry (MERGE_MAT uses vertex colors), so recoloring means
 * rebuilding those two meshes with the same layout.
 */
"use strict";

const Road = {
  group: null,
  dashMesh: null,
  ground: null,
  stars: null,
  buildings: [],         // { group, side, pad, w, d, baseH }
  laneCount: 0,
  halfWidth: 0,          // road half width (no shoulders)
  dashOffset: 0,
  _theme: null,
  _clouds: null,         // group of drifting puffs (dream theme only)
  _cloudMat: null,

  init(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // ground plane
    this._groundMat = new THREE.MeshLambertMaterial({ color: CONFIG.THEMES[0].ground });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 2000), this._groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.05;
    this.ground.receiveShadow = true;
    this.group.add(this.ground);

    // static star field (fog: false so the sky stays crisp)
    const starGeo = new THREE.BufferGeometry();
    const N = 420;
    const pts = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pts[i * 3]     = (Math.random() - 0.5) * 700;
      pts[i * 3 + 1] = 40 + Math.random() * 160;
      pts[i * 3 + 2] = -400 + Math.random() * 480;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    this._starMat = new THREE.PointsMaterial({ color: 0xbfd4ff, size: 1.4, sizeAttenuation: true, fog: false });
    this.stars = new THREE.Points(starGeo, this._starMat);
    this.group.add(this.stars);

    // road slab material (rebuilt on lane changes)
    this._roadMat = new THREE.MeshPhongMaterial({
      color: CONFIG.THEMES[0].road,
      shininess: 50,
      specular: 0x222233,
      reflectivity: 0.12    // subtle wet-asphalt sheen from the env map
    });

    // walls (geometry constant, only repositioned)
    this._wallMat = new THREE.MeshPhongMaterial({
      color: 0x39415a, shininess: 30, specular: 0x333344, reflectivity: 0.2
    });
    this._capMat = new THREE.MeshBasicMaterial({ color: 0xf5d442 });
    for (const side of [-1, 1]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 2000), this._wallMat);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 2000), this._capMat);
      cap.position.y = 0.55;
      mesh.add(cap);
      mesh.position.set(side * this.halfWidth, 0.5, 0);
      this.group.add(mesh);
      (this._wallRefs || (this._wallRefs = {}))[side] = mesh;
    }

    // solid white edge lines (shared material, recolorable per theme)
    this._edgeMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });

    this.setLanes(lanesForLevel(1), true);
  },

  // Rebuild lane count: road slab, edge lines, double yellow, dashes, buildings
  setLanes(lanes, force = false) {
    if (lanes === this.laneCount && !force) return;
    this.laneCount = lanes;
    this.halfWidth = roadHalfWidth(lanes);

    // --- road slab (rebuild: width changes) ---
    if (this._roadMesh) {
      this.group.remove(this._roadMesh);
      this._roadMesh.geometry.dispose();
    }
    const roadW = this.halfWidth * 2;
    this._roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(roadW, 2000), this._roadMat);
    this._roadMesh.rotation.x = -Math.PI / 2;
    this._roadMesh.position.y = 0.01;
    this._roadMesh.receiveShadow = true;
    this.group.add(this._roadMesh);

    // --- solid white edge lines (just inside the road edge = the boundary) ---
    for (const side of [-1, 1]) {
      const old = this._edgeMesh ? this._edgeMesh[side] : null;
      if (old) { this.group.remove(old); old.geometry.dispose(); }
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 2000), this._edgeMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(side * (this.halfWidth - CONFIG.EDGE_LINE_INSET), 0.02, 0);
      this.group.add(line);
      (this._edgeMesh || (this._edgeMesh = {}))[side] = line;
    }

    this._rebuildLines();

    // --- walls: reposition only (geometry is constant) ---
    for (const side of [-1, 1]) {
      this._wallRefs[side].position.set(side * this.halfWidth, 0.5, 0);
    }

    // --- buildings: reposition to the new road edges ---
    for (const b of this.buildings) {
      b.group.position.x = b.side * (this.halfWidth + CONFIG.BUILDING_OFFSET + b.w / 2 + b.pad);
    }

    // --- buildings: build once ---
    if (!this.buildings.length) this._buildBuildings();
  },

  // Double-yellow center line + all lane-divider dashes. Called from
  // setLanes and from applyTheme (colors are baked into the geometry, so a
  // theme change requires a rebuild — layout is identical).
  _rebuildLines() {
    const lanes = this.laneCount;
    const t = this._theme || CONFIG.THEMES[0];

    if (this._yellowMesh) {
      this.group.remove(this._yellowMesh);
      this._yellowMesh.geometry.dispose();
    }
    const cl = centerLine(lanes);
    this._yellowMesh = new THREE.Mesh(mergeBoxes([
      { w: 0.22, h: 0.01, d: 2000, x: cl.x - 0.35, y: 0.025, z: 0, c: t.yellow },
      { w: 0.22, h: 0.01, d: 2000, x: cl.x + 0.35, y: 0.025, z: 0, c: t.yellow }
    ]), MERGE_MAT);
    this.group.add(this._yellowMesh);

    if (this.dashMesh) {
      this.group.remove(this.dashMesh);
      this.dashMesh.geometry.dispose();
    }
    const parts = [];
    const half = (lanes * CONFIG.LANE_WIDTH) / 2;
    const spacing = CONFIG.DASH_LENGTH + CONFIG.DASH_GAP;
    for (let i = 0; i < lanes - 1; i++) {
      if (i === cl.divider) continue;   // replaced by the double yellow
      const x = -half + CONFIG.LANE_WIDTH * (i + 1);
      for (let k = 0; k < CONFIG.DASH_SEG; k++) {
        parts.push({ w: 0.16, h: 0.01, d: CONFIG.DASH_LENGTH,
          x, y: 0.02, z: CONFIG.DASH_START - k * spacing, c: t.dash });
      }
    }
    this.dashMesh = new THREE.Mesh(mergeBoxes(parts), MERGE_MAT);
    this.group.add(this.dashMesh);
  },

  _buildBuildings() {
    const span = CONFIG.BUILDING_SPACING * CONFIG.BUILDINGS_PER_SIDE;
    const t = this._theme || CONFIG.THEMES[0];
    const palette = t.buildings;
    for (const side of [-1, 1]) {
      for (let i = 0; i < CONFIG.BUILDINGS_PER_SIDE; i++) {
        const w = 10 + Math.random() * 16;
        const d = 12 + Math.random() * 20;
        const h = CONFIG.BUILDING_MIN_H +
          Math.random() * (CONFIG.BUILDING_MAX_H - CONFIG.BUILDING_MIN_H);

        const g = new THREE.Group();
        // body (merged so vertex colors work with the shared MERGE_MAT)
        // + optional pyramid roof for "castle" themes
        const bodyParts = [
          { w, h, d, x: 0, y: h / 2 - 0.05, z: 0, c: palette[(Math.random() * palette.length) | 0] }
        ];
        if (t.roofs) {
          const coneR = Math.min(w, d) / 2 + 0.6;
          const coneH = 5 + Math.random() * 4;
          const roof = new THREE.ConeGeometry(coneR, coneH, 4);
          roof.rotateY(Math.PI / 4);
          bodyParts.push({ geo: roof, x: 0, y: h - 0.05 + coneH / 2, z: 0, c: palette[(Math.random() * palette.length) | 0] });
        }
        const body = new THREE.Mesh(mergeBoxes(bodyParts), MERGE_MAT);
        body.castShadow = true;
        g.add(body);

        // windows: lit/dark panes on the road-facing face (GLOW_MAT)
        const winParts = [];
        const rows = Math.max(1, Math.floor(h / 4.2));
        const cols = Math.max(1, Math.floor(d / 3.6));
        const fx = -side * (w / 2 + 0.07);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const lit = Math.random() < 0.55;
            winParts.push({
              w: 0.1, h: 1.5, d: 1.7,
              x: fx,
              y: 2.6 + r * 3.4,
              z: -d / 2 + 1.8 + c * (d - 3.6) / Math.max(1, cols - 1),
              c: lit ? t.windowLit : t.windowDark
            });
          }
        }
        g.add(new THREE.Mesh(mergeBoxes(winParts), GLOW_MAT));

        const pad = Math.random() * 14;
        const x = side * (this.halfWidth + CONFIG.BUILDING_OFFSET + w / 2 + pad);
        const z = 400 - i * CONFIG.BUILDING_SPACING - (Math.random() - 0.5) * 12;
        g.position.set(x, 0, z);
        this.group.add(g);
        this.buildings.push({ group: g, side, pad, w, d, baseH: h });
      }
    }
  },

  // Dispose the current skyline (shared materials survive).
  _disposeBuildings() {
    for (const b of this.buildings) {
      this.group.remove(b.group);
      b.group.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    }
    this.buildings.length = 0;
  },

  // Drifting puffball clouds for the dreamy theme (parallax: 35% of the
  // world scroll speed, slow lateral drift, recycled behind the camera).
  _setClouds(t) {
    const want = !!t.clouds;
    if (want && !this._clouds) {
      const g = new THREE.Group();
      this._cloudMat = new THREE.MeshLambertMaterial({ color: t.cloudColor });
      for (let i = 0; i < 16; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), this._cloudMat);
        const s = 6 + Math.random() * 14;
        puff.scale.set(s * (1.6 + Math.random()), s * 0.5, s);
        puff.position.set(
          (Math.random() - 0.5) * 520,
          38 + Math.random() * 60,
          -300 - Math.random() * 700
        );
        puff.userData.vx = (Math.random() - 0.5) * 2;
        g.add(puff);
      }
      this._clouds = g;
      this.group.add(g);
    } else if (!want && this._clouds) {
      this.group.remove(this._clouds);
      for (const p of this._clouds.children) p.geometry.dispose();
      this._cloudMat.dispose();
      this._clouds = null;
      this._cloudMat = null;
    }
  },

  // Re-tint everything for the new theme.
  applyTheme(t) {
    this._theme = t;

    this._groundMat.color.set(t.ground);
    this._roadMat.color.set(t.road);
    this._edgeMat.color.set(t.edge);
    this._wallMat.color.set(t.wall);
    this._capMat.color.set(t.wallCap);
    if (t.stars !== null) {
      this.stars.visible = true;
      this._starMat.color.set(t.stars);
    } else {
      this.stars.visible = false;
    }

    this._rebuildLines();
    this._disposeBuildings();
    this._buildBuildings();
    this._setClouds(t);
  },

  // Scroll the world toward the player.
  scroll(dt, speed) {
    const dz = speed * dt;
    this.dashOffset = (this.dashOffset + dz) % (CONFIG.DASH_LENGTH + CONFIG.DASH_GAP);
    if (this.dashMesh) this.dashMesh.position.z = this.dashOffset;

    // buildings: recycle behind the camera
    const span = CONFIG.BUILDING_SPACING * CONFIG.BUILDINGS_PER_SIDE;
    for (const b of this.buildings) {
      const g = b.group;
      g.position.z += dz;
      if (g.position.z > 400) {
        g.position.z -= span;
        g.position.x = b.side * (this.halfWidth + CONFIG.BUILDING_OFFSET + b.w / 2 + b.pad);
        // swap height occasionally for variety
        if (Math.random() < 0.25) {
          const nh = CONFIG.BUILDING_MIN_H +
            Math.random() * (CONFIG.BUILDING_MAX_H - CONFIG.BUILDING_MIN_H);
          g.scale.y = nh / b.baseH;
        }
      }
    }

    // clouds: slow parallax drift + recycle
    if (this._clouds) {
      for (const p of this._clouds.children) {
        p.position.z += dz * 0.35;
        p.position.x += p.userData.vx * dt;
        if (p.position.z > 260) {
          p.position.z -= 1200;
          p.position.x = (Math.random() - 0.5) * 520;
        }
        if (Math.abs(p.position.x) > 320) p.userData.vx *= -1;
      }
    }
  }
};
