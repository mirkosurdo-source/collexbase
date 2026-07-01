import { createNotification } from "@/lib/notifications"

/**
 * Blocco 51.1 — Creator Partner application notifications.
 *
 * Thin, fire-and-forget wrappers around the Blocco 20 createNotification helper
 * (no model changes). All use the "system" notification type.
 */

/** A new application was submitted (sent to an admin recipient). */
export async function notifyNewCreatorApplication(adminUserId: string, applicantUsername: string): Promise<void> {
  await createNotification({
    userId: adminUserId,
    type: "system",
    title: "Nuova richiesta Creator Partner",
    body: `${applicantUsername} ha inviato una richiesta per diventare Creator Partner.`,
    link: "/admin/creator/applications",
  })
}

/** The user's application was approved. */
export async function notifyCreatorApplicationApproved(userId: string, referralCode: string): Promise<void> {
  await createNotification({
    userId,
    type: "system",
    title: "Richiesta Creator Partner approvata!",
    body: `Complimenti! Sei ufficialmente un Creator Partner. Il tuo codice referral è ${referralCode}. Apri la dashboard per iniziare a guadagnare.`,
    link: "/creator",
  })
}

/** The user's application was rejected (manually or automatically). */
export async function notifyCreatorApplicationRejected(userId: string, reason: string): Promise<void> {
  await createNotification({
    userId,
    type: "system",
    title: "Richiesta Creator Partner respinta",
    body: reason || "La tua richiesta per diventare Creator Partner non è stata approvata.",
    link: "/creator-apply",
  })
}
