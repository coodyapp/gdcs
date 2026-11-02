# GDCS Content Roadmap

Source: "The Encyclopedia of Mathematics & Physics in Game Development" (topic table provided 2026-11-01).

`[P2]` = phase-2 sheets (2026-11-02). `[P3]` = Top-40 completion sheets (2026-11-02). Section entries now name the covering sheet directly.

Legend: ✅ **complete**: covered by a phase-1 sheet (`[GD]` = phase-1 game-dev core set, `[PH]` = migrated physics.coody.app labs) · 🟡 **partial**: an existing sheet touches it, but it still needs its own sheet (counts as planned) · ⬜ **planned**
Levels come from the table: **CORE / COMMON / ADVANCED**.

## Assessment: is the table useful as a roadmap?

**Yes, as a backlog. It is not a sheet list as written.**
- ✅ Good coverage of math, physics, rendering, animation, AI, networking, and audio, with a usable priority signal (Top-40 + CORE/COMMON/ADVANCED) and a sensible learning order (§14). It maps cleanly onto our `Category › Subcategory › Sheet` model.
- ⚠️ It is a **vocabulary list (~600 terms)**, and many bullets are 5–10 synonyms or sub-terms. Sheet granularity should be **one sheet per bullet group** (≈ 250 sheets), not one per term.
- ⚠️ **Duplicates across sections** (fixed timestep in §2.8/§9, PBD/XPBD in §3.4/§3.6, spatial partitioning in §5/§7/§9, Voronoi/Delaunay in §2.5/§6.2). Each gets one canonical sheet and is cross-linked elsewhere.
- ⚠️ Some areas (networking, audio DSP, control theory) need less obvious Three.js visuals: timelines, signal plots in 3D space, or client/server ghosts.
- ⚠️ It misses **game-feel** topics that the phase-1 game-dev set covers (coyote time, hit stop, i-frames…), and covers only part of our existing electromagnetism/quantum/relativity sheets. Both are listed under "Already shipped, outside the table" below.
- Citations in the table point to Unity, Godot, Box2D, Gaffer On Games, Red Blob Games, Khronos, Scratchapixel, and GPU Gems. Use them as "Further reading" links, not as content to copy.

**Suggested order after phase 1:** finish the Top-40 (vectors, trig, transforms, matrices, lerp/smoothstep, collision basics, rigid bodies), then follow §14's learning order, then specializations by demand.

---

## 1. Top-40 most-used concepts

| # | Term | Status | Covered by / target |
|---|---|---|---|
| 1 | Vectors (Vector2, Vector3) | ✅ | [P2] vectors |
| 2 | Delta Time | ✅ | [GD] Delta time |
| 3 | Linear Interpolation (Lerp) | ✅ | [P2] lerp-and-smoothstep |
| 4 | Trigonometry (sin, cos, atan2) | ✅ | [P2] trigonometry |
| 5 | Dot Product | ✅ | [P2] dot-and-cross-product |
| 6 | Normalization | ✅ | [P2] vectors |
| 7 | Magnitude / Length | ✅ | [P2] vectors |
| 8 | Distance / Squared Distance | ✅ | [P2] vectors |
| 9 | Transforms (TRS) | ✅ | [P2] transforms-and-matrices |
| 10 | Matrices (3×3, 4×4) | ✅ | [P2] transforms-and-matrices |
| 11 | Quaternions | ✅ | [GD] Quaternions |
| 12 | Cross Product | ✅ | [P2] dot-and-cross-product |
| 13 | Clamp / Min / Max | ✅ | [P2] lerp-and-smoothstep |
| 14 | Velocity | ✅ | [GD] Acceleration and friction · [PH] Projectile Motion |
| 15 | Acceleration | ✅ | [GD] Acceleration and friction · [PH] Projectile Motion |
| 16 | Raycasting | ✅ | [GD] Raycasting |
| 17 | Collision Detection | ✅ | [P3] collision-detection |
| 18 | AABB / Bounding Box | ✅ | [P3] bounding-volumes |
| 19 | Gravity | ✅ | [PH] Projectile Motion, Kepler's Laws, My Solar System |
| 20 | Forces / Impulses | ✅ | [P3] impulse-and-momentum |
| 21 | Euler Angles / Radians | ✅ | [P2] euler-angles |
| 22 | Local vs. World Space | ✅ | [P2] local-vs-world-space |
| 23 | Smoothstep / SmoothDamp | ✅ | [P2] lerp-and-smoothstep |
| 24 | Slerp | ✅ | [GD] Quaternions |
| 25 | Fixed Timestep | ✅ | [GD] Fixed timestep |
| 26 | Damping / Friction | ✅ | [GD] Acceleration and friction · [PH] Damped Pendulum, Spring-Mass |
| 27 | Mass / Inertia | ✅ | [P3] moment-of-inertia |
| 28 | Normals / Tangents | ✅ | [GD] Normals · [P3] tangent-space |
| 29 | Projection | ✅ | [P3] camera-projection |
| 30 | Random Numbers / Probability | ✅ | [P3] probability-and-weighted-random |
| 31 | Noise Functions | ✅ | [GD] Seeded noise |
| 32 | Bézier Curves / Splines | ✅ | [P2] bezier-curves |
| 33 | Rigid-Body Dynamics | ✅ | [P2] rigid-body-dynamics |
| 34 | Broad Phase / Narrow Phase | ✅ | [P3] collision-detection |
| 35 | Inverse Kinematics | ✅ | [P2] inverse-kinematics |
| 36 | UV / Barycentric Coordinates | ✅ | [P3] barycentric-coordinates |
| 37 | Reflection / Refraction | ✅ | [P2] reflection-and-refraction |
| 38 | PBR / BRDF | ✅ | [P2] pbr-materials |
| 39 | Spatial Partitioning | ✅ | [GD] Spatial partitioning |
| 40 | Numerical Integration | ✅ | [GD] Fixed timestep · [PH] Spring-Mass (semi-implicit), Charged Particle (RK4) |

