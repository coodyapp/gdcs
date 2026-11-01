import type { PagesFunction } from "@cloudflare/workers-types"

import { safely, type Env } from "../_lib/http"
import { isToken } from "../_lib/subscribers"

const back = (request: Request, status: string) =>
  Response.redirect(
    `${new URL(request.url).origin}/updates?status=${status}`,
    303
  )

/** GET /api/confirm?token=… activates a pending subscriber. */
export const onRequestGet: PagesFunction<Env> = ({ request, env }) =>
  safely(async () => {
    const value = new URL(request.url).searchParams.get("token")
    if (!isToken(value)) return back(request, "invalid")
    const row = await env.DB.prepare(
      "UPDATE subscribers SET status = 'active', confirmed_at = ?, unsubscribed_at = NULL, confirm_sends = 0 WHERE confirm_token = ? AND status = 'pending' RETURNING id"
    )
      .bind(new Date().toISOString(), value)
      .first()
    if (row) return back(request, "confirmed")
    const active = await env.DB.prepare(
      "SELECT 1 FROM subscribers WHERE confirm_token = ? AND status = 'active'"
    )
      .bind(value)
      .first()
    return back(request, active ? "confirmed" : "invalid")
  })
