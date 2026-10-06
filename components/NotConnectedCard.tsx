import { Ionicons } from './Icon';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';

/** Orienta o usuário quando a tela depende de uma conexão (real ou simulada). */
export default function NotConnectedCard({ what }: { what: string }) {
  const { isMockMode, connectionState } = useBluetooth();
  const connecting = connectionState === 'connecting';
  const target = isMockMode ? 'ao dispositivo simulado' : 'ao HydroBot por Bluetooth BLE';

  return (
    <View style={styles.card}>
      <Ionicons
        name={isMockMode ? 'flask-outline' : 'bluetooth-outline'}
        size={48}
        color="#6B7280"
      />
      <Text style={styles.title} accessibilityRole="header">
        {connecting ? 'Conectando…' : 'Não conectado'}
      </Text>
      <Text style={styles.text}>
        {connecting
          ? `Aguarde a conexão ${target}.`
          : `Conecte-se ${target} na aba Conexão para ${what}.`}
      </Text>
      {!connecting && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.navigate('/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="Ir para a aba Conexão"
        >
          <Ionicons name="bluetooth" size={18} color="#fff" />
          <Text style={styles.buttonText}>Ir para Conexão</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 12,
  },
  text: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    minHeight: 48,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