**Top-40: 40 ✅ · 0 🟡 · 0 ⬜**

---

## 2. Mathematics

### 2.1 Arithmetic, algebra, scalar math · CORE
- ⬜ Scalars, number types, floating vs fixed point
- ✅ Min / max / clamp / saturate / rounding: lerp-and-smoothstep
- ⬜ Modulo, wrapping, ping-pong
- ⬜ Equations & polynomials
- 🟡 Exponential growth/decay, logarithms: [GD] Delta time (`1 - exp(-k·dt)`)
- ⬜ Piecewise / step / sign functions
- ✅ Remap & inverse lerp: lerp-and-smoothstep
- ⬜ Epsilon comparisons & tolerances
- ⬜ Units & dimensional analysis

### 2.2 Trigonometry & angles · CORE
- ✅ sin / cos / tan, atan2, radians ↔ degrees: trigonometry
- ✅ Angle difference, wrapping, shortest arc: trigonometry
- ✅ Unit circle & identities: trigonometry
- ⬜ Pythagoras, law of sines/cosines
- ⬜ Polar / spherical / cylindrical coordinates
- ⬜ Heading, pitch, yaw, roll
- 🟡 Angular displacement / velocity / acceleration: [PH] Damped Pendulum
- ✅ Circular & orbital motion, oscillation, phase: [PH] Kepler's Laws, My Solar System, Spring-Mass Oscillator
- 🟡 Rotation matrices, axis-angle: [GD] Quaternions

### 2.3 Vectors & linear algebra · CORE
- ✅ Vector2/3/4 & basic ops: vectors
- ✅ Magnitude, squared magnitude, normalization: vectors
- ✅ Dot product: dot-and-cross-product
- ✅ Cross product: dot-and-cross-product
- ⬜ Projection & rejection
- ⬜ Reflection & refraction of vectors
- 🟡 Euclidean / Manhattan / Chebyshev distance: [GD] A* pathfinding (Manhattan/octile heuristics)
- ✅ Angle between vectors, orthogonality: dot-and-cross-product
- ⬜ Basis vectors, orthonormal basis, Gram–Schmidt
- ⬜ Linear combination, independence, span
- ⬜ Eigenvalues & eigenvectors
- ⬜ Triple products
- ✅ Barycentric coordinates: barycentric-coordinates
- ✅ Tangent / normal / binormal: tangent-space

### 2.4 Matrices, transforms & rotations · CORE
- 🟡 Matrix ops (multiply, transpose, inverse, determinant): transforms-and-matrices
- ⬜ Affine & homogeneous transforms
- ✅ TRS & composition order: transforms-and-matrices
- ✅ Transform hierarchies, parent/child: local-vs-world-space
- ✅ Coordinate spaces (local, world, view, clip, screen, tangent): camera-projection
- ⬜ Handedness & change of basis
- ✅ Euler angles & gimbal lock: euler-angles
- ✅ Quaternions (multiply, conjugate, inverse): [GD] Quaternions
- ⬜ Axis-angle & Rodrigues' formula
- ✅ Slerp: [GD] Quaternions · ⬜ Nlerp, squad
- 🟡 LookAt / orientation basis: [GD] Billboarding
- ⬜ Dual quaternions
- ⬜ Orthogonalization & drift correction

