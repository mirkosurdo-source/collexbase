/**
 * Push notification registration for CollexBase mobile. Obtains an Expo push
 * token and registers it with the backend so the existing notification system
 * (bids, trades, chat, advisor alerts) can reach the device.
 */
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { api } from "./api"
import { getToken } from "./auth"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "CollexBase",
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let status = existing
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync()
    status = req.status
  }
  if (status !== "granted") return null

  let pushToken: string
  try {
    const res = await Notifications.getExpoPushTokenAsync()
    pushToken = res.data
  } catch {
    return null
  }

  // Only register with the backend when the user is authenticated.
  const session = await getToken()
  if (session) {
    await api.post("/api/notifications/register-device", { pushToken, platform: Platform.OS })
  }
  return pushToken
}
