# AGENTS.md

GDCS (gdcs.coody.app): visual, AI-ready cheat sheets. Vite+ (`vp`) · React 19 · TypeScript · Tailwind v4 · React Three Fiber · KaTeX (build time) · one Cloudflare Worker (Static Assets + API + mailer + cron) + D1.

- Adding or editing a sheet: follow `docs/reference/authoring.md` (two files per slug; no registry edits).
- Validate: `pnpm exec vp check`, `pnpm exec vp test --run`, `pnpm build`.
- Content is original. Never copy from or name other cheat-sheet sites. Credits go in `THIRD_PARTY_LICENSES.md`.
- After changing dependencies, run `pnpm notices`.
- Plans and progress: `tasks/todo.md`; content backlog: `tasks/roadmap.md`.

## Documentation and changelog (every change)

- Behaviour change → update the matching file in `docs/reference/` in the same
  change. Code wins over docs; fix the doc, never leave them diverging.
- Add a line under `[Unreleased]` in `CHANGELOG.md` (Keep a Changelog
  categories) describing the user-visible effect.
- New or reversed design decision → ADR `docs/decisions/NNNN-*.md`
  (`IMPL-NNNN`, MADR-lite). Question only the product owner can answer →
  `docs/decisions/open-questions.md`; do not decide for them.
- Releases follow `docs/reference/versioning.md` (SemVer, `PROTOCOL_VERSION`,
  migration numbering). Commit messages: Conventional Commits.
- Docs are en-US; identifiers, commands and program output stay in English.
  Index: `docs/README.md`.
