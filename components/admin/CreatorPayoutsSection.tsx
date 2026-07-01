"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  adminGet,
  adminPost,
  fmtEUR,
  fmtDate,
  Spinner,
  StatCard,
  SectionHeader,
  StatusPill,
  ActionBtn,
  Toolbar,
  Select,
  TableShell,
  Th,
  Td,
  EmptyRow,
} from "@/components/admin/shared"

interface PayoutRow {
  id: string
  creatorId: string
  username: string
  email: string
  amount: number
  destination: string
  status: string
  note: string
  stripeTransferId: string | null
  at: string
  decidedAt: string | null
}

const STATUS_FILTERS = [
  { value: "", label: "Tutti gli stati" },
  { value: "pending", label: "In attesa" },
  { value: "paid", label: "Pagati" },
  { value: "approved", label: "Approvati" },
  { value: "rejected", label: "Rifiutati" },
]

export default function CreatorPayoutsSection() {
  const [rows, setRows] = useState<PayoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("pending")
  const [selected, setSelected] = useState<PayoutRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : ""
      const json = await adminGet<{ ok: boolean; error?: string; requests?: PayoutRow[] }>(
        `/api/admin/creator/payouts${qs}`,
      )
      if (!json.ok) setError(json.error || "Errore di caricamento.")
      setRows(json.requests || [])
    } catch {
      setError("Errore di connessione.")
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending")
    const pendingAmount = pending.reduce((s, r) => s + r.amount, 0)
    const paidAmount = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0)
    return { pendingCount: pending.length, pendingAmount, paidAmount }
  }, [rows])

  async function decide(row: PayoutRow, approve: boolean) {
    setBusy(true)
    try {
      const json = await adminPost<{ ok: boolean; error?: string }>(
        `/api/admin/creator/payouts/${row.id}/${approve ? "approve" : "reject"}`,
        { note: note.trim() },
      )
      if (!json.ok) {
        setError(json.error || "Operazione non riuscita.")
      } else {
        setSelected(null)
        setNote("")
        await load()
      }
    } catch {
      setError("Errore di connessione.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Payout Creator"
        description="Gestisci le richieste di prelievo dei creator. Approva per registrare il pagamento o rifiuta per rimborsare il saldo."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Richieste in attesa" value={String(totals.pendingCount)} />
        <StatCard label="Importo in attesa" value={fmtEUR(totals.pendingAmount)} />
        <StatCard label="Totale pagato (filtro)" value={fmtEUR(totals.paidAmount)} />
      </div>

      <Toolbar>
        <Select value={status} onChange={setStatus} options={STATUS_FILTERS} />
        <ActionBtn onClick={load}>Aggiorna</ActionBtn>
      </Toolbar>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <TableShell
          head={
            <>
              <Th>Creator</Th>
              <Th>Importo</Th>
              <Th>Destinazione</Th>
              <Th>Stato</Th>
              <Th>Richiesto</Th>
              <Th className="text-right">Azioni</Th>
            </>
          }
        >
          {rows.length === 0 ? (
            <EmptyRow colSpan={6} text="Nessuna richiesta di payout." />
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <Td>
                  <div className="font-medium text-foreground">{r.username}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </Td>
                <Td className="font-semibold">{fmtEUR(r.amount)}</Td>
                <Td className="max-w-[180px] truncate text-muted-foreground">{r.destination || "—"}</Td>
                <Td>
                  <StatusPill status={r.status} />
                </Td>
                <Td className="text-muted-foreground">{fmtDate(r.at)}</Td>
                <Td className="text-right">
                  <ActionBtn onClick={() => { setSelected(r); setNote("") }}>Dettagli</ActionBtn>
                </Td>
              </tr>
            ))
          )}
        </TableShell>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground">Richiesta di payout</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Creator</dt>
                <dd className="text-right font-medium text-foreground">{selected.username}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Importo</dt>
                <dd className="text-right font-semibold text-foreground">{fmtEUR(selected.amount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Destinazione</dt>
                <dd className="text-right text-foreground break-all">{selected.destination || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Stato</dt>
                <dd className="text-right">
                  <StatusPill status={selected.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Richiesto il</dt>
                <dd className="text-right text-foreground">{fmtDate(selected.at)}</dd>
              </div>
              {selected.stripeTransferId && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Transfer ID</dt>
                  <dd className="text-right text-foreground break-all">{selected.stripeTransferId}</dd>
                </div>
              )}
              {selected.note && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Nota</dt>
                  <dd className="text-right text-foreground">{selected.note}</dd>
                </div>
              )}
            </dl>

            {selected.status === "pending" ? (
              <>
                <label className="mt-4 block text-xs font-medium text-muted-foreground" htmlFor="payout-note">
                  Nota (opzionale)
                </label>
                <textarea
                  id="payout-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                  placeholder="Riferimento pagamento, motivo del rifiuto, ecc."
                />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <ActionBtn onClick={() => decide(selected, false)} variant="danger" disabled={busy}>
                    Rifiuta e rimborsa
                  </ActionBtn>
                  <ActionBtn onClick={() => decide(selected, true)} variant="primary" disabled={busy}>
                    Approva e paga
                  </ActionBtn>
                </div>
              </>
            ) : (
              <div className="mt-5 flex justify-end">
                <ActionBtn onClick={() => setSelected(null)}>Chiudi</ActionBtn>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
