import { Link } from "react-router-dom"
import { Compass } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty"

export function NotFoundPage() {
  return (
    <Empty className="min-h-[50vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Compass aria-hidden />
        </EmptyMedia>
        <h1 className="font-heading text-2xl">Page not found</h1>
        <EmptyDescription>
          This address does not match any cheat sheet.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/" />}>
          Browse all sheets
        </Button>
      </EmptyContent>
    </Empty>
  )
}
