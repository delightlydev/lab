import { drawRibbon } from "./ribbon";
import { VoiceMotion, syntheticVoice } from "./motion";

const REST_TURN = 2.71;
const REST_TILT = 0.55;

const canvas = document.getElementById("doodle") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const playButton = document.getElementById("play") as HTMLButtonElement;
const chips = document.querySelectorAll<HTMLButtonElement>("[data-shape]");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

let shape = "loop";
let playing = false;
let voiceTime = 0;
let last = performance.now();
const motion = new VoiceMotion();

function fit() {
  const dpr = devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing) voiceTime += dt;

  const level = playing && !reduced.matches ? syntheticVoice(voiceTime) : 0;
  const m = motion.step(level, dt);

  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);
  drawRibbon(ctx, {
    x: width / 2,
    y: height / 2,
    radius: Math.min(width, height) * 0.36 * m.growth,
    shape,
    turn: REST_TURN + m.turn,
    tilt: REST_TILT + m.tilt,
    ripplePhase: voiceTime * 2.64 + 0.3,
    rippleAmount: m.ripple,
  });
  requestAnimationFrame(frame);
}

playButton.addEventListener("click", () => {
  playing = !playing;
  playButton.setAttribute("aria-pressed", String(playing));
  playButton.textContent = playing ? "Pause" : "Play";
});

for (const chip of chips) {
  chip.addEventListener("click", () => {
    shape = chip.dataset.shape!;
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
  });
}

addEventListener("resize", fit);
fit();
requestAnimationFrame(frame);

