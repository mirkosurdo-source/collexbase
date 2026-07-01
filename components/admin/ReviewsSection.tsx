"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Toolbar, TextInput, Select, TableShell, Th, Td, EmptyRow, Pagination,
  StatCard, ActionBtn, useAdminData, adminDelete, fmtNum, fmtDate,
} from "./shared"

interface Row {
  id: string
  author: string
  target: string
  type: "seller" | "buyer" | "trade"
  rating: number
  comment: string
  createdAt: string
}

interface Resp {
  success: boolean
  reviews: Row[]
  total: number
  page: number
  pages: number
  stats: { avg: number; total: number; byType: Record<string, number> }
}

const TYPE_LABEL: Record<string, string> = { seller: "Venditore", buyer: "Acquirente", trade: "Scambio" }

export default function ReviewsSection() {
  const [q, setQ] = useState("")
  const [type, setType] = useState("")
  const [rating, setRating] = useState("")
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState("")
  const [notice, setNotice] = useState("")

  const query = `/api/admin/reviews?q=${encodeURIComponent(q)}&type=${type}&rating=${rating}&page=${page}`
  const { data, loading, error, reload } = useAdminData<Resp>(query, [q, type, rating, page])

  async function remove(id: string) {
    if (!confirm("Eliminare definitivamente questa recensione? La reputazione verrà ricalcolata.")) return
    setBusy(id)
    setNotice("")
    const res = await adminDelete<{ success: boolean; message?: string }>(`/api/admin/reviews?id=${id}`)
    setBusy("")
    setNotice(res.message || (res.success ? "Recensione eliminata." : "Azione non riuscita."))
    if (res.success) reload()
  }

  return (
    <div>
      <SectionHeader title="Recensioni" description="Modera le recensioni e monitora la qualità della community." />

      {data?.stats && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Totale recensioni" value={fmtNum(data.stats.total)} />
          <StatCard label="Media globale" value={`${data.stats.avg || 0} / 5`} />
          <StatCard label="Venditori" value={fmtNum(data.stats.byType.seller || 0)} />
          <StatCard label="Scambi" value={fmtNum(data.stats.byType.trade || 0)} />
        </div>
      )}

      <Toolbar>
        <TextInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Cerca autore, destinatario o testo…" />
        <Select value={type} onChange={(v) => { setType(v); setPage(1) }} options={[
          { value: "", label: "Tutti i tipi" },
          { value: "seller", label: "Venditore" },
          { value: "buyer", label: "Acquirente" },
          { value: "trade", label: "Scambio" },
        ]} />
        <Select value={rating} onChange={(v) => { setRating(v); setPage(1) }} options={[
          { value: "", label: "Tutti i voti" },
          { value: "5", label: "5 stelle" },
          { value: "4", label: "4 stelle" },
          { value: "3", label: "3 stelle" },
          { value: "2", label: "2 stelle" },
          { value: "1", label: "1 stella" },
        ]} />
        {data && <span className="ml-auto text-sm text-muted-foreground">{fmtNum(data.total)} recensioni</span>}
      </Toolbar>

      {notice && <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{notice}</p>}

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <>
          <TableShell head={<><Th>Autore → Destinatario</Th><Th>Tipo</Th><Th>Voto</Th><Th>Commento</Th><Th>Data</Th><Th className="text-right">Azioni</Th></>}>
            {!data?.reviews.length ? (
              <EmptyRow colSpan={6} />
            ) : (
              data.reviews.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <Td>
                    <div className="font-medium">@{r.author}</div>
                    <div className="text-xs text-muted-foreground">→ @{r.target}</div>
                  </Td>
                  <Td className="text-xs">{TYPE_LABEL[r.type] || r.type}</Td>
                  <Td>
                    <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">{"★".repeat(r.rating)}</span>
                    <span className="text-muted-foreground">{"★".repeat(5 - r.rating)}</span>
                  </Td>
                  <Td className="max-w-xs"><span className="line-clamp-2 text-xs text-muted-foreground">{r.comment || "—"}</span></Td>
                  <Td className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</Td>
                  <Td className="text-right">
                    <ActionBtn variant="danger" disabled={!!busy} onClick={() => remove(r.id)}>Elimina</ActionBtn>
                  </Td>
                </tr>
              ))
            )}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      )}
    </div>
  )
}
