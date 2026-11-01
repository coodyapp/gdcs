import { primeSheets } from "./index"
import type { Sheet } from "./types"

/**
 * Server/build only. Eagerly loads every full sheet and primes the cache so
 * SSR renders synchronously. Never import this from client code.
 */
const modules = import.meta.glob<Sheet>("./sheets/**/*.ts", {
  eager: true,
  import: "default",
})

export const fullSheets: Sheet[] = Object.values(modules)
primeSheets(fullSheets)
