// dot-orb -- a ball of dots on a canvas that reshapes itself for each state.
//
//   <span data-orb data-state="swell" data-size="36" data-n="90"></span>
//   orbs[i].setState("check")
//
// Each state is named for what the dots do:
//   sphere   a slowly turning ball
//   swell    a ball whose surface rises and sinks as waves roll over it
//   sweep    a faint ball with one bright arc circling it
//   halftone a square grid of dots, cut to a disc, where soft blobs of larger
//            dots drift and merge
//   converge a flat round disc, the ripple turned inside out: each word is a ring
//            that closes in from the rim and lands softly at the centre, like listening
//   ripple   a still surface where each word lands as a water drop and ripples spread outward, like speaking
//   check    a faint circle with a thin check drawn inside
//   tremor   a light earthquake on a flat round disc of dots in straight rows: a
//            quick shudder, a wave of shaking across it, and smaller aftershocks
//
// Dots change shape one after another, not all at once. Reduced motion gets a
// still pose and no loop.

const TAU = Math.PI * 2;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

// One gradient for every state, laid across the orb and drifting slowly, so the
// shape alone says which state it is. Blue, violet, then pink.
const STOPS = [
  [74, 128, 255],
  [138, 92, 246],
  [232, 92, 176],
];
const SHADES = Array.from({ length: 64 }, (_, k) => {
  const g = (k / 63) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(g));
  const f = g - i;
  return STOPS[i].map((v, c) => Math.round(v + (STOPS[i + 1][c] - v) * f));
});

// Orbit width, orbit height, speeds, phases, radius and strength of each halftone
// blob. The layout was picked by search: the pattern is split into two or more
// separate parts about nine tenths of the time.
const BLOBS = [
  [0.62, 0.64, 0.68, 0.66, 5.2, 3.49, 0.19, 0.88],
  [0.61, 0.7, 0.78, 0.73, 4.99, 3.45, 0.16, 0.9],
  [0.56, 0.58, 0.89, 1.0, 2.14, 0.77, 0.19, 0.94],
  [0.73, 0.74, 1.03, 0.74, 3.75, 5.03, 0.17, 0.86],
  [0.75, 0.52, 0.83, 0.71, 3.23, 2.69, 0.21, 0.95],
  [0.46, 0.73, 0.76, 1.0, 5.1, 5.08, 0.15, 0.89],
];

export const STATES = ["sphere", "swell", "sweep", "halftone", "converge", "ripple", "check", "tremor"];

const hash = (i) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Words arriving, for the listening state: when each reaches the rim, from which
// side, how strongly and how fast it closes in. Words come at irregular moments,
// in phrases and with longer pauses between them. A real app would raise one of
// these for each stretch of speech it hears from the person.
const WORD_LIFE = 3.2;
function wordAt(e) {
  const g = 0.95;
  const time = g * (e + 1.7 * Math.sin(0.5 * e + 1) + 0.9 * Math.sin(0.17 * e + 2) + 1.1 * Math.sin(0.31 * e + 0.7) * Math.sin(0.11 * e + 4)) + (hash(e * 3 + 7) - 0.5) * g * 0.6;
  return { time, from: hash(e * 5 + 8) * TAU, str: 0.45 + 0.55 * hash(e * 7 + 9) * (hash(e * 13 + 4) < 0.2 ? 1 : 0.75), speed: 0.5 + 0.3 * hash(e * 11 + 10), width: 0.055 + 0.03 * hash(e * 17 + 11) };
}

// Water drops for the speaking state: when each lands and where. Drops come at
// irregular moments, in clusters and lulls, each at a random spot on the front
// of the ball. A real app would raise a drop for each word the assistant speaks.
const DROP_LIFE = 3.4;
function dropAt(e) {
  const g = 0.72;
  const time = g * (e + 1.5 * Math.sin(0.47 * e + 1) + 0.9 * Math.sin(0.15 * e + 2)) + (hash(e * 3 + 1) - 0.5) * g * 0.5;
  const az = (hash(e * 5 + 2) - 0.5) * 1.5; // across the front, not out at the edge
  const el = (hash(e * 7 + 3) - 0.5) * 1.2;
  const cz = Math.cos(el);
  return { time, x: Math.sin(az) * cz, y: Math.sin(el), z: Math.cos(az) * cz, str: 0.55 + 0.45 * hash(e * 11 + 4), speed: 0.7 + 0.3 * hash(e * 13 + 5) };
}

