/**
 * Authorizes cron endpoints (Blocco 51).
 *
 * Vercel Cron invokes the route with an `Authorization: Bearer <CRON_SECRET>`
 * header. We also accept the same secret via an `x-cron-secret` header for
 * manual/curl triggering. When `CRON_SECRET` is not configured the endpoint is
 * left open (useful in preview/dev) but a warning is logged.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.log("[v0] CRON_SECRET not set — cron endpoint is unprotected.")
    return true
  }
  const auth = req.headers.get("authorization") || ""
  if (auth === `Bearer ${secret}`) return true
  const header = req.headers.get("x-cron-secret") || ""
  return header === secret
}
