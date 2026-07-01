"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function LiveTradeStartPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error"; message: string }>({
    type: "idle",
    message: "",
  })

  async function startTrade(e: React.FormEvent) {
    e.preventDefault()
    const target = username.trim()
    if (!target) {
      setStatus({ type: "error", message: "Inserisci lo username del destinatario." })
      return
    }
    setStatus({ type: "loading", message: "" })
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const res = await fetch("/api/live-trade/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ toUsername: target }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setStatus({ type: "error", message: data.message || "Impossibile avviare lo scambio." })
        return
      }
      router.push(`/trade/live/${data.trade.id}`)
    } catch {
      setStatus({ type: "error", message: "Errore di rete. Riprova." })
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-xl flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-balance text-2xl font-semibold text-card-foreground">Scambio Live</h1>
        <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
          Avvia una sessione di scambio in tempo reale con un altro collezionista. Aggiungete oggetti,
          chattate e confermate entrambi per finalizzare.
        </p>

        <form onSubmit={startTrade} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-card-foreground">Username del destinatario</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="es. mario_rossi"
              className="rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          {status.type === "error" ? (
            <p className="text-sm text-destructive" role="alert">
              {status.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={status.type === "loading"}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {status.type === "loading" ? "Avvio in corso..." : "Avvia scambio"}
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center">
          <Link href="/trade" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Torna agli scambi
          </Link>
        </div>
      </div>
    </main>
  )
}
