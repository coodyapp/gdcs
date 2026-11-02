import { describe, expect, it } from "vite-plus/test"

import type { Env } from "./http"
import { handle } from "./index"

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as never
const env = {
  ASSETS: {
    fetch: async (input: Request | string) =>
      new Response(
        `asset:${new URL(typeof input === "string" ? input : input.url).pathname}`
      ),
  },
  SITE_URL: "https://gdcs.coody.app",
} as unknown as Env

const call = (method: string, path: string, init: RequestInit = {}) =>
  handle(
    new Request(`https://gdcs.coody.app${path}`, { method, ...init }),
    env,
    ctx
  )

describe("worker router", () => {
  it("rejects unknown API routes with JSON 404", async () => {
    const res = await call("GET", "/api/nope")
    expect(res.status).toBe(404)
    expect(res.headers.get("Content-Type")).toContain("application/json")
  })

  it("returns 405 for a known path with the wrong method", async () => {
    expect((await call("GET", "/api/subscribe")).status).toBe(405)
    expect((await call("DELETE", "/api/confirm")).status).toBe(405)
  })

  it("falls back to static assets outside /api", async () => {
    expect(await (await call("GET", "/physics")).text()).toBe("asset:/physics")
  })

  it("redirects invalid confirm tokens without touching the database", async () => {
    const res = await call("GET", "/api/confirm?token=bad")
    expect(res.status).toBe(303)
    expect(res.headers.get("Location")).toBe(
      "https://gdcs.coody.app/?updates=invalid"
    )
  })

  it("validates subscribe bodies before any write", async () => {
    const res = await call("POST", "/api/subscribe", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    })
    expect(res.status).toBe(400)
  })
})
