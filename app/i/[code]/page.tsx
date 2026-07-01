"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"

/** Blocco 51.1 — short creator/referral link `/i/<code>`. Stores the invite
 * code locally, then forwards to registration. The persisted code is later
 * claimed (once the user has an account) by the ReferralClaimer in the layout. */
export default function InviteLandingPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()
  const [code, setCode] = useState("")

  useEffect(() => {
    const raw = Array.isArray(params.code) ? params.code[0] : params.code
    const clean = (raw || "").trim()
    if (!clean) {
      router.replace("/register")
      return
    }
    setCode(clean)
    try {
      localStorage.setItem("collexbase:ref", clean)
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    const t = setTimeout(() => router.replace("/register"), 1200)
    return () => clearTimeout(t)
  }, [params.code, router])

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-16 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Invito CollexBase</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {code ? (
            <>
              Stai usando il codice invito <span className="font-mono font-semibold">{code}</span>. Ti portiamo alla
              registrazione con i tuoi vantaggi attivi.
            </>
          ) : (
            "Reindirizzamento in corso..."
          )}
        </p>
        <div className="mt-5">
          <a
            href="/register"
            className="inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Continua
          </a>
        </div>
      </div>
    </div>
  )
}