### 2.5 Geometry & spatial math · CORE / COMMON
- ⬜ Primitives (point, line, ray, plane, sphere, capsule, box)
- ✅ AABB / OBB / bounding sphere: bounding-volumes
- ⬜ Convex hull
- 🟡 Ray–plane / ray–sphere / ray–triangle intersection: [GD] Raycasting
- ✅ Point-in-polygon / triangle tests: barycentric-coordinates
- ⬜ Closest-point queries
- ✅ Surface / face / vertex normals: [GD] Normals
- ⬜ Area & volume
- ⬜ Signed distance & SDFs
- 🟡 Winding order & backface: [GD] Normals
- ⬜ Half-edge & mesh adjacency
- ⬜ Delaunay & Voronoi
- ⬜ Polygon clipping, offsetting, triangulation
- ⬜ CSG / boolean geometry
- ⬜ Convex decomposition, simplification
- ⬜ Curvature & geodesics
- ⬜ Bézier / B-spline / NURBS surfaces

### 2.6 Interpolation, easing & curves · CORE / COMMON
- ✅ Lerp & inverse lerp: lerp-and-smoothstep
- ⬜ Bilinear & trilinear interpolation
- ✅ Slerp: [GD] Quaternions · ⬜ Nlerp
- ✅ Smoothstep / smootherstep: lerp-and-smoothstep
- ⬜ SmoothDamp / critically damped smoothing
- ✅ Exponential smoothing: [GD] Delta time
- ⬜ Hermite & cubic splines
- ✅ Bézier curves: bezier-curves
- ⬜ Catmull–Rom, B-splines, NURBS
- ✅ Easing curves (in/out/in-out, back, elastic, bounce): [GD] Easing
- ⬜ Step / nearest interpolation, keyframes
- ⬜ Arc-length parameterization
- ⬜ Continuity (C0/C1/C2) & curvature
- ⬜ Interpolation vs extrapolation
- 🟡 Damped springs (under/critical/over): [PH] Spring-Mass Oscillator, Damped Pendulum

### 2.7 Calculus & differential equations · COMMON / ADVANCED
- ⬜ Derivatives & differentiation rules
- ⬜ Partial derivatives, gradient, divergence, curl
- ⬜ Jacobian & Hessian
- ⬜ Integrals
- ✅ ODEs (initial value problems): [PH] Spring-Mass Oscillator, Damped Pendulum, Charged Particle Motion
- ✅ PDEs: [PH] Heat Diffusion Plate, EM Wave Propagation, Quantum Tunneling, 2D Schrödinger Wave Packet
- ⬜ Taylor series
- ⬜ Extrema & critical points
- ⬜ Gradient descent & Newton's method
- ⬜ Calculus of variations
- ⬜ Lagrange multipliers

### 2.8 Numerical methods & simulation · COMMON / ADVANCED
- 🟡 Explicit vs semi-implicit Euler: [PH] Spring-Mass (semi-implicit); needs comparison sheet
- ⬜ Verlet / velocity Verlet / leapfrog
- ✅ Runge–Kutta (RK4): [PH] Charged Particle Motion
- ⬜ Implicit Euler
- ✅ Fixed / variable / semi-fixed timestep: [GD] Fixed timestep
- 🟡 Substepping: [GD] Tunneling
- ⬜ Stability, convergence & numerical error
- ⬜ Floating-point precision & machine epsilon
- ⬜ Energy drift & numerical damping
- ⬜ Iterative solvers (Gauss–Seidel, Jacobi, CG)
- ⬜ PGS & sequential impulses
- ⬜ Sparse matrices & factorization
- ⬜ Root finding (bisection, Newton–Raphson)
- ⬜ Constraint stabilization & regularization
- ⬜ Conditioning
- ⬜ Determinism & reproducibility
- ✅ Monte Carlo / Metropolis sampling: [PH] Boltzmann Energy Distribution
- ✅ Finite differences / FDTD: [PH] Heat Diffusion Plate, EM Wave Propagation

---

## 3. Physics & simulation

