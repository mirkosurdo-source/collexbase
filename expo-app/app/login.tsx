import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { useState } from "react"
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native"
import { Button, Screen, Subtitle, Title } from "@/components/ui"
import { useAuth } from "@/lib/AuthContext"
import { fontSize, radius, spacing, useTheme } from "@/lib/theme"

export default function LoginScreen() {
  const t = useTheme()
  const router = useRouter()
  const { signIn } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setLoading(true)
    const res = await signIn(email.trim(), password)
    setLoading(false)
    if (res.ok) router.back()
    else setError(res.error ?? "Accesso non riuscito")
  }

  const inputStyle = {
    backgroundColor: t.cardAlt,
    color: t.text,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: t.border,
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ alignItems: "center", marginVertical: spacing.xl }}>
          <Image source={require("@/assets/icon.png")} style={{ width: 72, height: 72, borderRadius: radius.lg }} />
        </View>
        <Title>Accedi a CollexBase</Title>
        <Subtitle>Entra per scansionare, vendere e gestire la tua collezione.</Subtitle>

        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          <TextInput
            placeholder="Email"
            placeholderTextColor={t.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={inputStyle}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor={t.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={inputStyle}
          />
          {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
          <Button title="Accedi" onPress={submit} loading={loading} />
          <Button title="Annulla" variant="ghost" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}
