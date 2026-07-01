"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Toolbar, Select, TableShell, Th, Td, EmptyRow, Pagination,
  StatusPill, useAdminData, fmtEUR, fmtNum, fmtDate,
} from "./shared"

interface Row {
  id: string; itemName: string; startingPrice: number; currentPrice: number; bids: number
  status: string; ended: boolean; winner: string; endsAt: string
}
interface Resp { success: boolean; auctions: Row[]; counts: { active: number; closed: number }; total: number; page: number; pages: number }

export default function AuctionsSection() {
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const { data, loading, error } = useAdminData<Resp>(`/api/admin/auctions?status=${status}&page=${page}`, [status, page])

  return (
    <div>
      <SectionHeader title="Aste" description="Supervisiona le aste in corso e concluse con offerte e vincitori." />

      <Toolbar>
        <Select value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[
          { value: "", label: "Tutte" },
          { value: "active", label: "Attive" },
          { value: "closed", label: "Concluse" },
        ]} />
        {data && <span className="ml-auto text-sm text-muted-foreground">{fmtNum(data.total)} aste · {fmtNum(data.counts.active)} attive</span>}
      </Toolbar>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <>
          <TableShell head={<><Th>Oggetto</Th><Th className="text-right">Base</Th><Th className="text-right">Attuale</Th><Th className="text-right">Offerte</Th><Th>Vincitore</Th><Th>Stato</Th><Th>Scadenza</Th></>}>
            {!data?.auctions.length ? <EmptyRow colSpan={7} /> : data.auctions.map((a) => (
              <tr key={a.id} className="hover:bg-muted/30">
                <Td className="font-medium">{a.itemName}</Td>
                <Td className="text-right text-xs text-muted-foreground">{fmtEUR(a.startingPrice)}</Td>
                <Td className="text-right font-medium">{fmtEUR(a.currentPrice)}</Td>
                <Td className="text-right">{fmtNum(a.bids)}</Td>
                <Td className="text-xs">{a.winner ? `@${a.winner}` : "—"}</Td>
                <Td><StatusPill status={a.status} /></Td>
                <Td className="text-xs text-muted-foreground">{fmtDate(a.endsAt)}</Td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      )}
    </div>
  )
}