### 3.1 Classical mechanics & kinematics · CORE / COMMON
- ✅ Position, displacement, velocity, acceleration: [PH] Projectile Motion · [GD] Acceleration and friction
- ⬜ Jerk
- 🟡 Rotational motion: [PH] Damped Pendulum
- 🟡 Newton's laws: [PH] Spring-Mass Oscillator
- ✅ Force, mass, weight, gravity: [PH] Projectile Motion, Kepler's Laws, Buoyancy
- 🟡 Density: [PH] Buoyancy
- ✅ Momentum (linear & angular): impulse-and-momentum
- ✅ Impulse–momentum theorem: impulse-and-momentum
- ✅ Torque & lever arm: [PH] Balancing Act
- 🟡 Work, kinetic & potential energy: [PH] Spring-Mass Oscillator (U = ½kx²)
- 🟡 Conservation of energy & momentum: [PH] Kepler's Laws
- ⬜ Power & efficiency
- 🟡 Center of mass: [PH] Balancing Act, Gravitational Waves (barycenter)
- ✅ Moment of inertia & inertia tensor: moment-of-inertia
- ✅ Free fall, projectile motion, ballistic trajectory: [PH] Projectile Motion, Projectile Data Lab
- ✅ Circular / orbital motion, centripetal acceleration: [PH] Kepler's Laws, My Solar System
- ⬜ Centrifugal force & rotating frames
- ⬜ Terminal velocity & air resistance
- ⬜ Relative motion & reference frames

### 3.2 Rigid-body dynamics · COMMON
- ⬜ Body types (static / dynamic / kinematic)
- ✅ Mass properties & inertia tensor: moment-of-inertia
- ⬜ Forces vs torques at an application point
- 🟡 Linear & angular impulse: impulse-and-momentum (linear only)
- ⬜ Gravity scale & force accumulators
- 🟡 Linear & angular damping: [GD] Acceleration and friction
- ⬜ Static / dynamic / Coulomb friction, friction cone
- ✅ Restitution: impulse-and-momentum
- ⬜ Contacts: point, normal, penetration, manifold
- ⬜ Sleeping & islands
- ⬜ Impulse-based constraint solver
- ⬜ Penetration correction
- ⬜ Solver iterations & convergence
- ⬜ Rotational integration

### 3.3 Collision detection & response · CORE / COMMON
- 🟡 Detection vs response, overlap tests: [GD] Hitbox and hurtbox
- ✅ Broad / narrow phase: collision-detection
- ✅ Discrete vs continuous detection, TOI, tunneling: [GD] Tunneling
- ✅ Raycast: [GD] Raycasting · ⬜ shape / sphere / capsule / box casts
- 🟡 Colliders, triggers, layers & masks: [GD] Raycasting (collision mask), Hitbox and hurtbox
- ⬜ AABB tree / BVH
- ⬜ Separating Axis Theorem
- ⬜ GJK
- ⬜ EPA
- ⬜ Minkowski sum/difference & support functions
- ⬜ Contact manifold generation
- ⬜ Penetration depth & MTV
- ⬜ Normal / friction / restitution impulses
- ⬜ Contact caching & warm starting
- ⬜ Speculative contacts & margins
- ✅ Spatial hashing & collision grids: [GD] Spatial partitioning
- ⬜ Compound & convex-hull colliders
- ⬜ One-way, terrain & heightfield collision

### 3.4 Springs, joints & constraints · COMMON
- ✅ Hooke's law, spring constant: [PH] Spring-Mass Oscillator
- ✅ Damping, damping ratio, resonance, under/critical/over damping: [PH] Spring-Mass Oscillator, Damped Pendulum
- ✅ Spring-mass-damper system: [PH] Spring-Mass Oscillator
- ⬜ Constraints & degrees of freedom
- ⬜ Joint types (fixed, hinge, ball, prismatic, distance, cone-twist)
- ⬜ Joint limits, motors & springs
- ⬜ Ragdoll constraints
- ⬜ Position-Based Dynamics (PBD)
- ⬜ XPBD & compliance
- ⬜ Baumgarte stabilization
- ⬜ Sequential impulse solver

### 3.5 Vehicle & racing physics · COMMON / ADVANCED
- ⬜ Slip ratio & slip angle
- ⬜ Longitudinal / lateral tire force, normal load
- ⬜ Friction circle / ellipse
- ⬜ Pacejka Magic Formula
- ⬜ Brush tire model & combined slip
- ⬜ Rolling resistance & contact patch
- ⬜ Weight distribution & load transfer
- ⬜ Understeer / oversteer
- ⬜ Yaw rate & yaw moment
- ⬜ Ackermann steering
- ⬜ Bicycle model (kinematic & dynamic)
- ⬜ Traction loss, skid & drift
- ⬜ Aerodynamic drag & downforce
- ⬜ Suspension (spring rate, damper, travel)
- ⬜ Sprung vs unsprung mass, anti-roll bars
- ⬜ Differentials
- ⬜ Gears, torque curve & RPM
- ⬜ TCS / ABS / ESC

