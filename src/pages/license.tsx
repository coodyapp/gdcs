import { Link } from "react-router-dom"

import { getSheet } from "@/content"
import { attributionText, CC_BY_URL, embedCode } from "@/lib/embed"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { SheetCode } from "@/components/sheet-code"

const example = getSheet("projectile-motion")!

const PARTS = [
  {
    what: "Sheet text and images",
    license: "CC BY 4.0",
    terms:
      "Reuse and adapt them, even commercially. Credit GDCS and link to the sheet.",
  },
  {
    what: "Code examples and prompts",
    license: "MIT",
    terms:
      "Use them in anything, including paid games, with no credit on screen. If you copy a large part, keep the copyright notice in your source.",
  },
  {
    what: "Simulations and site code",
    license: "All rights reserved",
    terms: "Embed them with our embed code. Copying them needs permission.",
  },
]

export function LicensePage() {
  return (
    <article className="prose-sheet mx-auto max-w-3xl space-y-6">
      <Breadcrumbs items={[{ label: "License" }]} />
      <h1 className="font-heading text-display">License</h1>
      <p className="text-lead text-muted-foreground">
        Learn from GDCS, reuse the text with credit, use the code in your games
        and embed the simulations. The simulations themselves stay on GDCS.
      </p>

      <section aria-labelledby="parts">
        <h2 id="parts">What covers what</h2>
        <dl className="mt-4 grid gap-4">
          {PARTS.map((p) => (
            <div key={p.what} className="border-b pb-4 last:border-0">
              <dt className="font-medium">
                {p.what}: {p.license}
              </dt>
              <dd className="mt-1 text-muted-foreground">{p.terms}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="embed">
        <h2 id="embed">Embed a simulation</h2>
        <p>
          Every sheet has a <strong>Copy embed code</strong> button. Embedding
          is free, on any site, including commercial ones. Paste the code as it
          is:
        </p>
        <SheetCode
          code={embedCode(example)}
          lang="html"
          title="Embed code"
          wrap
        />
        <p>Two conditions:</p>
        <ul>
          <li>
            Keep the link under the iframe on your page. It is part of the
            license.
          </li>
          <li>
            Load the iframe from gdcs.coody.app, and do not crop or cover it so
            that its link to GDCS is hidden.
          </li>
        </ul>
        <p>
          Embeds set no cookies, and you can change the width and height to suit
          your layout. They are provided as is, with no warranty. We may change
          or remove them, and may withdraw permission from a site that does not
          follow these terms.
        </p>
      </section>

      <section aria-labelledby="reuse">
        <h2 id="reuse">Reuse or adapt the text</h2>
        <p>
          Quote, translate or adapt a sheet under{" "}
          <a href={CC_BY_URL} className="link-quiet" rel="noopener">
            CC BY 4.0
          </a>
          . Say if you changed it, and credit it like this. Reusing an image of
          a simulation does not license the simulation or its code.
        </p>
        <SheetCode
          code={attributionText(example)}
          lang="text"
          title="Attribution text"
          wrap
        />
      </section>

      <section aria-labelledby="not-allowed">
        <h2 id="not-allowed">What needs permission</h2>
        <ul>
          <li>
            Copying, rehosting or extracting a simulation or its JavaScript,
            including from your browser&rsquo;s developer tools.
          </li>
          <li>Adapting a simulation&rsquo;s code into your own product.</li>
          <li>Using the Coody or GDCS names or logos as your own branding.</li>
        </ul>
        <p>
          Writing your own version of a concept is always fine. That is what the
          prompts are for.
        </p>
      </section>

      <section aria-labelledby="ai">
        <h2 id="ai">AI tools and search engines</h2>
        <p>
          Crawlers and AI assistants are welcome to read the site, including{" "}
          <a href="/llms.txt" className="link-quiet">
            llms.txt
          </a>{" "}
          and the Markdown version of each sheet. When an answer uses a sheet,
          credit GDCS and link to it.
        </p>
      </section>

      <section aria-labelledby="third-party">
        <h2 id="third-party">Third-party software</h2>
        <p>
          GDCS is built on open source software that keeps its own licenses,
          listed in full in{" "}
          <a href="/third-party-licenses.txt" className="link-quiet">
            third-party licenses
          </a>
          . Nothing on this page changes them.
        </p>
      </section>

      <section aria-labelledby="ask">
        <h2 id="ask">Ask for something else</h2>
        <p>
          Need a different arrangement? Write to{" "}
          <a href="mailto:hi@coody.app" className="link-quiet">
            hi@coody.app
          </a>
          . See also the{" "}
          <Link to="/privacy" className="link-quiet">
            privacy policy
          </Link>
          .
        </p>
      </section>
    </article>
  )
}
