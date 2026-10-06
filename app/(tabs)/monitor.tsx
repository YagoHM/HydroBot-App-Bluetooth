import { Ionicons } from '../../components/Icon';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import EmergencyStopBar from '../../components/EmergencyStopBar';
import NotConnectedCard from '../../components/NotConnectedCard';
import { useBluetooth } from '../../context/BluetoothContext';
import {
  DEFAULT_FIRE_PARAMS,
  FIRE_LEVEL_FILL_COLOR,
  FIRE_LEVEL_ICON,
  FIRE_LEVEL_LABEL,
  FIRE_LEVEL_SHORT,
  FIRE_LEVEL_TEXT_COLOR,
  classifyIntensity,
  type FireParams,
} from '../../services/fireLevels';
import { LOW_WATER_PUMP_BLOCK, PUMP_PWM_MAX, type Telemetry } from '../../services/telemetry';

/** Após este intervalo sem telemetria, os dados deixam de ser tratados como atuais. */
const STALE_AFTER_MS = 5000;

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function waterInfo(level: number) {
  if (level >= 60) return { icon: 'water' as const, color: '#1D4ED8', text: 'Nível adequado' };
  if (level >= 40) return { icon: 'water-outline' as const, color: '#92400E', text: 'Nível médio' };
  if (level > LOW_WATER_PUMP_BLOCK)
    return { icon: 'warning' as const, color: '#B91C1C', text: 'Nível baixo — reabasteça' };
  return {
    icon: 'alert-circle' as const,
    color: '#991B1B',
    text: 'CRÍTICO — reabasteça. Ligar a bomba está bloqueado.',
  };
}

function Missing({ text = 'Sem leitura' }: { text?: string }) {
  return (
    <View style={styles.missing}>
      <Ionicons name="remove-circle-outline" size={18} color="#4B5563" />
      <Text style={styles.missingText}>{text}</Text>
    </View>
  );
}

export default function MonitorScreen() {
  const { telemetry, isConnected, isMockMode } = useBluetooth();
  const now = useNow(1000);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!isConnected ? (
          <NotConnectedCard what="ver os dados" />
        ) : !telemetry ? (
          <View style={styles.waitingCard} accessible accessibilityLiveRegion="polite">
            <Ionicons name="hourglass-outline" size={48} color="#4B5563" />
            <Text style={styles.waitingTitle} accessibilityRole="header">
              {isMockMode ? 'Preparando simulação…' : 'Aguardando dados'}
            </Text>
            <Text style={styles.waitingText}>
              {isMockMode
                ? 'A primeira leitura simulada chega em instantes.'
                : 'Conectado, mas o HydroBot ainda não enviou telemetria. Nenhum valor é exibido até lá.'}
            </Text>
          </View>
        ) : (
          <TelemetryView telemetry={telemetry} now={now} />
        )}
      </ScrollView>
      <EmergencyStopBar />
    </View>
  );
}

