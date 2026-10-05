import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';

/**
 * Parada de emergência fixa no rodapé de Controle e Monitor (fora da rolagem).
 * O toque envia os comandos imediatamente, sem confirmação prévia; o
 * resultado aparece no modal único (EmergencyModal) montado no layout.
 */
export default function EmergencyStopBar() {
  const { emergencyStop, emergency, emergencyOriginRef } = useBluetooth();
  const buttonRef = useRef<any>(null);
  const running = emergency?.phase === 'running';

  const handlePress = () => {
    emergencyOriginRef.current = buttonRef.current;
    void emergencyStop();
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        ref={buttonRef}
        style={styles.button}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Parada de emergência"
        accessibilityHint="Para o movimento, desliga a bomba e sai do modo automático, sem pedir confirmação."
        accessibilityState={{ busy: running }}
        aria-busy={running}
      >
        <Ionicons name="alert-circle" size={26} color="#fff" />
        <Text style={styles.buttonText}>
          {running ? 'ENVIANDO PARADA…' : 'PARADA DE EMERGÊNCIA'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#991B1B',
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#450A0A',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
