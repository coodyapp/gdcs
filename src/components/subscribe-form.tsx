import { useId, useState, type FormEvent } from "react"

import { Link } from "react-router-dom"

import { useTurnstile } from "@/hooks/use-turnstile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Status = "idle" | "sending" | "sent" | "error"

/** Email signup; the API sends a confirmation link (double opt-in). */
export function SubscribeForm({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")
  const human = useTurnstile()
  const id = useId()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setStatus("sending")
    const turnstile = await human.getToken()
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          website: String(form.get("website") ?? ""),
          source: window.location.pathname,
          turnstile,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok)
        throw new Error(data.error ?? "Something went wrong. Try again.")
      setStatus("sent")
      setMessage("Check your inbox and confirm your subscription.")
    } catch (error) {
      human.reset()
      setStatus("error")
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Try again."
      )
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate={false}>
      <div
        className={compact ? "flex gap-2" : "flex flex-col gap-2 sm:flex-row"}
      >
        <label htmlFor={id} className="sr-only">
          Email address
        </label>
        <Input
          id={id}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@studio.dev"
          className="h-10 w-full min-w-0 sm:flex-1"
          disabled={status === "sending" || status === "sent"}
        />
        {/* Honeypot: real people never see or fill this. */}
        <input
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden
        />
        <Button
          type="submit"
          size="lg"
          className="h-10 px-4"
          disabled={status === "sending" || status === "sent"}
        >
          {status === "sending" ? "Sending…" : "Get updates"}
        </Button>
      </div>
      <div
        ref={human.container}
        aria-hidden="true"
        className="h-0 overflow-hidden"
      />
      <p
        role="status"
        className={
          status === "error"
            ? "text-sm text-red-400"
            : "text-sm text-muted-foreground"
        }
      >
        {message || (
          <>
            New sheets only, a few times a month at most. Unsubscribe in one
            click.{" "}
            <Link to="/privacy" className="link-quiet">
              Privacy policy
            </Link>
          </>
        )}
      </p>
    </form>
  )
}
