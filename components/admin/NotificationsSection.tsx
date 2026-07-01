"use client"

import { useState } from "react"
import {
  SectionHeader,
  StatCard,
  Card,
  Spinner,
  Select,
  Toolbar,
  TableShell,
  Th,
  Td,
  EmptyRow,
  Pagination,
  StatusPill,
  AdminAreaChart,
  AdminBarChart,
  useAdminData,
  fmtNum,
  fmtDate,
} from "./shared"

interface SummaryData {
  success: boolean
  total: number
  unread: number
  deleted: number
  byType: { category: string; value: number }[]
  daily: { label: string; value: number }[]
  generationErrors: number
}

interface ListItem {
  id: string
  userId: string
  type: string
  contextKind: string | null
  read: boolean
  deleted: boolean
  createdAt: string
}

interface ListData {
  success: boolean
  total: number
  page: number
  pages: number
  items: ListItem[]
}

const TYPE_OPTIONS = [
  { value: "", label: "Tutti i tipi" },
  { value: "chat", label: "Chat" },
  { value: "trade", label: "Scambi" },
  { value: "marketplace", label: "Marketplace" },
  { value: "auction", label: "Aste" },
  { value: "payment", label: "Pagamenti" },
  { value: "escrow", label: "Escrow" },
  { value: "moderation", label: "Moderazione" },
  { value: "message", label: "Messaggi" },
  { value: "system", label: "Sistema" },
]

export default function NotificationsSection() {
  const { data: summary, loading: summaryLoading } = useAdminData<SummaryData>("/api/admin/notifications?view=summary")

  const [type, setType] = useState("")
  const [page, setPage] = useState(1)
  const { data: list, loading: listLoading } = useAdminData<ListData>(
    `/api/admin/notifications?view=list&type=${type}&page=${page}`,
    [type, page],
  )

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionHeader
          title="Notifiche"
          description="Audit del sistema di notifiche: volume, distribuzione per tipo e metadati di generazione. I contenuti personali delle notifiche non sono mostrati."
        />

        {summaryLoading ? (
          <Spinner />
        ) : summary ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Totale notifiche" value={fmtNum(summary.total)} />
              <StatCard label="Non lette" value={fmtNum(summary.unread)} />
              <StatCard label="Eliminate" value={fmtNum(summary.deleted)} />
              <StatCard label="Errori di generazione" value={fmtNum(summary.generationErrors)} hint="logged server-side" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <p className="mb-3 text-sm font-medium text-foreground">Volume giornaliero (14 giorni)</p>
                <AdminAreaChart data={summary.daily} />
              </Card>
              <Card>
                <p className="mb-3 text-sm font-medium text-foreground">Distribuzione per tipo</p>
                <AdminBarChart data={summary.byType} />
              </Card>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nessun dato disponibile.</p>
        )}
      </div>

      <div>
        <Toolbar>
          <Select
            value={type}
            onChange={(v) => {
              setType(v)
              setPage(1)
            }}
            options={TYPE_OPTIONS}
          />
        </Toolbar>

        {listLoading ? (
          <Spinner />
        ) : (
          <>
            <TableShell
              head={
                <>
                  <Th>Destinatario</Th>
                  <Th>Tipo</Th>
                  <Th>Contesto</Th>
                  <Th>Stato</Th>
                  <Th>Data</Th>
                </>
              }
            >
              {!list || list.items.length === 0 ? (
                <EmptyRow colSpan={5} text="Nessuna notifica." />
              ) : (
                list.items.map((it) => (
                  <tr key={it.id}>
                    <Td className="font-mono text-xs">{it.userId}</Td>
                    <Td>
                      <StatusPill status={it.type} />
                    </Td>
                    <Td className="text-muted-foreground">{it.contextKind || "—"}</Td>
                    <Td>
                      {it.deleted ? (
                        <span className="text-xs text-muted-foreground">eliminata</span>
                      ) : it.read ? (
                        <span className="text-xs text-muted-foreground">letta</span>
                      ) : (
                        <span className="text-xs font-medium text-foreground">non letta</span>
                      )}
                    </Td>
                    <Td className="text-muted-foreground">{fmtDate(it.createdAt)}</Td>
                  </tr>
                ))
              )}
            </TableShell>
            {list && <Pagination page={list.page} pages={list.pages} onPage={setPage} />}
          </>
        )}
      </div>
    </div>
  )
}
