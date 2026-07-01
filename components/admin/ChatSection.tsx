"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Toolbar, TableShell, Th, Td, EmptyRow, Pagination,
  ActionBtn, useAdminData, adminGet, adminPost, fmtNum, fmtDate,
} from "./shared"

type View = "threads" | "suspended"

interface Thread {
  id: string
  participants: string[]
  type: string
  contextId: string | null
  contextLabel: string
  messageCount: number
  status: string
  reportedBy: number
  reportReason: string
  lastMessageAt: string
  lastMessageText: string
}

interface Message {
  id: string
  senderId: string
  senderUsername: string
  text: string | null
  attachments: { url: string; name?: string }[]
  deleted: boolean
  createdAt: string
}

interface Resp { success: boolean; threads?: Thread[]; total: number; page: number; pages: number }

const TYPE_LABELS: Record<string, string> = {
  private: "Privata",
  trade: "Scambio",
  marketplace: "Vendita",
  auction: "Asta",
}

export default function ChatSection() {
  const [view, setView] = useState<View>("threads")
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState("")
  const [notice, setNotice] = useState("")

  // Inspector state.
  const [openThread, setOpenThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  const { data, loading, error, reload } = useAdminData<Resp>(`/api/admin/chat?view=${view}&page=${page}`, [view, page])

  function switchView(v: View) { setView(v); setPage(1); setOpenThread(null) }

  async function inspect(thread: Thread) {
    setOpenThread(thread)
    setLoadingMsgs(true)
    setMessages([])
    const res = await adminGet<{ success: boolean; messages?: Message[] }>(
      `/api/admin/chat?view=messages&threadId=${thread.id}`,
    )
    setMessages(res.messages || [])
    setLoadingMsgs(false)
  }

  async function toggleThread(thread: Thread) {
    setBusy(thread.id)
    setNotice("")
    const action = thread.status === "suspended" ? "reactivate_thread" : "suspend_thread"
    const res = await adminPost<{ success: boolean; message?: string }>("/api/admin/chat/action", {
      action,
      threadId: thread.id,
    })
    setBusy("")
    setNotice(res.success ? "Stato aggiornato." : res.message || "Azione non riuscita.")
    if (res.success) reload()
  }

  async function deleteMessage(messageId: string) {
    setBusy(messageId)
    const res = await adminPost<{ success: boolean; message?: string }>("/api/admin/chat/action", {
      action: "delete_message",
      messageId,
    })
    setBusy("")
    if (res.success) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, deleted: true, text: null, attachments: [] } : m)))
    } else {
      setNotice(res.message || "Azione non riuscita.")
    }
  }

  return (
    <div>
      <SectionHeader title="Chat" description="Monitora le conversazioni, sospendi i thread e rimuovi i messaggi che violano le regole." />

      <Toolbar>
        {(["threads", "suspended"] as View[]).map((v) => (
          <ActionBtn key={v} variant={view === v ? "primary" : "default"} onClick={() => switchView(v)}>
            {v === "threads" ? "Tutte le conversazioni" : "Sospese"}
          </ActionBtn>
        ))}
        {data && <span className="ml-auto text-sm text-muted-foreground">{fmtNum(data.total)} conversazioni</span>}
      </Toolbar>

      {notice && <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{notice}</p>}

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <>
          <TableShell head={<><Th>Partecipanti</Th><Th>Tipo</Th><Th className="text-right">Messaggi</Th><Th>Stato</Th><Th>Ultimo messaggio</Th><Th className="text-right">Azioni</Th></>}>
            {!data?.threads?.length ? <EmptyRow colSpan={6} /> : data.threads.map((t) => (
              <tr key={t.id} className="hover:bg-muted/30">
                <Td className="text-xs font-medium">{t.participants.map((p) => `@${p}`).join(", ")}</Td>
                <Td className="text-xs text-muted-foreground">{TYPE_LABELS[t.type] || t.type}{t.contextLabel ? ` · ${t.contextLabel}` : ""}</Td>
                <Td className="text-right text-xs text-muted-foreground">{fmtNum(t.messageCount)}</Td>
                <Td>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${t.status === "suspended" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                    {t.status === "suspended" ? "Sospesa" : "Attiva"}
                  </span>
                  {t.reportedBy > 0 && <span className="ml-1 text-xs text-destructive">⚑ {t.reportedBy}</span>}
                </Td>
                <Td><div className="line-clamp-1 max-w-xs text-xs text-muted-foreground">{t.lastMessageText || "—"}</div><div className="text-[10px] text-muted-foreground">{t.lastMessageAt ? fmtDate(t.lastMessageAt) : ""}</div></Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <ActionBtn onClick={() => inspect(t)}>Apri</ActionBtn>
                    <ActionBtn variant={t.status === "suspended" ? "primary" : "danger"} disabled={busy === t.id} onClick={() => toggleThread(t)}>
                      {t.status === "suspended" ? "Riattiva" : "Sospendi"}
                    </ActionBtn>
                  </div>
                </Td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      )}

      {openThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpenThread(null)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{openThread.participants.map((p) => `@${p}`).join(", ")}</p>
                <p className="text-xs text-muted-foreground">{TYPE_LABELS[openThread.type] || openThread.type}</p>
              </div>
              <button onClick={() => setOpenThread(null)} className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Chiudi">✕</button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {loadingMsgs ? (
                <Spinner />
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">Nessun messaggio.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border bg-muted/30 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground">@{m.senderUsername}</span>
                      <span className="text-[10px] text-muted-foreground">{fmtDate(m.createdAt)}</span>
                    </div>
                    {m.deleted ? (
                      <p className="mt-1 text-xs italic text-muted-foreground">Messaggio rimosso</p>
                    ) : (
                      <>
                        {m.text && <p className="mt-1 text-pretty text-sm text-foreground">{m.text}</p>}
                        {m.attachments?.map((a, i) => (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-primary underline">
                            {a.name || "Allegato"}
                          </a>
                        ))}
                        <button
                          disabled={busy === m.id}
                          onClick={() => deleteMessage(m.id)}
                          className="mt-1 text-xs text-destructive underline disabled:opacity-50"
                        >
                          Rimuovi
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