// The check after it has been drawn: now and then a glint glides along the
// stroke, and a faint ring of light spreads out to the circle. Both come at
// irregular moments, never on a beat.
function glintAt(e) {
  const time = 4.4 * (e + 0.9 * Math.sin(0.7 * e + 1) + 0.5 * Math.sin(0.23 * e + 2)) + (hash(e * 3 + 21) - 0.5) * 2.4;
  return { time, dur: 1.0 + 0.6 * hash(e * 5 + 22), str: 0.55 + 0.45 * hash(e * 7 + 23) };
}
function echoAt(e) {
  const time = 8.6 * (e + 0.7 * Math.sin(0.9 * e + 2) + 0.4 * Math.sin(0.31 * e)) + (hash(e * 3 + 31) - 0.5) * 3.6;
  return { time, str: 0.25 + 0.2 * hash(e * 7 + 32) };
}

// The tremor state: aftershocks, at irregular moments, each one smaller than the
// last, from its own spot on the ball and shaking at its own pace.
function shockAt(e) {
  const time = 0.55 + 2.3 * (e + 0.9 * Math.sin(0.8 * e + 1) + 0.5 * Math.sin(0.31 * e + 2)) + (hash(e * 3 + 81) - 0.5) * 1.2;
  const az = hash(e * 5 + 82) * TAU;
  const r = 0.7 * Math.sqrt(hash(e * 7 + 83));
  return { time, x: Math.cos(az) * r, y: Math.sin(az) * r, str: (0.3 + 0.35 * hash(e * 11 + 84)) / (1 + 0.28 * e), freq: 7 + 4 * hash(e * 13 + 85), decay: 0.45 + 0.4 * hash(e * 17 + 86) };
}

class Orb {
  constructor(host, state) {
    this.host = host;
    this.n = Number(host.dataset.n) || 120;
    this.size = Number(host.dataset.size) || 36;
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    host.append(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.visible = true;
    this.state = state;
    this.prev = state;
    this.enter = -10;
    this.t = 0;

    // Dots sit on latitude rows. Every row gets as many dots as it takes to
    // keep the spacing along the row equal to the spacing between rows, so the
    // lattice is even everywhere, and every row starts at the same angle, so a
    // neighbouring row is never shifted the other way. That evenness is what
    // lets a highlight read as a clean shape.
    const rows = Math.max(6, Math.round(Math.sqrt((2 * this.n) / Math.PI)));
    this.rows = rows;
    const step = Math.PI / rows;
    const ys = Array.from({ length: rows }, (_, b) => 1 - (2 * (b + 0.5)) / rows);
    const counts = ys.map((y) => Math.max(3, Math.round((TAU * Math.sqrt(1 - y * y)) / step)));
    const n = counts.reduce((a, c) => a + c, 0);
    this.n = n;
    this.sph = new Float32Array(n * 3);
    this.cur = new Float32Array(n * 5); // x, y, z, size, alpha
    this.tar = new Float32Array(5);
    this.vel = new Float32Array(n * 3); // how fast each dot is moving, for the spring
    this.rad = new Float32Array(n); // distance from the centre, as seen from the front
    let idx = 0;
    for (let b = 0; b < rows; b++) {
      const r = Math.sqrt(1 - ys[b] * ys[b]);
      for (let k = 0; k < counts[b]; k++, idx++) {
        const lon = (k / counts[b]) * TAU;
        this.sph[idx * 3] = Math.cos(lon) * r;
        this.sph[idx * 3 + 1] = ys[b];
        this.sph[idx * 3 + 2] = Math.sin(lon) * r;
        this.rad[idx] = Math.hypot(this.sph[idx * 3], ys[b]);
      }
    }

    // Concentric rings of dots, spaced the same along a ring as between rings,
    // for the converge state: a flat round disc. As many rings as the dot count
    // allows; any dots left over are hidden.
    const ringsFor = (r) => {
      let c = 0;
      for (let k = 0; k < r; k++) c += Math.max(6, Math.round(TAU * (k + 0.5)));
      return c;
    };
    let nr = 3;
    while (ringsFor(nr + 1) <= n) nr++;
    this.pnr = nr;
    this.pr = new Float32Array(n);
    this.pth = new Float32Array(n);
    this.pk = new Int16Array(n);
    this.pOn = new Uint8Array(n);
    let pi = 0;
    for (let k = 0; k < nr; k++) {
      const m = Math.max(6, Math.round(TAU * (k + 0.5)));
      for (let j = 0; j < m; j++, pi++) {
        this.pr[pi] = (k + 0.5) / nr;
        this.pth[pi] = ((j + 0.5 * (k % 2)) / m) * TAU + k * 0.7;
        this.pk[pi] = k;
        this.pOn[pi] = 1;
      }
    }
    for (; pi < n; pi++) {
      this.pr[pi] = this.pr[pi - 1];
      this.pth[pi] = this.pth[pi - 1];
      this.pk[pi] = this.pk[pi - 1];
    }

    // A square grid cut to a disc, one cell per dot, for the halftone state. The
    // grid is as fine as the dot count allows. Any dots left over are hidden.
    const cellsFor = (g) => {
      let c = 0;
      for (let gy = 0; gy < g; gy++) {
        for (let gx = 0; gx < g; gx++) {
          if (Math.hypot(((gx + 0.5) / g) * 2 - 1, ((gy + 0.5) / g) * 2 - 1) <= 1) c++;
        }
      }
      return c;
    };
    let g = 4;
    while (cellsFor(g + 1) <= n) g++;
    const cells = [];
    for (let gy = 0; gy < g; gy++) {
      for (let gx = 0; gx < g; gx++) {
        const cx = ((gx + 0.5) / g) * 2 - 1;
        const cy = 1 - ((gy + 0.5) / g) * 2;
        if (Math.hypot(cx, cy) <= 1) cells.push([cx, cy]);
      }
    }
    this.gn = g; // cells across the grid
    this.gx = new Float32Array(n);
    this.gy = new Float32Array(n);
    this.gOn = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const cell = cells[i % cells.length];
      this.gx[i] = cell[0];
      this.gy[i] = cell[1];
      this.gOn[i] = i < cells.length ? 1 : 0;
    }

    this.resize(this.size);
    this.settled = false;
  }

