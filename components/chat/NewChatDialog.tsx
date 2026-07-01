"use client"

import { useEffect, useState } from "react"
import { X, Search, Loader2 } from "lucide-react"
import { chatFetch, type ChatUserDTO, type ChatThreadDTO } from "@/lib/chat-client"

export default function NewChatDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (thread: ChatThreadDTO) => void
}) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<ChatUserDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [creatingId, setCreatingId] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) {
      setQ("")
      setResults([])
      setError("")
      return
    }
  }, [open])

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const id = setTimeout(() => {
      chatFetch<{ success: boolean; users?: ChatUserDTO[] }>(`/api/chat/users/search?q=${encodeURIComponent(q.trim())}`)
        .then((res) => !cancelled && setResults(res.users || []))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [q, open])

  async function start(user: ChatUserDTO) {
    setCreatingId(user.id)
    setError("")
    const res = await chatFetch<{ success: boolean; message?: string; thread?: ChatThreadDTO }>("/api/chat/thread", {
      method: "POST",
      body: JSON.stringify({ type: "private", targetUserId: user.id }),
    })
    setCreatingId("")
    if (res.success && res.thread) {
      onCreated(res.thread)
      onClose()
    } else {
      setError(res.message || "Impossibile avviare la chat.")
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 p-4 pt-24" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Nuova chat privata</h2>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca per username…"
              className="flex-1 bg-transparent text-sm text-foreground outline-none"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <ul className="mt-3 max-h-64 divide-y divide-border overflow-y-auto">
            {results.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => start(u)}
                  disabled={!!creatingId}
                  className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-accent/50 disabled:opacity-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                    {u.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar || "/placeholder.svg"} alt={u.username} className="h-full w-full object-cover" />
                    ) : (
                      u.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="flex-1 truncate text-sm text-foreground">{u.username}</span>
                  {creatingId === u.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </button>
              </li>
            ))}
            {q.trim().length >= 2 && !loading && results.length === 0 && (
              <li className="px-1 py-3 text-center text-xs text-muted-foreground">Nessun utente trovato.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
