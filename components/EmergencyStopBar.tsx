import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBluetooth, type EmergencyStep } from '../context/BluetoothContext';

/**
 * Parada de emergência fixa no rodapé de Controle e Monitor (fora da rolagem).
 * Envia os comandos imediatamente, sem confirmação prévia, e só depois mostra
 * o resultado de cada um.
 */
export default function EmergencyStopBar() {
  const { emergencyStop, lastEmergency, dismissEmergency, telemetry } = useBluetooth();
  const [sending, setSending] = useState(false);

  const handlePress = async () => {
    setSending(true);
    try {
      await emergencyStop();
    } finally {
      setSending(false);
    }
  };

  const report = lastEmergency;
  const sim = report?.source === 'sim';
  const failures = report ? report.steps.filter((s) => !s.outcome.ok).length : 0;
  const allFailed = report ? failures === report.steps.length : false;
  // Estado informado pela telemetria recebida depois da parada (não pelo envio).
  const after = report && telemetry && telemetry.receivedAt >= report.at ? telemetry : null;

  return (
    <View style={styles.wrap}>
      {report && !sending && (
        <View style={styles.report} accessibilityLiveRegion="polite">
          <View style={styles.reportHeader}>
            <Ionicons
              name={failures === 0 ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={failures === 0 ? '#065F46' : '#991B1B'}
            />
            <Text style={styles.reportTitle} accessibilityRole="header">
              {failures === 0
                ? sim
                  ? 'Parada aplicada na simulação'
                  : 'Parada enviada ao HydroBot'
                : allFailed
                  ? 'Parada não enviada'
                  : 'Parada com falha parcial'}
            </Text>
            <TouchableOpacity
              onPress={dismissEmergency}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Fechar resultado da parada de emergência"
            >
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>
          {sim && failures === 0 ? (
            <Text style={styles.stepText}>
              Movimento parado · bomba desligada · modo manual.
            </Text>
          ) : (
            report.steps.map((step) => <StepLine key={step.command} step={step} />)
          )}
          <Text style={styles.reportNote}>
            {allFailed
              ? 'Nenhum comando foi aplicado. Verifique a conexão; se o robô estiver ativo, desligue a alimentação dele.'
              : failures > 0
              ? 'Pelo menos um comando não foi aplicado. Toque novamente em Parada de emergência; se persistir, desligue a alimentação do robô.'
              : sim
              ? 'Retome o modo automático ou os comandos quando quiser. A detecção de fogo continua ativa.'
              : 'Escrita BLE concluída não comprova que o robô parou: confirme visualmente. A saída do modo automático depende do firmware.'}
          </Text>
          {!sim && after && (
            <Text style={styles.reportNote}>
              Telemetria recebida após a parada: bomba{' '}
              {after.pump === undefined ? 'sem leitura' : after.pump > 0 ? 'LIGADA' : 'desligada'}, modo{' '}
              {after.mode ?? 'sem leitura'}.
            </Text>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Parada de emergência"
        accessibilityHint="Para o movimento, desliga a bomba e sai do modo automático, sem pedir confirmação."
      >
        <Ionicons name="alert-circle" size={26} color="#fff" />
        <Text style={styles.buttonText}>
          {sending ? 'ENVIANDO PARADA…' : 'PARADA DE EMERGÊNCIA'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function StepLine({ step }: { step: EmergencyStep }) {
  const { outcome } = step;
  const icon = !outcome.ok ? 'close-circle' : outcome.status === 'sent' ? 'paper-plane' : 'checkmark-circle';
  const color = !outcome.ok ? '#991B1B' : outcome.status === 'sent' ? '#1E40AF' : '#065F46';
  const status = !outcome.ok
    ? `falhou — ${outcome.error}`
    : outcome.status === 'sent'
      ? 'enviado, sem confirmação'
      : 'aplicado na simulação';
  return (
    <View style={styles.step} accessible accessibilityLabel={`${step.label}: ${status}`}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.stepText}>
        <Text style={styles.stepLabel}>{step.label}: </Text>
        <Text style={{ color }}>{status}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
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
  report: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  close: {
    width: 48,
    height: 48,
    marginVertical: -12,
    marginRight: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
  },
  stepLabel: {
    fontWeight: '600',
  },
  reportNote: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 6,
    lineHeight: 16,
  },
});