function TelemetryView({ telemetry: t, now }: { telemetry: Telemetry; now: number }) {
  const sim = t.source === 'sim';
  const ageMs = now - t.receivedAt;
  const stale = ageMs > STALE_AFTER_MS;

  const deviceParams =
    t.fire_thresh !== undefined && t.fire_ideal !== undefined && t.fire_danger !== undefined;
  const params: FireParams = deviceParams
    ? { thresh: t.fire_thresh!, ideal: t.fire_ideal!, danger: t.fire_danger! }
    : DEFAULT_FIRE_PARAMS;
  const level = t.intensity !== undefined ? classifyIntensity(t.intensity, params) : null;

  return (
    <>
      <View
        style={[styles.sourceCard, stale && styles.sourceCardStale]}
        accessible
        accessibilityLabel={
          stale
            ? `Dados desatualizados: última leitura há ${Math.round(ageMs / 1000)} segundos`
            : sim
              ? 'Leituras simuladas, geradas pelo app'
              : 'Leituras recebidas do HydroBot por Bluetooth BLE'
        }
      >
        <Ionicons
          name={stale ? 'time-outline' : sim ? 'flask' : 'radio'}
          size={18}
          color={stale ? '#991B1B' : '#374151'}
        />
        <Text style={[styles.sourceText, stale && styles.sourceTextStale]}>
          {stale
            ? `Dados desatualizados — última leitura há ${Math.round(ageMs / 1000)} s`
            : sim
              ? 'Leituras SIMULADAS · geradas pelo app'
              : 'Leituras do HydroBot (BLE)'}
        </Text>
      </View>

      {/* Nível de Água */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons
            name={t.water !== undefined ? waterInfo(t.water).icon : 'water-outline'}
            size={32}
            color={t.water !== undefined ? waterInfo(t.water).color : '#6B7280'}
          />
          <Text style={styles.cardTitle} accessibilityRole="header">
            Nível de Água{sim ? ' (simulado)' : ''}
          </Text>
        </View>
        {t.water === undefined ? (
          <Missing />
        ) : (
          <View style={styles.metricContainer}>
            <Text style={[styles.metricValue, { color: waterInfo(t.water).color }]}>
              {t.water}%
            </Text>
            <View
              style={styles.progressBar}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Nível de água"
              accessibilityValue={{ min: 0, max: 100, now: t.water, text: `${t.water}%` }}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${t.water}%`, backgroundColor: waterInfo(t.water).color },
                ]}
              />
            </View>
            <Text style={[styles.metricDescription, { color: waterInfo(t.water).color }]}>
              {waterInfo(t.water).text}
            </Text>
          </View>
        )}
      </View>

      {/* Detecção de Fogo (resumo) */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons
            name="flame"
            size={32}
            color={level ? FIRE_LEVEL_FILL_COLOR[level] : '#6B7280'}
          />
          <Text style={styles.cardTitle} accessibilityRole="header">
            Detecção de Fogo
          </Text>
        </View>

        <View style={styles.metricContainer}>
          {t.fire === undefined ? (
            <Missing text="Estado de fogo sem leitura" />
          ) : t.fire ? (
            <View style={styles.fireState} accessible accessibilityRole="alert">
              <Ionicons name="flame" size={44} color="#B91C1C" />
              <Text style={styles.fireStateText}>
                {sim ? 'FOGO SIMULADO DETECTADO' : 'FOGO DETECTADO'}
              </Text>
            </View>
          ) : (
            <View style={styles.fireState}>
              <Ionicons name="checkmark-circle" size={44} color="#047857" />
              <Text style={[styles.fireStateText, { color: '#047857' }]}>
                Nenhum fogo detectado
              </Text>
            </View>
          )}

          <Text style={styles.metricLabel}>
            {sim ? 'Intensidade simulada — unidade relativa' : 'Intensidade — unidade relativa'}
          </Text>
          {t.intensity === undefined || !level ? (
            <Missing />
          ) : (
            <>
              <Text style={[styles.metricValue, { color: FIRE_LEVEL_TEXT_COLOR[level] }]}>
                {t.intensity}
              </Text>
              <View style={styles.fireLevel}>
                <Ionicons
                  name={FIRE_LEVEL_ICON[level]}
                  size={20}
                  color={FIRE_LEVEL_TEXT_COLOR[level]}
                />
                <Text style={[styles.fireLevelText, { color: FIRE_LEVEL_TEXT_COLOR[level] }]}>
                  {FIRE_LEVEL_LABEL[level]}
                </Text>
              </View>
            </>
          )}

          <Text style={styles.paramsText}>
            Faixas: detecção ≥ {params.thresh} · referência ≥ {params.ideal} · perigo ≥{' '}
            {params.danger}
            {'\n'}
            {deviceParams
              ? sim
                ? 'Parâmetros aplicados na simulação.'
                : 'Parâmetros informados pelo dispositivo.'
              : 'Valores padrão do app — o dispositivo não informou seus parâmetros.'}
          </Text>
        </View>
      </View>

      {/* Sensores */}
      <View style={styles.card}>
        {/* Título e selo em linhas próprias: o selo não comprime o título. */}
        <View style={[styles.cardTitleRow, t.calibrated && styles.cardTitleRowTight]}>
          <Ionicons name="thermometer-outline" size={32} color="#B91C1C" />
          <Text style={styles.cardTitle} accessibilityRole="header">
            Sensores de Fogo{sim ? ' (simulados)' : ''}
          </Text>
        </View>
        {t.calibrated && (
          <View style={styles.calibratedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#047857" />
            <Text style={styles.calibratedText}>
              {sim ? 'Calibração simulada' : 'Calibrado (informado pelo dispositivo)'}
            </Text>
          </View>
        )}

        <View style={styles.sensorsContainer}>
          <SensorCard name="Esquerdo" icon="arrow-back" value={t.sensor_left} delta={t.delta_left} params={params} />
          <SensorCard name="Centro" icon="arrow-up" value={t.sensor_center} delta={t.delta_center} params={params} />
          <SensorCard name="Direito" icon="arrow-forward" value={t.sensor_right} delta={t.delta_right} params={params} />
        </View>

        {t.calibrated &&
          t.base_left !== undefined &&
          t.base_center !== undefined &&
          t.base_right !== undefined && (
            <View style={styles.baseValues}>
              <Text style={styles.baseTitle}>
                Valores base {sim ? '(simulados)' : '(informados pelo dispositivo)'}
              </Text>
              <View style={styles.baseRow}>
                <BaseItem label="Esq" value={t.base_left} />
                <BaseItem label="Centro" value={t.base_center} />
                <BaseItem label="Dir" value={t.base_right} />
              </View>
            </View>
          )}
      </View>

      {/* Bomba */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons
            name="speedometer"
            size={32}
            color={t.pump !== undefined && t.pump > 0 ? '#1D4ED8' : '#6B7280'}
          />
          <Text style={styles.cardTitle} accessibilityRole="header">
            Bomba de Água
          </Text>
        </View>
        {t.pump === undefined ? (
          <Missing />
        ) : (
          <View style={styles.metricContainer}>
            <View style={styles.pumpStatus}>
              <Ionicons
                name={t.pump > 0 ? 'play-circle' : 'pause-circle'}
                size={22}
                color={t.pump > 0 ? '#047857' : '#4B5563'}
              />
              <Text style={styles.pumpStatusText}>{t.pump > 0 ? 'LIGADA' : 'DESLIGADA'}</Text>
            </View>
            {t.pump > 0 && (
              <>
                <Text style={styles.pumpValue}>
                  PWM {t.pump} de {PUMP_PWM_MAX}
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${(t.pump / PUMP_PWM_MAX) * 100}%`, backgroundColor: '#1D4ED8' },
                    ]}
                  />
                </View>
                <Text style={styles.metricDescription}>
                  Potência: {Math.round((t.pump / PUMP_PWM_MAX) * 100)}%
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* Status do Sistema */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="information-circle" size={32} color="#B91C1C" />
          <Text style={styles.cardTitle} accessibilityRole="header">
            Status do Sistema
          </Text>
        </View>
        <View style={styles.infoGrid}>
          <InfoItem
            label="Modo"
            value={t.mode === undefined ? 'Sem leitura' : t.mode === 'AUTO' ? 'Automático' : 'Manual'}
            icon={t.mode === 'AUTO' ? 'sync' : 'hand-left'}
          />
          <InfoItem label="Velocidade" value={t.speed === undefined ? 'Sem leitura' : `${t.speed}%`} />
          <InfoItem label="PWM Mín" value={t.pwm_min === undefined ? 'Sem leitura' : String(t.pwm_min)} />
          <InfoItem label="PWM Máx" value={t.pwm_max === undefined ? 'Sem leitura' : String(t.pwm_max)} />
        </View>
      </View>
    </>
  );
}

