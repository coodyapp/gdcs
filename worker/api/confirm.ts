import { safely, type Env } from "../http"
import { isToken } from "../subscribers"

const back = (request: Request, status: string) =>
  Response.redirect(`${new URL(request.url).origin}/?updates=${status}`, 303)

/** GET /api/confirm?token=… activates a pending subscriber. */
export const confirm = (request: Request, env: Env, _ctx?: unknown) =>
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
