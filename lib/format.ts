/** Relative "time ago" formatting in Italian. */
export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return "ora"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min fa`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h fa`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} g fa`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} sett fa`
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })
}

/** Formats a number as EUR currency in Italian locale. */
export function formatEUR(value: number): string {
  return `€ ${(value || 0).toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
