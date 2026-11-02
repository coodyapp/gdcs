import type { Category } from "./types"

/**
 * Category › Subcategory tree. Order here is display order. A new topic
 * area is one more entry plus sheet modules under `sheets/<category>/`.
 */
export const categories: Category[] = [
  {
    slug: "threejs",
    title: "Three.js & Rendering",
    short: "Three.js",
    description:
      "How a 3D scene becomes pixels: rays, normals, culling, shaders and the standard ways to draw less.",
    subcategories: [
      {
        slug: "rendering",
        title: "Rendering",
        description:
          "Core real-time rendering ideas every Three.js scene relies on.",
      },
      {
        slug: "materials",
        title: "Materials & Light",
        description: "How surfaces reflect, refract and scatter light.",
      },
    ],
  },
  {
    slug: "mathematics",
    title: "Mathematics",
    short: "Math",
    description:
      "The math under game code: rotations, interpolation and deterministic randomness.",
    subcategories: [
      {
        slug: "vectors",
        title: "Vectors",
        description: "Directions, lengths and the products that compare them.",
      },
      {
        slug: "trigonometry",
        title: "Trigonometry",
        description: "Angles, circles and turning between them.",
      },
      {
        slug: "transforms",
        title: "Transforms",
        description: "Moving, rotating and scaling between coordinate spaces.",
      },
      {
        slug: "rotations",
        title: "Rotations",
        description: "Representing and blending orientation in 3D.",
      },
      {
        slug: "interpolation",
        title: "Interpolation",
        description: "Blending values and drawing smooth curves between them.",
      },
      {
        slug: "procedural",
        title: "Procedural",
        description: "Seeds, noise and reproducible generated worlds.",
      },
    ],
  },
  {
    slug: "game-feel",
    title: "Game Feel",
    description:
      "Timing and motion rules that make jumps, hits and cameras respond the way players expect.",
    subcategories: [
      {
        slug: "timing",
        title: "Timing",
        description: "Frame-rate independence and forgiving input windows.",
      },
      {
        slug: "motion",
        title: "Motion",
        description: "How characters speed up, stop and deform.",
      },
      {
        slug: "camera",
        title: "Camera",
        description: "Cameras that follow calmly and shake with intent.",
      },
    ],
  },
  {
    slug: "systems",
    title: "Systems",
    description:
      "Code patterns most games need for objects, effects, simulation and collision.",
    subcategories: [
      {
        slug: "patterns",
        title: "Patterns",
        description: "Reusable runtime patterns for many short-lived objects.",
      },
      {
        slug: "simulation",
        title: "Simulation",
        description: "Stepping a world forward deterministically.",
      },
      {
        slug: "collision",
        title: "Collision",
        description: "Deciding what touched what, and when.",
      },
    ],
  },
  {
    slug: "ai",
    title: "AI",
    description:
      "Navigation, steering and decision-making for game characters.",
    subcategories: [
      {
        slug: "navigation",
        title: "Navigation",
        description: "Finding paths through grids and graphs.",
      },
      {
        slug: "steering",
        title: "Steering",
        description: "Local movement forces for agents.",
      },
      {
        slug: "decision",
        title: "Decision making",
        description: "Structuring what an agent does next.",
      },
    ],
  },
  {
    slug: "performance",
    title: "Performance",
    description:
      "Where the 16.67 ms of a frame go, and the standard ways to spend less of them.",
    subcategories: [
      {
        slug: "cpu",
        title: "CPU",
        description: "Budgeting and spreading work across frames.",
      },
      {
        slug: "gpu",
        title: "GPU",
        description: "Fewer draw calls, fewer overdrawn pixels.",
      },
      {
        slug: "world",
        title: "World",
        description: "Organising large worlds in space and memory.",
      },
    ],
  },
  {
    slug: "animation",
    title: "Animation",
    short: "Animation",
    description: "Skeletons, kinematics and procedural motion for characters.",
    subcategories: [
      {
        slug: "kinematics",
        title: "Kinematics",
        description:
          "Solving joint chains so hands and feet reach their targets.",
      },
    ],
  },
  {
    slug: "physics",
    title: "Physics",
    description:
      "Interactive physics from forces and fields to quanta and curved spacetime, with the equations behind each model.",
    subcategories: [
      {
        slug: "mechanics",
        title: "Mechanics",
        description: "Forces, oscillation, orbits, torque, waves and fluids.",
      },
      {
        slug: "electromagnetism",
        title: "Electromagnetism",
        description: "Fields, charged particles and electromagnetic waves.",
      },
      {
        slug: "thermodynamics",
        title: "Thermodynamics",
        description: "Heat flow, gases and statistical energy distributions.",
      },
      {
        slug: "quantum-mechanics",
        title: "Quantum Mechanics",
        description: "Wavefunctions, tunneling and wave packets.",
      },
      {
        slug: "relativity",
        title: "Relativity",
        description: "Curved spacetime, gravitational waves and precession.",
      },
    ],
  },
]
