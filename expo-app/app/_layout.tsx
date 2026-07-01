import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { AuthProvider } from "@/lib/AuthContext"
import { registerForPushNotifications } from "@/lib/notifications"
import { theme } from "@/lib/theme"
import { useEffect } from "react"

export default function RootLayout() {
  useEffect(() => {
    void registerForPushNotifications()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: false,
              headerStyle: { backgroundColor: theme.colors.card },
              headerTintColor: theme.colors.foreground,
              headerTitleStyle: { fontWeight: "800" },
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" options={{ presentation: "modal" }} />
            <Stack.Screen name="auctions" options={{ headerShown: true, title: "Aste" }} />
            <Stack.Screen name="trades" options={{ headerShown: true, title: "Scambi" }} />
            <Stack.Screen name="groups" options={{ headerShown: true, title: "Gruppi" }} />
            <Stack.Screen name="showcases" options={{ headerShown: true, title: "Vetrine" }} />
            <Stack.Screen name="advisor" options={{ headerShown: true, title: "Advisor" }} />
            <Stack.Screen name="chat" options={{ headerShown: true, title: "Chat" }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
