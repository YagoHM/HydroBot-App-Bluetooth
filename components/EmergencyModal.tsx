import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';
import { describeEmergency, type EmergencyLine, type EmergencyTone } from '../services/emergency';
import { restoreFocus } from './AppModal';

const TONE: Record<EmergencyTone | 'running', { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  running: { icon: 'hourglass', color: '#7C2D12', bg: '#FFEDD5' },
  success: { icon: 'checkmark-circle', color: '#065F46', bg: '#D1FAE5' },
  sent: { icon: 'paper-plane', color: '#1E40AF', bg: '#DBEAFE' },
  partial: { icon: 'warning', color: '#991B1B', bg: '#FEE2E2' },
  failed: { icon: 'close-circle', color: '#991B1B', bg: '#FEE2E2' },
};

const LINE: Record<EmergencyLine['kind'], { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  ok: { icon: 'checkmark-circle', color: '#065F46' },
  sent: { icon: 'paper-plane', color: '#1E40AF' },
  fail: { icon: 'close-circle', color: '#991B1B' },
  informed: { icon: 'radio', color: '#374151' },
};

/**
 * Modal único do resultado da parada de emergência (montado uma vez no layout
 * das abas). Abre no toque, mostra "Executando…" e é atualizado com o
 * resultado; fica aberto até o usuário fechá-lo. Fechar não envia comandos.
 */
export default function EmergencyModal() {
  const { emergency, dismissEmergency, emergencyStop, emergencyOriginRef, telemetry } = useBluetooth();
  const titleRef = useRef<any>(null);
  const wasOpenRef = useRef(false);
  const visible = emergency !== null;
  const running = emergency?.phase === 'running';

  const focusTitle = () => {
    const node = titleRef.current;
    if (!node) return;
    if (Platform.OS === 'web') {
      node.focus?.();
      return;
    }
    const tag = findNodeHandle(node);
    if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
  };

  // Foco no título ao abrir e quando o resultado chega; devolve ao botão de origem ao fechar.
  useEffect(() => {
    if (visible) {
      wasOpenRef.current = true;
      const t = setTimeout(focusTitle, 50);
      return () => clearTimeout(t);
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      const target = emergencyOriginRef.current;
      const t = setTimeout(() => restoreFocus(target), 300);
      return () => clearTimeout(t);
    }
  }, [visible, emergency?.phase, emergency?.id, emergencyOriginRef]);

  const desc = emergency?.report ? describeEmergency(emergency.report, telemetry) : null;
  const tone = running || !desc ? TONE.running : TONE[desc.tone];
  const title = running || !desc ? 'Executando parada de emergência…' : desc.title;

  // Botão Voltar do Android: não cancela uma parada em andamento.
  const handleRequestClose = () => {
    if (!running) dismissEmergency();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleRequestClose}>
      <View style={styles.overlay}>
        <View style={styles.box} accessibilityViewIsModal>
          <View style={[styles.header, { backgroundColor: tone.bg }]}>
            {running ? (
              <ActivityIndicator size="large" color={tone.color} />
            ) : (
              <Ionicons name={tone.icon} size={56} color={tone.color} />
            )}
            <View
              ref={titleRef}
              focusable
              accessible
              accessibilityRole="header"
              accessibilityLabel={title}
              accessibilityLiveRegion="assertive"
            >
              <Text style={[styles.title, { color: tone.color }]}>{title}</Text>
            </View>
            {emergency && (
              <Text style={styles.source}>
                {emergency.source === 'sim' ? 'Modo de Simulação' : 'Bluetooth BLE'}
              </Text>
            )}
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {running ? (
              <Text style={styles.note}>
                Enviando: parar movimento, desligar bomba e sair do modo automático.
              </Text>
            ) : (
              desc && (
                <>
                  {desc.lines.map((line, i) => (
                    <View key={i} style={styles.line} accessible accessibilityLabel={line.text}>
                      <Ionicons name={LINE[line.kind].icon} size={24} color={LINE[line.kind].color} />
                      <Text style={[styles.lineText, { color: LINE[line.kind].color }]}>{line.text}</Text>
                    </View>
                  ))}
                  <Text style={styles.note}>{desc.note}</Text>
                </>
              )
            )}
          </ScrollView>

          {!running && desc && (
            <View style={styles.actions}>
              {desc.canRetry && (
                <TouchableOpacity
                  style={[styles.action, styles.retry]}
                  onPress={() => void emergencyStop()}
                  accessibilityRole="button"
                  accessibilityLabel="Tentar parada de emergência novamente"
                >
                  <Ionicons name="refresh" size={22} color="#fff" />
                  <Text style={styles.actionText}>Tentar novamente</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.action, styles.close]}
                onPress={dismissEmergency}
                accessibilityRole="button"
                accessibilityLabel="Fechar resultado da parada de emergência"
              >
                <Text style={[styles.actionText, styles.closeText]}>Fechar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 30,
  },
  source: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    padding: 20,
    gap: 12,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  lineText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  note: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 21,
  },
  actions: {
    padding: 16,
    paddingTop: 4,
    gap: 10,
  },
  action: {
    minHeight: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  retry: {
    backgroundColor: '#991B1B',
  },
  close: {
    backgroundColor: '#E5E7EB',
  },
  actionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeText: {
    color: '#111827',
  },
});
