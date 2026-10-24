// A single closed 3D curve, spun, projected and drawn as short depth-shaded
// segments. Nearer segments are lighter and thicker, which is what makes a flat
// line read as a ribbon.

export type Vec3 = [number, number, number];

// Each shape is a spherical Lissajous curve:
//   p(t) = (sin(c t + m) cos(h t + x), sin(c t + m) sin(h t + x), cos(c t + m))
// [h, c, x, m]
export const SHAPES: Record<string, [number, number, number, number]> = {
  loop: [3, 1, 1.2, 3.8],
  coil: [3, 2, 2.4, 4.6],
  bow: [2, 1, 0.8, 4.2],
  slip: [1, 2, 0.4, 1],
  knot: [1, 3, 0, 0],
};

const TAU = Math.PI * 2;
const STEPS = 200;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function point(shape: string, t: number): Vec3 {
  const [h, c, x, m] = SHAPES[shape];
  const ring = Math.sin(c * t + m);
  return [ring * Math.cos(h * t + x), ring * Math.sin(h * t + x), Math.cos(c * t + m)];
}

function project([x, y, z]: Vec3, turn: number, tilt: number): Vec3 {
  const x1 = x * Math.cos(turn) + z * Math.sin(turn);
  const z1 = -x * Math.sin(turn) + z * Math.cos(turn);
  const y2 = y * Math.cos(tilt) - z1 * Math.sin(tilt);
  const z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt);
  const perspective = 3.2 / (3.2 - z2);
  return [x1 * perspective, y2 * perspective, z2];
}

// A travelling bump: pushes the curve outward around one spot, fading to zero
// 1.15 rad away. This is the "speaking" ripple.
function bump(t: number, centre: number, amount: number) {
  const d = Math.atan2(Math.sin(t - centre), Math.cos(t - centre));
  if (Math.abs(d) >= 1.15) return 0;
  return Math.sin(d * 4.8) * Math.cos(((d / 1.15) * Math.PI) / 2) ** 2 * amount * 0.135 * 1.55;
}

export interface RibbonOptions {
  x: number;
  y: number;
  radius: number;
  shape: string;
  turn: number;
  tilt: number;
  ripplePhase: number;
  rippleAmount: number;
}

export function drawRibbon(ctx: CanvasRenderingContext2D, o: RibbonOptions) {
  const rest: Vec3[] = [];
  const live: Vec3[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * TAU;
    const p = point(o.shape, t);
    rest.push(project(p, o.turn, o.tilt));
    const k = 1 + bump(t, o.ripplePhase, o.rippleAmount);
    live.push(project([p[0] * k, p[1] * k, p[2] * k], o.turn, o.tilt));
  }

  // Fit by the un-rippled outline, so the doodle does not resize as it speaks.
  const xs = rest.map((p) => p[0]);
  const ys = rest.map((p) => p[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const scale = (o.radius * 2) / Math.max(x1 - x0, y1 - y0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const pts = live.map(([x, y, z]): Vec3 => [o.x + (x - cx) * scale, o.y + (y - cy) * scale, z]);

  const segments = pts
    .slice(1)
    .map((b, i) => ({ a: pts[i], b, depth: (pts[i][2] + b[2]) / 2 }))
    .sort((p, q) => p.depth - q.depth);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const { a, b, depth } of segments) {
    const near = clamp((depth + 1.2) / 2.4);
    const grey = Math.round(175 + 74 * near);
    ctx.strokeStyle = `rgb(${grey},${grey},${Math.min(255, grey + 4)})`;
    ctx.lineWidth = Math.max(2.8, o.radius * 0.115 * (0.85 + near * 0.2));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
}