### 3.6 Soft bodies, cloth & ropes · ADVANCED
- ⬜ Mass-spring systems
- ⬜ Cloth simulation (stretch, shear, bend)
- ⬜ Rope & chain simulation
- ⬜ FEM basics
- ⬜ Elastic vs plastic deformation
- ⬜ Young's modulus, Poisson's ratio, stress & strain
- ⬜ Shape matching
- ⬜ Volume preservation
- ⬜ Fracture & destructible geometry
- ⬜ Self-collision

### 3.7 Fluids, water, smoke & environment · ADVANCED
- ⬜ Navier–Stokes & incompressible flow
- ⬜ Velocity / pressure / density fields
- 🟡 Advection & diffusion: [PH] Heat Diffusion Plate (diffusion)
- ⬜ Viscosity, vorticity & curl
- ⬜ Pressure projection
- ⬜ Eulerian vs Lagrangian
- ⬜ SPH
- ⬜ Position-Based Fluids
- ⬜ FLIP / PIC
- ⬜ Stable fluids (grid)
- ⬜ VOF & level sets
- ⬜ Surface tension
- ✅ Buoyancy: [PH] Buoyancy
- ⬜ Laminar vs turbulent, Reynolds number
- ⬜ Shallow water / heightfield water
- ⬜ Gerstner waves
- ⬜ FFT ocean
- ✅ Wave superposition & interference: [PH] Sound Waves, Gravitational Waves
- ⬜ Foam, wake & splash
- ⬜ Volumetric smoke & combustion
- ⬜ Atmospheric scattering & fog

---

## 4. Character animation

### 4.1 Skeletal animation & kinematics · COMMON
- ⬜ Skeleton, bones & bind pose
- ⬜ Forward kinematics
- ✅ Two-bone / analytical IK: inverse-kinematics
- ✅ FABRIK: inverse-kinematics
- ✅ CCD IK: inverse-kinematics
- ⬜ Jacobian IK & DLS
- ⬜ Full-body / multi-effector IK
- ⬜ Pole vectors & joint limits
- ⬜ Linear blend skinning
- ⬜ Dual quaternion skinning
- ⬜ Pose blending & additive animation
- ⬜ Retargeting
- ⬜ Root motion

### 4.2 Procedural animation & locomotion · COMMON / ADVANCED
- ✅ Squash & stretch: [GD] Squash and stretch *(beyond table scope; filed here)*
- ⬜ Animation state machines, blend trees & blend spaces
- ⬜ Motion matching
- ⬜ Gait cycle, foot planting & foot IK
- ⬜ Stride / orientation / motion warping
- ⬜ Look-at & head tracking
- ⬜ Hand placement & two-hand IK
- ⬜ Spring bones & secondary motion
- ⬜ Inertialization
- ⬜ Procedural idle (breathing, sway)
- ⬜ Noise-driven motion
- ⬜ Active ragdoll & balance

---

## 5. Graphics & rendering

### 5.1 Cameras, projection & visibility · CORE / COMMON
- ✅ Perspective vs orthographic projection: camera-projection
- ✅ Model / view / projection (MVP): camera-projection
- ✅ FOV, aspect, near/far planes: camera-projection
- ✅ View frustum & frustum culling: [GD] Frustum culling
- ✅ NDC, perspective divide & viewport: camera-projection
- ✅ World ↔ screen projection: camera-projection
- ✅ Depth buffer, depth precision & Z-fighting: [GD] Z-fighting · ⬜ reversed-Z
- ⬜ Occlusion culling
- 🟡 Backface culling & winding: [GD] Normals
- ⬜ Rasterization & barycentric interpolation
- ⬜ Orbit / follow cameras
- ✅ Camera deadzone: [GD] Camera deadzone *(beyond table scope)*
- ⬜ Parallax & parallax occlusion mapping
- ⬜ Spring-arm camera & camera smoothing
- ✅ Screen-space picking: [GD] Raycasting
- ⬜ Depth of field
- ⬜ Motion blur

