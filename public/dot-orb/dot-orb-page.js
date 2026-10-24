import { mountOrb } from "./dot-orb.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const hero = mountOrb($("#dorb-hero"), "sphere");
const heroName = $("#dorb-name");
const pickerBtns = $$("[data-state]");
const names = pickerBtns.map((b) => b.dataset.state);
pickerBtns.forEach((b) => mountOrb($(".dorb-orb", b), b.dataset.state));

// The orb takes whatever room is left once the label and picker are placed,
// up to a cap, so it is as large as it can be without scrolling.
function sizeHero() {
  const stage = $(".dorb-stage");
  const main = $(".dorb");
  const canvas = hero.orb.canvas;
  const pad = parseFloat(getComputedStyle(main).paddingTop) + parseFloat(getComputedStyle(main).paddingBottom);
  const others = stage.offsetHeight - canvas.offsetHeight;
  const room = window.innerHeight - pad - others;
  const px = Math.round(Math.max(200, Math.min(660, stage.clientWidth, room)));
  if (px !== hero.orb.size) hero.resize(px);
}
sizeHero();
addEventListener("resize", sizeHero);
document.fonts?.ready.then(sizeHero);

let current = "sphere";
let auto = !reduced.matches;
let autoTimer = 0;

function setState(name) {
  current = name;
  hero.set(name);
  heroName.textContent = name;
  heroName.classList.remove("dorb-pop");
  void heroName.offsetWidth;
  heroName.classList.add("dorb-pop");
  pickerBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.state === name)));
}
function queueAuto() {
  clearTimeout(autoTimer);
  if (!auto) return;
  autoTimer = setTimeout(() => {
    setState(names[(names.indexOf(current) + 1) % names.length]);
    queueAuto();
  }, 3200);
}
pickerBtns.forEach((b) =>
  b.addEventListener("click", () => {
    auto = false;
    clearTimeout(autoTimer);
    setState(b.dataset.state);
  }),
);
$("#dorb-hit").addEventListener("click", () => {
  auto = !auto;
  $("#dorb-hit").setAttribute("aria-pressed", String(!auto));
  queueAuto();
});
setState("sphere");
queueAuto();
