"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, MessageSquare } from "lucide-react"
import { chatFetch, usePolling, useRealtimeTransport, type ChatThreadDTO } from "@/lib/chat-client"
import ChatThreadList from "@/components/chat/ChatThreadList"
import ChatWindow from "@/components/chat/ChatWindow"
import NewChatDialog from "@/components/chat/NewChatDialog"

export default function ChatPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Blocco 29 — a deep-linked thread id (?t=) opened from "Messaggia" buttons.
  const deepLinkId = searchParams.get("t")
  const deepLinkHandled = useRef(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [threads, setThreads] = useState<ChatThreadDTO[]>([])
  const [active, setActive] = useState<ChatThreadDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const transport = useRealtimeTransport()

  // Resolve current user.
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("token")) {
      router.replace("/login")
      return
    }
    chatFetch<{ success: boolean; user?: { id: string } }>("/api/auth/me")
      .then((res) => {
        if (res.success && res.user) setUserId(res.user.id)
        else router.replace("/login")
      })
      .catch(() => router.replace("/login"))
  }, [router])

  const loadThreads = useCallback(async () => {
    const res = await chatFetch<{ success: boolean; threads?: ChatThreadDTO[] }>("/api/chat/threads")
    if (res.success && res.threads) {
      setThreads(res.threads)
      setActive((prev) => {
        if (!prev) return prev
        const updated = res.threads!.find((t) => t.id === prev.id)
        return updated || prev
      })
    }
    setLoading(false)
  }, [])

  usePolling(loadThreads, 5000, [])

  // Blocco 29 — auto-open a deep-linked private conversation (?t=threadId).
  useEffect(() => {
    if (!userId || !deepLinkId || deepLinkHandled.current) return
    const existing = threads.find((t) => t.id === deepLinkId)
    if (existing) {
      deepLinkHandled.current = true
      setActive(existing)
      return
    }
    // Not in the list yet (freshly created thread) — fetch it directly once.
    deepLinkHandled.current = true
    chatFetch<{ success: boolean; thread?: ChatThreadDTO }>(`/api/chat/thread/${deepLinkId}`)
      .then((res) => {
        if (res.success && res.thread) {
          setThreads((prev) => (prev.find((p) => p.id === res.thread!.id) ? prev : [res.thread!, ...prev]))
          setActive(res.thread)
        }
      })
      .catch(() => {})
  }, [userId, deepLinkId, threads])

  function selectThread(t: ChatThreadDTO) {
    setActive(t)
    setThreads((prev) => prev.map((p) => (p.id === t.id ? { ...p, unreadCount: 0 } : p)))
  }

  if (!userId) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Caricamento…</div>
  }

  return (
    <div className="mx-auto max-w-6xl px-0 sm:px-4 sm:py-6">
      <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-none border-border bg-card sm:rounded-lg sm:border">
        {/* Conversations sidebar */}
        <aside className={`flex w-full flex-col border-r border-border sm:w-80 ${active ? "hidden sm:flex" : "flex"}`}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h1 className="text-base font-semibold text-foreground">Messaggi</h1>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {transport === "websocket" ? "Tempo reale" : "Aggiornamento automatico"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Nuova chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ChatThreadList threads={threads} activeId={active?.id} onSelect={selectThread} loading={loading} />
          </div>
        </aside>

        {/* Active conversation */}
        <section className={`min-w-0 flex-1 ${active ? "flex" : "hidden sm:flex"} flex-col`}>
          {active ? (
            <ChatWindow threadId={active.id} currentUserId={userId} backHref="#" onActivity={loadThreads} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-40" />
              <p className="text-sm">Seleziona una conversazione o avviane una nuova.</p>
            </div>
          )}
        </section>
      </div>

      <NewChatDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(t) => {
          setThreads((prev) => (prev.find((p) => p.id === t.id) ? prev : [t, ...prev]))
          setActive(t)
        }}
      />
    </div>
  )
}
