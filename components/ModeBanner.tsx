import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';

/**
 * Indicador da origem dos dados, igual nas quatro abas. Usa ícone e texto
 * além da cor para distinguir simulação de Bluetooth BLE.
 */
export default function ModeBanner() {
  const { isMockMode, connectionState, device, bleAvailable } = useBluetooth();

  let icon: keyof typeof Ionicons.glyphMap;
  let title: string;
  let detail: string;
  let tone: 'sim' | 'ok' | 'off' | 'wait';

  if (isMockMode) {
    icon = 'flask';
    tone = 'sim';
    title = 'MODO DE SIMULAÇÃO';
    detail =
      connectionState === 'connected'
        ? 'Conectado ao dispositivo simulado · dados gerados pelo app, sem robô físico'
        : connectionState === 'connecting'
          ? 'Conectando ao dispositivo simulado…'
          : 'Dispositivo simulado não conectado';
    if (!bleAvailable) detail += ' · versão web: conexão física indisponível';
  } else if (connectionState === 'connected') {
    icon = 'bluetooth';
    tone = 'ok';
    title = 'BLUETOOTH BLE';
    detail = `Conectado a ${device?.name ?? 'dispositivo'}`;
  } else if (connectionState === 'connecting') {
    icon = 'bluetooth';
    tone = 'wait';
    title = 'BLUETOOTH BLE';
    detail = 'Conectando…';
  } else {
    icon = 'close-circle';
    tone = 'off';
    title = 'BLUETOOTH BLE';
    detail = 'Desconectado';
  }

  const colors = TONES[tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.bg, borderColor: colors.border }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${title}. ${detail}`}
    >
      <Ionicons name={icon} size={20} color={colors.fg} />
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
        <Text style={[styles.detail, { color: colors.fg }]}>{detail}</Text>
      </View>
    </View>
  );
}

const TONES = {
  sim: { bg: '#FEF3C7', border: '#F59E0B', fg: '#78350F' },
  ok: { bg: '#D1FAE5', border: '#10B981', fg: '#065F46' },
  wait: { bg: '#E5E7EB', border: '#9CA3AF', fg: '#1F2937' },
  off: { bg: '#FEE2E2', border: '#EF4444', fg: '#991B1B' },
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 2,
  },
  texts: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detail: {
    fontSize: 13,
    marginTop: 1,
  },
});
