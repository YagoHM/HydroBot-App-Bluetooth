import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBluetooth } from '../../context/BluetoothContext';
import { Device } from 'react-native-ble-plx';

export default function HomeScreen() {
  const { devices, isScanning, startScan, isConnected, device, connect, disconnect } = useBluetooth();

  const renderDevice = ({ item }: { item: Device }) => (
    <TouchableOpacity style={styles.deviceCard} onPress={() => connect(item)}>
      <View style={styles.deviceInfo}>
        <Ionicons name="bluetooth" size={32} color="#DC2626" />
        <View style={styles.deviceText}>
          <Text style={styles.deviceName}>{item.name || 'Dispositivo Desconhecido'}</Text>
          <Text style={styles.deviceId}>{item.id}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {isConnected ? (
        <View style={styles.connectedContainer}>
          <View style={styles.connectedCard}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            <Text style={styles.connectedTitle}>Conectado</Text>
            <Text style={styles.connectedName}>{device?.name}</Text>
            <Text style={styles.connectedSubtext}>HydroBot está online e pronto!</Text>
            <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
              <Ionicons name="close-circle" size={20} color="#fff" />
              <Text style={styles.disconnectText}>Desconectar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Dispositivos Bluetooth</Text>
            <Text style={styles.subtitle}>
              {isScanning ? 'Procurando dispositivos...' : 'Busque por HC-05 ou HC-06'}
            </Text>
          </View>

          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={renderDevice}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="bluetooth-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>
                  {isScanning ? 'Buscando...' : 'Nenhum dispositivo encontrado'}
                </Text>
              </View>
            }
          />

          <TouchableOpacity
            style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
            onPress={startScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="search" size={24} color="#fff" />
                <Text style={styles.scanButtonText}>Buscar Dispositivos</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}
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
    color: '#6B7280',
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
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  scanButtonDisabled: {
    backgroundColor: '#9CA3AF',
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
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
    maxWidth: 350,
  },
  connectedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 16,
  },
  connectedName: {
    fontSize: 20,
    color: '#111827',
    marginTop: 8,
    fontWeight: '600',
  },
  connectedSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 32,
    paddingVertical: 12,
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