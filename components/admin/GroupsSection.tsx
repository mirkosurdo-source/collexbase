"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Toolbar, TextInput, Select, TableShell, Th, Td, EmptyRow, Pagination,
  StatCard, ActionBtn, useAdminData, adminDelete, fmtNum, fmtDate,
} from "./shared"
import { CATEGORIES } from "@/lib/collection-helpers"

interface Row {
  id: string
  name: string
  category: string
  privacy: "public" | "private"
  memberCount: number
  postCount: number
  owner: string
  createdAt: string
}

interface Resp {
  success: boolean
  groups: Row[]
  total: number
  page: number
  pages: number
  stats: { total: number; members: number; posts: number; topCategory: string }
}

export default function GroupsSection() {
  const [q, setQ] = useState("")
  const [category, setCategory] = useState("")
  const [privacy, setPrivacy] = useState("")
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState("")
  const [notice, setNotice] = useState("")

  const query = `/api/admin/groups?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&privacy=${privacy}&page=${page}`
  const { data, loading, error, reload } = useAdminData<Resp>(query, [q, category, privacy, page])

  async function remove(id: string) {
    if (!confirm("Eliminare definitivamente questo gruppo? Verranno rimossi membri, post e messaggi.")) return
    setBusy(id)
    setNotice("")
    const res = await adminDelete<{ success: boolean; message?: string }>(`/api/admin/groups?id=${id}`)
    setBusy("")
    setNotice(res.message || (res.success ? "Gruppo eliminato." : "Azione non riuscita."))
    if (res.success) reload()
  }

  return (
    <div>
      <SectionHeader title="Gruppi" description="Modera i gruppi tematici e monitora l'attività delle community." />

      {data?.stats && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Totale gruppi" value={fmtNum(data.stats.total)} />
          <StatCard label="Iscrizioni totali" value={fmtNum(data.stats.members)} />
          <StatCard label="Post totali" value={fmtNum(data.stats.posts)} />
          <StatCard label="Categoria top" value={data.stats.topCategory || "—"} />
        </div>
      )}

      <Toolbar>
        <TextInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Cerca nome, descrizione o categoria…" />
        <Select value={category} onChange={(v) => { setCategory(v); setPage(1) }} options={[
          { value: "", label: "Tutte le categorie" },
          ...CATEGORIES.map((c: string) => ({ value: c, label: c })),
        ]} />
        <Select value={privacy} onChange={(v) => { setPrivacy(v); setPage(1) }} options={[
          { value: "", label: "Tutte" },
          { value: "public", label: "Pubblici" },
          { value: "private", label: "Privati" },
        ]} />
        {data && <span className="ml-auto text-sm text-muted-foreground">{fmtNum(data.total)} gruppi</span>}
      </Toolbar>

      {notice && <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{notice}</p>}

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <>
          <TableShell head={<><Th>Gruppo</Th><Th>Categoria</Th><Th>Privacy</Th><Th>Membri</Th><Th>Post</Th><Th>Creatore</Th><Th>Data</Th><Th className="text-right">Azioni</Th></>}>
            {!data?.groups.length ? (
              <EmptyRow colSpan={8} />
            ) : (
              data.groups.map((g) => (
                <tr key={g.id} className="hover:bg-muted/30">
                  <Td><div className="font-medium">{g.name}</div></Td>
                  <Td className="text-xs">{g.category || "—"}</Td>
                  <Td className="text-xs">{g.privacy === "private" ? "Privato" : "Pubblico"}</Td>
                  <Td className="tabular-nums">{fmtNum(g.memberCount)}</Td>
                  <Td className="tabular-nums">{fmtNum(g.postCount)}</Td>
                  <Td className="text-xs text-muted-foreground">@{g.owner}</Td>
                  <Td className="text-xs text-muted-foreground">{fmtDate(g.createdAt)}</Td>
                  <Td className="text-right">
                    <ActionBtn variant="danger" disabled={!!busy} onClick={() => remove(g.id)}>Elimina</ActionBtn>
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
