import { useEffect, useState } from "react"

import { SubscribeForm } from "@/components/subscribe-form"

const notices: Record<string, string> = {
  confirmed: "You're subscribed. The next update will land in your inbox.",
  unsubscribed: "You've been unsubscribed. No more emails.",
  invalid: "That link is invalid or has expired. Subscribe again below.",
}

export function UpdatesPage() {
  // Read after hydration: the prerendered HTML has no query string.
  const [notice, setNotice] = useState<string>()
  useEffect(() => {
    setNotice(
      notices[new URLSearchParams(window.location.search).get("status") ?? ""]
    )
  }, [])
  return (
    <section className="mx-auto max-w-2xl space-y-6 py-6">
      <p className="eyebrow">Get updates</p>
      <h1 className="font-heading text-display">
        New cheat sheets, in your inbox
      </h1>
      <p className="text-lead text-muted-foreground">
        An occasional digest when new visual cheat sheets are published: game
        dev, math, physics and more. No tracking pixels.
      </p>
      {notice && (
        <p role="status" className="rounded-lg border bg-card p-4 text-sm">
          {notice}
        </p>
      )}
      <SubscribeForm />
    </section>
  )
}
