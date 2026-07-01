"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import ChatWindow from "@/components/chat/ChatWindow"
import { chatFetch } from "@/lib/chat-client"

const CONTEXT_LABELS: Record<string, string> = {
  trade: "scambio",
  listing: "vendita",
  auction: "asta",
}

export default function ContextChatClient({ context, id }: { context: string; id: string }) {
  const router = useRouter()
  const [threadId, setThreadId] = useState<string | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const label = CONTEXT_LABELS[context] ?? "conversazione"

  useEffect(() => {
    let active = true
    async function init() {
      const me = await chatFetch<{ success?: boolean; user?: { id: string } }>("/api/auth/me").catch(() => null)
      const uid = me?.user?.id
      if (!uid) {
        router.replace(`/login?redirect=/chat/c/${context}/${id}`)
        return
      }
      if (active) setMeId(uid)

      const res = await chatFetch<{ success: boolean; threadId?: string; message?: string }>(
        "/api/chat/thread",
        {
          method: "POST",
          body: JSON.stringify({ contextType: context, contextId: id }),
        },
      )
      if (!active) return
      if (res.success && res.threadId) {
        setThreadId(res.threadId)
      } else {
        setError(res.message ?? "Impossibile aprire la chat per questo contesto.")
      }
      setLoading(false)
    }
    init()
    return () => {
      active = false
    }
  }, [context, id, router])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    )
  }

  if (error || !threadId || !meId) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-pretty text-sm text-muted-foreground">{error ?? "Chat non disponibile."}</p>
        <Link
          href="/chat"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Vai alle chat
        </Link>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <Link href="/chat" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            ← Tutte le chat
          </Link>
          <h1 className="text-pretty text-xl font-semibold text-foreground">
            Chat {label}
          </h1>
        </div>
      </div>
      <div className="h-[70vh] overflow-hidden rounded-xl border border-border bg-card">
        <ChatWindow threadId={threadId} currentUserId={meId} />
      </div>
    </main>
  )
}
