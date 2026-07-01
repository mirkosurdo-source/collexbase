/**
 * Secure token storage for CollexBase mobile. The web app issues a JWT on
 * login (sent as a Bearer token); we persist it with expo-secure-store so the
 * session survives app restarts.
 */
import * as SecureStore from "expo-secure-store"

const TOKEN_KEY = "collexbase.token"

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    return null
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}
