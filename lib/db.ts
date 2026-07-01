import mongoose from "mongoose"

/**
 * Blocco 48 — optimized MongoDB connection for Next.js App Router / Vercel.
 *
 * The whole codebase is built on Mongoose, so rather than introducing a second
 * (native `mongodb`) client — which would open a parallel connection pool and
 * defeat the purpose of connection reuse — we keep the single `connectDB()` API
 * everything already imports and make it robust:
 *
 *   - A globally cached connection + in-flight promise survives hot reloads in
 *     dev and module re-evaluation between serverless invocations on Vercel.
 *   - Caching the *promise* (not just the resolved connection) means concurrent
 *     cold-start requests await the same connect() instead of each firing their
 *     own, avoiding duplicate connections.
 *   - Connection pooling is configured explicitly (maxPoolSize) for serverless.
 *
 * Credentials live only in the environment (MONGODB_URI), never in code.
 */

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null }
if (!global._mongooseCache) {
  global._mongooseCache = cache
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI

  if (!uri) {
    throw new Error("MONGODB_URI non è definita nelle variabili d'ambiente")
  }

  // Reuse a live connection.
  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn.connection
  }

  // Reuse an in-flight connection attempt (prevents duplicate connects under
  // concurrent requests during a cold start).
  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      // Pooling tuned for serverless: keep the pool small but warm.
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000,
      // Allow buffering so models can queue ops while the pool warms up.
      bufferCommands: true,
    })
  }

  try {
    cache.conn = await cache.promise
  } catch (error) {
    // Reset so the next call can retry instead of being stuck on a failed promise.
    cache.promise = null
    throw error
  }

  return cache.conn.connection
}
