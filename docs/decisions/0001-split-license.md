# IMPL-0001: Keep the repository private with a split license

- Status: accepted
- Date: 2026-11-02

## Context

The goal is for search engines and AI tools to read the site and for people to embed simulations with a link back, without others copying the simulations. Open sourcing under MIT was considered and declined by the product owner.

## Decision

The repository stays private. Sheet text and images are CC BY 4.0, code examples and prompts are MIT, and simulations and site code are all rights reserved with free embedding.

The copyright holder is COODY. The laws of Brazil govern the custom terms in part 3.

## Consequences

- Browsers must download the simulation code to run it, so the restriction on copying relies on the license and takedown requests, not on technical measures.
- Earlier versions shipped as MIT, and copies received under those terms keep them.
- Third-party software keeps its own license. Ghost Fibers' license forbids redistributing the component, which is one more reason to keep the repository private.
