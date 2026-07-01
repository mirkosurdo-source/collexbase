"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ActionBtn,
  Card,
  EmptyRow,
  SectionHeader,
  Select,
  Spinner,
  StatusPill,
  Td,
  Th,
  TableShell,
  Toolbar,
  adminGet,
  adminPost,
  fmtDate,
  fmtNum,
} from "./shared"

interface ApplicationRow {
  id: string
  userId: string
  username: string
  email: string
  instagramUrl: string
  tiktokUrl: string
  socialLinks: string[]
  followerCountInstagram: number | null
  followerCountTikTok: number | null
  message: string
  status: string
  decisionNote: string
  submittedAt: string
  reviewedAt: string | null
}

const STATUS_OPTIONS = [
  { value: "pending", label: "In attesa" },
  { value: "approved", label: "Approvate" },
  { value: "rejected", label: "Respinte" },
  { value: "", label: "Tutte" },
]

export default function CreatorApplicationsSection() {
  const [status, setStatus] = useState("pending")
  const [rows, setRows] = useState<ApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<ApplicationRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const q = status ? `?status=${status}` : ""
      const json = await adminGet<{ ok: boolean; error?: string; applications?: ApplicationRow[] }>(
        `/api/admin/creator/applications${q}`,
      )
      if (!json.ok) setError(json.error || "Errore di caricamento.")
      setRows(json.applications || [])
    } catch {
      setError("Errore di connessione.")
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  async function decide(app: ApplicationRow, action: "approve" | "reject", note?: string) {
    const json = await adminPost<{ ok: boolean; error?: string }>(
      `/api/admin/creator/applications/${app.id}/${action}`,
      action === "reject" ? { note: note || "" } : {},
    )
    if (!json.ok) {
      setError(json.error || "Operazione non riuscita.")
      return
    }
    setSelected(null)
    await load()
  }

  return (
    <section>
      <SectionHeader
        title="Richieste Creator Partner"
        description="Esamina le candidature, approva per attivare il creator o rifiuta con una motivazione."
      />

      <Toolbar>
        <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <ActionBtn onClick={load}>Aggiorna</ActionBtn>
      </Toolbar>

      {error && (
        <p className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <TableShell
          head={
            <>
              <Th>Utente</Th>
              <Th>Instagram</Th>
              <Th>TikTok</Th>
              <Th>Stato</Th>
              <Th>Data</Th>
              <Th className="text-right">Azioni</Th>
            </>
          }
        >
          {rows.length === 0 ? (
            <EmptyRow colSpan={6} text="Nessuna richiesta." />
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <div className="font-medium">{r.username}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </Td>
                <Td>{r.followerCountInstagram != null ? fmtNum(r.followerCountInstagram) : "—"}</Td>
                <Td>{r.followerCountTikTok != null ? fmtNum(r.followerCountTikTok) : "—"}</Td>
                <Td>
                  <StatusPill status={r.status} />
                </Td>
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(r.submittedAt)}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    <ActionBtn onClick={() => setSelected(r)}>Dettagli</ActionBtn>
                    {r.status === "pending" && (
                      <>
                        <ActionBtn variant="primary" onClick={() => decide(r, "approve")}>
                          Approva
                        </ActionBtn>
                        <ActionBtn variant="danger" onClick={() => setSelected(r)}>
                          Rifiuta
                        </ActionBtn>
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            ))
          )}
        </TableShell>
      )}

      {selected && <DetailModal app={selected} onClose={() => setSelected(null)} onDecide={decide} />}
    </section>
  )
}

function DetailModal({
  app,
  onClose,
  onDecide,
}: {
  app: ApplicationRow
  onClose: () => void
  onDecide: (app: ApplicationRow, action: "approve" | "reject", note?: string) => void
}) {
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  async function run(action: "approve" | "reject") {
    setBusy(true)
    await onDecide(app, action, note)
    setBusy(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{app.username}</h3>
              <p className="text-sm text-muted-foreground">{app.email}</p>
            </div>
            <StatusPill status={app.status} />
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Follower Instagram" value={app.followerCountInstagram != null ? fmtNum(app.followerCountInstagram) : "—"} />
            <Info label="Follower TikTok" value={app.followerCountTikTok != null ? fmtNum(app.followerCountTikTok) : "—"} />
            <Info label="Inviata il" value={fmtDate(app.submittedAt)} />
            <Info label="Valutata il" value={app.reviewedAt ? fmtDate(app.reviewedAt) : "—"} />
          </dl>

          {(app.instagramUrl || app.tiktokUrl) && (
            <div className="space-y-1.5 text-sm">
              <p className="font-medium text-foreground">Link social</p>
              {app.instagramUrl && (
                <a href={app.instagramUrl} target="_blank" rel="noreferrer" className="block break-all text-primary underline">
                  {app.instagramUrl}
                </a>
              )}
              {app.tiktokUrl && (
                <a href={app.tiktokUrl} target="_blank" rel="noreferrer" className="block break-all text-primary underline">
                  {app.tiktokUrl}
                </a>
              )}
            </div>
          )}

          {app.message && (
            <div className="text-sm">
              <p className="font-medium text-foreground">Messaggio</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">{app.message}</p>
            </div>
          )}

          {app.decisionNote && (
            <div className="text-sm">
              <p className="font-medium text-foreground">Nota decisione</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">{app.decisionNote}</p>
            </div>
          )}

          {app.status === "pending" && (
            <div className="space-y-3 border-t border-border pt-4">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Motivazione (opzionale, mostrata in caso di rifiuto)"
                className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              />
              <div className="flex justify-end gap-2">
                <ActionBtn variant="danger" onClick={() => run("reject")} disabled={busy}>
                  Rifiuta
                </ActionBtn>
                <ActionBtn variant="primary" onClick={() => run("approve")} disabled={busy}>
                  Approva e attiva
                </ActionBtn>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <ActionBtn onClick={onClose}>Chiudi</ActionBtn>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  )
}
