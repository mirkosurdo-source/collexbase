import Link from "next/link"
import { Users, LayoutGrid } from "lucide-react"

export interface ShowcaseSummary {
  userId: string
  username: string
  title: string
  theme: string
  followerCount: number
  coverImage: string
  itemCount: number
}

/** Discovery card for a public showcase (Blocco 32). */
export default function ShowcaseCard({ showcase }: { showcase: ShowcaseSummary }) {
  return (
    <Link
      href={`/showcase/${showcase.username}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {showcase.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={showcase.coverImage || "/placeholder.svg"}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/15 to-accent/25" />
        )}
        <span className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium text-foreground backdrop-blur">
          {showcase.theme}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="truncate text-sm font-semibold text-foreground">{showcase.title}</h3>
        <p className="truncate text-xs text-muted-foreground">di @{showcase.username}</p>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users width={13} height={13} />
            {showcase.followerCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <LayoutGrid width={13} height={13} />
            {showcase.itemCount} in evidenza
          </span>
        </div>
      </div>
    </Link>
  )
}