### 5.2 Meshes, vertices, topology & UVs · COMMON
- ⬜ Vertex / index buffers
- ⬜ Manifold vs non-manifold
- ⬜ Vertex attributes
- ✅ Tangent, bitangent & TBN: tangent-space
- 🟡 UV mapping & unwrapping: [GD] Texture atlas
- ✅ Texture atlas: [GD] Texture atlas · ⬜ texture arrays, UDIM
- ⬜ Normal / bump / displacement mapping
- ⬜ Triplanar mapping
- 🟡 Normal interpolation, hard vs smooth edges: [GD] Normals
- ✅ Level of detail: [GD] Level of detail · ⬜ quadric-error simplification
- ⬜ Subdivision & tessellation
- ⬜ Morph targets & blend shapes
- ✅ Instancing & batching: [GD] Draw calls

### 5.3 Lighting, optics & materials · COMMON / ADVANCED
- ⬜ Rendering equation, radiance & irradiance
- ⬜ Lambert diffuse
- ⬜ Phong & Blinn–Phong
- ⬜ PBR & BRDF
- ⬜ Cook–Torrance & microfacets
- ⬜ GGX / NDF & Smith masking
- ⬜ Fresnel & Schlick
- ⬜ IOR, Snell's law & total internal reflection
- ⬜ Inverse-square law
- ⬜ Metal/rough workflow (albedo, metallic, roughness)
- ⬜ Emissive & ambient occlusion
- ⬜ Clearcoat, sheen & anisotropy
- ⬜ Subsurface scattering
- ⬜ Transmission & Beer's law
- ⬜ Thin-film & iridescence
- ⬜ Shadow mapping & bias
- ⬜ Cascaded shadow maps
- ⬜ PCF / VSM soft shadows
- ⬜ SSAO / GTAO
- ⬜ SSR
- ⬜ Ray & path tracing
- ⬜ Global illumination
- ⬜ IBL & cubemaps
- ⬜ Spherical harmonics & probes
- ⬜ Monte Carlo & importance sampling
- ⬜ Tone mapping, exposure & gamma
- ⬜ Linear vs sRGB, HDR

### 5.4 Shader math & VFX · COMMON
- ✅ Fragment shader basics: [GD] Fragment shader · ⬜ vertex & compute shaders
- ⬜ GLSL built-ins (step, smoothstep, mix, fract, mod)
- ⬜ SDFs & ray marching
- ⬜ SDF booleans & smooth min
- ⬜ Domain repetition & warping
- ⬜ Polar UV transforms
- ⬜ Voronoi / cellular patterns
- 🟡 Perlin, simplex & fractal noise: [GD] Seeded noise
- ⬜ Fresnel rim lighting
- ⬜ Dissolve effects
- ⬜ Dithering
- ⬜ Anti-aliasing (MSAA, FXAA, SMAA, TAA)
- ⬜ Convolution & Gaussian blur
- ⬜ Bloom & color grading
- ⬜ Chromatic aberration & vignette
- ⬜ Fog
- ⬜ Heat haze & distortion
- ✅ Billboarding: [GD] Billboarding *(beyond table scope)*
- ✅ Overdraw: [GD] Overdraw *(beyond table scope)*
- ✅ Particle systems: [GD] Particle system · ⬜ GPU particles & velocity fields

---

## 6. Procedural generation & probability

### 6.1 Randomness, statistics & probability · CORE / COMMON
- ✅ PRNG & seeds, deterministic randomness: [GD] Seeded noise
- ⬜ Uniform vs normal distributions
- ⬜ Bernoulli, binomial, Poisson, exponential distributions
- ✅ Weighted random & loot tables: probability-and-weighted-random
- ⬜ PDF & CDF
- ⬜ Expected value & variance
- ⬜ Conditional probability & Bayes
- ⬜ Stratified / rejection / importance sampling
- ✅ Monte Carlo methods: [PH] Boltzmann Energy Distribution, Ideal Gas Kinetics
- ⬜ Markov chains
- ⬜ Random walks & Brownian motion
- 🟡 Fisher–Yates & reservoir sampling: probability-and-weighted-random (Fisher–Yates only)

