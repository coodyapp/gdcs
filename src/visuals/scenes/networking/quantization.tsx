import { useEffect, useMemo, useRef } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { angleBetween, type Quat } from "@/lib/quat"
import {
  decodeQuat,
  dequantize,
  encodeQuat,
  FLOAT_POSE_BITS,
  newEncodedQuat,
  poseBits,
  quantize,
  stepSize,
  worstAngleError,
} from "@/lib/quantization"

import { deg, defineVisual, palette, useClock, useLiveReadout } from "../../kit"

type V = { posBits: number; rotBits: number; range: number; on: boolean }

type P = [number, number, number]

/** A flat dart with a fin: every rotation, roll included, changes its outline. */
const HULL: Record<string, P> = {
  a: [-1.1, 0.28, 0.8],
  b: [-1.1, 0.28, -0.8],
  c: [-1.1, -0.28, -0.8],
  d: [-1.1, -0.28, 0.8],
  nose: [1.6, 0, 0],
  finRoot: [-1.1, 0.28, 0],
  finTip: [-1.1, 1.05, 0],
  finFront: [-0.15, 0.18, 0],
}
const FACES =
  "a b nose b c nose c d nose d a nose a c b a d c finRoot finTip finFront"
const EDGES =
  "a b b c c d d a a nose b nose c nose d nose finRoot finTip finTip finFront"
const corners = (names: string) => names.split(" ").map((n) => HULL[n])
const EDGE_POINTS = corners(EDGES)

const NOSE = new THREE.Vector3(...HULL.nose)
const UP = new THREE.Vector3(0, 1, 0)
/** Lattice nodes drawn each side of the current cell, and when to stop. */
const REACH = 12
const MAX_DOTS = (2 * REACH + 1) ** 2
const MIN_VISIBLE_STEP = 0.14

/** Encoder and decoder share these: x and z in ±range/2, y from the floor up. */
const low = (axis: number, range: number) => (axis === 1 ? 0 : -range / 2)
const high = (axis: number, range: number) => (axis === 1 ? range : range / 2)

