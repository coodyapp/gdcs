import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

/** The site's one-line description with its version, as in the hero and footer. */
export function Tagline({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {siteConfig.tagline}.{" "}
      <a
        href={siteConfig.changelog}
        rel="noopener"
        title="Changelog"
        className="whitespace-nowrap tabular-nums transition-colors hover:text-foreground"
      >
        v{siteConfig.version}
      </a>
    </p>
  )
}
