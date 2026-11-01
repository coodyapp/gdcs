import { Link } from "react-router-dom"

export function NotFoundPage() {
  return (
    <section className="grid min-h-[50vh] place-content-center gap-4 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-heading text-title">Page not found</h1>
      <Link to="/" className="link-quiet">
        Back to all cheat sheets
      </Link>
    </section>
  )
}
