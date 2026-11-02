import type { CSSProperties } from "react"

import "./powered-by.css"

import logo from "./coody-logo-white.webp"

/** Intrinsic ratio of coody-logo-white.webp (3× asset, 252×84). */
const RATIO = 3

export interface PoweredByProps {
  /** Small caption above the mark. Default "Powered by"; pass "" to hide it. */
  label?: string
  /** Logo height in px. Default 28. */
  height?: number
  /** Link target. Default https://coody.app with UTM source = this site. */
  href?: string
  /** Utm source added to the default href (e.g. "gdcs"). */
  source?: string
  /** Align caption and mark. Default start; omit to let CSS (className) decide. */
  align?: "start" | "center" | "end"
  className?: string
}

/**
 * Coody "Powered by" mark with the brand glitch. Portable: React + one CSS
 * file + the logo asset, no Tailwind. Copy `components/coody/` to any project.
 */
export function PoweredByCoody({
  label = "Powered by",
  height = 28,
  href,
  source,
  align,
  className,
}: PoweredByProps) {
  const url =
    href ??
    `https://coody.app/${source ? `?utm_source=${encodeURIComponent(source)}&utm_medium=powered_by` : ""}`
  const style = {
    "--coody-pb-height": `${height}px`,
    ...(align && {
      "--coody-pb-align": {
        start: "flex-start",
        center: "center",
        end: "flex-end",
      }[align],
    }),
  } as CSSProperties
  return (
    <a
      href={url}
      className={
        className ? `coody-powered-by ${className}` : "coody-powered-by"
      }
      style={style}
      rel="noopener"
      aria-label={`${label || "Powered by"} Coody`}
    >
      {label && (
        <span className="coody-powered-by__label" aria-hidden="true">
          {label}
        </span>
      )}
      <span className="coody-powered-by__mark" aria-hidden="true">
        <img
          src={logo}
          alt=""
          width={height * RATIO}
          height={height}
          loading="lazy"
          decoding="async"
        />
        <img
          src={logo}
          alt=""
          className="coody-powered-by__slice coody-powered-by__slice--a"
        />
        <img
          src={logo}
          alt=""
          className="coody-powered-by__slice coody-powered-by__slice--b"
        />
      </span>
    </a>
  )
}
