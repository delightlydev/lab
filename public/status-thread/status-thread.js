// <lab-mark> -- a status indicator made of one thread that changes shape.
// One file, no dependencies. Drawn as SVG, so it is crisp at any size.
//
//   <script type="module" src="status-thread.js"></script>
//   <lab-mark state="working" size="20"></lab-mark>
//
// state:  idle | voice | thinking | working | done | failed   (default idle)
// size:   pixels, default 24. 20 and up reads best.
// label:  accessible name, defaults to the state ("Working"). label="" hides it.
// level:  0 to 1, how loud the voice is. Only used by state="voice". Leave it off
//         and the mark plays a simulated speech pattern; set it from a real
//         audio meter and the ring follows your voice.
//
// Each state has its own shape, so it reads without colour:
//   idle      a ring, resting and breathing slowly
//   voice     the same ring, swelling and rippling with a voice
//   thinking  a wave travelling along the thread
//   working   an open arc chasing round the ring
//   done      the thread draws itself into a check
//   failed    the thread breaks into a cross, and shakes once
//
// Changing state morphs one shape into the next. It stops updating when it is
// off screen or settled, and holds a still pose for reduced-motion users.

const TAU = Math.PI * 2;
const POINTS = 128;
const HALF = POINTS / 2;
const NS = "http://www.w3.org/2000/svg";

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Walk a polyline at an even pace; t is 0..1 along its length.
function along(path, t) {
  const lengths = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  let at = t * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (at <= lengths[i] || i === lengths.length - 1) {
      const k = clamp(at / lengths[i]);
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k, 0];
    }
    at -= lengths[i];
  }
}

const CHECK = [[-0.55, 0.02], [-0.21, 0.37], [0.59, -0.42]];

// Every shape answers: where is point i, given the two moving phases?
const SHAPES = {
  // Starts at the left and goes over the top, so it unrolls into the wave.
  idle: (i) => {
    const a = Math.PI + (i / (POINTS - 1)) * TAU;
    return [0.58 * Math.cos(a), 0.58 * Math.sin(a), 0];
  },

  // The idle ring, alive: it swells with the voice and a ripple runs round it.
  // A bloom: the ring grows lobes as the voice gets louder, like a flower
  // opening and closing. The lobes slowly turn and the whole ring leans.
  voice: (i, wave, _coil, { level, kick, lean }) => {
    const a = Math.PI + (i / (POINTS - 1)) * TAU;
    const open = Math.min(1, level * 1.1 + kick * 0.5);
    const lobes = 0.075 * open * Math.sin(3 * a + wave * 0.9) + 0.03 * open * Math.sin(5 * a - wave * 1.4);
    const r = 0.5 * (1 + 0.12 * level + 0.1 * kick) + lobes;
    return [r * Math.cos(a) * (1 - 0.14 * lean), r * Math.sin(a), 0];
  },

  thinking: (i, wave) => {
    const u = i / (POINTS - 1);
    return [(u - 0.5) * 1.7, 0.4 * Math.sin(Math.PI * u) ** 0.7 * Math.sin(TAU * 1.5 * u - wave), 0];
  },

  // An open arc chasing round the ring, its tail stretching and shrinking.
  // Few moving parts, so it stays clear even at 16px.
  working: (i, wave, coil) => {
    const sweep = TAU * (0.5 + 0.17 * Math.sin(wave * 0.7));
    const a = coil + (i / (POINTS - 1)) * sweep;
    return [0.58 * Math.cos(a), 0.58 * Math.sin(a), 0];
  },

  done: (i) => along(CHECK, i / (POINTS - 1)),

  // Two strokes: the first half is one diagonal, the second half the other.
  failed: (i) => {
    const t = (i % HALF) / (HALF - 1);
    return i < HALF ? [-0.41 + 0.82 * t, -0.41 + 0.82 * t, 0] : [0.41 - 0.82 * t, -0.41 + 0.82 * t, 0];
  },
};

const LOOK = {
  idle: { rgb: [158, 158, 168] },
  voice: { rgb: [122, 224, 214] },
  thinking: { rgb: [168, 178, 255] },
  working: { rgb: [244, 246, 252] },
  done: { rgb: [200, 226, 106] },
  failed: { rgb: [255, 128, 108] },
};
const NAMES = Object.keys(LOOK);
// How shapes move into each other. Most settle smoothly; failed lands with a
// springy overshoot, like something snapping into place.
const SPRING = { failed: { omega: 19, damping: 0.55 }, other: { omega: 14, damping: 1 } };
const LABELS = { idle: "Idle", voice: "Voice", thinking: "Thinking", working: "Working", done: "Done", failed: "Failed" };

