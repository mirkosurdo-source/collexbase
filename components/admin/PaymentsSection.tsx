"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Toolbar, Select, TableShell, Th, Td, EmptyRow, Pagination,
  StatusPill, ActionBtn, useAdminData, adminPost, fmtEUR, fmtNum, fmtDate,
} from "./shared"

type View = "escrows" | "wallets" | "transactions"

interface Escrow {
  id: string; itemName: string; buyer: string; seller: string
  amount: number; buyerTotal: number; sellerNet: number; status: string; disputeReason: string; createdAt: string
}
interface Wallet { userId: string; username: string; available: number; pending: number; blocked: number }
interface Tx { id: string; username: string; kind: string; amount: number; status: string; description: string; createdAt: string }

interface Resp {
  success: boolean
  escrows?: Escrow[]
  wallets?: Wallet[]
  transactions?: Tx[]
  total: number
  page: number
  pages: number
}

export default function PaymentsSection() {
  const [view, setView] = useState<View>("escrows")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState("")
  const [notice, setNotice] = useState("")

  const query = view === "escrows"
    ? `/api/admin/payments?view=escrows&status=${status}&page=${page}`
    : `/api/admin/payments?view=${view}&page=${page}`
  const { data, loading, error, reload } = useAdminData<Resp>(query, [view, status, page])

  async function act(escrowId: string, action: string) {
    setBusy(escrowId + action)
    setNotice("")
    const res = await adminPost<{ success: boolean; message?: string }>("/api/admin/payments/action", { escrowId, action })
    setBusy("")
    setNotice(res.message || (res.success ? "Operazione completata." : "Azione non riuscita."))
    if (res.success) reload()
  }

  function switchView(v: View) { setView(v); setPage(1); setStatus("") }

  return (
    <div>
      <SectionHeader title="Pagamenti" description="Escrow, saldi wallet e registro delle transazioni in euro." />

      <Toolbar>
        {(["escrows", "wallets", "transactions"] as View[]).map((v) => (
          <ActionBtn key={v} variant={view === v ? "primary" : "default"} onClick={() => switchView(v)}>
            {v === "escrows" ? "Escrow" : v === "wallets" ? "Wallet" : "Transazioni"}
          </ActionBtn>
        ))}
        {view === "escrows" && (
          <Select value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[
            { value: "", label: "Tutti gli stati" },
            { value: "held", label: "In attesa" },
            { value: "released", label: "Rilasciati" },
            { value: "disputed", label: "In disputa" },
            { value: "refunded", label: "Rimborsati" },
          ]} />
        )}
        {data && <span className="ml-auto text-sm text-muted-foreground">{fmtNum(data.total)} record</span>}
      </Toolbar>

      {notice && <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{notice}</p>}

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : view === "escrows" ? (
        <>
          <TableShell head={<><Th>Oggetto</Th><Th>Acquirente</Th><Th>Venditore</Th><Th className="text-right">Totale</Th><Th className="text-right">Netto vend.</Th><Th>Stato</Th><Th className="text-right">Azioni</Th></>}>
            {!data?.escrows?.length ? <EmptyRow colSpan={7} /> : data.escrows.map((e) => (
              <tr key={e.id} className="hover:bg-muted/30">
                <Td className="font-medium">{e.itemName}</Td>
                <Td className="text-xs">@{e.buyer}</Td>
                <Td className="text-xs">@{e.seller}</Td>
                <Td className="text-right">{fmtEUR(e.buyerTotal)}</Td>
                <Td className="text-right">{fmtEUR(e.sellerNet)}</Td>
                <Td><StatusPill status={e.status} /></Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {(e.status === "held" || e.status === "disputed") && (
                      <>
                        <ActionBtn variant="primary" disabled={!!busy} onClick={() => act(e.id, "release")}>Rilascia</ActionBtn>
                        <ActionBtn variant="danger" disabled={!!busy} onClick={() => act(e.id, "refund")}>Rimborsa</ActionBtn>
                      </>
                    )}
                    {e.status === "held" && (
                      <ActionBtn disabled={!!busy} onClick={() => act(e.id, "dispute")}>Disputa</ActionBtn>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      ) : view === "wallets" ? (
        <>
          <TableShell head={<><Th>Utente</Th><Th className="text-right">Disponibile</Th><Th className="text-right">In attesa</Th><Th className="text-right">Bloccato</Th></>}>
            {!data?.wallets?.length ? <EmptyRow colSpan={4} /> : data.wallets.map((w) => (
              <tr key={w.userId} className="hover:bg-muted/30">
                <Td className="font-medium">@{w.username}</Td>
                <Td className="text-right">{fmtEUR(w.available)}</Td>
                <Td className="text-right text-amber-600 dark:text-amber-400">{fmtEUR(w.pending)}</Td>
                <Td className="text-right text-red-600 dark:text-red-400">{fmtEUR(w.blocked)}</Td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      ) : (
        <>
          <TableShell head={<><Th>Utente</Th><Th>Tipo</Th><Th className="text-right">Importo</Th><Th>Stato</Th><Th>Data</Th></>}>
            {!data?.transactions?.length ? <EmptyRow colSpan={5} /> : data.transactions.map((t) => (
              <tr key={t.id} className="hover:bg-muted/30">
                <Td className="text-xs">@{t.username}</Td>
                <Td className="text-xs text-muted-foreground">{t.kind}</Td>
                <Td className={`text-right font-medium ${t.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {t.amount >= 0 ? "+" : ""}{fmtEUR(t.amount)}
                </Td>
                <Td><StatusPill status={t.status} /></Td>
                <Td className="text-xs text-muted-foreground">{fmtDate(t.createdAt)}</Td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      )}
    </div>
  )
}
