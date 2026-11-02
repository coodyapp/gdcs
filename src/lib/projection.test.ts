import { describe, expect, it } from "vite-plus/test"
import * as THREE from "three"

import {
  insideNdc,
  ndcToPixels,
  orthographic,
  perspective,
  perspectiveDepth,
  pixelsToNdc,
  projectToNdc,
  toClip,
  visibleHeight,
} from "./projection"
import type { Vec3 } from "./transforms"

const rad = Math.PI / 180
const close = (a: number[], b: number[], digits = 6) => {
  expect(a.length).toBe(b.length)
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i], digits))
}

const POINTS: Vec3[] = [
  [0, 0, -5],
  [1.2, -0.7, -3],
  [-4, 2.5, -40],
  [0.3, 0.1, -0.5],
]

describe("perspective", () => {
  const P = perspective(50 * rad, 1.6, 0.5, 100)

  it("equals THREE.PerspectiveCamera's projection matrix", () => {
    const cam = new THREE.PerspectiveCamera(50, 1.6, 0.5, 100)
    close(P, cam.projectionMatrix.elements)
  })

  it("agrees with Vector3.project for a camera at the origin", () => {
    const cam = new THREE.PerspectiveCamera(50, 1.6, 0.5, 100)
    cam.updateMatrixWorld()
    for (const p of POINTS) {
      const v = new THREE.Vector3(...p).project(cam)
      close(projectToNdc(P, p), [v.x, v.y, v.z])
    }
  })

  it("agrees with Vector3.project for a moved camera, given view space", () => {
    const cam = new THREE.PerspectiveCamera(50, 1.6, 0.5, 100)
    cam.position.set(3, 4, 8)
    cam.lookAt(1, 0, -2)
    cam.updateMatrixWorld()
    for (const p of POINTS) {
      const world = new THREE.Vector3(...p)
      const view = world.clone().applyMatrix4(cam.matrixWorldInverse)
      const ndc = world.clone().project(cam)
      close(projectToNdc(P, [view.x, view.y, view.z]), [ndc.x, ndc.y, ndc.z])
    }
  })

  it("Vector3.unproject inverts the projection", () => {
    const cam = new THREE.PerspectiveCamera(50, 1.6, 0.5, 100)
    cam.updateMatrixWorld()
    const p = POINTS[1]
    const back = new THREE.Vector3(...projectToNdc(P, p)).unproject(cam)
    close([back.x, back.y, back.z], p, 5)
  })

  it("puts the near plane at z = -1 and the far plane at z = +1", () => {
    expect(projectToNdc(P, [0, 0, -0.5])[2]).toBeCloseTo(-1, 9)
    expect(projectToNdc(P, [0, 0, -100])[2]).toBeCloseTo(1, 9)
  })

  it("clip w is the distance in front of the camera", () => {
    expect(toClip(P, [1, 2, -7])[3]).toBeCloseTo(7, 9)
  })

  it("halves on-screen size when distance doubles", () => {
    const y1 = projectToNdc(P, [0, 1, -4])[1]
    const y2 = projectToNdc(P, [0, 1, -8])[1]
    expect(y2).toBeCloseTo(y1 / 2, 9)
  })

  it("maps the edge of visibleHeight to NDC y = 1", () => {
    const d = 12
    const top = visibleHeight(d, 50 * rad) / 2
    expect(projectToNdc(P, [0, top, -d])[1]).toBeCloseTo(1, 9)
  })

  it("visibleHeight is 2 d tan(fov/2)", () => {
    expect(visibleHeight(5, 90 * rad)).toBeCloseTo(10, 9)
  })

  it("depth is non-linear: half the NDC range sits between near and 2·near", () => {
    const [n, f] = [0.1, 1000]
    expect(perspectiveDepth(n, n, f)).toBeCloseTo(-1, 9)
    expect(perspectiveDepth(f, n, f)).toBeCloseTo(1, 9)
    expect(perspectiveDepth(2 * n, n, f)).toBeCloseTo(0, 3)
    const P2 = perspective(50 * rad, 1.6, n, f)
    expect(perspectiveDepth(7, n, f)).toBeCloseTo(
      projectToNdc(P2, [0, 0, -7])[2],
      9
    )
  })

  it("a point behind the camera falls outside the NDC cube", () => {
    expect(insideNdc(projectToNdc(P, [0, 0, 5]))).toBe(false)
    expect(insideNdc(projectToNdc(P, [0, 0, -5]))).toBe(true)
    expect(projectToNdc(P, [0, 0, 5])[2]).toBeGreaterThan(1)
  })
})

describe("orthographic", () => {
  const O = orthographic(3.2, 2, 0.5, 100)

  it("equals THREE.OrthographicCamera's projection matrix", () => {
    const cam = new THREE.OrthographicCamera(-3.2, 3.2, 2, -2, 0.5, 100)
    close(O, cam.projectionMatrix.elements)
  })

  it("agrees with Vector3.project", () => {
    const cam = new THREE.OrthographicCamera(-3.2, 3.2, 2, -2, 0.5, 100)
    cam.updateMatrixWorld()
    for (const p of POINTS) {
      const v = new THREE.Vector3(...p).project(cam)
      close(projectToNdc(O, p), [v.x, v.y, v.z])
    }
  })

  it("ignores distance for x and y, and depth is linear", () => {
    const a = projectToNdc(O, [1, 1, -4])
    const b = projectToNdc(O, [1, 1, -40])
    expect(a[0]).toBeCloseTo(b[0], 9)
    expect(a[1]).toBeCloseTo(b[1], 9)
    const mid = projectToNdc(O, [0, 0, -50.25])[2]
    expect(mid).toBeCloseTo(0, 9)
  })
})

describe("viewport", () => {
  it("maps NDC corners to pixel corners with y flipped", () => {
    close(ndcToPixels([-1, 1, 0], 1280, 800), [0, 0])
    close(ndcToPixels([1, -1, 0], 1280, 800), [1280, 800])
    close(ndcToPixels([0, 0, 0], 1280, 800), [640, 400])
  })

  it("round-trips through pixelsToNdc", () => {
    const [px, py] = ndcToPixels([0.25, -0.6, 0], 1280, 800)
    close(pixelsToNdc(px, py, 1280, 800), [0.25, -0.6])
  })
})