const STYLE = `
:host { display: inline-block; vertical-align: middle; line-height: 0; }
svg { display: block; overflow: visible; }
path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.resting g { transform-box: fill-box; transform-origin: center; animation: breathe 3.6s ease-in-out infinite; }
@keyframes breathe { 50% { transform: scale(1.07); opacity: 0.72; } }
@media (prefers-reduced-motion: reduce) { .resting g { animation: none; } }
`;

// Bursts of syllables with a pause between phrases; stands in for a voice.
const SYLLABLES = [
  [0.1, 0.23, 0.75], [0.35, 0.22, 1], [0.6, 0.28, 0.65],
  [1.2, 0.2, 0.85], [1.45, 0.3, 0.7],
  [2.1, 0.22, 0.9], [2.35, 0.2, 1], [2.58, 0.26, 0.6], [2.9, 0.3, 0.8],
];
function speech(time) {
  const phrase = time % 3.8;
  let level = 0;
  for (const [at, length, weight] of SYLLABLES) {
    const v = (phrase - at) / length;
    if (v > 0 && v < 1) level += Math.sin(v * Math.PI) ** 2 * weight;
  }
  return Math.min(1, level);
}

// One animation loop shared by every mark on the page.
const live = new Set();
let running = false;
let last = 0;
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const mark of live) mark.step(dt);
  if (live.size) requestAnimationFrame(tick);
  else running = false;
}
function start() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(tick);
}

class LabMark extends HTMLElement {
  static observedAttributes = ["state", "size", "label", "level"];

  constructor() {
    super();
    this.svg = document.createElementNS(NS, "svg");
    this.svg.setAttribute("viewBox", "0 0 100 100");
    this.svg.setAttribute("aria-hidden", "true");
    const group = (this.group = document.createElementNS(NS, "g"));
    // Every shape is drawn as one flat path.
    this.flat = group.appendChild(document.createElementNS(NS, "path"));
    this.svg.append(group);
    this.attachShadow({ mode: "open" }).append(Object.assign(document.createElement("style"), { textContent: STYLE }), this.svg);

    this.size = 24;
    this.wave = 0;
    this.coil = 0;
    this.since = 10; // seconds in the current state
    this.clock = 0; // runs while the voice is on, to drive the simulated speech
    this.level = 0; // smoothed voice level, 0 to 1
    this.kick = 0; // springy shove on each syllable
    this.kickSpeed = 0;
    this.lean = 0; // 0 to 1, how far the ring is squeezed as it leans
    this.leanClock = 0;
    this.dirty = true;
    this.visible = true;
    // How much of each shape is showing. Always adds up to 1.
    this.weights = Object.fromEntries(NAMES.map((n) => [n, n === "idle" ? 1 : 0]));
    this.speeds = Object.fromEntries(NAMES.map((n) => [n, 0]));
  }

  get current() {
    const state = this.getAttribute("state");
    return state in LOOK ? state : "idle";
  }

