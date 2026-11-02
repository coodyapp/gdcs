import { lazy, Suspense, useEffect, useState } from "react"
import { Mail, X } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const UpdatesDialog = lazy(() => import("@/components/updates-dialog"))

/** Hero button: opens the signup dialog (loaded on first click). */
export function GetUpdatesButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      <Button
        size="lg"
        aria-haspopup="dialog"
        className={`h-11 px-5 ${className}`}
        onClick={() => {
          setLoaded(true)
          setOpen(true)
        }}
      >
        <Mail aria-hidden /> Get updates
      </Button>
      {loaded && (
        <Suspense fallback={null}>
          <UpdatesDialog open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
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
    <Alert className="fixed inset-x-4 top-4 z-50 mx-auto max-w-xl pr-12 shadow-2xl">
      <Mail aria-hidden />
      <AlertDescription className="text-foreground">{notice}</AlertDescription>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Dismiss"
        className="absolute top-2 right-2"
        onClick={() => setNotice(undefined)}
      >
        <X aria-hidden />
      </Button>
    </Alert>
  )
}
