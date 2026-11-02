/**
 * Writes public/third-party-licenses.txt: our list of third-party software and
 * references, then the license text of every production dependency. These
 * licenses ask for their notices to travel with the software, and the
 * repository is private. Run after changing dependencies: pnpm notices
 */
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const listed = JSON.parse(
  execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
) as Record<string, { name: string; versions: string[]; paths: string[] }[]>

const licenseText = (dir: string) => {
  if (!existsSync(dir)) return null
  const file = readdirSync(dir).find((f) =>
    /^(licen[cs]e|copying|notice)(\.|-|$)/i.test(f)
  )
  return file ? readFileSync(path.join(dir, file), "utf8").trim() : null
}

const packages = Object.entries(listed)
  .flatMap(([license, list]) => list.map((p) => ({ ...p, license })))
  .sort((a, b) => a.name.localeCompare(b.name))

const rule = "=".repeat(72)
const sections = packages.map((p) => {
  const text = licenseText(p.paths[0])
  return [
    rule,
    `${p.name} ${p.versions.join(", ")} (${p.license})`,
    rule,
    text ?? `Licensed under ${p.license}; the package ships no license file.`,
  ].join("\n")
})
const missing = packages.filter((p) => !licenseText(p.paths[0]))

writeFileSync(
  path.join(root, "public", "third-party-licenses.txt"),
  [
    "GDCS third-party licenses. GDCS's own license: https://gdcs.coody.app/license",
    "",
    readFileSync(path.join(root, "THIRD_PARTY_LICENSES.md"), "utf8").trim(),
    "",
    ...sections,
    "",
  ].join("\n")
)
console.log(
  `${packages.length} packages, ${missing.length} without a license file`
)
for (const p of missing) console.log(`  no file: ${p.name} (${p.license})`)
