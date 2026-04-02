import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../src/stores/authStore'
import { Colors } from '../src/tokens'

export default function Index() {
  const { session, loading } = useAuthStore()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    )
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />
  }

  return <Redirect href="/(tabs)/feed" />
}