  resize(px) {
    this.size = px;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(px * dpr);
    this.canvas.height = Math.round(px * dpr);
    this.canvas.style.width = `${px}px`;
    this.canvas.style.height = `${px}px`;
    this.dpr = dpr;
    this.settled = false;
  }

  setState(state, t = 0) {
    if (state === this.state) return;
    this.prev = this.state;
    this.state = state;
    this.enter = t;
    this.settled = false;
    if (reduced.matches) {
      this.snap(t + 3.8);
      this.t = 0;
      this.draw();
    }
  }

  // Where dot i wants to be in `state` at time t. Writes into this.tar.
  target(state, i, t, tin) {
    const o = this.tar;
    const n = this.n;
    const sx = this.sph[i * 3];
    const sy = this.sph[i * 3 + 1];
    const sz = this.sph[i * 3 + 2];

    // Ball states share a turning, tilted sphere. The spin eases faster and
    // slower and the tilt drifts a little, so it never repeats exactly.
    const ball = (spin, radius, size, alpha) => {
      const a = spin * (t + 1.25 * Math.sin(0.4 * t));
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const x = sx * ca + sz * sa;
      const z = -sx * sa + sz * ca;
      const tilt = 0.4 + 0.07 * Math.sin(t * 0.27);
      const y2 = sy * Math.cos(tilt) - z * Math.sin(tilt);
      const z2 = sy * Math.sin(tilt) + z * Math.cos(tilt);
      o[0] = x * radius;
      o[1] = y2 * radius;
      o[2] = z2;
      o[3] = size;
      o[4] = alpha;
      return [x, y2, z2];
    };

    switch (state) {
      case "sphere": {
        ball(0.25, 0.9 * (1 + 0.025 * Math.sin(t * 1.2)), 1, 0.9);
        break;
      }
      case "swell": {
        // A lumpy ball: the surface swells and sinks as waves roll over it.
        const wave = 0.6 * Math.sin(sy * 3 + t * 2.2) + 0.4 * Math.sin(Math.atan2(sz, sx) * 2 - t * 1.6) * (1 - sy * sy);
        ball(0.7, 0.8 * (1 + 0.16 * wave), 1.1 + 0.3 * wave, 0.95);
        break;
      }
      case "sweep": {
        // A ball with one soft arc on its near side. The arc is a full circle
        // round the ball, so its far half is left unlit: only one arc is seen.
        const [x, y, z] = ball(0.3, 0.88, 0.85, 0.5);
        // Each pass eases in, glides across and eases out, then the ball rests
        // for a moment before the next. The arc leans a different way each pass.
        const L = 3.8;
        const pass = Math.floor(t / L);
        const p = Math.min(1, (t / L - pass) / 0.74);
        const a = -Math.PI / 2 + Math.PI * (0.5 - 0.5 * Math.cos(Math.PI * p));
        const lean = 0.32 * Math.sin(pass * 2.4 + 1);
        const nx = Math.cos(a) * Math.cos(lean);
        const ny = Math.sin(lean);
        const nz = Math.sin(a) * Math.cos(lean);
        const side = x * nx + y * ny + z * nz;
        const near = Math.min(1, Math.max(0, (z + 0.05) / 0.5));
        const hit = Math.exp(-Math.pow(side / (2.1 * (Math.PI / this.rows)), 2)) * near * near * (3 - 2 * near);
        // Pull the lit dots onto the arc's plane, so its edge is a clean curve
        // whichever dots of the lattice happen to fall inside it.
        const pull = 0.6 * hit;
        o[0] -= pull * side * nx * 0.88;
        o[1] -= pull * side * ny * 0.88;
        o[2] -= pull * side * nz;
        o[3] = 0.85 + 0.75 * hit;
        o[4] = 0.5 + 0.5 * hit;
        break;
      }
      case "halftone": {
        // The dots stay on a square grid; what moves is their size. Six small
        // blobs of larger dots wander round the grid on their own orbits, so the
        // pattern is mostly several separate parts that meet, merge and part.
        const x = this.gx[i];
        const y = this.gy[i];
        const slow = t * 0.6; // the blobs' clock, slower than the orbits were tuned at
        let f = 0;
        for (const [ax, ay, fx, fy, px, py, r, amp] of BLOBS) {
          const dx = x - ax * Math.sin(fx * slow + px);
          const dy = y - ay * Math.cos(fy * slow + py);
          f += amp * Math.exp(-(dx * dx + dy * dy) / (2 * r * r));
        }
        f = Math.min(1, f);
        // A square grid cut to a circle has a stepped edge, with long straight
        // runs at the sides. Fading every dot's size and brightness toward the
        // rim makes the visible edge follow a true circle instead of the steps.
        const edge = Math.min(1, Math.max(0, (Math.hypot(x, y) - 0.74) / 0.28));
        const rim = edge * edge * (3 - 2 * edge);
        o[0] = x * 0.96;
        o[1] = y * 0.96;
        o[2] = 0.7;
        o[3] = this.gOn[i] ? (0.3 + 1.45 * Math.pow(f, 1.3)) * (1 - 0.8 * rim) : 0;
        o[4] = this.gOn[i] ? (0.3 + 0.7 * f) * (1 - 0.75 * rim) : 0;
        break;
      }
      case "converge":
      case "ripple": {
        const out = state === "ripple";
        if (out) {
          // Speaking, as water. The ball is a still surface; each word lands as a
          // drop at its own spot, a ring ripple spreads outward from it across
          // the surface and fades, and drops overlap, so the rings cross and
          // pass through one another. The surface rises under a crest, which
          // swells the dots and lights them, and sinks under a trough.
          const [x, y, z] = ball(0.12, 0.8, 0.95, 0.62);
          const first = Math.floor(t / 0.72);
          let lift = 0;
          let glow = 0;
          for (let e = Math.max(0, first - 8); e <= first + 3; e++) {
            const d = dropAt(e);
            const age = t - d.time;
            if (age < 0 || age > DROP_LIFE) continue;
            const ang = Math.acos(Math.min(1, Math.max(-1, x * d.x + y * d.y + z * d.z))); // distance from the drop over the surface
            const front = d.speed * age;
            const life = Math.exp(-age / 1.7) * (1 - Math.pow(age / DROP_LIFE, 4));
            const ring = Math.exp(-Math.pow((ang - front) / (0.26 + 0.14 * front), 2)); // the crest, a little wider as it spreads
            const wave = Math.cos(7 * (ang - front)) * ring; // crest and trough
            const splash = Math.exp(-ang * ang / 0.05) * Math.exp(-age / 0.35); // the dent and bounce where it lands
            lift += d.str * life * (0.1 * wave + 0.12 * splash * Math.cos(9 * age));
            glow += d.str * life * (1.3 * Math.max(0, wave) * ring + 0.8 * splash);
          }
          const gl = Math.min(1, glow);
          const r = 0.8 * (1 + lift);
          o[0] = x * r;
          o[1] = y * r;
          o[3] = 0.9 + 1.1 * gl;
          o[4] = 0.45 + 0.55 * gl;
          break;
        }
        // Listening, on a flat round disc: the ripple turned inside out. Each
        // word the person says is a ring that gathers at the rim, then is drawn
        // in: it starts slowly and quickens as it closes on the centre, narrowing
        // and brightening as it focuses, and leaves a faint wake behind it. It
        // lands as a soft pulse, with a small rebound that eases back out, and
        // the disc settles. Words overlap and cross, as the drops do. Nothing is
        // regular: each ring comes from its own side, so it is brighter there,
        // has its own pace, width and strength, and its front is a little out of
        // round; the gaps between words are uneven; and between words the disc
        // is never dead, it breathes very slowly.
        const rho = this.pr[i];
        const th = this.pth[i] + (this.pk[i] % 2 ? 1 : -1) * 0.01 * t; // alternate rings drift a hair, opposite ways
        const first = Math.floor(t / 0.95);
        const soft = (lo, hi, v) => {
          const x = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
          return x * x * (3 - 2 * x);
        };
        let lit = 0.05 + 0.04 * Math.sin(0.5 * t - rho * 3 + th * 0.5); // the slow resting breath, a ripple of its own
        let push = 0; // how far the ring is drawing dots inward here
        for (let e = Math.max(0, first - 8); e <= first + 3; e++) {
          const w = wordAt(e);
          const age = t - w.time;
          if (age < 0 || age > WORD_LIFE) continue;
          const reach = 1.25 / w.speed; // seconds for the ring to be drawn all the way in
          const fade = 1 - Math.pow(age / WORD_LIFE, 4);
          const d = Math.atan2(Math.sin(th - w.from), Math.cos(th - w.from)); // angle away from the side it came from
          const side = 0.3 + 0.7 * Math.exp(-(d * d) / 2.2); // brighter on the side it came from, a wide arc
          if (age < reach) {
            const u = age / reach; // how far through its journey
            const drawn = u * u * (1.55 - 0.55 * u); // slow to start, quickening: being drawn in
            const front = 1.04 * (1 - drawn) + 0.04 * Math.sin(3 * th + e * 1.7 + 0.8 * age); // radius of the ring, a little out of round
            const f = Math.min(1, Math.max(0, front));
            const gather = soft(0, 0.22, u); // it builds at the rim, it does not just appear
            const sharp = w.width * (0.55 + 0.75 * f) + 0.015; // narrower as it focuses
            const dr = rho - front;
            const body = Math.exp(-Math.pow(dr / sharp, 2)); // the ring itself, sharp
            const wake = dr > 0 ? 0.32 * Math.exp(-dr / 0.16) * Math.exp(-Math.pow(dr / 0.5, 2)) : 0; // a faint trail left behind, outside it
            const near = 0.25 + 0.95 * (1 - f); // faint at the rim, brightening as it closes in
            lit += w.str * fade * gather * (body + wake) * side * near;
            push += w.str * fade * gather * body;
          } else {
            // It has arrived. The centre takes it in and glows, and a small
            // rebound eases back out, damped, like something that has landed.
            const since = age - reach;
            const land = soft(0, 0.12, since); // the glow swells in over a moment, not instantly
            const glow = Math.exp(-since / 0.6) * Math.exp(-rho * rho / 0.03) * 0.8 * land;
            const echoR = 0.26 * (1 - Math.exp(-since / 0.45)); // the rebound spreads and slows
            const echo = 0.3 * Math.exp(-since / 0.55) * soft(0.05, 0.25, since) * Math.exp(-Math.pow((rho - echoR) / 0.07, 2));
            lit += w.str * fade * (glow + echo);
          }
        }
        lit = Math.min(1, lit);
        // The dots lean inward a touch under the ring: they are being drawn in.
        const pull = 1 - 0.05 * Math.min(1, push);
        // As in halftone, fade toward the rim so the edge reads as a circle.
        const edge = Math.min(1, Math.max(0, (rho - 0.74) / 0.28));
        const rim = edge * edge * (3 - 2 * edge);
        // A dot never grows past a share of the gap to its neighbours, so the
        // tight rings at the centre keep clear space between them.
        const half = (this.size / 2) * 0.97;
        const spacing = (half * 0.96) / this.pnr; // pixels between rings
        const baseCss = Math.max(0.9, this.size * 0.0042 + 0.5);
        const roomy = (0.36 * spacing) / (baseCss * 1.06);
        const want = (0.9 + 1.0 * Math.pow(lit, 1.0)) * (1 - 0.6 * rim) * (0.94 + 0.12 * hash(i + 71));
        o[0] = Math.cos(th) * rho * pull * 0.96;
        o[1] = Math.sin(th) * rho * pull * 0.96;
        o[2] = 0.7;
        o[3] = this.pOn[i] ? Math.min(want, Math.max(0.45, roomy)) : 0;
        o[4] = this.pOn[i] ? (0.55 + 0.45 * lit) * (1 - 0.55 * rim) : 0;
        break;
      }
      case "check": {
        // The result. It arrives like a pen stroke: the faint circle gathers,
        // then the check is drawn on, a bright pen at its tip, and lands with a
        // small bounce. After that it stays quietly alive: now and then a glint
        // glides along the stroke, a faint ring of light spreads out to the
        // circle, and the circle's dots twinkle while the ring turns and breathes
        // very slowly. All of it small, and none of it on a beat.
        const gather = Math.min(1, Math.max(0, tin / 0.6));
        const settle = Math.min(1, Math.max(0, (tin - 1.3) / 1.0)); // the idle life fades in once it has landed
        // Light spreading out from the check: once as it lands, then now and then.
        const wave = (r) => {
          if (reduced.matches) return 0; // a still pose has no light mid-flight
          let v = 0;
          if (tin < 12) {
            const age = tin - 1.2;
            if (age > 0) v += 0.55 * Math.exp(-age / 0.9) * Math.exp(-Math.pow((r - 1.0 * (1 - Math.exp(-age / 0.6))) / 0.13, 2));
          }
          const first = Math.floor(t / 8.6);
          for (let e = Math.max(0, first - 2); e <= first + 1; e++) {
            const m = echoAt(e);
            const age = t - m.time;
            if (age < 0 || age > 3) continue;
            v += settle * m.str * 0.8 * Math.exp(-age / 1.2) * Math.exp(-Math.pow((r - 1.0 * (1 - Math.exp(-age / 0.8))) / 0.13, 2));
          }
          return v;
        };
        if (i % 3 === 0) {
          // The circle: dots that twinkle one by one, a ring that turns and breathes.
          const own = hash(i + 3);
          const a = own * TAU + 0.025 * t;
          const r = (0.92 + (hash(i + 17) - 0.5) * 0.07) * (1 + 0.012 * Math.sin(0.5 * t + own * 6));
          const tw = 0.5 + 0.5 * Math.sin(t * (0.5 + 0.9 * hash(i + 41)) + hash(i + 43) * TAU);
          o[0] = Math.cos(a) * r;
          o[1] = Math.sin(a) * r;
          o[2] = 0.8;
          o[3] = (0.52 + 0.3 * tw * settle) * gather * (1 + 0.6 * wave(r));
          o[4] = (0.34 + 0.3 * tw * settle + 0.26 * wave(r)) * gather;
          break;
        }
        const gn = Math.ceil((n * 2) / 3);
        const j = i - Math.floor(i / 3) - 1;
        const A = [-0.46, 0.02];
        const B = [-0.14, -0.3];
        const C = [0.5, 0.34];
        const l1 = Math.hypot(B[0] - A[0], B[1] - A[1]);
        const l2 = Math.hypot(C[0] - B[0], C[1] - B[1]);
        const w = ((j + 0.5) / gn) * (l1 + l2);
        const u = w / (l1 + l2); // how far along the stroke this dot is, 0 to 1
        const [p, q, v] = w < l1 ? [A, B, w / l1] : [B, C, (w - l1) / l2];
        // The pen: it eases out as it goes, so the stroke slows into the end.
        const k = Math.min(1, Math.max(0, (tin - 0.35) / 0.95));
        const pen = 1 - Math.pow(1 - k, 2.2);
        const shown = Math.min(1, Math.max(0, (pen * 1.06 - u) / 0.06));
        const head = pen < 1 ? Math.exp(-Math.pow((u - pen) / 0.05, 2)) : 0; // the bright tip of the pen
        // A small bounce as it lands, outward from the middle of the mark.
        const since = tin - 1.3;
        const bounce = since > 0 ? 0.06 * Math.sin(since * 13) * Math.exp(-since * 4.5) : 0;
        let x = p[0] + (q[0] - p[0]) * v;
        let y = p[1] + (q[1] - p[1]) * v;
        x += (x - 0.02) * bounce;
        y += (y + 0.02) * bounce;
        const sx = w < l1 ? (B[0] - A[0]) / l1 : (C[0] - B[0]) / l2;
        const sy = w < l1 ? (B[1] - A[1]) / l1 : (C[1] - B[1]) / l2;
        // The glint: a soft highlight gliding along the stroke, now and then.
        let glint = 0;
        const first = Math.floor(t / 4.4);
        for (let e = Math.max(0, first - 2); e <= first + 2 && !reduced.matches; e++) {
          const m = glintAt(e);
          const age = (t - m.time) / m.dur;
          if (age < 0 || age > 1) continue;
          const at = -0.15 + 1.3 * (age * age * (3 - 2 * age)); // eased, so it gathers speed and then slows
          glint += settle * m.str * Math.exp(-Math.pow((u - at) / 0.12, 2)) * Math.sin(Math.PI * age);
        }
        // Under the glint the stroke swells: its dots fan out across it, so the
        // highlight is a thicker, brighter patch gliding along a calmer line.
        const fan = (hash(i + 81) - 0.5) * 0.03 * Math.min(1, glint * 1.6);
        x += -sy * fan;
        y += sx * fan;
        const breathe = 1 + 0.012 * Math.sin(0.6 * t) * settle;
        o[0] = x * breathe;
        o[1] = y * breathe;
        o[2] = 0.8;
        o[3] = (0.9 + 0.85 * head + 0.6 * glint + 0.4 * wave(Math.hypot(x, y))) * shown;
        o[4] = Math.min(1, (0.7 + 0.3 * head + 0.35 * glint + 0.25 * wave(Math.hypot(x, y))) * shown);
        break;
      }
      case "tremor": {
        // A light earthquake on a flat round disc of dots in straight rows, the kind of sudden alert you
        // feel through a table. One quick shock shudders the whole disc sideways
        // and dies away; a seismic wave runs across it from a spot inside, so the
        // dots on the wave front shake most; then smaller aftershocks follow at
        // irregular moments, each from its own spot and each weaker than the
        // last, with only a faint hum in between. It is all small, a few pixels,
        // and the dots keep their brightness: it is a vibration, not a flash.
        // The dots sit on a square grid, in straight horizontal rows, cut to a disc.
        const gx0 = this.gx[i];
        const gy0 = this.gy[i];
        const rho = Math.hypot(gx0, gy0);
        let shakeX = 0;
        let shakeY = 0;
        let wave = 0;
        const quake = (age, str, freq, decay, ex, ey, speed) => {
          if (age < 0 || age > 5) return;
          const env = str * (1 - Math.exp(-age / 0.05)) * Math.exp(-age / decay);
          const d = Math.hypot(gx0 - ex, gy0 - ey); // distance from the spot it started
          const front = Math.exp(-Math.pow((d - speed * age) / 0.5, 2)); // the wave front
          const local = 0.4 + 0.6 * front;
          const ph = TAU * freq * age - 6 * d - 2.5 * gx0 - 5 * gy0 + 5 * hash(i + 91) * 0.12; // each row slides a little out of step with the next
          shakeX += env * local * Math.sin(ph);
          shakeY += env * local * 0.42 * Math.sin(ph * 1.07 + 1.3);
          wave += env * front;
        };
        const still = reduced.matches;
        if (!still) {
          quake(tin - 1.4, 1.0, 9, 0.8, 0.42, 0.2, 1.7); // the first, the strongest, once the disc has formed
          const first = Math.max(0, Math.floor((t - 0.55) / 2.3));
          for (let e = Math.max(0, first - 3); e <= first + 2; e++) {
            const m = shockAt(e);
            if (m.time < 2.4) continue;
            quake(t - m.time, m.str, m.freq, m.decay, m.x, m.y, 1.5);
          }
        }
        // The hum: a very faint tremor that never quite stops.
        const hum = still ? 0 : 0.045 * (0.6 + 0.4 * Math.sin(0.8 * t)) * Math.sin(TAU * 6.3 * t + 5 * hash(i + 95));
        const edge = Math.min(1, Math.max(0, (rho - 0.74) / 0.28));
        const rim = edge * edge * (3 - 2 * edge);
        const half = (this.size / 2) * 0.97;
        const spacing = (half * 0.96 * 2) / this.gn; // pixels between neighbouring dots
        const baseCss = Math.max(0.9, this.size * 0.0042 + 0.5);
        const roomy = (0.36 * spacing) / (baseCss * 1.06);
        const amp = 0.028; // the strongest shake, as a share of the disc's radius
        const gx = still ? 0 : 0.0085 * shakeX; // the whole disc shudders too, a little, as one piece
        o[0] = gx0 * 0.96 + amp * (shakeX + hum) + gx;
        o[1] = gy0 * 0.96 + amp * (shakeY + 0.5 * hum);
        o[2] = 0.7;
        const want = (1.05 + 0.2 * Math.min(1, Math.abs(wave))) * (1 - 0.6 * rim) * (0.94 + 0.12 * hash(i + 71));
        o[3] = this.gOn[i] ? Math.min(want, Math.max(0.45, roomy)) : 0;
        o[4] = this.gOn[i] ? 0.8 * (1 - 0.55 * rim) : 0;
        break;
      }
    }
  }