function SensorCard({
  name,
  icon,
  value,
  delta,
  params,
}: {
  name: string;
  icon: 'arrow-back' | 'arrow-up' | 'arrow-forward';
  value?: number;
  delta?: number;
  params: FireParams;
}) {
  const level = delta !== undefined ? classifyIntensity(delta, params) : null;
  const textColor = level ? FIRE_LEVEL_TEXT_COLOR[level] : '#4B5563';
  const pct = delta !== undefined ? Math.min((delta / Math.max(params.danger, 1)) * 100, 100) : 0;
  return (
    <View
      style={styles.sensorCard}
      accessible
      accessibilityLabel={
        value === undefined || delta === undefined || !level
          ? `Sensor ${name}: sem leitura`
          : `Sensor ${name}: leitura ${Math.round(value)}, variação ${Math.round(delta)}, ${FIRE_LEVEL_SHORT[level]}`
      }
    >
      <View style={styles.sensorHeader}>
        <Ionicons name={icon} size={18} color="#374151" />
        <Text style={styles.sensorTitle}>{name}</Text>
      </View>
      {value === undefined || delta === undefined || !level ? (
        <Text style={styles.sensorMissing}>Sem leitura</Text>
      ) : (
        <>
          <Text style={styles.sensorValue}>{Math.round(value)}</Text>
          <Text style={[styles.sensorDeltaValue, { color: textColor }]}>Δ {Math.round(delta)}</Text>
          <Text style={[styles.sensorLevel, { color: textColor }]}>{FIRE_LEVEL_SHORT[level]}</Text>
          <View style={styles.sensorBar}>
            <View
              style={[
                styles.sensorBarFill,
                { height: `${pct}%`, backgroundColor: FIRE_LEVEL_FILL_COLOR[level] },
              ]}
            />
          </View>
        </>
      )}
    </View>
  );
}

function BaseItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.baseItem}>
      <Text style={styles.baseLabel}>{label}:</Text>
      <Text style={styles.baseValue}>{value}</Text>
    </View>
  );
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: 'sync' | 'hand-left';
}) {
  return (
    <View style={styles.infoItem} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueContainer}>
        {icon && <Ionicons name={icon} size={18} color="#B91C1C" />}
        <Text style={styles.infoValue}>{value}</Text>
      </View>
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
  waitingCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 12,
  },
  waitingText: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  sourceCardStale: {
    backgroundColor: '#FEE2E2',
  },
  sourceText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  sourceTextStale: {
    color: '#991B1B',
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
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 4,
    flex: 1,
  },
  missing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  missingText: {
    fontSize: 15,
    color: '#4B5563',
    fontWeight: '600',
  },
  cardTitleRowTight: {
    marginBottom: 8,
  },
  calibratedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  calibratedText: {
    fontSize: 12,
    // #047857 sobre #ECFDF5: contraste 5,21:1
    color: '#047857',
    fontWeight: '600',
    marginLeft: 4,
  },
  metricContainer: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 44,
    fontWeight: 'bold',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  metricDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  pumpStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pumpStatusText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  pumpValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  fireState: {
    alignItems: 'center',
    marginBottom: 8,
  },
  fireStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#B91C1C',
    marginTop: 8,
    textAlign: 'center',
  },
  fireLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  fireLevelText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  paramsText: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  sensorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  // Largura pelo conteúdo: três colunas quando cabem; com fonte ampliada os
  // cartões passam para a linha seguinte em vez de partir as palavras (M4).
  sensorCard: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
    minWidth: '30%',
    maxWidth: '100%',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  sensorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sensorTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 4,
  },
  sensorMissing: {
    fontSize: 12,
    color: '#4B5563',
    textAlign: 'center',
    paddingVertical: 12,
  },
  sensorValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  sensorDeltaValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  sensorLevel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  sensorBar: {
    width: '100%',
    height: 48,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  sensorBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  baseValues: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  baseTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  baseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  baseItem: {
    flex: 1,
    alignItems: 'center',
  },
  baseLabel: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 2,
  },
  baseValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
    minWidth: '45%',
    maxWidth: '100%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 4,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});
