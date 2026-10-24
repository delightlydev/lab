// dot-orb -- a ball of dots on a canvas that reshapes itself for each state.
//
//   <span data-orb data-state="swell" data-size="36" data-n="90"></span>
//   orbs[i].setState("check")
//
// Each state is named for what the dots do:
//   sphere   a slowly turning ball
//   swell    a ball whose surface rises and sinks as waves roll over it
//   sweep    a faint ball with one bright arc circling it
//   scan     a flat disc of rows, one row lit at a time
//   trace    short lines written one after another, a pen dot leading
//   rings    concentric rings, breathing
//   lobes    the same rings, wobbling into five lobes
//   check    a faint circle with a thin check drawn inside
//   shake    a ball that shakes once as it arrives
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

export const STATES = ["sphere", "swell", "sweep", "scan", "trace", "rings", "lobes", "check", "shake"];

const hash = (i) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const frac = (v) => v - Math.floor(v);

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
    this.row = new Int16Array(n); // latitude row of each dot
    this.rowU = new Float32Array(n); // 0..1 along its row
    this.ring = new Int16Array(n); // concentric ring of each dot
    this.ringU = new Float32Array(n); // 0..1 around its ring
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
        this.row[idx] = b;
        this.rowU[idx] = (k + 0.5) / counts[b];
        this.rad[idx] = Math.hypot(this.sph[idx * 3], ys[b]);
      }
    }

    // Rings for the rings and lobes states: wider rings hold more dots.
    const rings = n < 150 ? 5 : 9;
    this.rings = rings;
    const rw = Array.from({ length: rings }, (_, k) => k + 1.5);
    const rs = rw.reduce((a, c) => a + c, 0);
    let ri = 0;
    for (let k = 0; k < rings; k++) {
      const c = k === rings - 1 ? n - ri : Math.round((rw[k] / rs) * n);
      for (let j = 0; j < c && ri < n; j++, ri++) {
        this.ring[ri] = k;
        this.ringU[ri] = (j + 0.5) / c;
      }
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
      this.snap(t + 0.8);
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
    const h = hash(i);

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

    const rows = this.rows;
    const row = this.row[i];
    const u = this.rowU[i];
    const rowY = ((rows - 1 - row + 0.5) / rows) * 2 - 1;

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
      case "scan": {
        // A flat disc of rows; one row at a time lights up.
        const chord = Math.sqrt(1 - rowY * rowY);
        o[0] = (u * 2 - 1) * chord * 0.92;
        o[1] = rowY * 0.92;
        o[2] = 0.7;
        const lit = Math.floor(t * 2.6) % rows;
        const on = rows - 1 - row === lit;
        o[3] = on ? 1.5 : 0.7;
        o[4] = on ? 1 : 0.28;
        break;
      }
      case "trace": {
        // A few short lines are written one after another; a pen dot leads.
        const lines = 5;
        const mid = Math.floor(rows / 2);
        const gap = Math.max(1, Math.round(rows / 8));
        const line = Math.round((rows - 1 - row - (mid - Math.floor(lines / 2) * gap)) / gap);
        const isLine = line >= 0 && line < lines && (rows - 1 - row - (mid - Math.floor(lines / 2) * gap)) % gap === 0;
        o[0] = (u * 2 - 1) * 0.8;
        o[1] = rowY * 0.92;
        o[2] = 0.7;
        o[3] = 0.9;
        o[4] = 0;
        if (isLine) {
          const len = 0.55 + 0.45 * hash(line + 2);
          const p = frac(t * 0.16) * 1.25 * lines;
          const reach = p - line; // how far through this line the pen has got
          const x = u;
          const word = Math.sin(x * 22 + line * 2.1) > 0.8;
          const shown = x < len && x < reach * len && !word;
          const pen = x < len && Math.abs(x - reach * len) < 0.03 && reach > 0 && reach < 1;
          o[0] = (x * 1.5 - 0.75) * (0.55 + 0.45 * len) * 1.1;
          o[3] = pen ? 2.4 : 0.9;
          o[4] = pen ? 1 : shown ? 0.85 : 0;
        }
        break;
      }
      case "rings":
      case "lobes": {
        const k = this.ring[i];
        const rings = this.rings;
        const a = this.ringU[i] * TAU + k * 1.1;
        const lobed = state === "lobes";
        let r = 0.1 + (k / (rings - 1)) * 0.82;
        let size = 0.8 + (1 - k / rings) * 0.5;
        if (lobed) {
          const env = 0.6 + 0.4 * Math.sin(t * 2.3) * Math.sin(t * 1.3 + 1);
          const amp = (0.02 + 0.13 * (1 - k / rings)) * env;
          r *= 1 + amp * Math.sin(5 * a + t * 1.8 - k * 0.45);
        } else {
          r *= 1 + 0.02 * Math.sin(t * 2.4 - k * 0.7);
        }
        o[0] = Math.cos(a) * r;
        o[1] = Math.sin(a) * r;
        o[2] = 0.7;
        o[3] = size;
        o[4] = 0.4 + 0.6 * (1 - Math.abs(k / rings - 0.35));
        break;
      }
      case "check": {
        // A faint, uneven circle with a thin check drawn inside it.
        if (i % 3 === 0) {
          const a = hash(i + 3) * TAU;
          const r = 0.92 + (hash(i + 17) - 0.5) * 0.07;
          o[0] = Math.cos(a) * r;
          o[1] = Math.sin(a) * r;
          o[2] = 0.8;
          o[3] = 0.6;
          o[4] = 0.5;
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
        const [p, q, v] = w < l1 ? [A, B, w / l1] : [B, C, (w - l1) / l2];
        o[0] = p[0] + (q[0] - p[0]) * v;
        o[1] = p[1] + (q[1] - p[1]) * v;
        o[2] = 0.8;
        o[3] = 0.95;
        o[4] = 1;
        break;
      }
      case "shake": {
        // The ball again, with one hard shake as it arrives.
        const shake = 0.05 * Math.sin(tin * 45) * Math.exp(-tin * 3.5);
        ball(0.3, 0.9, 1, 0.9);
        o[0] += shake;
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
    const settle = Math.min(1, Math.max(0, (tin - 1.1) / 0.9));
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