  connectedCallback() {
    this.sync();
    // Start on the right shape instead of morphing in from idle.
    for (const n of NAMES) {
      this.weights[n] = n === this.current ? 1 : 0;
      this.speeds[n] = 0;
    }
    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.dirty = true;
    });
    this.observer.observe(this);
    live.add(this);
    start();
  }

  disconnectedCallback() {
    live.delete(this);
    this.observer?.disconnect();
  }

  attributeChangedCallback(name) {
    if (name === "state") this.since = 0;
    this.sync();
  }

  sync() {
    // An empty label marks it as decoration, for when the text beside it says it all.
    const decorative = this.getAttribute("label") === "";
    this.setAttribute("role", decorative ? "presentation" : "img");
    if (decorative) this.removeAttribute("aria-label");
    else this.setAttribute("aria-label", this.getAttribute("label") || LABELS[this.current]);
    this.size = Number(this.getAttribute("size")) || 24;
    this.svg.setAttribute("width", this.size);
    this.svg.setAttribute("height", this.size);
    this.svg.classList.toggle("resting", this.current === "idle");
    this.dirty = true;
  }

  step(dt) {
    const motion = !reduceMotion.matches;
    let moving = false;
    if (motion) {
      // A spring per shape. Each one chases its goal, so they still add up to 1.
      const { omega, damping } = SPRING[this.current === "failed" ? "failed" : "other"];
      const slices = Math.max(1, Math.ceil(dt * 240));
      const h = dt / slices;
      for (const n of NAMES) {
        const goal = n === this.current ? 1 : 0;
        for (let i = 0; i < slices; i++) {
          this.speeds[n] += (omega * omega * (goal - this.weights[n]) - 2 * damping * omega * this.speeds[n]) * h;
          this.weights[n] += this.speeds[n] * h;
        }
        if (Math.abs(this.weights[n] - goal) > 0.002 || Math.abs(this.speeds[n]) > 0.01) moving = true;
        else {
          this.weights[n] = goal;
          this.speeds[n] = 0;
        }
      }
    } else {
      // Reduced motion: no overshoot, just a quick fade between shapes.
      const ease = 1 - Math.exp(-dt / 0.12);
      for (const n of NAMES) {
        const goal = n === this.current ? 1 : 0;
        const next = this.weights[n] + (goal - this.weights[n]) * ease;
        if (Math.abs(next - goal) > 0.002) moving = true;
        this.weights[n] = Math.abs(next - goal) <= 0.002 ? goal : next;
      }
    }
    this.since += dt;

    // The voice level: from the level attribute if there is one, else simulated.
    // It rises fast and falls slowly, like a real meter.
    const voiced = this.current === "voice" || this.weights.voice > 0.01;
    if (voiced) {
      if (motion) this.clock += dt;
      const given = this.getAttribute("level");
      const target = given !== null ? clamp(Number(given) || 0) : motion ? speech(this.clock) : 0.35;
      const before = this.level;
      this.level += (target - this.level) * (1 - Math.exp(-dt / (target > this.level ? 0.04 : 0.18)));
      // A new syllable is a sudden rise: launch a ripple from a spot that
      // alternates sides so the ring never looks like it repeats.
      if (motion && this.level - before > 0.035 && this.level > 0.25) this.kickSpeed += 9;
      this.leanClock += dt * (0.6 + this.level * 2.4);
      this.lean = 0.5 + 0.5 * Math.sin(this.leanClock);
    }
    // A springy shove on every syllable.
    this.kickSpeed += (-110 * this.kick - 9 * this.kickSpeed) * dt;
    this.kick += this.kickSpeed * dt;
    if (Math.abs(this.kick) > 0.002 || Math.abs(this.kickSpeed) > 0.01) this.dirty = true;

    const flowing = motion && ["thinking", "working", "voice"].includes(this.current);
    if (motion && (flowing || voiced || this.weights.thinking > 0.01 || this.weights.working > 0.01)) {
      this.wave += dt * 2.6;
      this.coil += dt * 5.2;
    }

    const busy = moving || flowing || this.since < 1;
    if (!busy && !this.dirty) return;
    this.dirty = false;
    if (this.visible) this.draw(motion);
  }

  draw(motion) {
    const { weights } = this;

    const popping = this.current === "done" && this.since < 0.35 && motion;
    const scale = popping ? 1 + 0.14 * Math.sin(Math.PI * (this.since / 0.35)) : 1;
    // A rejection: a few quick shakes and a small wobble that die away.
    const failing = this.current === "failed" && motion;
    const fade = Math.exp(-this.since * 5);
    const shake = failing ? Math.sin(this.since * 34) * fade * 8 : 0;
    const wobble = failing ? Math.sin(this.since * 34 + 1.2) * fade * 4 : 0;
    if (Math.abs(wobble) > 0.02) this.group.setAttribute("transform", `rotate(${wobble.toFixed(2)} 50 50)`);
    else this.group.removeAttribute("transform");
    const radius = 46 * scale;

    let rgb = [0, 0, 0];
    for (const n of NAMES) {
      const w = weights[n];
      if (!w) continue;
      rgb = rgb.map((c, k) => c + LOOK[n].rgb[k] * w);
    }
    // It lands bright and cools to its colour.
    if (failing) rgb = rgb.map((c) => c + (255 - c) * Math.exp(-this.since * 6) * 0.55);

    const points = [];
    for (let i = 0; i < POINTS; i++) {
      let x = 0, y = 0;
      for (const n of NAMES) {
        const w = weights[n];
        if (!w) continue;
        const p = SHAPES[n](i, this.wave, this.coil, this);
        x += p[0] * w;
        y += p[1] * w;
      }
      points.push([50 + shake + x * radius, 50 + y * radius]);
    }

    // The cross is two strokes, so drop the segment that joins them.
    const joined = weights.failed < 0.5;
    const pieces = [];
    for (let i = 1; i < POINTS; i++) {
      if (i === HALF && !joined) continue;
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      pieces.push({ d: `M${ax.toFixed(2)} ${ay.toFixed(2)}L${bx.toFixed(2)} ${by.toFixed(2)}` });
    }

    const base = Math.max(5.2, 150 / this.size);
    this.flat.setAttribute("d", pieces.map((q) => q.d).join(""));
    this.flat.setAttribute("stroke", `rgb(${rgb.map(Math.round).join(",")})`);
    this.flat.setAttribute("stroke-width", base.toFixed(2));
  }
}

if (!customElements.get("lab-mark")) customElements.define("lab-mark", LabMark);
