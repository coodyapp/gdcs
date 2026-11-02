/**
 * Curated learning paths: ordered sheets with one line on why each step
 * matters. Plain data (used by pages, SEO, llms.txt and tests).
 */
export interface LearningPath {
  slug: string
  title: string
  /** Short audience/outcome line (card + meta description, 70–160 chars). */
  summary: string
  /** Category accent used for the path. */
  accent: string
  steps: { slug: string; why: string }[]
}

export const paths: LearningPath[] = [
  {
    slug: "3d-math-foundations",
    title: "3D math foundations",
    summary:
      "The vector, angle and transform toolkit behind every 3D game. Start here before physics, animation or rendering.",
    accent: "mathematics",
    steps: [
      {
        slug: "vectors",
        why: "Positions, directions and lengths: the alphabet of 3D code.",
      },
      {
        slug: "dot-and-cross-product",
        why: "Measure alignment and build perpendiculars, normals and torque.",
      },
      {
        slug: "trigonometry",
        why: "Turn angles into directions and back with sin, cos and atan2.",
      },
      {
        slug: "transforms-and-matrices",
        why: "Move, rotate and scale in one matrix, in the right order.",
      },
      {
        slug: "local-vs-world-space",
        why: "Parent/child hierarchies and converting points between spaces.",
      },
      {
        slug: "euler-angles",
        why: "Human-friendly rotations and the gimbal lock they hide.",
      },
      { slug: "quaternions", why: "Robust rotation storage and smooth slerp." },
      {
        slug: "lerp-and-smoothstep",
        why: "Blend any value smoothly and frame-rate independently.",
      },
      {
        slug: "bezier-curves",
        why: "Paths for cameras, projectiles and UI motion.",
      },
    ],
  },
  {
    slug: "platformer-feel",
    title: "Platformer feel",
    summary:
      "Make jumping and running feel responsive and fair: timing windows, acceleration curves and camera polish.",
    accent: "game-feel",
    steps: [
      { slug: "delta-time", why: "Same speed at 30, 60 or 144 fps." },
      {
        slug: "fixed-timestep",
        why: "Deterministic physics regardless of frame rate.",
      },
      {
        slug: "acceleration-and-friction",
        why: "Weight and control in horizontal movement.",
      },
      {
        slug: "coyote-time",
        why: "Forgive jumps pressed just after leaving a ledge.",
      },
      {
        slug: "input-buffering",
        why: "Forgive jumps pressed just before landing.",
      },
      {
        slug: "squash-and-stretch",
        why: "Readable, elastic landings and takeoffs.",
      },
      {
        slug: "camera-deadzone",
        why: "A calm camera that follows without jitter.",
      },
      { slug: "hit-stop", why: "Make impacts land with a short freeze." },
      {
        slug: "screen-shake",
        why: "Trauma-based shake that scales with impact.",
      },
    ],
  },
  {
    slug: "collision-and-physics",
    title: "Collision & physics engine basics",
    summary:
      "From rays and normals to broad phase, tunneling and rigid bodies: the core of a small physics engine.",
    accent: "physics",
    steps: [
      { slug: "vectors", why: "Everything below is vector math." },
      { slug: "raycasting", why: "Ask the world what a line hits first." },
      {
        slug: "normals",
        why: "Which way a surface faces: bounces and slopes.",
      },
      {
        slug: "spatial-partitioning",
        why: "Avoid testing every pair of objects.",
      },
      { slug: "hitbox-hurtbox", why: "Gameplay overlap tests for attacks." },
      { slug: "tunneling", why: "Catch fast objects that skip through walls." },
      { slug: "fixed-timestep", why: "Stable, repeatable integration." },
      {
        slug: "projectile-motion",
        why: "The analytic reference for ballistic motion.",
      },
      {
        slug: "rigid-body-dynamics",
        why: "Mass, inertia, torque and impulses in one body.",
      },
    ],
  },
  {
    slug: "character-animation",
    title: "Character animation & IK",
    summary:
      "Hierarchies, rotations and inverse kinematics for characters that reach, aim and plant their feet.",
    accent: "animation",
    steps: [
      {
        slug: "transforms-and-matrices",
        why: "Bones are transforms in a hierarchy.",
      },
      {
        slug: "local-vs-world-space",
        why: "Convert targets into a bone's local frame.",
      },
      {
        slug: "euler-angles",
        why: "Joint limits are usually authored as angles.",
      },
      {
        slug: "quaternions",
        why: "Blend joint rotations without gimbal lock.",
      },
      {
        slug: "inverse-kinematics",
        why: "Solve the chain so the hand reaches the target.",
      },
      { slug: "easing", why: "Timing curves for procedural motion." },
      {
        slug: "squash-and-stretch",
        why: "Classic principle that sells weight.",
      },
      {
        slug: "bezier-curves",
        why: "Smooth paths for hands, cameras and props.",
      },
    ],
  },
  {
    slug: "rendering-pipeline",
    title: "Rendering pipeline",
    summary:
      "How a Three.js frame is drawn: normals, shaders, materials, depth and the costs that slow it down.",
    accent: "threejs",
    steps: [
      { slug: "normals", why: "Lighting starts with which way surfaces face." },
      {
        slug: "fragment-shader",
        why: "Per-pixel programs that decide the final colour.",
      },
      {
        slug: "reflection-and-refraction",
        why: "How light bounces and bends at a surface.",
      },
      { slug: "pbr-materials", why: "Physically based metal/rough materials." },
      { slug: "z-fighting", why: "Depth precision and the flicker it causes." },
      { slug: "frustum-culling", why: "Skip what the camera can't see." },
      { slug: "draw-calls", why: "Batch and instance to cut CPU overhead." },
      { slug: "overdraw", why: "Transparent layers that cost fill rate." },
    ],
  },
  {
    slug: "procedural-worlds",
    title: "Procedural & open worlds",
    summary:
      "Generate worlds from seeds and stream, cull and batch them so huge maps stay fast.",
    accent: "performance",
    steps: [
      { slug: "seeded-noise", why: "Reproducible terrain from a single seed." },
      {
        slug: "chunk-streaming",
        why: "Load and unload the world around the player.",
      },
      {
        slug: "spatial-partitioning",
        why: "Find neighbours fast in a large world.",
      },
      { slug: "level-of-detail", why: "Cheaper meshes far away." },
      { slug: "frustum-culling", why: "Don't draw what's off screen." },
      { slug: "draw-calls", why: "Instance repeated props." },
      {
        slug: "texture-atlas",
        why: "Fewer material switches for many sprites.",
      },
      { slug: "time-slicing", why: "Spread expensive updates across frames." },
    ],
  },
]

export const getPath = (slug: string) => paths.find((p) => p.slug === slug)
export const pathUrl = (slug: string) => `/paths/${slug}`
