import { createNotification } from "@/lib/notifications"

/** ⚡ Weekly collection growth alert. */
export async function notifyCollectionGrowth(userId: string, pct: number) {
  await createNotification({
    userId,
    type: "system",
    title: "⚡ La tua collezione è cresciuta!",
    body: `Il valore della tua collezione è aumentato del +${pct}% questa settimana. Apri gli Analytics per i dettagli.`,
    link: "/analytics",
  })
}

/** ⚡ A relevant market trend was detected in a category the user collects. */
export async function notifyMarketTrend(userId: string, category: string, pct: number) {
  await createNotification({
    userId,
    type: "system",
    title: "⚡ Nuovo trend di mercato!",
    body: `La categoria ${category} segna ${pct >= 0 ? "+" : ""}${pct}%: potrebbe essere il momento giusto per agire.`,
    link: "/analytics",
  })
}

/** ⚡ CollexSpark flags an item gaining value. */
export async function notifyItemRising(userId: string, itemName: string) {
  await createNotification({
    userId,
    type: "system",
    title: "⚡ CollexSpark",
    body: `"${itemName}" sta aumentando di valore. Controlla gli Analytics per scoprire di più.`,
    link: "/analytics",
  })
}
