import { safely, type Env } from "../http"
import { isToken } from "../subscribers"

/** Removes the subscription record entirely (privacy policy: no live record kept). */
async function unsubscribe(env: Env, value: string) {
  await env.DB.prepare("DELETE FROM subscribers WHERE unsub_token = ?")
    .bind(value)
    .run()
}

/** GET /api/unsubscribe?token=… from the email footer link. */
export const unsubscribeLink = (request: Request, env: Env, _ctx?: unknown) =>
  safely(async () => {
    const value = new URL(request.url).searchParams.get("token")
    const origin = new URL(request.url).origin
    if (!isToken(value))
      return Response.redirect(`${origin}/?updates=invalid`, 303)
    await unsubscribe(env, value)
    return Response.redirect(`${origin}/?updates=unsubscribed`, 303)
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
