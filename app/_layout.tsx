import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, TouchableOpacity } from 'react-native';
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
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
          }} 
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <BluetoothProvider>
      <AppStack />
    </BluetoothProvider>
  );
}