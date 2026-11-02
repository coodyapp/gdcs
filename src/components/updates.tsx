import { useEffect, useRef, useState } from "react"
import { Mail, X } from "lucide-react"

import { SubscribeForm } from "@/components/subscribe-form"

/** Hero button: opens the signup in a dialog (full screen on phones). */
export function GetUpdatesButton({ className = "" }: { className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        className={`chip !min-h-11 bg-foreground !text-background hover:bg-foreground/90 ${className}`}
        onClick={() => {
          dialog.current?.showModal()
          setOpen(true)
        }}
      >
        <Mail className="size-4" aria-hidden /> Get updates
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="updates-dialog-title"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-popover p-0 text-foreground shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm max-sm:m-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0"
      >
        <div className="flex h-full flex-col gap-6 p-6 max-sm:justify-center">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">Get updates</p>
              <h2 id="updates-dialog-title" className="font-heading text-2xl">
                New cheat sheets, in your inbox
              </h2>
            </div>
            <button
              type="button"
              className="chip !min-h-9 !min-w-9 !px-2"
              aria-label="Close"
              onClick={() => dialog.current?.close()}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            An occasional digest when new visual sheets are published. We send a
            confirmation link first.
          </p>
          {open && <SubscribeForm />}
        </div>
      </dialog>
    </>
  )
}

const NOTICES: Record<string, string> = {
  confirmed: "You're subscribed. The next update will land in your inbox.",
  unsubscribed:
    "You've been unsubscribed and your subscription record was deleted.",
  invalid:
    "That link is invalid or has expired. Subscribe again from the footer.",
}

/** Result of a confirm/unsubscribe link (?updates=…), shown once after hydration. */
export function UpdatesNotice() {
  const [notice, setNotice] = useState<string>()
  useEffect(() => {
    const url = new URL(window.location.href)
    const key = url.searchParams.get("updates")
    if (!key || !NOTICES[key]) return
    setNotice(NOTICES[key])
    url.searchParams.delete("updates")
    window.history.replaceState(window.history.state, "", url)
  }, [])
  if (!notice) return null
  return (
    <div
      role="status"
      className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-white/15 bg-popover p-4 text-sm shadow-2xl"
    >
      <Mail className="size-4 shrink-0 text-text-3" aria-hidden />
      <p className="flex-1">{notice}</p>
      <button
        type="button"
        className="chip !min-h-8 !min-w-8 !px-2"
        aria-label="Dismiss"
        onClick={() => setNotice(undefined)}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}
