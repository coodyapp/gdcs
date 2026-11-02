import { SubscribeForm } from "@/components/subscribe-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/** Signup dialog, full screen on phones. Lazy: loaded when the hero button is first used. */
export default function UpdatesDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 p-6 max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:content-center max-sm:rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">
            New cheat sheets, in your inbox
          </DialogTitle>
          <DialogDescription>
            An occasional digest when new visual sheets are published. We send a
            confirmation link first.
          </DialogDescription>
        </DialogHeader>
        <SubscribeForm />
      </DialogContent>
    </Dialog>
  )
}
