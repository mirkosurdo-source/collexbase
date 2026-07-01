"use client"

import { useCallback, useEffect, useState } from "react"
import {
  SectionHeader,
  StatCard,
  Card,
  Toolbar,
  TextInput,
  Select,
  TableShell,
  Th,
  Td,
  EmptyRow,
  Pagination,
  ActionBtn,
  Spinner,
  StatusPill,
  AdminBarChart,
  AdminAreaChart,
  fmtDate,
  fmtNum,
  adminGet,
  adminPatch,
  adminDelete,
} from "./shared"

interface ModEvent {
  id: string
  userId: string
  username: string
  targetType: string
  targetId: string
  severity: "low" | "medium" | "high" | "critical"
  category: string
  reason: string
  excerpt: string
  aiScore: number
  autoActioned: boolean
  resolved: boolean
  resolution: string | null
  createdAt: string
}

interface ModResponse {
  success: boolean
  events: ModEvent[]
  total: number
  page: number
  pages: number
  stats: {
    total: number
    open: number
    criticalOpen: number
    bySeverity: Record<string, number>
  }
  typeChart: { category: string; value: number }[]
  series: { label: string; value: number }[]
}

const TYPE_OPTIONS = [
  { value: "", label: "Tutti i tipi" },
  { value: "listing", label: "Annunci" },
  { value: "auction", label: "Aste" },
  { value: "post", label: "Post community" },
  { value: "comment", label: "Commenti" },
  { value: "message", label: "Messaggi" },
  { value: "review", label: "Recensioni" },
  { value: "profile", label: "Profili" },
  { value: "showcase", label: "Vetrine" },
]

const SEVERITY_OPTIONS = [
  { value: "", label: "Tutte le gravità" },
  { value: "low", label: "Bassa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Critica" },
]

const STATUS_OPTIONS = [
  { value: "open", label: "Da gestire" },
  { value: "resolved", label: "Risolte" },
  { value: "", label: "Tutte" },
]

const SEVERITY_STYLE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  critical: "bg-red-500/10 text-red-600 dark:text-red-400",
}

function SeverityPill({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        SEVERITY_STYLE[severity] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {severity}
    </span>
  )
}

export default function ModerationSection() {
  const [data, setData] = useState<ModResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [type, setType] = useState("")
  const [severity, setSeverity] = useState("")
  const [status, setStatus] = useState("open")
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), status })
      if (search.trim()) params.set("search", search.trim())
      if (type) params.set("type", type)
      if (severity) params.set("severity", severity)
      const res = await adminGet<ModResponse>(`/api/admin/moderation?${params.toString()}`)
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, status, search, type, severity])

  useEffect(() => {
    void load()
  }, [load])

  // Reset to first page whenever a filter changes.
  useEffect(() => {
    setPage(1)
  }, [status, type, severity])

  async function resolve(id: string) {
    setBusyId(id)
    try {
      await adminPatch(`/api/admin/moderation/resolve/${id}`, { resolution: "dismissed" })
      await load()
    } catch {
      // no-op; surfaced by reload
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string, suspend: boolean) {
    const msg = suspend
      ? "Rimuovere il contenuto e sospendere l'utente?"
      : "Rimuovere definitivamente questo contenuto?"
    if (typeof window !== "undefined" && !window.confirm(msg)) return
    setBusyId(id)
    try {
      await adminDelete(`/api/admin/moderation/remove/${id}${suspend ? "?suspend=1" : ""}`)
      await load()
    } catch {
      // no-op
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Moderazione"
        description="Eventi di moderazione automatica e manuale: spam, truffe, contenuti abusivi e profili sospetti rilevati dall'IA e dalle euristiche della piattaforma."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Eventi totali" value={fmtNum(data?.stats.total ?? 0)} />
        <StatCard label="Da gestire" value={fmtNum(data?.stats.open ?? 0)} hint="In attesa di revisione" />
        <StatCard
          label="Critici aperti"
          value={fmtNum(data?.stats.criticalOpen ?? 0)}
          hint="Richiedono attenzione immediata"
        />
        <StatCard
          label="Auto-azioni"
          value={fmtNum(data?.stats.bySeverity.critical ?? 0)}
          hint="Gravità critica rilevata"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-medium text-foreground">Attività ultimi 14 giorni</h3>
          <AdminAreaChart data={data?.series ?? []} />
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-medium text-foreground">Per tipo di contenuto</h3>
          <AdminBarChart data={data?.typeChart ?? []} />
        </Card>
      </div>

      <Toolbar>
        <TextInput value={search} onChange={setSearch} placeholder="Cerca per utente, motivo o testo…" />
        <Select value={type} onChange={setType} options={TYPE_OPTIONS} />
        <Select value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} />
        <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <ActionBtn variant="primary" onClick={() => void load()}>
          Aggiorna
        </ActionBtn>
      </Toolbar>

      {loading ? (
        <div className="py-16">
          <Spinner label="Caricamento eventi di moderazione…" />
        </div>
      ) : (
        <>
          <TableShell
            head={
              <tr>
                <Th>Contenuto</Th>
                <Th>Utente</Th>
                <Th>Categoria</Th>
                <Th>Gravità</Th>
                <Th>Punteggio IA</Th>
                <Th>Stato</Th>
                <Th>Data</Th>
                <Th className="text-right">Azioni</Th>
              </tr>
            }
          >
            {!data || data.events.length === 0 ? (
              <EmptyRow colSpan={8} text="Nessun evento di moderazione trovato." />
            ) : (
              data.events.map((e) => (
                <tr key={e.id} className="align-top">
                  <Td>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {e.targetType}
                      </span>
                      {e.excerpt ? (
                        <span className="max-w-xs text-pretty text-foreground line-clamp-2">{e.excerpt}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {e.reason ? <span className="text-xs text-muted-foreground">{e.reason}</span> : null}
                    </div>
                  </Td>
                  <Td>{e.username}</Td>
                  <Td>
                    <span className="capitalize">{e.category}</span>
                  </Td>
                  <Td>
                    <SeverityPill severity={e.severity} />
                  </Td>
                  <Td>
                    <span className="font-mono text-xs">{Math.round(e.aiScore * 100)}%</span>
                  </Td>
                  <Td>
                    {e.resolved ? (
                      <StatusPill status={e.resolution || "resolved"} />
                    ) : e.autoActioned ? (
                      <StatusPill status="auto" />
                    ) : (
                      <StatusPill status="open" />
                    )}
                  </Td>
                  <Td>{fmtDate(e.createdAt)}</Td>
                  <Td className="text-right">
                    {e.resolved ? (
                      <span className="text-xs text-muted-foreground">Gestito</span>
                    ) : (
                      <div className="flex justify-end gap-1.5">
                        <ActionBtn onClick={() => void resolve(e.id)} disabled={busyId === e.id}>
                          Ignora
                        </ActionBtn>
                        <ActionBtn variant="danger" onClick={() => void remove(e.id, false)} disabled={busyId === e.id}>
                          Rimuovi
                        </ActionBtn>
                        <ActionBtn variant="danger" onClick={() => void remove(e.id, true)} disabled={busyId === e.id}>
                          Rimuovi + sospendi
                        </ActionBtn>
                      </div>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </TableShell>

          {data && data.pages > 1 ? (
            <Pagination page={data.page} pages={data.pages} onPage={setPage} />
          ) : null}
        </>
      )}
    </div>
  )
}
