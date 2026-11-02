import { Link } from "react-router-dom"

import { siteConfig } from "@/config/site"
import { sheets } from "@/content"

export function AboutPage() {
  return (
    <article className="prose-sheet mx-auto max-w-3xl space-y-6">
      <h1 className="font-heading text-display">About GDCS</h1>
      <p className="text-lead text-muted-foreground">
        {siteConfig.longName} is a visual knowledge base of {sheets.length}{" "}
        cheat sheets. It starts with game development and physics and will grow
        into other topics.
      </p>
      <h2>How a sheet is built</h2>
      <ul>
        <li>
          <strong>Interactive visual.</strong> A small Three.js scene with a few
          controls. Change one value and watch the concept respond.
        </li>
        <li>
          <strong>What it is.</strong> A short, plain-language explanation.
        </li>
        <li>
          <strong>Formulas and rules of thumb.</strong> The math, plus the
          numbers you would actually start with.
        </li>
        <li>
          <strong>Implementation.</strong> A compact TypeScript/Three.js snippet
          or engine-neutral pseudocode.
        </li>
        <li>
          <strong>Common mistakes.</strong> The bugs people usually hit first.
        </li>
        <li>
          <strong>Prompt.</strong> A ready-to-paste instruction for your AI
          coding assistant.
        </li>
      </ul>
      <h2>Using GDCS with AI</h2>
      <ul>
        <li>
          <strong>Copy prompt</strong> on any card or page puts a focused
          implementation prompt on your clipboard.
        </li>
        <li>
          <strong>Copy as Markdown</strong> copies the full sheet. Every sheet
          also has a Markdown twin: add <code className="inline-code">.md</code>{" "}
          to its URL.
        </li>
        <li>
          <a href="/llms.txt" className="link-quiet">
            /llms.txt
          </a>{" "}
          indexes every sheet, and{" "}
          <a href="/llms-full.txt" className="link-quiet">
            /llms-full.txt
          </a>{" "}
          is the whole corpus in one file.
        </li>
        <li>
          Pages carry schema.org structured data (TechArticle, LearningResource,
          BreadcrumbList).
        </li>
      </ul>
      <h2>Accuracy</h2>
      <p>
        Visuals teach a technique. They are not complete engine implementations,
        and timings and sizes are starting points to tune. The physics models
        are tested against their reference equations. Corrections are welcome at{" "}
        <a href="mailto:hi@coody.app" className="link-quiet">
          hi@coody.app
        </a>
        .
      </p>
      <h2>Credits</h2>
      <p>
        Built by{" "}
        <a href={siteConfig.authorUrl} className="link-quiet" rel="noopener">
          Coody
        </a>{" "}
        with React, Three.js, React Three Fiber and KaTeX. See the{" "}
        <Link to="/license" className="link-quiet">
          license
        </Link>{" "}
        and the{" "}
        <a href="/third-party-licenses.txt" className="link-quiet">
          third-party licenses
        </a>
        .
      </p>
    </article>
  )
}
