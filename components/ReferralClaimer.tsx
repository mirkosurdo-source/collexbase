"use client"

import { useEffect, useRef } from "react"

/**
 * Blocco 51.1 — completes the referral attribution loop. When a logged-in user
 * (token present) has a pending invite code stored by the `/i/<code>` landing
 * page, this fires the claim once and clears the stored code. Fully additive:
 * it touches no auth flow and silently no-ops when there's nothing to claim.
 */
export default function ReferralClaimer() {
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return

    let token: string | null = null
    let code: string | null = null
    try {
      token = localStorage.getItem("token")
      code = localStorage.getItem("collexbase:ref")
    } catch {
      return
    }
    if (!token || !code) return

    attempted.current = true
    ;(async () => {
      try {
        const res = await fetch("/api/referral/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code, method: "link" }),
        })
        // Clear on success or any definitive rejection (self-invite, duplicate,
        // invalid code) so we don't retry a code that will never succeed.
        if (res.status !== 401) {
          try {
            localStorage.removeItem("collexbase:ref")
          } catch {
            // ignore
          }
        }
      } catch {
        // Network error — leave the code in place to retry on next mount.
        attempted.current = false
      }
    })()
  }, [])

  return null
}
