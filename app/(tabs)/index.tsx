import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ModeBanner from '../../components/ModeBanner';
import { useBluetooth, type DeviceInfo } from '../../context/BluetoothContext';

export default function HomeScreen() {
  const {
    devices,
    isScanning,
    startScan,
    stopScan,
    connectionState,
    device,
    connect,
    disconnect,
    isMockMode,
  } = useBluetooth();
  const connecting = connectionState === 'connecting';

  const renderDevice = ({ item }: { item: DeviceInfo }) => (
    <TouchableOpacity
      style={styles.deviceCard}
      onPress={() => connect(item)}
      disabled={connecting}
      accessibilityRole="button"
      accessibilityState={{ disabled: connecting }}
      accessibilityLabel={`Conectar a ${item.name || 'dispositivo desconhecido'}${item.simulated ? ', dispositivo simulado' : ''}`}
    >
      <View style={styles.deviceInfo}>
        <Ionicons name={item.simulated ? 'flask' : 'bluetooth'} size={32} color="#DC2626" />
        <View style={styles.deviceText}>
          <Text style={styles.deviceName}>{item.name || 'Dispositivo Desconhecido'}</Text>
          <Text style={styles.deviceId}>
            {item.simulated ? 'Dispositivo simulado — sem robô físico' : `BLE · ${item.id}`}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#6B7280" />
    </TouchableOpacity>
  );

  if (connectionState === 'connected') {
    const simulated = device?.simulated ?? isMockMode;
    return (
      <View style={styles.container}>
        <ModeBanner />
        <View style={styles.connectedContainer}>
          <View style={styles.connectedCard}>
            <Ionicons
              name={simulated ? 'flask' : 'checkmark-circle'}
              size={64}
              color={simulated ? '#B45309' : '#047857'}
            />
            <Text
              style={[styles.connectedTitle, simulated && styles.connectedTitleSim]}
              accessibilityRole="header"
            >
              {simulated ? 'Conectado ao dispositivo simulado' : 'Conectado via Bluetooth BLE'}
            </Text>
            <Text style={styles.connectedName}>{device?.name}</Text>
            <Text style={styles.connectedSubtext}>
              {simulated
                ? 'Os dados e as respostas são gerados pelo app para testar a interface. Nenhum robô físico está sendo controlado.'
                : 'Conexão BLE estabelecida. As leituras aparecem no Monitor quando o robô enviar telemetria.'}
            </Text>
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={disconnect}
              accessibilityRole="button"
              accessibilityLabel={simulated ? 'Desconectar do dispositivo simulado' : 'Desconectar do HydroBot'}
            >
              <Ionicons name="close-circle" size={20} color="#fff" />
              <Text style={styles.disconnectText}>Desconectar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ModeBanner />
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {isMockMode ? 'Dispositivo simulado' : 'Dispositivos Bluetooth'}
        </Text>
        <Text style={styles.subtitle}>
          {connecting
            ? 'Conectando…'
            : isScanning
              ? 'Procurando dispositivos…'
              : isMockMode
                ? 'Busque o HydroBot simulado para testar a interface sem o robô.'
                : 'Busque pelo HydroBot compatível com Bluetooth Low Energy (BLE).'}
        </Text>
      </View>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderDevice}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bluetooth-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>
              {isScanning ? 'Buscando…' : 'Nenhum dispositivo encontrado'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.scanButton, isScanning && styles.scanButtonStop]}
        onPress={isScanning ? stopScan : startScan}
        disabled={connecting}
        accessibilityRole="button"
        accessibilityState={{ disabled: connecting, busy: isScanning }}
        accessibilityLabel={isScanning ? 'Parar busca' : 'Buscar dispositivos'}
      >
        {isScanning ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={styles.scanButtonText}>Parar busca</Text>
          </>
        ) : (
          <>
            <Ionicons name="search" size={24} color="#fff" />
            <Text style={styles.scanButtonText}>Buscar Dispositivos</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  list: {
    padding: 16,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceText: {
    marginLeft: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: '#4B5563',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#4B5563',
    marginTop: 12,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    margin: 16,
    padding: 16,
    minHeight: 56,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  scanButtonStop: {
    backgroundColor: '#4B5563',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  connectedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  connectedCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
    maxWidth: 380,
  },
  connectedTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#047857',
    marginTop: 16,
    textAlign: 'center',
  },
  connectedTitleSim: {
    color: '#92400E',
  },
  connectedName: {
    fontSize: 18,
    color: '#111827',
    marginTop: 8,
    fontWeight: '600',
  },
  connectedSubtext: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 32,
    minHeight: 48,
    borderRadius: 8,
    marginTop: 24,
  },
  disconnectText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
