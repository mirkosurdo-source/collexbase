"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Toolbar, TextInput, Select, TableShell, Th, Td, EmptyRow, Pagination,
  StatusPill, PlanPill, ActionBtn, useAdminData, adminPost, fmtEUR, fmtNum,
} from "./shared"

interface Row {
  id: string; itemName: string; seller: string; sellerBadge: string; category: string
  price: number; buyerFee: number; sellerFee: number; status: string; viewsCount: number; savedCount: number
}
interface Resp { success: boolean; listings: Row[]; counts: Record<string, number>; total: number; page: number; pages: number }

export default function MarketplaceSection() {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState("")
  const [notice, setNotice] = useState("")

  const { data, loading, error, reload } = useAdminData<Resp>(
    `/api/admin/marketplace?q=${encodeURIComponent(q)}&status=${status}&page=${page}`,
    [q, status, page],
  )

  async function setStatusOf(listingId: string, newStatus: string) {
    setBusy(listingId)
    setNotice("")
    const res = await adminPost<{ success: boolean; message?: string }>("/api/admin/marketplace/action", { listingId, status: newStatus })
    setBusy("")
    setNotice(res.message || (res.success ? "Annuncio aggiornato." : "Azione non riuscita."))
    if (res.success) reload()
  }

  return (
    <div>
      <SectionHeader title="Marketplace" description="Modera gli annunci e ispeziona le commissioni applicate per tier." />

      <Toolbar>
        <TextInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Cerca oggetto…" />
        <Select value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[
          { value: "", label: "Tutti gli stati" },
          { value: "active", label: "Attivi" },
          { value: "pending", label: "In attesa" },
          { value: "sold", label: "Venduti" },
          { value: "cancelled", label: "Annullati" },
        ]} />
        {data && <span className="ml-auto text-sm text-muted-foreground">{fmtNum(data.total)} annunci</span>}
      </Toolbar>

      {notice && <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{notice}</p>}

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <>
          <TableShell head={<><Th>Oggetto</Th><Th>Venditore</Th><Th className="text-right">Prezzo</Th><Th className="text-right">Fee acq./vend.</Th><Th>Stato</Th><Th className="text-right">Azioni</Th></>}>
            {!data?.listings.length ? <EmptyRow colSpan={6} /> : data.listings.map((l) => (
              <tr key={l.id} className="hover:bg-muted/30">
                <Td>
                  <div className="font-medium">{l.itemName}</div>
                  <div className="text-xs text-muted-foreground">{l.category} · {fmtNum(l.viewsCount)} viste</div>
                </Td>
                <Td><div className="text-xs">@{l.seller}</div><PlanPill plan={l.sellerBadge} /></Td>
                <Td className="text-right">{fmtEUR(l.price)}</Td>
                <Td className="text-right text-xs text-muted-foreground">{fmtEUR(l.buyerFee)} / {fmtEUR(l.sellerFee)}</Td>
                <Td><StatusPill status={l.status} /></Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {l.status !== "active" && <ActionBtn disabled={!!busy} onClick={() => setStatusOf(l.id, "active")}>Riattiva</ActionBtn>}
                    {l.status !== "cancelled" && <ActionBtn variant="danger" disabled={!!busy} onClick={() => setStatusOf(l.id, "cancelled")}>Rimuovi</ActionBtn>}
                  </div>
                </Td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      )}
    </div>
  )
}
