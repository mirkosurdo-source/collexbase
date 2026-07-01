"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Toolbar, Select, TableShell, Th, Td, EmptyRow, Pagination,
  StatusPill, useAdminData, fmtNum, fmtDate,
} from "./shared"

interface Row {
  id: string; from: string; to: string; offeredItem: string; requestedItem: string
  status: string; messages: number; createdAt: string
}
interface Resp { success: boolean; trades: Row[]; counts: Record<string, number>; total: number; page: number; pages: number }

export default function TradesSection() {
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const { data, loading, error } = useAdminData<Resp>(`/api/admin/trades?status=${status}&page=${page}`, [status, page])

  return (
    <div>
      <SectionHeader title="Scambi" description="Monitora le proposte di scambio tra collezionisti." />

      <Toolbar>
        <Select value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[
          { value: "", label: "Tutti gli stati" },
          { value: "pending", label: "In corso" },
          { value: "accepted", label: "Completati" },
          { value: "rejected", label: "Annullati" },
        ]} />
        {data && <span className="ml-auto text-sm text-muted-foreground">{fmtNum(data.total)} scambi</span>}
      </Toolbar>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <>
          <TableShell head={<><Th>Da</Th><Th>A</Th><Th>Offre</Th><Th>Richiede</Th><Th>Stato</Th><Th className="text-right">Msg</Th><Th>Data</Th></>}>
            {!data?.trades.length ? <EmptyRow colSpan={7} /> : data.trades.map((t) => (
              <tr key={t.id} className="hover:bg-muted/30">
                <Td className="text-xs">@{t.from}</Td>
                <Td className="text-xs">@{t.to}</Td>
                <Td className="text-xs">{t.offeredItem || "—"}</Td>
                <Td className="text-xs">{t.requestedItem || "—"}</Td>
                <Td><StatusPill status={t.status} /></Td>
                <Td className="text-right text-xs text-muted-foreground">{fmtNum(t.messages)}</Td>
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
