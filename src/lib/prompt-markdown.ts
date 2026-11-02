/**
 * A sheet's prompt as Markdown: the title as a heading, each sentence as a bullet.
 * The wording never changes. Used wherever a prompt is shown or copied.
 */
export function promptMarkdown(title: string, prompt: string) {
  const sentences = prompt
    .trim()
    // After a sentence end and before a capital, a backtick or a quote. A lone
    // number ("1.") or a common abbreviation does not end a sentence.
    .split(/(?<=[^\d\s][.?!])\s+(?=[A-Z`"])/)
    .reduce<string[]>((all, part) => {
      const last = all.at(-1)
      if (last && /\b(?:e\.g|i\.e|vs|etc)\.$/i.test(last))
        all[all.length - 1] = `${last} ${part}`
      else all.push(part)
      return all
    }, [])
  return [`# ${title}`, "", ...sentences.map((s) => `- ${s}`)].join("\n")
}
