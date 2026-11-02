# IMPL-0002: Show the reference grid only on 3D simulations

- Status: accepted
- Date: 2026-11-02

## Context

A grid on every simulation was tried in 1.12.7. On flat 2D views it had to be a backdrop, where it added clutter to diagrams that already have their own axes.

## Decision

3D scenes set `gridY` to the height of their ground, and the stage draws a floor grid there. 2D scenes get no grid.

## Consequences

- A floor grid gives 3D scenes depth cues, aligned with the scene.
- A new 3D scene must set `gridY`, or it has no grid.
