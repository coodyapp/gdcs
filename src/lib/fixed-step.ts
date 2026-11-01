/**
 * Fixed-timestep accumulator ("Fix Your Timestep!" pattern): the simulation
 * always advances in `dt` slices; leftover time becomes the interpolation alpha.
 */
export class FixedStepper {
  acc = 0

  constructor(
    public dt: number,
    /** Longest frame we accept; prevents the spiral of death after a stall. */
    public maxFrame = 0.25
  ) {}

  /** Feed one render frame's elapsed time; runs `step` 0..n times. Returns n. */
  advance(frameTime: number, step: (dt: number) => void): number {
    this.acc += Math.min(Math.max(frameTime, 0), this.maxFrame)
    let n = 0
    while (this.acc >= this.dt) {
      step(this.dt)
      this.acc -= this.dt
      n++
    }
    return n
  }

  /** 0..1: how far we are between the previous and the current physics state. */
  get alpha() {
    return this.acc / this.dt
  }

  reset() {
    this.acc = 0
  }
}

/** Blend previous and current state for rendering. */
export const interpolate = (prev: number, curr: number, alpha: number) =>
  prev + (curr - prev) * alpha
