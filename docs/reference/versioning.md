# Versioning and releases

GDCS follows [Semantic Versioning](https://semver.org). The version lives in `package.json` and shows in the hero and footer. Each release is tagged `vX.Y.Z`, and `CHANGELOG.md` is published at `/changelog` on every build.

- **MAJOR:** breaking changes to a public surface: sheet URLs, the `.md`, `llms.txt` or `feed.json` formats, embed URLs, or the API.
- **MINOR:** new sheets, categories, learning paths or features.
- **PATCH:** fixes and content corrections.

## Release steps

1. Move the `[Unreleased]` entries in `CHANGELOG.md` under a new version heading.
2. Set the version in `package.json`.
3. Check that `pnpm exec vp check`, `pnpm exec vp test --run` and `pnpm build` pass.
4. Commit, tag with `git tag -a vX.Y.Z -m "vX.Y.Z"`, and push with `git push origin main --follow-tags`.

Any push to `main` deploys through `.github/workflows/cd.yaml`.

## `PROTOCOL_VERSION`

GDCS has no `PROTOCOL_VERSION` today. It has no client that negotiates a wire format: the public formats above are versioned by the MAJOR number. If a versioned protocol is ever added, define the constant in code and document it here.

## Migrations

D1 migrations live in `migrations/`, named `NNNN_description.sql` with the next four-digit number. They run during deployment, before the new Worker goes live, so they must be additive and work with the Worker that is still running. Never edit a migration that has shipped.
