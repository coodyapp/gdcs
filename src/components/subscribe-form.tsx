import { useState, type FormEvent } from "react"

type Status = "idle" | "sending" | "sent" | "error"

/** Email signup; the API sends a confirmation link (double opt-in). */
export function SubscribeForm({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setStatus("sending")
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          website: String(form.get("website") ?? ""),
          source: window.location.pathname,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok)
        throw new Error(data.error ?? "Something went wrong. Try again.")
      setStatus("sent")
      setMessage("Check your inbox and confirm your subscription.")
    } catch (error) {
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
        <label htmlFor="subscribe-email" className="sr-only">
          Email address
        </label>
        <input
          id="subscribe-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@studio.dev"
          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-foreground/50"
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
        <button
          type="submit"
          className="chip h-10 !rounded-md bg-foreground !text-background hover:bg-foreground/90"
          disabled={status === "sending" || status === "sent"}
        >
          {status === "sending" ? "Sending…" : "Get updates"}
        </button>
      </div>
      <p
        role="status"
        className={
          status === "error"
            ? "text-sm text-red-400"
            : "text-sm text-muted-foreground"
        }
      >
        {message ||
          "New sheets only, a few times a month at most. Unsubscribe in one click."}
      </p>
    </form>
  )
}