### 6.2 Noise & procedural worlds · COMMON
- ✅ Perlin / simplex noise, octaves (fBm): [GD] Seeded noise · ⬜ value noise
- ⬜ Worley / cellular noise
- ⬜ White / pink / blue noise
- ⬜ Ridged multifractal & domain warping
- ⬜ Frequency, amplitude, lacunarity & persistence
- ⬜ Voronoi & Delaunay (canonical sheet in §2.5)
- ⬜ Poisson-disk sampling
- ⬜ Heightmaps
- ⬜ Hydraulic & thermal erosion
- ⬜ Biomes (moisture / temperature)
- ⬜ Cellular automata
- ⬜ Wave Function Collapse
- ⬜ L-systems
- ⬜ Marching squares & marching cubes
- ⬜ Dual contouring & voxels
- ⬜ Space-filling curves (Hilbert, Morton)
- ⬜ Procedural dungeons
- ⬜ Spline roads
- ✅ Chunk streaming: [GD] Chunk streaming *(beyond table scope)*

---

## 7. AI, navigation & spatial algorithms

### 7.1 Pathfinding & computational geometry · COMMON
- ⬜ Graphs (weighted, directed)
- ⬜ BFS & DFS
- ⬜ Dijkstra
- ✅ A* & heuristics: [GD] A* pathfinding
- ⬜ Greedy best-first
- ⬜ Jump Point Search
- ⬜ D* Lite
- ⬜ Floyd–Warshall
- ⬜ NavMesh & navigation polygons
- ⬜ Waypoint graphs
- ⬜ Flow fields & Dijkstra maps
- ⬜ Visibility graphs
- ⬜ Funnel algorithm / string pulling
- ⬜ Hex grids
- ⬜ Quadtree, octree & KD-tree
- ✅ Uniform grids & spatial hashing: [GD] Spatial partitioning
- ⬜ Nearest-neighbor / KNN
- ⬜ Hierarchical pathfinding (HPA*)
- ✅ Steering & local avoidance: [GD] Steering behaviors
- ⬜ RVO / ORCA

### 7.2 Game AI & decision-making · COMMON / ADVANCED
- ✅ Finite state machines: [GD] Finite state machine · ⬜ hierarchical FSMs
- ⬜ Behavior trees
- ⬜ Utility AI
- ⬜ Influence maps
- ⬜ Potential fields
- ✅ Seek, flee & arrive: [GD] Steering behaviors
- ⬜ Pursuit, evasion & interception
- ⬜ Flocking / boids
- ✅ Line of sight & vision cones: [P2] field-of-view, field-of-view-visualization
- ⬜ Minimax & alpha-beta
- ⬜ MCTS
- ⬜ MDPs & reinforcement learning
- ⬜ Q-learning
- ⬜ Genetic algorithms
- ⬜ Simulated annealing & hill climbing
- ⬜ Dynamic programming
- ⬜ Target leading & ballistic interception
- ✅ Time slicing AI updates: [GD] Time slicing *(beyond table scope)*

---

## 8. Control theory, cameras & input

### 8.1 Control systems · COMMON
- ⬜ Open vs closed loop
- ⬜ P / PI / PID controllers
- ⬜ Overshoot, settling time & steady-state error
- ⬜ Dead zones, hysteresis & rate limiting
- ⬜ Low- & high-pass filters
- ⬜ Spring controllers
- ⬜ State space
- ⬜ Kalman / EKF
- ⬜ Complementary filter
- ⬜ LQR
- ⬜ MPC
- ⬜ Lyapunov stability
- ⬜ Pure pursuit & Stanley controllers

### 8.2 Camera & input smoothing · CORE / COMMON
- ⬜ Input filtering & response curves
- ⬜ Stick deadzones & sensitivity curves
- ⬜ Spring-arm cameras & camera lag
- ✅ Frame-rate-independent damping: [GD] Delta time
- ⬜ Look-at & orbit constraints
- ⬜ Predictive cameras
- ⬜ Camera collision & occlusion
- ⬜ Screen-space framing
- ✅ Trauma-based & noise-driven camera shake: [GD] Screen shake
- ✅ Camera deadzone: [GD] Camera deadzone
- ✅ Input buffering: [GD] Input buffering *(beyond table scope)*

---

## 9. Networking & simulation · COMMON / ADVANCED
- ✅ Tick rate, delta time & fixed timestep: [GD] Fixed timestep, Delta time
- ⬜ Snapshot interpolation & interpolation buffers
- ⬜ Extrapolation & dead reckoning
- ⬜ Client-side prediction & reconciliation
- ⬜ Rollback netcode
- ⬜ Deterministic lockstep
- ⬜ Lag compensation / server rewind
- ⬜ Latency, RTT & jitter
- ⬜ State sync & delta compression
- ⬜ Quantization & smallest-three quaternions
- ⬜ Floating-point determinism
- ⬜ Clock synchronization
- ⬜ Interest management (AOI)
- ⬜ Bandwidth budgeting

