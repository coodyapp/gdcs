import { useId, useState, type FormEvent } from "react"

import { Link } from "react-router-dom"

import { useTurnstile } from "@/hooks/use-turnstile"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

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

  const busy = status === "sending" || status === "sent"
  return (
    <form onSubmit={onSubmit} noValidate={false}>
      <Field data-invalid={status === "error" || undefined}>
        <FieldLabel htmlFor={id} className="sr-only">
          Email address
        </FieldLabel>
        <div
          className={compact ? "flex gap-2" : "flex flex-col gap-2 sm:flex-row"}
        >
          <Input
            id={id}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@studio.dev"
            aria-invalid={status === "error" || undefined}
            className="h-10 w-full min-w-0 sm:flex-1"
            disabled={busy}
          />
          {/* Honeypot: real people never see or fill this. */}
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden
          />
          <Button type="submit" size="lg" className="h-10 px-4" disabled={busy}>
            {status === "sending" && <Spinner />}
            {status === "sending" ? "Sending" : "Get updates"}
          </Button>
        </div>
        <div
          ref={human.container}
          aria-hidden="true"
          className="h-0 overflow-hidden"
        />
        {status === "error" ? (
          <FieldError>{message}</FieldError>
        ) : (
          <FieldDescription role="status">
            {message || (
              <>
                New sheets only, a few times a month at most. Unsubscribe in one
                click.{" "}
                <Link to="/privacy" className="link-quiet">
                  Privacy policy
                </Link>
              </>
            )}
          </FieldDescription>
        )}
      </Field>
    </form>
  )
}
