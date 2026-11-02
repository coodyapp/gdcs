export const PHYSICS_CONSTANTS = {
  G: 6.6743e-11, // Gravitational constant (m³ kg⁻¹ s⁻²)
  c: 299792458, // Speed of light (m/s)
  h: 6.62607015e-34, // Planck constant (J⋅s)
  hbar: 1.054571817e-34, // Reduced Planck constant (J⋅s)
  k: 1.380649e-23, // Boltzmann constant (J/K)
  e: 1.602176634e-19, // Elementary charge (C)
  m_e: 9.1093837015e-31, // Electron mass (kg)
  m_p: 1.67262192369e-27, // Proton mass (kg)
  m_n: 1.67492749804e-27, // Neutron mass (kg)
  M_sun: 1.989e30, // Solar mass (kg)
  R_earth: 6.371e6, // Earth radius (m)
  AU: 1.496e11, // Astronomical unit (m)
} as const

export const SIMULATION_CONSTANTS = {
  TIME_STEP: 0.01, // Time step for simulations (seconds)
  MAX_ITERATIONS: 1000, // Maximum iterations per frame
  EPSILON: 1e-10, // Numerical precision threshold
} as const

export const VISUALIZATION_DEFAULTS = {
  GRID_SIZE: 20,
  GRID_DIVISIONS: 20,
  GRID_RESOLUTION: 32,
  CAMERA_DISTANCE: 10,
  ANIMATION_SPEED: 1,
  MIN_MESH_SIZE: 0.1,
  MAX_MESH_SIZE: 5,
} as const
