import { safely, token, type Env } from "../http"
import { isToken } from "../subscribers"

/** Also rotates the confirm token so an old confirmation link can't resubscribe. */
async function unsubscribe(env: Env, value: string) {
  await env.DB.prepare(
    "UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = ?, confirm_token = ? WHERE unsub_token = ? AND status != 'unsubscribed'"
  )
    .bind(new Date().toISOString(), token(), value)
    .run()
}

/** GET /api/unsubscribe?token=… from the email footer link. */
export const unsubscribeLink = (request: Request, env: Env, _ctx?: unknown) =>
  safely(async () => {
    const value = new URL(request.url).searchParams.get("token")
    const origin = new URL(request.url).origin
    if (!isToken(value))
      return Response.redirect(`${origin}/updates?status=invalid`, 303)
    await unsubscribe(env, value)
    return Response.redirect(`${origin}/updates?status=unsubscribed`, 303)
  })

/** RFC 8058 one-click unsubscribe (List-Unsubscribe-Post). */
export const unsubscribeOneClick = (
  request: Request,
  env: Env,
  _ctx?: unknown
) =>
  safely(async () => {
    const value = new URL(request.url).searchParams.get("token")
    if (isToken(value)) await unsubscribe(env, value)
    return new Response(null, { status: 204 })
  })
