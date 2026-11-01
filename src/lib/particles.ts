/**
 * Struct-of-arrays particle buffer. Live particles are packed in [0, count);
 * a dead particle is overwritten by the last live one (swap-remove), so update
 * and upload are tight loops with no holes and no allocation.
 */
export class ParticleBuffer {
  readonly px: Float32Array
  readonly py: Float32Array
  readonly pz: Float32Array
  readonly vx: Float32Array
  readonly vy: Float32Array
  readonly vz: Float32Array
  readonly age: Float32Array
  readonly life: Float32Array
  count = 0

  constructor(readonly capacity: number) {
    const f = () => new Float32Array(capacity)
    this.px = f()
    this.py = f()
    this.pz = f()
    this.vx = f()
    this.vy = f()
    this.vz = f()
    this.age = f()
    this.life = f()
  }

  /** Index of a fresh particle (caller fills position/velocity), or -1 if full. */
  spawn(life: number): number {
    if (this.count >= this.capacity) return -1
    const i = this.count++
    this.age[i] = 0
    this.life[i] = life
    return i
  }

  private copy(from: number, to: number) {
    this.px[to] = this.px[from]
    this.py[to] = this.py[from]
    this.pz[to] = this.pz[from]
    this.vx[to] = this.vx[from]
    this.vy[to] = this.vy[from]
    this.vz[to] = this.vz[from]
    this.age[to] = this.age[from]
    this.life[to] = this.life[from]
  }

  /** Semi-implicit Euler with gravity on Y and linear drag; kills expired particles. */
  update(dt: number, gravity: number, drag = 0) {
    const k = Math.max(0, 1 - drag * dt)
    let i = 0
    while (i < this.count) {
      this.age[i] += dt
      if (this.age[i] >= this.life[i]) {
        this.copy(--this.count, i) // re-check slot i: it now holds another particle
        continue
      }
      this.vy[i] -= gravity * dt
      this.vx[i] *= k
      this.vy[i] *= k
      this.vz[i] *= k
      this.px[i] += this.vx[i] * dt
      this.py[i] += this.vy[i] * dt
      this.pz[i] += this.vz[i] * dt
      i++
    }
  }

  clear() {
    this.count = 0
  }
}

/** Fractional emission: carries the remainder so 2.5 particles/frame averages out. */
export function emitCount(state: { carry: number }, rate: number, dt: number) {
  state.carry += rate * dt
  const n = Math.floor(state.carry)
  state.carry -= n
  return n
}
