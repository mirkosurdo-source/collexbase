"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "@/lib/i18n/LanguageProvider"

/**
 * Auth Navbar Block — shows a Login link when the user is signed out and a
 * Logout button when signed in. Auth state is derived from the JWT stored in
 * localStorage under "token" (the same key set by the login flow), so it works
 * with the existing authentication system without extra wiring.
 */
export default function AuthButton() {
  const { t } = useTranslation()
  const router = useRouter()
  // null = not yet resolved (avoids a flash of the wrong button during hydration)
  const [authed, setAuthed] = useState<boolean | null>(null)

  const readToken = useCallback(() => {
    if (typeof window === "undefined") return
    setAuthed(Boolean(window.localStorage.getItem("token")))
  }, [])

  useEffect(() => {
    readToken()
    // Keep in sync when the token changes in another tab or elsewhere in the app.
    window.addEventListener("storage", readToken)
    window.addEventListener("focus", readToken)
    return () => {
      window.removeEventListener("storage", readToken)
      window.removeEventListener("focus", readToken)
    }
  }, [readToken])

  function handleLogout() {
    // Invalidate the client session, then redirect to login.
    localStorage.removeItem("token")
    document.cookie = "token=; path=/; max-age=0"
    setAuthed(false)
    router.replace("/login")
    router.refresh()
  }

  // Avoid rendering the wrong state before the token has been read.
  if (authed === null) {
    return <span className="h-8 w-16 rounded-md" aria-hidden="true" />
  }

  if (!authed) {
    return (
      <Link
        href="/login"
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t("nav.login", "Accedi")}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {t("nav.logout", "Esci")}
    </button>
  )
}
