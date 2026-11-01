import type { PagesFunction } from "@cloudflare/workers-types"

import { HttpError, readJson, safely, type Env } from "../_lib/http"

const NAMES = new Set(["copy_prompt", "copy_prompt_card", "copy_markdown"])

/** Cookieless daily counts of copy actions per page. */
export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  safely(async () => {
    const body = await readJson(request)
    const name = String(body.name ?? "")
    const path = String(body.path ?? "")
    if (!NAMES.has(name) || !/^\/[a-z0-9/-]{0,160}$/.test(path))
      throw new HttpError(400, "Unknown event.")
    await env.DB.prepare(
      "INSERT INTO site_events(day, name, path, count) VALUES (?, ?, ?, 1) ON CONFLICT(day, name, path) DO UPDATE SET count = count + 1"
    )
      .bind(new Date().toISOString().slice(0, 10), name, path)
      .run()
    return new Response(null, { status: 204 })
  })