  // Move every dot toward where it wants to be. Each dot has its own pace and
  // its own small delay, so a change of state ripples instead of cutting.
  step(t, dt) {
    const n = this.n;
    const cur = this.cur;
    const vel = this.vel;
    const tin = t - this.enter;
    let moving = false;
    // While the shape changes each dot moves on a spring, so it overshoots a
    // touch and settles, and the change starts at the middle and spreads
    // outward. Once the change is over every dot tracks its target tightly and
    // at the same pace; dots at different paces would trail a moving target by
    // different amounts and the lattice would look ragged.
    // The tremor needs a stiff spring almost from the start, or the spring would
    // smooth its quick shaking away; the others take longer to firm up.
    const settle = this.state === "tremor" ? Math.min(1, Math.max(0, (tin - 0.55) / 0.7)) : Math.min(1, Math.max(0, (tin - 1.1) / 0.9));
    const lock = settle * settle * (3 - 2 * settle);
    for (let i = 0; i < n; i++) {
      const wait = 0.42 * this.rad[i] + 0.08 * hash(i + 40);
      const use = tin < wait ? this.prev : this.state;
      this.target(use, i, t, use === this.state ? tin : tin + 9);
      const o = i * 5;
      const w0 = 6 + 4 * hash(i + 7);
      const w = w0 + (80 - w0) * lock;
      const zeta = 0.62 + 0.38 * lock;
      const steps = Math.ceil((dt * w) / 0.35);
      const h = dt / steps;
      for (let c = 0; c < 3; c++) {
        let x = cur[o + c];
        let v = vel[i * 3 + c];
        for (let s = 0; s < steps; s++) {
          v += (w * w * (this.tar[c] - x) - 2 * zeta * w * v) * h;
          x += v * h;
        }
        cur[o + c] = x;
        vel[i * 3 + c] = v;
        if (Math.abs(this.tar[c] - x) > 0.002) moving = true;
      }
      // Size and brightness come up quickly and die away slowly, so whatever
      // is lit leaves a short glow behind it.
      for (let c = 3; c < 5; c++) {
        const d = this.tar[c] - cur[o + c];
        const quick = 5 + 9 * hash(i + 7);
        const rate = d >= 0 ? quick + (30 - quick) * lock : quick + (3.4 - quick) * lock;
        cur[o + c] += d * (1 - Math.exp(-dt * rate));
        if (Math.abs(d) > 0.002) moving = true;
      }
    }
    this.t = t;
    return moving;
  }

