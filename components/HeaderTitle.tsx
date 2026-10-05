import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useBluetooth, type ConnectionState } from '../context/BluetoothContext';

type Look = {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  label: string;
  bg: string;
  fg: string;
};

const STATE_TEXT: Record<ConnectionState, string> = {
  connected: 'conectado',
  connecting: 'conectando…',
  disconnected: 'desconectado',
};

/** Texto curto, ícone e cores do indicador de origem dos dados. */
export function statusLook(isMockMode: boolean, state: ConnectionState, deviceName?: string | null): Look {
  if (isMockMode) {
    return {
      icon: state === 'disconnected' ? 'flask-outline' : 'flask',
      text: `Simulação · ${STATE_TEXT[state]}`,
      label: `Modo de Simulação, ${STATE_TEXT[state]}. Os dados são gerados pelo aplicativo, sem controlar um robô físico.`,
      bg: '#FEF3C7',
      fg: '#78350F',
    };
  }
  if (state === 'connected') {
    return {
      icon: 'bluetooth',
      text: `BLE · ${STATE_TEXT[state]}`,
      label: `Bluetooth BLE, conectado${deviceName ? ` a ${deviceName}` : ''}.`,
      bg: '#D1FAE5',
      fg: '#065F46',
    };
  }
  if (state === 'connecting') {
    return { icon: 'sync', text: 'BLE · conectando…', label: 'Bluetooth BLE, conectando.', bg: '#E5E7EB', fg: '#1F2937' };
  }
  return {
    icon: 'close-circle',
    text: 'BLE · desconectado',
    label: 'Bluetooth BLE, desconectado.',
    bg: '#FFFFFF',
    fg: '#991B1B',
  };
}

/**
 * Título do cabeçalho com o indicador compacto de modo e conexão logo abaixo.
 * Substitui a faixa grande que ocupava o topo de cada aba.
 */
export default function HeaderTitle({ title }: { title: string }) {
  const { isMockMode, connectionState, device } = useBluetooth();
  const look = statusLook(isMockMode, connectionState, device?.name);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
        {title}
      </Text>
      <View
        style={[styles.pill, { backgroundColor: look.bg }]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={look.label}
        testID="status-indicator"
      >
        <Ionicons name={look.icon} size={13} color={look.fg} />
        <Text style={[styles.pillText, { color: look.fg }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {look.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexShrink: 1,
  },
  title: {
    color: '#fff',
    fontSize: 19,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
});
