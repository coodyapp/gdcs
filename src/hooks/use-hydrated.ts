import { useSyncExternalStore } from "react"

const noSubscribe = () => () => {}

/** False in prerendered HTML and until React takes over the page, then true. */
export const useHydrated = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  )
