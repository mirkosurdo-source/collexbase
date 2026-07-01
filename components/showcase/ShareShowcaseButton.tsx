"use client"

import { useState } from "react"
import { chatFetch } from "@/lib/chat-client"

/**
 * Lets a showcase owner publish a community post that links back to their
 * public showcase (Blocco 32). Reuses the community post create API.
 */
export default function ShareShowcaseButton({
  username,
  title,
}: {
  username: string
  title: string
}) {
  const [sharing, setSharing] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  async function share() {
    setSharing(true)
    setError("")
    try {
      const url = `/showcase/${username}`
      const res = await chatFetch<{ success: boolean; message?: string }>("/api/community/post/create", {
        method: "POST",
        body: JSON.stringify({
          kind: "post",
          body: `Ho aggiornato la mia vetrina "${title || "collezione"}"! Dai un'occhiata ai miei pezzi migliori 👉 ${url}`,
          category: "Vetrine",
        }),
      })
      if (res.success) {
        setDone(true)
        setTimeout(() => setDone(false), 2500)
      } else {
        setError(res.message || "Errore durante la condivisione.")
      }
    } catch {
      setError("Errore durante la condivisione.")
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={share}
        disabled={sharing}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
      >
        {sharing ? "Condivisione…" : done ? "Condivisa nella community!" : "Condividi nella community"}
      </button>
      {error ? <span className="mt-1 text-xs text-destructive">{error}</span> : null}
    </div>
  )
}