function truePose(t: number, position: THREE.Vector3, euler: THREE.Euler) {
  position.set(
    3.1 * Math.sin(0.5 * t),
    1.7 + 0.8 * Math.sin(0.7 * t + 1),
    2.5 * Math.sin(0.83 * t + 0.6)
  )
  euler.set(0.47 * t, 0.71 * t, 0.29 * t)
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const truth = useRef<THREE.Group>(null)
  const copy = useRef<THREE.Group>(null)
  const bar = useRef<THREE.Mesh>(null)
  const dots = useRef<THREE.InstancedMesh>(null)

  const hull = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(corners(FACES).flat(), 3)
    )
    g.computeVertexNormals()
    return g
  }, [])
  useEffect(() => () => hull.dispose(), [hull])

  const work = useMemo(
    () => ({
      position: new THREE.Vector3(),
      decoded: new THREE.Vector3(),
      euler: new THREE.Euler(),
      rotation: new THREE.Quaternion(),
      decodedRotation: new THREE.Quaternion(),
      noseA: new THREE.Vector3(),
      noseB: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      dummy: new THREE.Object3D(),
      input: [0, 0, 0, 1] as Quat,
      output: [0, 0, 0, 1] as Quat,
      encoded: newEncodedQuat(),
    }),
    []
  )
  const live = useRef({ position: 0, angle: 0, clamped: false })
  const layer = useRef("")

  const step = (axis: number) =>
    stepSize(low(axis, v.range), high(axis, v.range), v.posBits)
  const maxPosition = (Math.sqrt(3) * step(0)) / 2
  const maxAngle = useMemo(() => deg(worstAngleError(v.rotBits)), [v.rotBits])

  useFrame(() => {
    if (!truth.current || !copy.current || !bar.current || !dots.current) return
    const w = work
    truePose(time.current, w.position, w.euler)
    w.rotation.setFromEuler(w.euler)
    truth.current.position.copy(w.position)
    truth.current.quaternion.copy(w.rotation)

    let clamped = false
    if (v.on) {
      for (let axis = 0; axis < 3; axis++) {
        const min = low(axis, v.range)
        const max = high(axis, v.range)
        const x = w.position.getComponent(axis)
        if (x < min || x > max) clamped = true
        w.decoded.setComponent(
          axis,
          dequantize(quantize(x, min, max, v.posBits), min, max, v.posBits)
        )
      }
      w.rotation.toArray(w.input)
      encodeQuat(w.input, v.rotBits, w.encoded)
      decodeQuat(w.encoded, v.rotBits, w.output)
      w.decodedRotation.fromArray(w.output)
    } else {
      w.decoded.copy(w.position)
      w.decodedRotation.copy(w.rotation)
    }
    copy.current.position.copy(w.decoded)
    copy.current.quaternion.copy(w.decodedRotation)

    live.current.position = w.position.distanceTo(w.decoded)
    live.current.angle = v.on ? deg(angleBetween(w.input, w.output)) : 0
    live.current.clamped = clamped

    // The red bar joins the two noses, so it grows with either error.
    w.noseA.copy(NOSE).applyQuaternion(w.rotation).add(w.position)
    w.noseB.copy(NOSE).applyQuaternion(w.decodedRotation).add(w.decoded)
    w.direction.subVectors(w.noseB, w.noseA)
    const length = w.direction.length()
    bar.current.visible = length > 1e-4
    if (bar.current.visible) {
      bar.current.position.addVectors(w.noseA, w.noseB).multiplyScalar(0.5)
      bar.current.quaternion.setFromUnitVectors(
        UP,
        w.direction.divideScalar(length)
      )
      bar.current.scale.set(1, length, 1)
    }

    // The lattice layer the copy sits on. It only changes when the cell does.
    const s = stepSize(-v.range / 2, v.range / 2, v.posBits)
    const cx = quantize(w.position.x, -v.range / 2, v.range / 2, v.posBits)
    const cz = quantize(w.position.z, -v.range / 2, v.range / 2, v.posBits)
    const key = `${v.on}|${v.range}|${v.posBits}|${cx}|${cz}|${w.decoded.y}`
    if (key === layer.current) return
    layer.current = key
    let n = 0
    if (v.on && s >= MIN_VISIBLE_STEP) {
      const last = 2 ** v.posBits - 1
      const size = Math.min(0.07, 0.1 * s)
      for (
        let i = Math.max(0, cx - REACH);
        i <= Math.min(last, cx + REACH);
        i++
      )
        for (
          let k = Math.max(0, cz - REACH);
          k <= Math.min(last, cz + REACH);
          k++
        ) {
          w.dummy.position.set(
            dequantize(i, -v.range / 2, v.range / 2, v.posBits),
            w.decoded.y,
            dequantize(k, -v.range / 2, v.range / 2, v.posBits)
          )
          w.dummy.scale.setScalar(size)
          w.dummy.updateMatrix()
          dots.current.setMatrixAt(n++, w.dummy.matrix)
        }
    }
    dots.current.count = n
    dots.current.instanceMatrix.needsUpdate = true
  })

  useLiveReadout(() => {
    const bits = poseBits(v.posBits, v.rotBits)
    if (!v.on)
      return `Quantization off · ${FLOAT_POSE_BITS} bits = ${FLOAT_POSE_BITS / 8} B per entity · no error`
    const now = live.current
    return `${bits} bits = ${(bits / 8).toFixed(1)} B per entity vs ${FLOAT_POSE_BITS / 8} B floats · worst ${maxPosition.toFixed(3)} u, ${maxAngle.toFixed(2)}° · now ${now.position.toFixed(3)} u, ${now.angle.toFixed(2)}°${now.clamped ? " · CLAMPED at range edge" : ""}`
  })

  const half = v.range / 2
  const bounds = useMemo<P[]>(
    () => [
      [-half, 0.01, -half],
      [half, 0.01, -half],
      [half, 0.01, half],
      [-half, 0.01, half],
      [-half, 0.01, -half],
    ],
    [half]
  )

  return (
    <>
      <Line
        points={bounds}
        color={palette.tertiary}
        lineWidth={1.5}
        dashed
        dashSize={0.25}
        gapSize={0.18}
      />
      <instancedMesh
        ref={dots}
        args={[undefined, undefined, MAX_DOTS]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={palette.guide} toneMapped={false} />
      </instancedMesh>

      <group ref={copy}>
        <mesh geometry={hull}>
          <meshStandardMaterial
            color={palette.moving}
            side={THREE.DoubleSide}
            flatShading
          />
        </mesh>
        <Line
          points={EDGE_POINTS}
          segments
          color={palette.stage}
          lineWidth={1}
        />
      </group>
      <group ref={truth}>
        <Line
          points={EDGE_POINTS}
          segments
          color={palette.accel}
          lineWidth={2.2}
          depthTest={false}
          renderOrder={2}
        />
      </group>
      <mesh ref={bar} renderOrder={3}>
        <cylinderGeometry args={[0.07, 0.07, 1, 10]} />
        <meshBasicMaterial
          color={palette.error}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  gridY: 0,
  camera: { position: [5.6, 7.6, 10.4], target: [0, 1, 0.4] },
  params: [
    {
      key: "posBits",
      label: "Position bits per axis",
      min: 2,
      max: 16,
      step: 1,
      value: 3,
    },
    {
      key: "rotBits",
      label: "Rotation bits per component",
      min: 3,
      max: 12,
      step: 1,
      value: 4,
    },
    {
      key: "range",
      label: "Range per axis",
      min: 4,
      max: 32,
      step: 1,
      value: 8,
      unit: "u",
    },
    { key: "on", label: "Quantization", type: "toggle", value: true },
  ],
  readout: (v) => {
    const bits = v.on ? poseBits(v.posBits, v.rotBits) : FLOAT_POSE_BITS
    return `${bits} bits = ${(bits / 8).toFixed(1)} B per entity vs ${FLOAT_POSE_BITS / 8} B floats`
  },
  Scene,
})
