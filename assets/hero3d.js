/* Plunq hero: a construction site at blue hour, screened into halftone.

   The site is built here from boxes and struts, lit, rendered to a texture,
   then drawn as a dot screen in the ink palette. The stage stays pinned
   while the hero's three beats scroll over it: scroll moves the camera
   between three shots, and the handoff tags ride on points in the scene.
   Without WebGL the stage keeps its blueprint grid and the copy stands alone. */
(function () {
  "use strict";
  // three.js arrives as a plain global (assets/vendor/three.min.js), so the page also runs from file://
  const THREE = window.THREE;
  if (!THREE) return;

  const hero = document.getElementById("top");
  const stage = document.getElementById("hero-stage");
  const canvas = document.getElementById("hero-canvas");

  /* ── small helpers ─────────────────────────────────────────────── */
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  let seed = 20260930;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rgb = (hex) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);

  const lambert = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra));
  const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
  const MAT = {
    slab: lambert(0xbfc4cb),
    concrete: lambert(0xa9afb8),
    core: lambert(0x969da7),
    void: lambert(0x0a0d12),
    jump: lambert(0x3d4550),
    paint: lambert(0xe2e5ea),
    timber: lambert(0xb9a98c),
    rebar: lambert(0x6d5f52),
    prop: lambert(0x8d96a2),
    steel: lambert(0x56606c),
    alu: lambert(0x98a2ae),
    glass: lambert(0x2a3645, { emissive: 0x06090e }),
    glassLit: lambert(0x2a3645, { emissive: 0x6e5534 }),
    mesh: lambert(0xa7b0bb, { transparent: true, opacity: 0.28, depthWrite: false }),
    net: lambert(0x505a66, { transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
    scaff: lambert(0x87919d),
    board: lambert(0x8d8473),
    crane: lambert(0xc6cad0),
    craneDark: lambert(0x4a525d),
    cabin: lambert(0xaeb6c0),
    winLit: lambert(0x222a34, { emissive: 0x8a6b40 }),
    winDark: lambert(0x1a2029, { emissive: 0x05070a }),
    hoard: lambert(0xc9ced5),
    band: lambert(0x39414c),
    ground: lambert(0x262c34),
    yard: lambert(0x4a5059),
    asphalt: lambert(0x1c2027),
    kerb: lambert(0x6a717b),
    lamp: glow(2.0, 1.75, 1.4),
    festoon: glow(3.0, 2.3, 1.4),
    red: glow(6.0, 0.35, 0.28),
    // anchors: each lights up in Plunq blue when its tag is on
    hotDefect: lambert(0x2a3645, { emissive: 0x06090e }),
    hotRfi: lambert(0x2a3645, { emissive: 0x06090e }),
    deck: lambert(0xb9a98c),
    load: lambert(0x5f6975),
    office: lambert(0x222a34, { emissive: 0x8a6b40 }),
  };

  /* One instanced mesh per material: boxes placed by centre and size, and
     struts drawn from one point to another. Everything on site is one or
     the other, so the whole scene is a few dozen draw calls. */
  const UNIT = new THREE.BoxGeometry(1, 1, 1);
  const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
  const UP = v(0, 1, 0);

  class Batch {
    constructor(material, shadow) { this.material = material; this.shadow = shadow; this.list = []; }
    box(x, y, z, sx, sy, sz, ry = 0) {
      _q.setFromAxisAngle(UP, ry);
      this.list.push(new THREE.Matrix4().compose(_c.set(x, y, z), _q, _s.set(sx, sy, sz)));
      return this;
    }
    strut(a, b, t, t2 = t) {
      _d.subVectors(b, a);
      const len = _d.length();
      _q.setFromUnitVectors(UP, _d.divideScalar(len));
      this.list.push(new THREE.Matrix4().compose(_c.addVectors(a, b).multiplyScalar(0.5), _q, _s.set(t, len, t2)));
      return this;
    }
    into(parent) {
      if (!this.list.length) return;
      const mesh = new THREE.InstancedMesh(UNIT, this.material, this.list.length);
      this.list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = this.shadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }
  function batcher() {
    const map = new Map();
    const get = (mat, shadow = true) => {
      const key = mat.uuid + shadow;
      if (!map.has(key)) map.set(key, new Batch(mat, shadow));
      return map.get(key);
    };
    get.into = (parent) => map.forEach((b) => b.into(parent));
    return get;
  }

  /* ── the frame: eight floors cast, the ninth being formed ──────── */
  const FL = 3.4, TOP = 8, W = 15.4, D = 10.4;
  const lvl = (k) => k * FL;

  function buildFrame(root, A) {
    const B = batcher();
    const XS = [-15, -9, -3, 3, 9, 15], ZS = [-10, -5, 0, 5, 10];
    const inCore = (x, z) => Math.abs(x) < 4 && Math.abs(z) < 3.5;

    B(MAT.slab).box(0, 0.15, 0, 2 * W + 0.6, 0.3, 2 * D + 0.6);
    for (let k = 1; k <= TOP; k++) B(MAT.slab).box(0, lvl(k) - 0.15, 0, 2 * W, 0.3, 2 * D);

    for (let k = 0; k <= TOP; k++) {
      const y0 = k ? lvl(k) : 0.3, y1 = lvl(k + 1) - 0.3, yc = (y0 + y1) / 2;
      for (const x of XS) for (const z of ZS) {
        if (inCore(x, z)) continue;
        if (k < TOP || x <= -3) B(MAT.concrete).box(x, yc, z, 0.45, y1 - y0, 0.45);
        else if (x === 3) B(MAT.timber).box(x, yc, z, 0.74, y1 - y0, 0.74); // shuttered, waiting on the pour
        else for (const [dx, dz] of [[-0.15, -0.15], [0.15, -0.15], [0.15, 0.15], [-0.15, 0.15]])
          B(MAT.rebar, false).strut(v(x + dx, y0, z + dz), v(x + dx, y0 + 1.7, z + dz), 0.04);
      }
    }

    // the core leads the frame by two floors, with its jump form on top
    B(MAT.core).box(0, 17.1, 0, 7.2, 34.2, 6.4);
    for (let k = 0; k <= TOP; k++) B(MAT.void, false).box(-1.6, lvl(k) + (k ? 1.15 : 1.45), 3.22, 1.2, 2.2, 0.06);
    B(MAT.jump).box(0, 33.6, 3.9, 8.8, 5.2, 0.12).box(0, 33.6, -3.9, 8.8, 5.2, 0.12)
      .box(4.4, 33.6, 0, 0.12, 5.2, 7.8).box(-4.4, 33.6, 0, 0.12, 5.2, 7.8);
    B(MAT.paint).box(0, 35.9, 3.97, 8.8, 0.55, 0.04).box(-4.47, 35.9, 0, 0.04, 0.55, 7.8);

    // curtain wall on the first four storeys, one side of the fifth
    const sides = [
      { axis: "x", at: D + 0.06, span: [-W, W] },
      { axis: "x", at: -D - 0.06, span: [-W, W] },
      { axis: "z", at: -W - 0.06, span: [-D, D] },
      { axis: "z", at: W + 0.06, span: [-D, D] },
    ];
    const put = (s, b, a, y, len, h, th, off = 0) =>
      s.axis === "x" ? b.box(a, y, s.at + Math.sign(s.at) * off, len, h, th) : b.box(s.at + Math.sign(s.at) * off, y, a, th, h, len);

    function clad(k, s, a0, a1, pick) {
      const y0 = k ? lvl(k) : 0.3, y1 = lvl(k + 1);
      const n = Math.max(1, Math.round((a1 - a0) / 1.5)), pw = (a1 - a0) / n;
      put(s, B(MAT.alu), (a0 + a1) / 2, y1 - 0.25, a1 - a0, 0.9, 0.12);
      for (let i = 0; i < n; i++) {
        const a = a0 + pw * (i + 0.5);
        const m = (pick && pick(i, n, a)) || (rnd() < 0.17 ? MAT.glassLit : MAT.glass);
        put(s, B(m), a, (y0 + y1 - 0.7) / 2, pw - 0.06, y1 - y0 - 0.7, 0.05);
        put(s, B(MAT.alu), a0 + pw * i, (y0 + y1) / 2, 0.08, y1 - y0, 0.16);
      }
      put(s, B(MAT.alu), a1, (y0 + y1) / 2, 0.08, y1 - y0, 0.16);
    }
    const defect = (i, n, a) => (i === 5 ? (A.defect.pos.set(a, 1.9, D + 0.12), MAT.hotDefect) : null);
    const rfi = (i, n, a) => (i === n - 1 ? (A.rfi.pos.set(a, lvl(4) + 1.6, D + 0.12), MAT.hotRfi) : null);
    for (let k = 0; k <= 3; k++) sides.forEach((s, si) => clad(k, s, s.span[0], s.span[1], k === 0 && si === 0 ? defect : null));
    clad(4, sides[0], -W, 3, rfi);

    // edge protection on the open floors: posts, two rails, brick guard
    function edge(k, s, a0, a1) {
      const y = lvl(k);
      for (let a = a0; a <= a1 + 0.01; a += 2.4) put(s, B(MAT.steel), a, y + 0.6, 0.06, 1.2, 0.06, 0.1);
      put(s, B(MAT.steel), (a0 + a1) / 2, y + 1.12, a1 - a0, 0.05, 0.05, 0.1);
      put(s, B(MAT.steel), (a0 + a1) / 2, y + 0.55, a1 - a0, 0.05, 0.05, 0.1);
      put(s, B(MAT.mesh, false), (a0 + a1) / 2, y + 0.6, a1 - a0, 1.1, 0.02, 0.12);
    }
    for (let k = 4; k <= TOP; k++) {
      if (k === 4) edge(k, sides[0], 3, W); else edge(k, sides[0], -W, W);
      edge(k, sides[1], -W, W);
      edge(k, sides[3], -D, D);
      if (k === TOP) edge(k, sides[2], -D, D);
    }

    // back-propping under the newest slabs, a little uneven
    for (let k = 5; k <= 7; k++) for (let x = -14.1; x < 14.5; x += 1.8) for (let z = -9.1; z < 9.5; z += 1.8) {
      if ((Math.abs(x) < 4.4 && Math.abs(z) < 3.9) || rnd() < 0.28) continue;
      B(MAT.prop).strut(v(x, lvl(k), z), v(x, lvl(k + 1) - 0.3, z), 0.07);
    }
    // festoon lighting strung under each open soffit
    for (let k = 4; k <= 7; k++) for (const z of [-6.8, 0, 6.8]) for (let x = -14; x <= 14; x += 2) {
      if (z === 0 && Math.abs(x) < 5) continue;
      B(MAT.festoon, false).box(x, lvl(k + 1) - 0.55 - Math.abs(Math.sin(x * 0.8)) * 0.18, z, 0.16, 0.16, 0.16);
    }

    // table formwork for level 09 over one bay, with the mat half fixed
    const dx0 = -15.4, dx1 = -4.3, dz0 = -10.4, dz1 = 1.6, dy = lvl(9) - 0.3;
    B(MAT.deck).box((dx0 + dx1) / 2, dy - 0.06, (dz0 + dz1) / 2, dx1 - dx0, 0.12, dz1 - dz0);
    for (let x = dx0 + 0.7; x < dx1; x += 1.5) {
      B(MAT.timber).strut(v(x, dy - 0.22, dz0 + 0.2), v(x, dy - 0.22, dz1 - 0.2), 0.14, 0.2);
      for (let z = dz0 + 0.7; z < dz1; z += 1.5) B(MAT.prop).strut(v(x, lvl(TOP), z), v(x, dy - 0.3, z), 0.07);
    }
    for (let x = dx0 + 0.3; x < dx1 - 0.2; x += 0.45) B(MAT.rebar).strut(v(x, dy + 0.05, dz0 + 0.2), v(x, dy + 0.05, dz1 - 0.2), 0.035);
    for (let z = dz0 + 0.3; z < dz1 - 0.2; z += 0.45) B(MAT.rebar).strut(v(dx0 + 0.2, dy + 0.1, z), v(dx1 - 0.2, dy + 0.1, z), 0.035);
    A.drawing.pos.set(-9.6, dy + 0.2, -4.4);

    // tube-and-fitting scaffold up the west face
    const s0 = -W - 0.75, s1 = -W - 2.05, H = lvl(9) + 1.4;
    const zs = [];
    for (let z = -D; z <= D + 0.01; z += 2.08) zs.push(z);
    zs.forEach((z) => { B(MAT.scaff).strut(v(s0, 0, z), v(s0, H, z), 0.05); B(MAT.scaff).strut(v(s1, 0, z), v(s1, H, z), 0.05); });
    for (let y = 2; y <= H - 0.5; y += 2) {
      [s0, s1].forEach((x) => B(MAT.scaff).strut(v(x, y, -D), v(x, y, D), 0.05));
      B(MAT.scaff).strut(v(s1, y + 1, -D), v(s1, y + 1, D), 0.045);
      zs.forEach((z) => B(MAT.scaff).strut(v(s0 + 0.2, y, z), v(s1 - 0.2, y, z), 0.045));
      B(MAT.board).box((s0 + s1) / 2, y + 0.04, 0, 1.25, 0.05, 2 * D);
      for (let i = (y / 2) % 2; i < zs.length - 1; i += 2) B(MAT.scaff).strut(v(s1, y - 2, zs[i]), v(s1, y, zs[i + 1]), 0.04);
    }
    B(MAT.net, false).box(s1 - 0.12, (H + 15) / 2, -4.6, 0.02, H - 15, 11.6);

    // passenger hoist on the south face
    const hx = 9.6, hz = D + 1.0, HH = lvl(9) + 2;
    for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [0.35, 0.35], [-0.35, 0.35]]) B(MAT.crane).strut(v(hx + dx, 0, hz + dz), v(hx + dx, HH, hz + dz), 0.07);
    for (let y = 0; y < HH; y += 1.5) B(MAT.crane).strut(v(hx - 0.35, y, hz + 0.35), v(hx + 0.35, y + 1.5, hz + 0.35), 0.04);
    for (let k = 1; k <= TOP; k++) B(MAT.steel).box(hx, lvl(k) + 1.1, D + 0.3, 1.8, 2.2, 0.05);
    B.into(root);

    const cage = new THREE.Group();
    const C = batcher();
    C(MAT.cabin).box(0, 1.4, 0, 1.6, 2.6, 2.2);
    C(MAT.winLit, false).box(0.81, 1.8, 0, 0.02, 0.6, 1.2);
    C(MAT.steel).box(0, 2.9, 0, 1.7, 0.1, 2.3);
    C.into(cage);
    cage.position.set(hx, 0.3, hz + 1.5);
    root.add(cage);
    return { cage, hoistTop: lvl(7) + 0.3 };
  }

  /* ── tower crane: hammerhead, lattice mast, triangular jib ─────── */
  function buildCrane({ mastH = 44, jibL = 52, cjL = 17, lod = 1 } = {}) {
    const root = new THREE.Group();
    const B = batcher();
    const h = 1.0, step = lod ? 2.5 : 5;
    const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
    if (lod) B(MAT.concrete).box(0, 0.6, 0, 8, 1.2, 8);
    corners.forEach(([x, z]) => B(MAT.crane, !!lod).strut(v(x, 0, z), v(x, mastH, z), lod ? 0.22 : 0.4));
    for (let y = 0, i = 0; y < mastH - 0.01; y += step, i++) {
      for (let f = 0; f < 4; f++) {
        const [x1, z1] = corners[f], [x2, z2] = corners[(f + 1) % 4];
        B(MAT.crane, !!lod).strut(v(x1, y + step, z1), v(x2, y + step, z2), 0.1);
        if (i % 2) B(MAT.crane, !!lod).strut(v(x1, y, z1), v(x2, y + step, z2), 0.09);
        else B(MAT.crane, !!lod).strut(v(x2, y, z2), v(x1, y + step, z1), 0.09);
      }
    }
    B.into(root);

    const slew = new THREE.Group();
    slew.position.y = mastH;
    root.add(slew);
    const S = batcher();
    const jy = 1.2, jw = 0.85, jh = 1.8, apex = v(0, jy + 8, 0);
    S(MAT.craneDark).box(0, 0.6, 0, 2.8, 1.2, 2.8);
    if (lod) {
      S(MAT.craneDark).box(-0.6, 1.5, 2.2, 2.1, 2.3, 1.8);
      S(MAT.winLit, false).box(-1.66, 1.7, 2.2, 0.02, 1.2, 1.5);
    }
    corners.forEach(([x, z]) => S(MAT.crane, !!lod).strut(v(x * 1.2, jy, z * 1.2), apex, 0.16));
    // jib, pointing along -x
    const n = Math.round((jibL - 1.4) / 2.2), seg = (jibL - 1.4) / n;
    const J = S(MAT.crane, !!lod);
    J.strut(v(-1.4, jy, -jw), v(-jibL, jy, -jw), 0.14).strut(v(-1.4, jy, jw), v(-jibL, jy, jw), 0.14);
    J.strut(v(-1.4, jy + jh, 0), v(-jibL, jy + jh * 0.7, 0), 0.14);
    for (let i = 0; i < n; i++) {
      const x0 = -1.4 - i * seg, xm = x0 - seg / 2, x1 = x0 - seg;
      const yt = jy + jh * (1 - 0.3 * ((i + 0.5) / n));
      J.strut(v(x0, jy, -jw), v(x0, jy, jw), 0.08);
      if (lod) {
        J.strut(v(x0, jy, -jw), v(xm, yt, 0), 0.07).strut(v(xm, yt, 0), v(x1, jy, -jw), 0.07);
        J.strut(v(x0, jy, jw), v(xm, yt, 0), 0.07).strut(v(xm, yt, 0), v(x1, jy, jw), 0.07);
      } else J.strut(v(x0, jy, 0), v(xm, yt, 0), 0.12).strut(v(xm, yt, 0), v(x1, jy, 0), 0.12);
    }
    // counter-jib, walkway, machinery, ballast
    const K = S(MAT.crane, !!lod);
    K.strut(v(1.4, jy, -1), v(cjL, jy, -1), 0.16).strut(v(1.4, jy, 1), v(cjL, jy, 1), 0.16);
    for (let x = 1.4; x <= cjL; x += 2) K.strut(v(x, jy, -1), v(x, jy, 1), 0.08);
    if (lod) {
      for (let x = 1.4; x <= cjL; x += 2) for (const z of [-1.05, 1.05]) K.strut(v(x, jy, z), v(x, jy + 1.1, z), 0.05);
      for (const z of [-1.05, 1.05]) K.strut(v(1.4, jy + 1.1, z), v(cjL, jy + 1.1, z), 0.05);
      S(MAT.craneDark).box(8, jy + 0.95, 0, 3.4, 1.7, 1.8);
    }
    for (let i = 0; i < 4; i++) S(MAT.concrete).box(cjL - 0.7 - i * 1.05, jy - 1.1, 0, 1.0, 3.4, 2.4);
    S(MAT.crane, !!lod).strut(apex, v(-jibL * 0.36, jy + jh * 0.9, 0), 0.06).strut(apex, v(-jibL * 0.74, jy + jh * 0.75, 0), 0.06);
    for (const z of [-1, 1]) S(MAT.crane, !!lod).strut(apex, v(cjL - 0.5, jy + 0.1, z), 0.06);
    S.into(slew);

    const lights = [v(-jibL, jy + 0.9, 0), v(cjL, jy + 0.6, 0), apex.clone().add(v(0, 0.4, 0))].map((p) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(lod ? 0.4 : 0.9, 10, 8), MAT.red);
      m.position.copy(p);
      slew.add(m);
      return m;
    });

    let trolley = null, pend = null, ropes = null, load = null;
    if (lod) {
      trolley = new THREE.Group();
      trolley.position.set(-26, jy, 0);
      slew.add(trolley);
      const T = batcher();
      T(MAT.craneDark).box(0, -0.2, 0, 1.4, 0.5, 2.0);
      T.into(trolley);
      pend = new THREE.Group();
      trolley.add(pend);
      ropes = [-0.3, 0.3].map((z) => {
        const r = new THREE.Mesh(UNIT, MAT.steel);
        r.position.z = z;
        r.scale.set(0.05, 1, 0.05);
        r.castShadow = true;
        pend.add(r);
        return r;
      });
      load = new THREE.Group();
      pend.add(load);
      const L = batcher();
      L(MAT.craneDark).box(0, -0.45, 0, 0.7, 0.9, 0.55);
      L(MAT.paint).box(0, -1.05, 0, 0.12, 0.5, 0.12);
      for (const [x, z] of [[-2.8, -0.45], [2.8, -0.45], [2.8, 0.45], [-2.8, 0.45]]) L(MAT.steel).strut(v(0, -1.3, 0), v(x, -3.35, z), 0.04);
      // a bundle of steel beams, waiting on its submittal
      for (const [y, zs] of [[-3.55, [-0.45, 0, 0.45]], [-3.2, [-0.22, 0.22]]])
        for (const z of zs) L(MAT.load).box(0, y, z, 7, 0.34, 0.3);
      L.into(load);
    }
    return { root, slew, trolley, pend, ropes, load, lights, hookY: mastH + jy };
  }

  /* ── welfare: stacked cabins, walkway, stair ───────────────────── */
  function buildCabins(root, A) {
    const B = batcher();
    const x0 = 21.5, len = 9.0;
    for (let row = 0; row < 3; row++) for (let st = 0; st < 2; st++) {
      const z = 14.5 + row * 3.05, y = 0.25 + st * 2.95;
      B(MAT.cabin).box(x0 + len / 2, y + 1.4, z, len, 2.8, 2.95);
      B(MAT.band).box(x0 + len / 2, y + 2.82, z, len + 0.1, 0.12, 3.0);
      B(st ? MAT.office : rnd() < 0.6 ? MAT.winLit : MAT.winDark, false).box(x0 - 0.03, y + 1.6, z, 0.05, 0.95, 1.2);
      if (row === 2) for (const wx of [1.6, 4.5, 7.4]) B(st ? MAT.office : MAT.winLit, false).box(x0 + wx, y + 1.6, z + 1.5, 1.2, 0.95, 0.05);
    }
    B(MAT.steel).box(x0 - 0.75, 3.2, 17.55, 1.3, 0.1, 9.3);
    for (let z = 13.1; z <= 22.1; z += 1.5) B(MAT.steel).strut(v(x0 - 1.38, 3.2, z), v(x0 - 1.38, 4.3, z), 0.05);
    B(MAT.steel).strut(v(x0 - 1.38, 4.3, 13.0), v(x0 - 1.38, 4.3, 22.1), 0.05);
    for (const x of [x0 - 0.2, x0 - 1.3]) B(MAT.steel).strut(v(x, 0.1, 25.4 - 0.9), v(x, 3.2, 22.1), 0.12);
    for (let i = 1; i < 10; i++) B(MAT.steel).box(x0 - 0.75, 0.1 + i * 0.31, 24.5 - i * 0.24, 1.1, 0.05, 0.26);
    B.into(root);
    A.record.pos.set(x0 - 0.1, 5.3, 17.55);
  }

  /* ── the yard, the street and the city behind ──────────────────── */
  function radialTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.35)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function buildStreet(root) {
    const B = batcher();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), MAT.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    root.add(ground);

    B(MAT.yard, false).box(3, 0.01, 1.5, 70, 0.02, 47);
    B(MAT.asphalt, false).box(0, 0.02, 33, 1400, 0.02, 11).box(-42, 0.02, 0, 11, 0.02, 1400);
    B(MAT.kerb, false).box(0, 0.08, 26.4, 1400, 0.16, 2.6).box(-35.2, 0.08, 0, 2.6, 0.16, 1400)
      .box(0, 0.08, 39.7, 1400, 0.16, 2.6).box(-48.8, 0.08, 0, 2.6, 0.16, 1400);
    for (let x = -400; x < 400; x += 9) B(MAT.paint, false).box(x, 0.035, 33, 3, 0.01, 0.16);
    for (let z = -400; z < 400; z += 9) B(MAT.paint, false).box(-42, 0.035, z, 0.16, 0.01, 3);

    // hoarding round the site, with the gate on the south side
    const hh = 2.4;
    B(MAT.hoard).box(-15.5, hh / 2, 25, 33, hh, 0.12).box(24, hh / 2, 25, 28, hh, 0.12)
      .box(3, hh / 2, -22, 70, hh, 0.12).box(-32, hh / 2, 1.5, 0.12, hh, 47).box(38, hh / 2, 1.5, 0.12, hh, 47);
    B(MAT.band, false).box(-15.5, 0.2, 25.08, 33, 0.4, 0.04).box(24, 0.2, 25.08, 28, 0.4, 0.04).box(-32.08, 0.2, 1.5, 0.04, 0.4, 47);
    for (const x of [1, 10]) B(MAT.steel).box(x, 1.6, 25, 0.3, 3.2, 0.3);

    // street lamps, with a pool of light under each
    const pools = [];
    const lamp = (x, z, dir) => {
      B(MAT.steel).strut(v(x, 0, z), v(x, 7.2, z), 0.14);
      B(MAT.steel).strut(v(x, 7.2, z), v(x + dir[0] * 1.6, 7.3, z + dir[1] * 1.6), 0.1);
      B(MAT.lamp, false).box(x + dir[0] * 1.8, 7.2, z + dir[1] * 1.8, 0.5, 0.12, 0.25);
      pools.push([x + dir[0] * 2.2, z + dir[1] * 2.2]);
    };
    for (let x = -40; x <= 170; x += 26) lamp(x, 27.9, [0, 1]);
    for (let z = -170; z <= -20; z += 26) lamp(-36.4, z, [-1, 0]);
    const poolMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(15, 15).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: radialTexture(), color: new THREE.Color(0.55, 0.45, 0.32), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      pools.length
    );
    const m = new THREE.Matrix4();
    pools.forEach(([x, z], i) => poolMesh.setMatrixAt(i, m.makeTranslation(x, 0.06, z)));
    root.add(poolMesh);

    // site floodlight masts
    for (const [x, z, a] of [[-29, 21, -0.7], [35, -19, 2.3]]) {
      B(MAT.steel).strut(v(x, 0, z), v(x, 11, z), 0.22);
      B(MAT.lamp, false).box(x, 11.2, z, 0.8, 0.32, 0.2, a).box(x, 10.6, z, 0.8, 0.32, 0.2, a);
    }

    // stock on the ground: steel, rebar, blocks
    for (let l = 0; l < 3; l++) for (let i = 0; i < 6 - l; i++) B(MAT.load).box(15 + i * 0.55 + l * 0.27, 0.25 + l * 0.36, -15, 0.35, 0.34, 8);
    for (let i = 0; i < 5; i++) B(MAT.rebar).box(6 + i * 0.45, 0.25, -17.5, 0.3, 0.3, 11);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) B(MAT.concrete).box(-26 + i * 1.6, 0.55, -15 + j * 1.6, 1.2, 1.1, 1.2);

    B.into(root);

    // a mixer truck backed up to the gate
    const truck = new THREE.Group();
    const T = batcher();
    T(MAT.steel).box(0, 1.05, 0, 2.3, 0.5, 8.2);
    T(MAT.cabin).box(0, 2.0, 3.3, 2.4, 1.9, 1.8);
    T(MAT.winDark, false).box(0, 2.35, 4.22, 2.1, 0.8, 0.04);
    T.into(truck);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.25, 4.6, 18).rotateX(Math.PI / 2 - 0.22), MAT.crane);
    drum.position.set(0, 2.5, -0.8);
    drum.castShadow = true;
    truck.add(drum);
    for (let i = 0; i < 4; i++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14).rotateZ(Math.PI / 2), MAT.band);
      wheel.position.set(i < 2 ? -1.1 : 1.1, 0.5, i % 2 ? -2.6 : 2.6);
      truck.add(wheel);
    }
    truck.position.set(5.6, 0, 20.5);
    truck.rotation.y = Math.PI;
    root.add(truck);
  }

  function windowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const r = rnd();
      if (r > 0.1) continue;
      const warm = rnd() < 0.7, k = 0.45 + rnd() * 0.55;
      g.fillStyle = warm ? `rgba(255,${196 + (k * 30) | 0},${130 + (k * 40) | 0},${k})` : `rgba(190,215,255,${k * 0.8})`;
      g.fillRect(x * 8 + 1, y * 8 + 2, 6, 4);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  function buildCity(root) {
    const base = new THREE.BoxGeometry(1, 1, 1);
    const bp = base.attributes.position.array, bn = base.attributes.normal.array, bu = base.attributes.uv.array, bi = base.index.array;
    const pos = [], nor = [], uv = [], idx = [];
    let placed = 0, tries = 0;
    while (placed < 200 && tries++ < 4000) {
      const ang = rnd() * Math.PI * 2, rad = 80 + Math.pow(rnd(), 0.75) * 430;
      const x = Math.cos(ang) * rad + 40, z = Math.sin(ang) * rad - 40;
      const w = 14 + rnd() * 24, d = 14 + rnd() * 24;
      if (Math.abs(z - 33) < d / 2 + 10 || Math.abs(x + 42) < w / 2 + 10) continue;
      if (x > -60 && x < 60 && z > -45 && z < 50) continue;
      if (x < -30 && z > 20 && rad < 300) continue;
      let h = 10 + Math.pow(rnd(), 2.4) * 55;
      const cx = x - 175, cz = z + 205;
      if (cx * cx + cz * cz < 95 * 95) h = 60 + rnd() * 120;
      const ox = rnd() * 31, oy = rnd() * 17, v0 = pos.length / 3;
      for (let i = 0; i < 24; i++) {
        const face = (i / 4) | 0;
        pos.push(x + bp[i * 3] * w, (bp[i * 3 + 1] + 0.5) * h, z + bp[i * 3 + 2] * d);
        nor.push(bn[i * 3], bn[i * 3 + 1], bn[i * 3 + 2]);
        const span = face < 2 ? d : w;
        if (face === 2 || face === 3) uv.push(0.001, 0.001);
        else uv.push(ox + (bu[i * 2] * span) / 3.8 / 32, oy + (bu[i * 2 + 1] * h) / 3.5 / 32);
      }
      for (let i = 0; i < bi.length; i++) idx.push(v0 + bi[i]);
      placed++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const city = new THREE.Mesh(geo, lambert(0x2c333d, { emissive: 0xffffff, emissiveMap: windowTexture(), emissiveIntensity: 1.0 }));
    city.receiveShadow = false;
    root.add(city);

    // other sites across town, cranes against the sky
    const far = [];
    for (const [x, z, h, j, r] of [[150, -140, 62, 50, 0.9], [215, -250, 88, 60, -2.2], [360, -170, 70, 55, 2.6], [300, -60, 58, 45, -0.4]]) {
      const c = buildCrane({ mastH: h, jibL: j, cjL: 15, lod: 0 });
      c.root.position.set(x, 0, z);
      c.slew.rotation.y = r;
      root.add(c.root);
      far.push(c);
    }
    return far;
  }

  /* ── the screen: scene colour in, dots out ─────────────────────── */
  const SCREEN_VERT = /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `;
  /* Two passes. The prep pass runs once per CSS pixel: it finds the drawn
     edges (depth steps for outlines, light steps for creases) and packs the
     scene colour into 8 bits. The screen pass runs per device pixel and only
     reads that back: one tap for the cell's dot, one for the line. */
  const PREP_FRAG = /* glsl */ `
    precision highp float;
    uniform sampler2D tScene, tDepth;
    uniform vec2 uTexel;
    uniform float uNear, uFar;
    varying vec2 vUv;

    vec3 toSRGB(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
    float depthAt(vec2 uv) {
      float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
      return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
    }
    float lumaAt(vec2 uv) { return dot(toSRGB(texture2D(tScene, uv).rgb), vec3(0.2126, 0.7152, 0.0722)); }

    void main() {
      vec3 c = texture2D(tScene, vUv).rgb;
      vec2 ex = vec2(uTexel.x, 0.0), ey = vec2(0.0, uTexel.y);
      float dC = depthAt(vUv);
      float dd = max(abs(depthAt(vUv + ex) - dC), abs(depthAt(vUv + ey) - dC)) / dC;
      float lC = dot(toSRGB(c), vec3(0.2126, 0.7152, 0.0722));
      float dl = max(abs(lumaAt(vUv + ex) - lC), abs(lumaAt(vUv + ey) - lC));
      // lines fade out with distance, so the city behind stays soft
      float near = 1.0 - smoothstep(150.0, 320.0, dC);
      float edge = max(smoothstep(0.015, 0.05, dd), smoothstep(0.07, 0.2, dl) * 0.55) * near;
      // HDR squeezed into 0..1, then gamma'd so the darks keep their steps
      gl_FragColor = vec4(toSRGB(c / (1.0 + c)), edge);
    }
  `;

  const SCREEN_FRAG = /* glsl */ `
    precision highp float;
    uniform sampler2D tPrep;
    uniform vec2 uRes;
    uniform float uCell, uExposure, uReveal, uDim;
    uniform vec3 uInk, uDot, uLine;
    varying vec2 vUv;

    vec3 toSRGB(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
    vec3 unpack(vec3 v) { vec3 x = pow(v, vec3(2.2)); return x / max(1.0 - x, 1e-3); }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    void main() {
      vec2 px = vUv * uRes;
      vec2 cell = floor(px / uCell);
      vec2 ctr = (cell + 0.5) * uCell;
      vec2 cu = ctr / uRes;
      vec3 c = unpack(texture2D(tPrep, cu).rgb);

      float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float t = 1.0 - exp(-L * uExposure);

      // on arrival the cells switch on from the ground up
      float gate = smoothstep(0.0, 0.12, uReveal * 1.45 - (cu.y + hash(cell) * 0.3));
      t *= gate * (1.0 - uDim);

      float r = sqrt(t) * 0.7 * uCell;
      float m = 1.0 - smoothstep(r - 0.8, r + 0.8, length(px - ctr));

      // strong colour keeps its hue: Plunq blue, aviation red
      float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
      float sat = (mx - mn) / max(mx, 1e-4);
      vec3 hue = toSRGB(c / max(mx, 1e-4));
      vec3 dotc = mix(uDot, hue, smoothstep(0.4, 0.8, sat) * smoothstep(0.02, 0.12, mx));

      vec3 col = mix(uInk + toSRGB(c) * 0.13 * gate, dotc, m);
      col = mix(col, uLine, texture2D(tPrep, vUv).a * gate * 0.6 * (1.0 - uDim));

      vec2 q = vUv - 0.5;
      col *= 1.0 - dot(q, q) * 0.5;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  /* ── camera: three shots, one per beat ─────────────────────────── */
  const SHOTS = [
    { pos: v(-66, 5, 72), at: v(10, 23, -6), fov: 36 },
    { pos: v(-36, 30, 86), at: v(5, 14, 3), fov: 34 },
    { pos: v(-38, 92, 96), at: v(8, 10, 0), fov: 32 },
  ];
  const posPath = new THREE.CatmullRomCurve3(SHOTS.map((s) => s.pos), false, "centripetal");
  const atPath = new THREE.CatmullRomCurve3(SHOTS.map((s) => s.at), false, "centripetal");

  function run() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); stage.dataset.state = "off"; });

    const narrow = window.matchMedia("(max-width: 767px)").matches;
    const scene = new THREE.Scene();
    const horizon = new THREE.Color(0x384456);
    scene.fog = new THREE.Fog(horizon, 120, 600);

    // sky: dark overhead, a band of last light low in the west
    const keyDir = v(-80, 62, 48).normalize();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1000, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { uTop: { value: new THREE.Color(0x0a0e15) }, uHorizon: { value: horizon }, uGlow: { value: new THREE.Color(0x56647b) }, uSun: { value: keyDir } },
        vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "uniform vec3 uTop, uHorizon, uGlow, uSun; varying vec3 vDir; void main(){ float h = max(vDir.y, 0.0); vec3 c = mix(uHorizon, uTop, pow(h, 0.5)); c += uGlow * pow(max(dot(vDir, uSun), 0.0), 5.0) * (1.0 - h); gl_FragColor = vec4(c, 1.0); }",
      })
    );
    scene.add(sky);

    scene.add(new THREE.HemisphereLight(0x9cb0cc, 0x0f1319, 0.6));
    const key = new THREE.DirectionalLight(0xdfe7f2, 2.7);
    key.position.copy(keyDir).multiplyScalar(120);
    key.target.position.set(2, 8, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(narrow ? 1024 : 2048, narrow ? 1024 : 2048);
    Object.assign(key.shadow.camera, { left: -58, right: 58, top: 58, bottom: -58, near: 20, far: 260 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    scene.add(key, key.target);
    for (const [p, t] of [[v(-29, 11, 21), v(-2, 3, 6)], [v(35, 11, -19), v(8, 5, -4)]]) {
      const s = new THREE.SpotLight(0xffe3bd, 1100, 110, 0.62, 0.8, 2);
      s.position.copy(p);
      s.target.position.copy(t);
      scene.add(s, s.target);
    }
    for (const [x, k, z] of [[-7, 5, 3], [8, 7, -4]]) {
      const pl = new THREE.PointLight(0xffc88a, 70, 28, 2);
      pl.position.set(x, lvl(k) + 1.6, z);
      scene.add(pl);
    }

    // anchors for the tags; each has a point and, where it has one, a material to light
    const A = {
      rfi: { pos: v(), mat: MAT.hotRfi },
      drawing: { pos: v(), mat: MAT.deck },
      defect: { pos: v(), mat: MAT.hotDefect },
      submittal: { pos: v(), mat: MAT.load },
      record: { pos: v(), mat: MAT.office },
    };
    Object.values(A).forEach((a) => { a.base = a.mat.emissive.clone(); a.k = 0; });

    const site = new THREE.Group();
    scene.add(site);
    const frame = buildFrame(site, A);
    buildCabins(site, A);
    buildStreet(site);
    const farCranes = buildCity(scene);
    const crane = buildCrane();
    crane.root.position.set(27, 0, -3);
    crane.slew.rotation.y = -0.22;
    site.add(crane.root);

    // render targets and the screen pass
    const camera = new THREE.PerspectiveCamera(33, 1, 1, 2400);
    const floatOK = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: floatOK ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 4 });
    rt.depthTexture = new THREE.DepthTexture(2, 2);
    const prepRT = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false });
    const prepMat = new THREE.ShaderMaterial({
      vertexShader: SCREEN_VERT,
      fragmentShader: PREP_FRAG,
      depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uTexel: { value: new THREE.Vector2() },
        uNear: { value: camera.near }, uFar: { value: camera.far },
      },
    });
    const screenMat = new THREE.ShaderMaterial({
      vertexShader: SCREEN_VERT,
      fragmentShader: SCREEN_FRAG,
      depthTest: false, depthWrite: false,
      uniforms: {
        tPrep: { value: prepRT.texture }, uRes: { value: new THREE.Vector2() },
        uLine: { value: rgb(0xaebfd3) }, uCell: { value: 9 },
        uExposure: { value: 2.3 }, uReveal: { value: reduce ? 1 : 0 }, uDim: { value: 0 },
        uInk: { value: rgb(0x0d121a) }, uDot: { value: rgb(0xd9e2ed) },
      },
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const screen = new THREE.Mesh(tri, screenMat), prepQuad = new THREE.Mesh(tri, prepMat);
    screen.frustumCulled = prepQuad.frustumCulled = false;
    const post = new THREE.Scene(), prep = new THREE.Scene();
    post.add(screen);
    prep.add(prepQuad);
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // sizing, with a quality step down if frames run long
    let W0 = 0, H0 = 0, quality = 0;
    const QUALITY = [{ dpr: 1.5, rt: 1 }, { dpr: 1.25, rt: 0.8 }, { dpr: 1, rt: 0.65 }];
    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      W0 = w; H0 = h;
      const q = QUALITY[quality];
      const dpr = Math.min(window.devicePixelRatio || 1, q.dpr);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      rt.setSize(Math.round(w * q.rt), Math.round(h * q.rt));
      prepRT.setSize(rt.width, rt.height);
      prepMat.uniforms.uTexel.value.set(1 / rt.width, 1 / rt.height);
      const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
      screenMat.uniforms.uRes.value.copy(buf);
      screenMat.uniforms.uCell.value = (w < 640 ? 4 : 4.6) * dpr;
      camera.aspect = w / h;
    }
    resize();
    new ResizeObserver(resize).observe(stage);

    // tags and the links that carry each handoff to the record
    const tags = Array.prototype.slice.call(stage.querySelectorAll("[data-anchor]")).map((el) => ({
      el, a: A[el.dataset.anchor], at: parseFloat(el.dataset.at || "0"), until: parseFloat(el.dataset.until || "2"), on: false,
    }));
    const svg = document.getElementById("hero-links");
    const NS = "http://www.w3.org/2000/svg";
    const links = tags.filter((t) => t.el.dataset.anchor !== "record").map((t, i) => {
      const g = document.createElementNS(NS, "g");
      const base = document.createElementNS(NS, "path"), packet = document.createElementNS(NS, "path");
      packet.setAttribute("class", "packet");
      packet.setAttribute("pathLength", "100");
      packet.style.animationDelay = i * -0.6 + "s";
      g.append(base, packet);
      svg.appendChild(g);
      return { from: t, g, paths: [base, packet] };
    });
    const record = tags.find((t) => t.el.dataset.anchor === "record");

    // scroll: 0 at the top of the hero, 1 when its last beat fills the screen
    let pGoal = 0, p = 0;
    function readScroll() {
      const r = hero.getBoundingClientRect();
      const run = r.height - window.innerHeight;
      pGoal = run > 0 ? clamp(-r.top / run, 0, 1) : 0;
    }
    readScroll();
    p = pGoal;
    window.addEventListener("scroll", () => { readScroll(); if (reduce) requestRender(); }, { passive: true });

    let px = 0, py = 0, pxGoal = 0, pyGoal = 0;
    if (!reduce && window.matchMedia("(pointer: fine)").matches) {
      window.addEventListener("pointermove", (e) => {
        pxGoal = (e.clientX / window.innerWidth) * 2 - 1;
        pyGoal = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }

    const tmp = v(), tmp2 = v(), right = v(), blue = new THREE.Color(0.1, 0.34, 1.0);
    let time = 0, intro = reduce ? 1 : 0;

    function placeCamera() {
      const u = reduce ? 0 : smooth(0, 1, p) * 0.35 + p * 0.65;
      posPath.getPoint(u, camera.position);
      atPath.getPoint(u, tmp);
      const seg = u < 0.5 ? u * 2 : (u - 0.5) * 2, i = u < 0.5 ? 0 : 1;
      camera.fov = THREE.MathUtils.lerp(SHOTS[i].fov, SHOTS[i + 1].fov, seg);

      // squarer screens step back so the whole frame fits beside (or under) the copy
      const aspect = camera.aspect;
      const back = aspect < 1.25 ? 1 + (1.25 - aspect) * 0.7 : 1 + Math.max(0, 1.6 - aspect) * 0.45;
      if (back > 1) {
        const y = camera.position.y;
        camera.position.sub(tmp).multiplyScalar(back).add(tmp);
        camera.position.y = aspect < 1.25 ? Math.max(y, 7) : y; // step back, never down into the ground
      }
      if (aspect < 1.25) camera.fov += (1.25 - aspect) * 10;
      // arrival glide, idle drift, a little pointer parallax
      const k = 1 - Math.pow(1 - intro, 3);
      tmp2.subVectors(camera.position, tmp).multiplyScalar(0.16 * (1 - k));
      camera.position.add(tmp2).add(v(0, -4 * (1 - k), 0));
      if (!reduce) {
        right.subVectors(tmp, camera.position).cross(UP).normalize();
        camera.position.addScaledVector(right, Math.sin(time * 0.07) * 1.6 + px * 2.6);
        camera.position.y += Math.sin(time * 0.05) * 0.6 - py * 1.4;
      }
      camera.lookAt(tmp);

      // keep the site clear of the copy: right of it on wide screens, below it on tall ones
      const endShift = smooth(0.6, 1, p);
      const sx = aspect >= 1.25 ? THREE.MathUtils.lerp(0.2 + Math.max(0, 1.6 - aspect) * 0.15, 0.0, endShift) : 0;
      const sy = aspect >= 1.25 ? THREE.MathUtils.lerp(0.02, -0.2, endShift) : THREE.MathUtils.lerp(0.24, -0.12, endShift);
      camera.setViewOffset(W0, H0, -sx * W0, -sy * H0, W0, H0);
      camera.updateProjectionMatrix();
    }

    function animateSite(dt) {
      if (reduce) return;
      crane.slew.rotation.y = -0.22 + Math.sin(time * 0.05) * 0.16;
      crane.trolley.position.x = -(27 + Math.sin(time * 0.07 + 1.3) * 6);
      const hookY = 37.5 + Math.sin(time * 0.09) * 3;
      const L = crane.hookY - hookY;
      crane.ropes.forEach((r) => { r.scale.y = L; r.position.y = -L / 2; });
      crane.load.position.y = -L;
      crane.pend.rotation.z = Math.sin(time * 0.85) * 0.012;
      crane.pend.rotation.x = Math.sin(time * 0.6 + 1) * 0.01;
      crane.load.rotation.y = Math.sin(time * 0.13) * 0.25;
      const hp = (Math.sin(time * 0.11) + 1) / 2;
      frame.cage.position.y = 0.3 + smooth(0.1, 0.9, hp) * frame.hoistTop;
      const blink = Math.sin(time * 2.2) > 0.2 ? 1 : 0.15;
      MAT.red.color.setRGB(6 * blink, 0.35 * blink, 0.28 * blink);
      farCranes.forEach((c, i) => { c.slew.rotation.y += dt * 0.01 * (i % 2 ? 1 : -1); });
    }

    function project(world) {
      tmp2.copy(world).project(camera);
      return { x: (tmp2.x * 0.5 + 0.5) * W0, y: (-tmp2.y * 0.5 + 0.5) * H0, ok: tmp2.z < 1 && tmp2.z > -1 };
    }

    function updateOverlay(dt) {
      crane.load.getWorldPosition(A.submittal.pos).add(v(0, -3.3, 0));
      const narrowNow = W0 < 640;
      tags.forEach((t) => {
        const on = p >= t.at && p < t.until && !(narrowNow && t.el.classList.contains("wide"));
        if (on !== t.on) { t.on = on; t.el.classList.toggle("on", on); }
        const s = project(t.a.pos);
        t.el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
        t.el.style.visibility = s.ok ? "" : "hidden";
        t.a.k += ((on ? 1 : 0) - t.a.k) * (reduce ? 1 : 1 - Math.exp(-dt * 5));
        t.a.mat.emissive.copy(t.a.base).lerp(blue, t.a.k * 0.9);
      });
      links.forEach((l) => {
        const on = l.from.on && record.on;
        l.g.classList.toggle("on", on);
        if (!on && !l.paths[0].getAttribute("d")) return;
        const a = l.from.a.pos, b = record.a.pos;
        const lift = a.distanceTo(b) * 0.32 + 6;
        let d = "";
        for (let i = 0; i <= 24; i++) {
          const t = i / 24, u = 1 - t;
          tmp.set(u * u * a.x + 2 * u * t * (a.x + b.x) / 2 + t * t * b.x,
            u * u * a.y + 2 * u * t * (Math.max(a.y, b.y) + lift) + t * t * b.y,
            u * u * a.z + 2 * u * t * (a.z + b.z) / 2 + t * t * b.z);
          const s = project(tmp);
          d += (i ? "L" : "M") + s.x.toFixed(1) + " " + s.y.toFixed(1);
        }
        l.paths.forEach((path) => path.setAttribute("d", d));
      });
    }

    function render() {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(prepRT);
      renderer.render(prep, postCam);
      renderer.setRenderTarget(null);
      renderer.render(post, postCam);
    }

    // the loop runs only while the hero is on screen
    let born = performance.now(), last = born, raf = 0, visible = true, slow = 0, frames = 0, firstFrame = true;
    function tick(now) {
      raf = requestAnimationFrame(tick);
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      time += dt;
      // the arrival runs on the clock, so a slow first second doesn't stretch it
      const since = Math.max(0, now - born) / 1000;
      intro = Math.min(1, since / 2.8);
      screenMat.uniforms.uReveal.value = Math.min(1, since / 1.9);
      p += (pGoal - p) * (1 - Math.exp(-dt * 7));
      px += (pxGoal - px) * (1 - Math.exp(-dt * 2.5));
      py += (pyGoal - py) * (1 - Math.exp(-dt * 2.5));
      step(dt);
      // step quality down if the device is struggling
      if (++frames > 20) {
        slow = dt > 0.028 ? slow + 1 : Math.max(0, slow - 1);
        if (slow > 45 && quality < QUALITY.length - 1) { quality++; slow = 0; resize(); }
      }
    }
    function step(dt) {
      animateSite(dt);
      placeCamera();
      screenMat.uniforms.uDim.value = smooth(0.72, 1, p) * 0.22;
      updateOverlay(dt);
      render();
      if (firstFrame) { firstFrame = false; stage.dataset.state = "live"; }
    }
    let pending = false;
    function requestRender() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; p = pGoal; step(1); });
    }

    function play() { if (ready && !raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } }
    function pause() { cancelAnimationFrame(raf); raf = 0; }
    function start() {
      ready = true;
      born = performance.now();
      if (reduce) {
        requestRender();
        new ResizeObserver(requestRender).observe(stage);
        return;
      }
      new IntersectionObserver((e) => { visible = e[0].isIntersecting; visible ? play() : pause(); }).observe(hero);
      document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
      play();
    }
    // compile every program up front, so the arrival doesn't stutter on first draw
    placeCamera();
    let ready = false;
    const warm = renderer.extensions.has("KHR_parallel_shader_compile")
      ? Promise.all([renderer.compileAsync(scene, camera), renderer.compileAsync(prep, postCam), renderer.compileAsync(post, postCam)])
      : Promise.resolve();
    warm.catch(() => {}).then(start);
  }

  if (hero && stage && canvas) {
    try {
      // probe first, so browsers without WebGL2 keep the grid without console noise
      if (!document.createElement("canvas").getContext("webgl2")) throw new Error("WebGL2 unavailable");
      run();
    } catch (err) {
      stage.dataset.state = "off";
      console.warn("Plunq hero scene unavailable:", err);
    }
  }
})();
