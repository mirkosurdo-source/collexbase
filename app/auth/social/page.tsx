"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

// Blocco 49 — receives the JWT from the Google callback via URL fragment
// (fragments are never sent to the server or logged), stores it like the
// email/password flow, then forwards to the dashboard.
export default function SocialAuthPage() {
  const router = useRouter()
  const [error, setError] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash
    const token = new URLSearchParams(hash).get("token")

    if (!token) {
      setError(true)
      const t = setTimeout(() => router.replace("/login?social=error"), 1500)
      return () => clearTimeout(t)
    }

    localStorage.setItem("token", token)
    document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
    // Clear the fragment so the token isn't left in the address bar / history.
    window.history.replaceState(null, "", "/auth/social")
    router.replace("/dashboard")
    router.refresh()
  }, [router])

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {error ? "Accesso non riuscito, reindirizzamento..." : "Completamento accesso con Google..."}
        </p>
      </div>
    </div>
  )
}
