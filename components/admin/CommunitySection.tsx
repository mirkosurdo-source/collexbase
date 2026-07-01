"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Toolbar, TableShell, Th, Td, EmptyRow, Pagination,
  ActionBtn, useAdminData, adminPost, fmtNum, fmtDate,
} from "./shared"

type View = "posts" | "comments" | "reviews" | "reputation"

interface Post { id: string; author: string; kind: string; title: string; body: string; category: string; likeCount: number; commentCount: number; createdAt: string }
interface Comment { id: string; author: string; body: string; likeCount: number; createdAt: string }
interface Review { id: string; author: string; target: string; type: string; rating: number; comment: string; createdAt: string }
interface Rep { userId: string; username: string; score: number; tier: string; avgRating: number; reviewCount: number; salesCount: number; tradesCount: number; communityPoints: number }

interface Resp {
  success: boolean
  posts?: Post[]; comments?: Comment[]; reviews?: Review[]; reputation?: Rep[]
  total: number; page: number; pages: number
}

export default function CommunitySection() {
  const [view, setView] = useState<View>("posts")
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState("")
  const [notice, setNotice] = useState("")

  const { data, loading, error, reload } = useAdminData<Resp>(`/api/admin/community?view=${view}&page=${page}`, [view, page])

  async function del(type: string, id: string) {
    setBusy(id)
    setNotice("")
    const res = await adminPost<{ success: boolean; message?: string }>("/api/admin/community/action", { type, id })
    setBusy("")
    setNotice(res.message || (res.success ? "Eliminato." : "Azione non riuscita."))
    if (res.success) reload()
  }

  function switchView(v: View) { setView(v); setPage(1) }

  return (
    <div>
      <SectionHeader title="Community" description="Modera post, commenti e recensioni; consulta la reputazione." />

      <Toolbar>
        {(["posts", "comments", "reviews", "reputation"] as View[]).map((v) => (
          <ActionBtn key={v} variant={view === v ? "primary" : "default"} onClick={() => switchView(v)}>
            {v === "posts" ? "Post" : v === "comments" ? "Commenti" : v === "reviews" ? "Recensioni" : "Reputazione"}
          </ActionBtn>
        ))}
        {data && <span className="ml-auto text-sm text-muted-foreground">{fmtNum(data.total)} record</span>}
      </Toolbar>

      {notice && <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{notice}</p>}

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : view === "posts" ? (
        <>
          <TableShell head={<><Th>Autore</Th><Th>Contenuto</Th><Th className="text-right">Like / Commenti</Th><Th>Data</Th><Th className="text-right">Azioni</Th></>}>
            {!data?.posts?.length ? <EmptyRow colSpan={5} /> : data.posts.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <Td className="text-xs">@{p.author}</Td>
                <Td><div className="font-medium">{p.title || p.kind}</div><div className="line-clamp-1 text-xs text-muted-foreground">{p.body}</div></Td>
                <Td className="text-right text-xs text-muted-foreground">{fmtNum(p.likeCount)} / {fmtNum(p.commentCount)}</Td>
                <Td className="text-xs text-muted-foreground">{fmtDate(p.createdAt)}</Td>
                <Td className="text-right"><ActionBtn variant="danger" disabled={!!busy} onClick={() => del("post", p.id)}>Elimina</ActionBtn></Td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      ) : view === "comments" ? (
        <>
          <TableShell head={<><Th>Autore</Th><Th>Commento</Th><Th className="text-right">Like</Th><Th>Data</Th><Th className="text-right">Azioni</Th></>}>
            {!data?.comments?.length ? <EmptyRow colSpan={5} /> : data.comments.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <Td className="text-xs">@{c.author}</Td>
                <Td><div className="line-clamp-2 text-sm">{c.body}</div></Td>
                <Td className="text-right text-xs text-muted-foreground">{fmtNum(c.likeCount)}</Td>
                <Td className="text-xs text-muted-foreground">{fmtDate(c.createdAt)}</Td>
                <Td className="text-right"><ActionBtn variant="danger" disabled={!!busy} onClick={() => del("comment", c.id)}>Elimina</ActionBtn></Td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      ) : view === "reviews" ? (
        <>
          <TableShell head={<><Th>Autore</Th><Th>Destinatario</Th><Th className="text-right">Voto</Th><Th>Commento</Th><Th>Data</Th><Th className="text-right">Azioni</Th></>}>
            {!data?.reviews?.length ? <EmptyRow colSpan={6} /> : data.reviews.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <Td className="text-xs">@{r.author}</Td>
                <Td className="text-xs">@{r.target}</Td>
                <Td className="text-right text-xs font-medium">{r.rating}/5</Td>
                <Td><div className="line-clamp-2 text-sm">{r.comment}</div></Td>
                <Td className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</Td>
                <Td className="text-right"><ActionBtn variant="danger" disabled={!!busy} onClick={() => del("review", r.id)}>Elimina</ActionBtn></Td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      ) : (
        <>
          <TableShell head={<><Th>Utente</Th><Th>Tier</Th><Th className="text-right">Punteggio</Th><Th className="text-right">Voto medio</Th><Th className="text-right">Vendite / Scambi</Th></>}>
            {!data?.reputation?.length ? <EmptyRow colSpan={5} /> : data.reputation.map((r) => (
              <tr key={r.userId} className="hover:bg-muted/30">
                <Td className="text-xs font-medium">@{r.username}</Td>
                <Td className="text-xs text-muted-foreground">{r.tier}</Td>
                <Td className="text-right font-medium">{fmtNum(r.score)}</Td>
                <Td className="text-right text-xs">{r.avgRating?.toFixed(1) || "—"} ({fmtNum(r.reviewCount)})</Td>
                <Td className="text-right text-xs text-muted-foreground">{fmtNum(r.salesCount)} / {fmtNum(r.tradesCount)}</Td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      )}
    </div>
  )
}
