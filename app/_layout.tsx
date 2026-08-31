  import { Ionicons } from '@expo/vector-icons';
  import { Stack } from 'expo-router';
  import { StatusBar } from 'expo-status-bar';
  import { ActivityIndicator, Alert, TouchableOpacity, View } from 'react-native';
  import ErrorBoundary from '../components/ErrorBoundary';
  import { AuthProvider, useAuth } from '../context/AuthContext';
  import { BluetoothProvider, useBluetooth } from '../context/BluetoothContext';

  // Componente do botão de reiniciar (precisa estar dentro do Provider)
  function RestartButton() {
    const { restartApp } = useBluetooth();

    const handleRestart = () => {
      Alert.alert(
        'Reiniciar App',
        'Tem certeza que deseja reiniciar o aplicativo?',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Reiniciar',
            onPress: () => restartApp(),
            style: 'destructive',
          },
        ]
      );
    };

    return (
      <TouchableOpacity
        onPress={handleRestart}
        style={{
          marginRight: 15,
          padding: 5,
        }}
      >
        <Ionicons name="reload" size={24} color="#fff" />
      </TouchableOpacity>
    );
  }

  // Componente interno com acesso ao contexto
  function AppStack() {
    const { isAuthenticated } = useAuth();

    return (
      <>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#DC2626',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            headerRight: () => <RestartButton />,
          }}
        >
          <Stack.Protected guard={!!isAuthenticated}>
            <Stack.Screen
              name="(tabs)"
              options={{
                headerShown: false,
              }}
            />
          </Stack.Protected>
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
      </>
    );
  }

  export default function RootLayout() {
    return (
      <ErrorBoundary>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ErrorBoundary>
    );
  }

  function RootNavigator() {
    const { isAuthenticated } = useAuth();

    if (isAuthenticated === null) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' }}>
          <ActivityIndicator size="large" color="#DC2626" />
        </View>
      );
    }

    return (
      <BluetoothProvider>
        <AppStack />
      </BluetoothProvider>
    );
  }