import { HttpError } from "./http"

const EMAIL =
  /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

/** Validates and normalizes an email (trim + lowercase domain and local part). */
export function parseEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (email.length > 254 || !EMAIL.test(email))
    throw new HttpError(400, "Enter a valid email address.")
  return email
}

/** A filled honeypot field means a bot. */
export const isBot = (body: Record<string, unknown>) =>
  typeof body.website === "string" && body.website.trim() !== ""

export const cleanSource = (value: unknown) =>
  typeof value === "string" && value.startsWith("/") ? value.slice(0, 200) : ""

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/
export const isToken = (value: string | null): value is string =>
  Boolean(value && TOKEN.test(value))
