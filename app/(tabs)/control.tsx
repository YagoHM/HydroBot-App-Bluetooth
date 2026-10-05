import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EmergencyStopBar from '../../components/EmergencyStopBar';
import FeedbackLine from '../../components/FeedbackLine';
import ModeBanner from '../../components/ModeBanner';
import NotConnectedCard from '../../components/NotConnectedCard';
import { useBluetooth } from '../../context/BluetoothContext';
import { useCommandFeedback } from '../../hooks/useCommandFeedback';
import { useScreenReader } from '../../hooks/useScreenReader';
import {
  LOW_WATER_PUMP_BLOCK,
  MOTION_LABEL,
  PUMP_PWM_MAX,
  type Motion,
} from '../../services/telemetry';

type Direction = Exclude<Motion, 'STOPPED'>;

const DIRECTIONS: Record<Direction, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  FWD: { icon: 'arrow-up', label: 'Mover para frente' },
  BACK: { icon: 'arrow-down', label: 'Mover para trás' },
  LEFT: { icon: 'arrow-back', label: 'Girar para a esquerda' },
  RIGHT: { icon: 'arrow-forward', label: 'Girar para a direita' },
};

export default function ControlScreen() {
  const { isConnected, telemetry, isMockMode, lastEmergency } = useBluetooth();
  const screenReader = useScreenReader();
  const modeFb = useCommandFeedback();
  const moveFb = useCommandFeedback();
  const pumpFb = useCommandFeedback();
  const [lastSentMove, setLastSentMove] = useState<Motion | null>(null);

  // Depois de uma parada de emergência, mensagens anteriores deixam de valer.
  const clearMode = modeFb.clear;
  const clearMove = moveFb.clear;
  const clearPump = pumpFb.clear;
  useEffect(() => {
    if (!lastEmergency) return;
    clearMode();
    clearMove();
    clearPump();
  }, [lastEmergency, clearMode, clearMove, clearPump]);

  const mode = telemetry?.mode;
  const isAuto = mode === 'AUTO';
  const pump = telemetry?.pump;
  const pumpOn = pump !== undefined ? pump > 0 : undefined;
  const water = telemetry?.water;
  const lowWater = water !== undefined && water <= LOW_WATER_PUMP_BLOCK;

  const toggleMode = () => {
    const target = isAuto ? 'MANUAL' : 'AUTO';
    void modeFb.run(target === 'AUTO' ? 'MODE_AUTO' : 'MODE_MANUAL', {
      label: target === 'AUTO' ? 'Modo automático' : 'Modo manual',
      confirm: { check: (t) => t.mode === target },
    });
  };

  const move = async (dir: Motion) => {
    const label = dir === 'STOPPED' ? 'Parar movimento' : DIRECTIONS[dir].label;
    const { outcome } = await moveFb.run(dir === 'STOPPED' ? 'STOP' : dir, { label });
    if (outcome.ok) setLastSentMove(dir);
  };

  const setPump = (on: boolean) => {
    void pumpFb.run(on ? 'PUMP_ON' : 'PUMP_OFF', {
      label: on ? 'Ligar bomba' : 'Desligar bomba',
      confirm: { check: (t) => t.pump !== undefined && (on ? t.pump > 0 : t.pump === 0) },
    });
  };

  // Ligar fica bloqueado com água baixa ou em AUTO; desligar nunca é bloqueado.
  const turnOnBlockedReason = lowWater
    ? `Nível de água baixo (${water}%). Reabasteça para ligar a bomba.`
    : isAuto
      ? 'No modo automático, quem decide ligar a bomba é o robô. Desligar continua disponível.'
      : null;

  const motionText = isMockMode
    ? `Movimento (simulação): ${telemetry?.motion ? MOTION_LABEL[telemetry.motion] : 'aguardando dados'}`
    : `Último comando de movimento enviado: ${lastSentMove ? MOTION_LABEL[lastSentMove] : 'nenhum'} (o robô não confirma movimento)`;

  const renderDirection = (dir: Direction) => (
    <TouchableOpacity
      style={styles.directionButton}
      // Com leitor de tela, o toque duplo inicia o movimento e "Parar movimento" encerra.
      onPressIn={screenReader ? undefined : () => void move(dir)}
      onPressOut={screenReader ? undefined : () => void move('STOPPED')}
      onPress={screenReader ? () => void move(dir) : undefined}
      accessibilityRole="button"
      accessibilityLabel={DIRECTIONS[dir].label}
      accessibilityHint={
        screenReader
          ? 'Toque duas vezes para iniciar. Use o botão Parar movimento para parar.'
          : 'Mantenha pressionado para mover; solte para parar.'
      }
    >
      <Ionicons name={DIRECTIONS[dir].icon} size={32} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <ModeBanner />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {!isConnected ? (
          <NotConnectedCard what="controlar o robô" />
        ) : (
          <>
            {/* Modo */}
            <View style={styles.card}>
              <View style={styles.modeHeader}>
                <View style={styles.modeInfo}>
                  <Ionicons name={isAuto ? 'sync' : 'hand-left'} size={28} color="#B91C1C" />
                  <View style={styles.modeText}>
                    <Text style={styles.modeTitle} accessibilityRole="header">
                      {mode === undefined
                        ? 'Modo: aguardando dados'
                        : `Modo ${isAuto ? 'Automático' : 'Manual'}`}
                    </Text>
                    <Text style={styles.modeDescription}>
                      {isAuto
                        ? isMockMode
                          ? 'Automático simulado: a simulação não reproduz o deslocamento do robô.'
                          : 'O robô decide movimento e bomba conforme o firmware.'
                        : 'Você controla o movimento e a bomba.'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.modeButton, isAuto && styles.modeButtonActive]}
                  onPress={toggleMode}
                  disabled={mode === undefined}
                  accessibilityRole="switch"
                  accessibilityLabel="Modo automático"
                  accessibilityState={{ checked: isAuto, disabled: mode === undefined }}
                >
                  <Text style={[styles.modeButtonText, isAuto && styles.modeButtonTextActive]}>
                    {isAuto ? 'AUTO' : 'MANUAL'}
                  </Text>
                </TouchableOpacity>
              </View>
              <FeedbackLine feedback={modeFb.feedback} />
            </View>

            {/* Movimento */}
            {!isAuto && (
              <View style={styles.card}>
                <Text style={styles.cardTitle} accessibilityRole="header">
                  Controle de Movimento
                </Text>
                <Text style={styles.hint}>
                  {screenReader
                    ? 'Toque duas vezes numa direção para mover; toque em Parar movimento para parar.'
                    : 'Mantenha uma seta pressionada para mover; ao soltar, o robô para.'}
                </Text>

                <View style={styles.controlsContainer}>
                  <View style={styles.controlRow}>{renderDirection('FWD')}</View>
                  <View style={styles.controlRow}>
                    {renderDirection('LEFT')}
                    <TouchableOpacity
                      style={[styles.directionButton, styles.stopButton]}
                      onPress={() => void move('STOPPED')}
                      accessibilityRole="button"
                      accessibilityLabel="Parar movimento"
                      accessibilityHint="Para apenas o deslocamento. Não desliga a bomba."
                    >
                      <Ionicons name="stop" size={24} color="#fff" />
                      <Text style={styles.stopButtonText}>PARAR</Text>
                    </TouchableOpacity>
                    {renderDirection('RIGHT')}
                  </View>
                  <View style={styles.controlRow}>{renderDirection('BACK')}</View>
                </View>

                <Text style={styles.motionStatus} accessibilityLiveRegion="polite">
                  {motionText}
                </Text>
                <FeedbackLine feedback={moveFb.feedback?.kind === 'error' ? moveFb.feedback : null} />
              </View>
            )}

            {/* Bomba */}
            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                Bomba de Água
              </Text>

              <View style={styles.pumpContainer}>
                <View style={styles.pumpInfo}>
                  <Ionicons
                    name={pumpOn ? 'water' : 'water-outline'}
                    size={44}
                    color={pumpOn ? '#1D4ED8' : '#6B7280'}
                  />
                  <View style={styles.pumpText}>
                    <Text style={styles.pumpStatus}>
                      {pumpOn === undefined ? 'Sem leitura' : pumpOn ? 'Ligada' : 'Desligada'}
                    </Text>
                    {pumpOn && pump !== undefined && (
                      <Text style={styles.pumpPWM}>
                        PWM {pump} de {PUMP_PWM_MAX} ({Math.round((pump / PUMP_PWM_MAX) * 100)}%)
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.pumpButtons}>
                {pumpOn !== true && (
                  <TouchableOpacity
                    style={[styles.pumpButton, turnOnBlockedReason && styles.buttonDisabled]}
                    onPress={() => setPump(true)}
                    disabled={!!turnOnBlockedReason}
                    accessibilityRole="button"
                    accessibilityLabel="Ligar bomba"
                    accessibilityState={{ disabled: !!turnOnBlockedReason }}
                    accessibilityHint={turnOnBlockedReason ?? undefined}
                  >
                    <Ionicons name="play" size={22} color="#fff" />
                    <Text style={styles.pumpButtonText}>Ligar</Text>
                  </TouchableOpacity>
                )}
                {pumpOn !== false && (
                  <TouchableOpacity
                    style={[styles.pumpButton, styles.pumpButtonOff]}
                    onPress={() => setPump(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Desligar bomba"
                  >
                    <Ionicons name="pause" size={22} color="#fff" />
                    <Text style={styles.pumpButtonText}>Desligar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {turnOnBlockedReason && pumpOn !== true && (
                <View style={styles.warningBox}>
                  <Ionicons name="information-circle" size={20} color="#92400E" />
                  <Text style={styles.warningText}>{turnOnBlockedReason}</Text>
                </View>
              )}
              {lowWater && pumpOn === true && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={20} color="#92400E" />
                  <Text style={styles.warningText}>
                    Nível de água baixo ({water}%). Você pode desligar a bomba normalmente.
                  </Text>
                </View>
              )}
              <FeedbackLine feedback={pumpFb.feedback} />
            </View>

            {/* Ações */}
            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                Ações Rápidas
              </Text>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.navigate('/(tabs)/settings')}
                accessibilityRole="button"
                accessibilityLabel="Configurar sensores"
                accessibilityHint="Abre a aba Configurações, com os parâmetros de detecção de fogo"
              >
                <Ionicons name="options-outline" size={24} color="#111827" />
                <Text style={styles.actionButtonText}>Configurar sensores</Text>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
      <EmergencyStopBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 8,
  },
  modeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeText: {
    marginLeft: 12,
    flex: 1,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  modeDescription: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 2,
  },
  modeButton: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 16,
    minHeight: 48,
    minWidth: 88,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: '#DC2626',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  controlsContainer: {
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 6,
  },
  directionButton: {
    backgroundColor: '#DC2626',
    width: 70,
    height: 70,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  stopButton: {
    backgroundColor: '#374151',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  motionStatus: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  pumpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pumpInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pumpText: {
    marginLeft: 16,
    flex: 1,
  },
  pumpStatus: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  pumpPWM: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
  },
  pumpButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  pumpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    minHeight: 48,
    borderRadius: 8,
  },
  pumpButtonOff: {
    // Branco sobre #1D4ED8: contraste 6,70:1
    backgroundColor: '#1D4ED8',
  },
  buttonDisabled: {
    backgroundColor: '#6B7280',
  },
  pumpButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 16,
    minHeight: 56,
    borderRadius: 8,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
  },
});
