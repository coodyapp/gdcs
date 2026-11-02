import type { MouseEvent } from "react"

import "./site-credits.css"

export interface SiteCreditsProps {
  /** Name after the year. Default "coody.app". */
  owner?: string
  /** Where the name links. Default https://coody.app. */
  ownerHref?: string
  /** Quote text, without quotation marks. Pass "" to hide the quote. */
  quote?: string
  /** Who said it. */
  quoteAuthor?: string
  /** Id of the element that Back to top moves focus to. Default "main". */
  topTarget?: string
  className?: string
}

function scrollToTop(event: MouseEvent, target: string) {
  event.preventDefault()
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
  document.getElementById(target)?.focus({ preventScroll: true })
}

/**
 * Coody site credits: where it was built, a quote, the year and Back to top.
 * Portable: React + one CSS file, no Tailwind. Inherits colour and font size.
 */
export function SiteCredits({
  owner = "coody.app",
  ownerHref = "https://coody.app",
  quote = "If I have seen further, it is by standing on the shoulders of giants",
  quoteAuthor = "Newton",
  topTarget = "main",
  className,
}: SiteCreditsProps) {
  return (
    <div className={className ? `coody-credits ${className}` : "coody-credits"}>
      <p className="coody-credits__built">
        Built in
        <svg
          className="coody-credits__flag"
          viewBox="0 0 20 14"
          role="img"
          aria-label="Brazil"
        >
          <rect width="20" height="14" rx="2" fill="#009c3b" />
          <path d="M10 1.8 18 7l-8 5.2L2 7z" fill="#ffdf00" />
          <circle cx="10" cy="7" r="3" fill="#002776" />
        </svg>
      </p>
      {quote && (
        <p className="coody-credits__quote">
          “{quote}”{quoteAuthor && `, ${quoteAuthor}`}.
        </p>
      )}
      <p suppressHydrationWarning>
        © {new Date().getFullYear()}{" "}
        <a href={ownerHref} rel="noopener">
          {owner}
        </a>
      </p>
      <a
        href={`#${topTarget}`}
        className="coody-credits__top"
        onClick={(event) => scrollToTop(event, topTarget)}
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 12 7-7 7 7" />
          <path d="M12 19V5" />
        </svg>
        Back to top
      </a>
    </div>
  )
}
