import { Breadcrumbs } from "@/components/breadcrumbs"

/** Bump together with CONSENT_VERSION in worker/api/subscribe.ts. */
export const PRIVACY_VERSION = "2026-11-02"

export function PrivacyPage() {
  return (
    <article className="prose-sheet mx-auto max-w-3xl space-y-6">
      <Breadcrumbs items={[{ label: "Privacy policy" }]} />
      <h1 className="font-heading text-display">Privacy policy</h1>
      <p className="text-text-3">Version {PRIVACY_VERSION}</p>

      <section aria-labelledby="p-signup">
        <h2 id="p-signup">Signup security</h2>
        <p>
          The signup form uses Cloudflare Turnstile. Cloudflare processes the
          information needed to perform its security check under its{" "}
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            className="link-quiet"
            rel="noopener"
          >
            privacy policy
          </a>
          . The server validates the result before accepting a signup.
        </p>
      </section>

      <section aria-labelledby="p-analytics">
        <h2 id="p-analytics">Analytics</h2>
        <p>
          We count pageviews, referrer domains and broad device and browser
          categories, and we measure page loading, responsiveness and layout
          stability with Cloudflare Web Analytics. It uses no cookies, no local
          storage, no persistent visitor identifier and no fingerprint.
        </p>
        <p>
          Our own server counts clicks on the copy buttons (prompt and Markdown)
          as daily totals per page, with no visitor identifier.
        </p>
        <p>
          The “visited” ticks and “recently viewed” list are kept in your
          browser’s local storage only. They are never sent to us, and you can
          clear them by clearing this site’s data.
        </p>
      </section>

      <section aria-labelledby="p-newsletter">
        <h2 id="p-newsletter">Newsletter</h2>
        <p>
          If you subscribe, we store your email address, the subscription date,
          the page you signed up from, the version of this policy you agreed to,
          and random confirmation and unsubscribe tokens. Your address is only
          used to confirm the subscription and to send new cheat sheets and site
          updates. Every newsletter includes an unsubscribe link, and
          unsubscribing deletes your subscription record.
        </p>
      </section>

      <section aria-labelledby="p-contact">
        <h2 id="p-contact">Contact</h2>
        <p>
          Questions:{" "}
          <a href="mailto:hi@coody.app" className="link-quiet">
            hi@coody.app
          </a>
          .
        </p>
      </section>
    </article>
  )
}