  snap(t) {
    this.t = t;
    const tin = t - this.enter;
    for (let i = 0; i < this.n; i++) {
      this.target(this.state, i, t, tin);
      for (let c = 0; c < 5; c++) this.cur[i * 5 + c] = this.tar[c];
    }
    this.vel.fill(0);
  }

  draw() {
    const { ctx, canvas, cur, n, dpr } = this;
    const px = this.size * dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const drift = 0.12 * Math.sin(this.t * 0.5);
    const half = px / 2;
    // Dot size scales with the orb, with a floor so tiny orbs stay legible.
    const base = Math.max(0.9 * dpr, px * 0.0042 + 0.5 * dpr);
    for (let i = 0; i < n; i++) {
      const o = i * 5;
      const z = cur[o + 2];
      const depth = 0.5 + 0.5 * Math.max(-1, Math.min(1, z));
      const x = half + cur[o] * half * 0.97;
      const y = half - cur[o + 1] * half * 0.97;
      const rad = Math.max(0.3, base * cur[o + 3] * (0.55 + 0.6 * depth));
      const a = Math.max(0, Math.min(1, cur[o + 4])) * (0.3 + 0.7 * depth);
      // Blue at the top left, pink at the bottom right.
      const shade = SHADES[Math.round(Math.max(0, Math.min(1, 0.5 + 0.34 * (cur[o] - cur[o + 1]) + drift)) * 63)];
      ctx.fillStyle = `rgba(${shade[0]},${shade[1]},${shade[2]},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, TAU);
      ctx.fill();
    }
  }
}

const orbs = [];
let last = 0;
let running = false;

function frame(now) {
  const t = now / 1000;
  const dt = Math.min(0.05, last ? t - last : 0.016);
  last = t;
  let any = false;
  for (const orb of orbs) {
    if (!orb.visible) continue;
    orb.step(t, dt);
    orb.draw();
    any = true;
  }
  if (any && !reduced.matches) requestAnimationFrame(frame);
  else running = false;
}

function start() {
  if (running || reduced.matches) return;
  running = true;
  last = 0;
  requestAnimationFrame(frame);
}

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const orb = e.target.__orb;
    if (orb) orb.visible = e.isIntersecting;
  }
  start();
});

export function mountOrb(host, state = host.dataset.state || "sphere") {
  const orb = new Orb(host, state);
  host.__orb = orb;
  orbs.push(orb);
  io.observe(host);
  orb.enter = performance.now() / 1000 - 10;
  orb.snap(performance.now() / 1000);
  orb.draw();
  start();
  return {
    el: host,
    orb,
    set(s) {
      orb.setState(s, performance.now() / 1000);
      start();
    },
    resize(px) {
      orb.resize(px);
      orb.snap(performance.now() / 1000);
      orb.draw();
    },
  };
}

reduced.addEventListener("change", start);
