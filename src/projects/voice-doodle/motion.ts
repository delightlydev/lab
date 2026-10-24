// Turns a voice level (0..1) into the doodle's motion. Three things happen:
//   - each new word gives it a springy shove (push),
//   - while someone talks the ripple builds and the doodle spins faster,
//   - when they stop, everything eases back to a stand-still.

export class VoiceMotion {
  private spin = 0;
  private swing = 0;
  private quiet = 10;
  private ripple = 0;
  private breath = 0;
  private push = 0;
  private pushVelocity = 0;
  private previousVoice = 0;

  step(level: number, dt: number) {
    // The spring is stiff, so integrate in small slices to keep it stable.
    const slices = Math.max(1, Math.ceil(dt * 120));
    const h = dt / slices;
    for (let i = 0; i < slices; i++) {
      const onset = Math.max(0, level - this.previousVoice);
      this.previousVoice = level;
      this.pushVelocity += onset * 55;
      this.pushVelocity += (-90 * this.push - 0.7 * Math.sqrt(90) * this.pushVelocity) * h;
      this.push += this.pushVelocity * h;

      const target = level > 0.04 ? Math.min((0.26 + level * 1.28) * 0.52, 1) : 0;
      const rate = target > this.ripple ? 0.035 : 0.24;
      this.ripple += (target - this.ripple) * (1 - Math.exp(-h / rate));
      this.breath += (level - this.breath) * (1 - Math.exp(-h / 0.3));

      if (level > 0.2) {
        if (this.quiet > 0.45) this.swing = Math.min(this.swing + 1.8, 2.2);
        this.quiet = 0;
      } else {
        this.quiet += h;
      }
      this.swing *= Math.exp(-h * 1.8);
      this.spin += h * (0.025 + this.swing + this.breath * 0.45);
    }

    return {
      turn: this.spin,
      tilt: Math.sin(this.spin * 1.2) * 0.26 + this.push * 0.025,
      growth: (1 + this.push / 55) * (1 + this.breath * 0.07),
      ripple: this.ripple * 1.12,
    };
  }
}

// A stand-in for speech: bursts of syllables with pauses between phrases.
export function syntheticVoice(time: number): number {
  const phrase = time % 3.8;
  const syllables: [number, number, number][] = [
    [0.1, 0.23, 0.75], [0.35, 0.22, 1], [0.6, 0.28, 0.65],
    [1.2, 0.2, 0.85], [1.45, 0.3, 0.7],
    [2.1, 0.22, 0.9], [2.35, 0.2, 1], [2.58, 0.26, 0.6], [2.9, 0.3, 0.8],
  ];
  let level = 0;
  for (const [at, length, weight] of syllables) {
    const v = (phrase - at) / length;
    if (v > 0 && v < 1) level += Math.sin(v * Math.PI) ** 2 * weight;
  }
  return Math.min(1, level);
}