## 10. Audio, waves & signal processing · COMMON / ADVANCED
- ✅ Frequency, amplitude, phase, wavelength: [PH] Sound Waves
- ⬜ Waveforms (sine, square, saw, triangle)
- ✅ Superposition & interference: [PH] Sound Waves
- ⬜ Fourier series & FFT
- ⬜ Sampling, Nyquist & aliasing
- ⬜ Convolution & impulse response
- ⬜ FIR / IIR filters
- ⬜ Decibels & dynamic range
- ⬜ 3D positional audio & distance falloff
- ⬜ Doppler effect
- ⬜ Panning, binaural & HRTF
- ⬜ Reverb, RT60 & occlusion
- ⬜ Resampling & pitch shifting

## 11. Specialized fields · ADVANCED
| Field | Status | Covered by |
|---|---|---|
| Computational topology | ⬜ | |
| Differential geometry | ⬜ | |
| Optimization (GD, CG, BFGS) | ⬜ | |
| Statistics (regression, PCA, clustering) | ⬜ | |
| Information theory | ⬜ | |
| Numerical acoustics (wave eq., FDTD) | 🟡 | [PH] EM Wave Propagation (FDTD method) |
| Thermodynamics | ✅ | [PH] Heat Diffusion Plate, Ideal Gas Kinetics, Boltzmann Energy Distribution |
| Electromagnetism | ✅ | [PH] Electric Field Lines, Charged Particle Motion, EM Wave Propagation |
| Optics | ⬜ | |
| Lagrangian / Hamiltonian mechanics | ⬜ | |
| Chaos theory | ⬜ | |
| Fractal geometry | ⬜ | |
| Engine optimization (SIMD, DOD, cache) | 🟡 | [GD] Frame budget, Object pooling |
| Large-world precision (floating origin) | 🟡 | [GD] Chunk streaming |
| Geospatial math | ⬜ | |

## 12. Formulas (each becomes a formula block on its canonical sheet)
| Formula | Status | Sheet |
|---|---|---|
| Lerp `a+(b−a)t` | ✅ | [GD] Easing |
| 3D distance | ⬜ | mathematics/vectors |
| Normalization | ⬜ | mathematics/vectors |
| Dot product | 🟡 | [GD] Normals |
| Angle between vectors | ⬜ | |
| F = ma | ✅ | [PH] Spring-Mass Oscillator |
| p = mv | ⬜ | |
| J = Δp | ⬜ | |
| τ = r × F | ✅ | [PH] Balancing Act |
| Eₖ = ½mv² | ⬜ | |
| F = −kx | ✅ | [PH] Spring-Mass Oscillator |
| F_d = −cv | ✅ | [PH] Spring-Mass Oscillator, Damped Pendulum |
| a_c = v²/r | 🟡 | [PH] Kepler's Laws |
| Drag ½ρC_dAv² | ⬜ | |
| α = τ/I | ⬜ | |
| x(t)=x₀e^(−kt) | ✅ | [GD] Delta time |
| Projectile height | ✅ | [PH] Projectile Motion |
| Semi-implicit Euler | ✅ | [GD] Fixed timestep · [PH] Spring-Mass Oscillator |

## 13–14. Game-type tracks & learning order
Shown as curated "learning paths" on the home page once there are enough sheets (racing, character/IK, RPG/survival, procedural worlds). Status follows from the sheets above. **Planned** for phase 2+.

---

## Already shipped, outside the table (phase 1)
- **Game feel [GD]:** Coyote time, Hit stop, Invincibility frames, Input buffering, Squash and stretch, Camera deadzone, Screen shake
- **Systems / performance [GD]:** Object pooling, Hitbox and hurtbox, Particle system, Frame budget, Draw calls, Overdraw, Time slicing, Texture atlas, Chunk streaming, Billboarding
- **Physics [PH]:** Kepler's Laws, My Solar System, Projectile Data Lab, Electric Field Lines, Charged Particle Motion, EM Wave Propagation, Heat Diffusion Plate, Ideal Gas Kinetics, Boltzmann Energy Distribution, Particle in a Box, Quantum Tunneling, 2D Schrödinger Wave Packet, Spacetime Curvature (Mass Effect), Gravitational Waves, Mercury Precession
- **Phase 2, outside the table [P2]:** Stencil Buffer Masks, Field of View Visualization
