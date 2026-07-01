"use client"

import { useState } from "react"
import {
  useAdminData,
  adminDelete,
  adminPost,
  Spinner,
  StatCard,
  SectionHeader,
  Toolbar,
  TextInput,
  Select,
  TableShell,
  Th,
  Td,
  EmptyRow,
  Pagination,
  ActionBtn,
  fmtNum,
  fmtDate,
} from "@/components/admin/shared"

interface ShowcaseRow {
  id: string
  username: string
  title: string
  theme: string
  visibility: "public" | "private" | "disabled"
  followerCount: number
  viewCount: number
  itemCount: number
  createdAt: string
}

interface ShowcaseResponse {
  success: boolean
  showcases: ShowcaseRow[]
  total: number
  page: number
  pages: number
  stats: { total: number; followers: number; views: number; publicCount: number; topTheme: string }
}

export default function ShowcaseSection() {
  const [q, setQ] = useState("")
  const [visibility, setVisibility] = useState("")
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState("")

  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (visibility) params.set("visibility", visibility)
  params.set("page", String(page))

  const { data, loading, error, reload } = useAdminData<ShowcaseResponse>(`/api/admin/showcase?${params.toString()}`, [
    q,
    visibility,
    page,
  ])

  async function setVis(id: string, vis: string) {
    setBusy(id)
    await adminPost(`/api/admin/showcase`, { id, visibility: vis }).catch(() => {})
    setBusy("")
    reload()
  }

  async function remove(id: string) {
    if (!confirm("Eliminare definitivamente questa vetrina?")) return
    setBusy(id)
    await adminDelete(`/api/admin/showcase?id=${id}`).catch(() => {})
    setBusy("")
    reload()
  }

  const stats = data?.stats

  return (
    <div>
      <SectionHeader title="Vetrine" description="Modera le vetrine pubbliche dei collezionisti." />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Vetrine totali" value={fmtNum(stats?.total ?? 0)} />
        <StatCard label="Pubbliche" value={fmtNum(stats?.publicCount ?? 0)} />
        <StatCard label="Follower totali" value={fmtNum(stats?.followers ?? 0)} />
        <StatCard label="Tema più diffuso" value={stats?.topTheme ?? "—"} />
      </div>

      <Toolbar>
        <TextInput
          value={q}
          onChange={(v) => {
            setPage(1)
            setQ(v)
          }}
          placeholder="Cerca per titolo, utente o tema…"
        />
        <Select
          value={visibility}
          onChange={(v) => {
            setPage(1)
            setVisibility(v)
          }}
          options={[
            { value: "", label: "Tutte le visibilità" },
            { value: "public", label: "Pubbliche" },
            { value: "private", label: "Private" },
            { value: "disabled", label: "Disattivate" },
          ]}
        />
      </Toolbar>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-500">{error}</p>
      ) : (
        <>
          <TableShell
            head={
              <>
                <Th>Vetrina</Th>
                <Th>Utente</Th>
                <Th>Tema</Th>
                <Th>Visibilità</Th>
                <Th className="text-right">Pezzi</Th>
                <Th className="text-right">Follower</Th>
                <Th className="text-right">Visite</Th>
                <Th>Creata</Th>
                <Th className="text-right">Azioni</Th>
              </>
            }
          >
            {data && data.showcases.length > 0 ? (
              data.showcases.map((s) => (
                <tr key={s.id}>
                  <Td className="font-medium">{s.title}</Td>
                  <Td>
                    <a href={`/showcase/${s.username}`} className="text-primary hover:underline">
                      @{s.username}
                    </a>
                  </Td>
                  <Td>{s.theme}</Td>
                  <Td>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.visibility === "public"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : s.visibility === "private"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.visibility}
                    </span>
                  </Td>
                  <Td className="text-right">{fmtNum(s.itemCount)}</Td>
                  <Td className="text-right">{fmtNum(s.followerCount)}</Td>
                  <Td className="text-right">{fmtNum(s.viewCount)}</Td>
                  <Td>{fmtDate(s.createdAt)}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {s.visibility !== "disabled" ? (
                        <ActionBtn onClick={() => setVis(s.id, "disabled")} disabled={busy === s.id}>
                          Disattiva
                        </ActionBtn>
                      ) : (
                        <ActionBtn onClick={() => setVis(s.id, "public")} disabled={busy === s.id}>
                          Riattiva
                        </ActionBtn>
                      )}
                      <ActionBtn variant="danger" onClick={() => remove(s.id)} disabled={busy === s.id}>
                        Elimina
                      </ActionBtn>
                    </div>
                  </Td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={9} />
            )}
          </TableShell>
          <Pagination page={data?.page ?? 1} pages={data?.pages ?? 1} onPage={setPage} />
        </>
      )}
    </div>
  )
}
