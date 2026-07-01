/**
 * Blocco 38 — public API / integrations badge metrics.
 *
 * Read-only aggregation over ApiKey and Webhook. All counters are stored on the
 * documents themselves (incremented during request handling / webhook
 * dispatch), so this gatherer just sums them per owner. Fully additive.
 */

import { connectDB } from "@/lib/db"
import ApiKey from "@/lib/models/ApiKey"
import Webhook from "@/lib/models/Webhook"

export interface ApiBadgeRaw {
  /** Total public API calls across all of the user's keys. */
  apiCalls: number
  /** Successful webhook deliveries across all of the user's endpoints. */
  webhookDeliveries: number
  /** Analytics-scoped API calls (subset of apiCalls). */
  analyticsApiCalls: number
}

export async function gatherApiBadgeRaw(userId: string): Promise<ApiBadgeRaw> {
  await connectDB()

  const [keys, webhooks] = await Promise.all([
    ApiKey.find({ userId }).select("callCount analyticsCallCount").lean(),
    Webhook.find({ userId }).select("deliveredCount").lean(),
  ])

  const apiCalls = keys.reduce(
    (sum: number, k: Record<string, unknown>) => sum + (Number(k.callCount) || 0),
    0,
  )
  const analyticsApiCalls = keys.reduce(
    (sum: number, k: Record<string, unknown>) => sum + (Number(k.analyticsCallCount) || 0),
    0,
  )
  const webhookDeliveries = webhooks.reduce(
    (sum: number, w: Record<string, unknown>) => sum + (Number(w.deliveredCount) || 0),
    0,
  )

  return { apiCalls, webhookDeliveries, analyticsApiCalls }
}
