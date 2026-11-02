import { describe, expect, it } from "vite-plus/test"

import { HttpError, type Env } from "./http"
import { requireHuman } from "./turnstile"

const req = new Request("https://gdcs.coody.app/api/subscribe", {
  headers: { "CF-Connecting-IP": "1.2.3.4" },
})
const env = (secret?: string) =>
  ({ TURNSTILE_SECRET: secret }) as unknown as Env
const fakeFetch = (success: boolean, seen: FormData[] = []) =>
  (async (_url: unknown, init?: RequestInit) => {
    seen.push(init?.body as FormData)
    return new Response(JSON.stringify({ success }))
  }) as unknown as typeof fetch

describe("requireHuman", () => {
  it("skips verification when no secret is configured", async () => {
    await expect(requireHuman(undefined, req, env())).resolves.toBeUndefined()
  })
  it("rejects missing tokens", async () => {
    await expect(
      requireHuman("", req, env("s"), fakeFetch(true))
    ).rejects.toBeInstanceOf(HttpError)
  })
  it("accepts a token Turnstile confirms, sending secret, token and IP", async () => {
    const seen: FormData[] = []
    await requireHuman("tok", req, env("s3cret"), fakeFetch(true, seen))
    expect(seen[0].get("secret")).toBe("s3cret")
    expect(seen[0].get("response")).toBe("tok")
    expect(seen[0].get("remoteip")).toBe("1.2.3.4")
  })
  it("rejects a token Turnstile refuses", async () => {
    await expect(
      requireHuman("tok", req, env("s"), fakeFetch(false))
    ).rejects.toBeInstanceOf(HttpError)
  })
})
