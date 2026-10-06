import { Ionicons } from './Icon';
import Slider from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';
import { useCommandFeedback } from '../hooks/useCommandFeedback';
import { ACK_PREFIX_BY_COMMAND } from '../services/hydroBotProtocol';
import type { Telemetry } from '../services/telemetry';
import FeedbackLine from './FeedbackLine';

interface Props {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  command: string;
  telemetryKey: 'speed' | 'pwm_min' | 'pwm_max';
  /** Valor informado pela telemetria (undefined = sem leitura). */
  remoteValue?: number;
  fallback: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  description: string;
  color: string;
  disabled: boolean;
  /** Recebe o valor local (inclusive durante o arraste), para limites dependentes. */
  onLocalChange?: (value: number) => void;
}

/**
 * Slider que não é sobrescrito pela telemetria enquanto o usuário arrasta.
 * Os botões − e + permitem ajuste preciso e funcionam com leitor de tela.
 */
export default function SliderSetting({
  title,
  icon,
  command,
  telemetryKey,
  remoteValue,
  fallback,
  min,
  max,
  step,
  unit = '',
  description,
  color,
  disabled,
  onLocalChange,
}: Props) {
  const [value, setValue] = useState(remoteValue ?? fallback);
  const draggingRef = useRef(false);
  const lastRemoteRef = useRef(remoteValue);
  const fb = useCommandFeedback();
  const { sessionId } = useBluetooth();
  const sessionRef = useRef(sessionId);

  // Nova sessão: descarta o valor local da sessão anterior e volta ao que o
  // dispositivo informar (ou ao padrão do app, sinalizado na tela).
  useEffect(() => {
    if (sessionRef.current === sessionId) return;
    sessionRef.current = sessionId;
    lastRemoteRef.current = remoteValue;
    draggingRef.current = false;
    setValue(remoteValue ?? fallback);
    // remoteValue/fallback lidos só no momento da troca de sessão
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Sincroniza apenas quando a telemetria muda de fato e não há arraste em curso.
  useEffect(() => {
    if (remoteValue === undefined || remoteValue === lastRemoteRef.current) return;
    lastRemoteRef.current = remoteValue;
    if (!draggingRef.current) setValue(remoteValue);
  }, [remoteValue]);

  useEffect(() => {
    onLocalChange?.(value);
  }, [value, onLocalChange]);

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));

  const commit = async (raw: number) => {
    const next = clamp(raw);
    const previous = remoteValue ?? fallback;
    const session = sessionRef.current;
    setValue(next);
    const { outcome } = await fb.run(`${command}:${next}`, {
      label: `${title} = ${next}${unit}`,
      confirm: {
        ackPrefix: ACK_PREFIX_BY_COMMAND[command],
        ackValue: String(next),
        check: (t: Telemetry) => t[telemetryKey] === next,
      },
    });
    // Sem envio, o controle volta ao último valor conhecido para não fingir sucesso.
    if (!outcome.ok && session === sessionRef.current) setValue(previous);
  };

  const shown = clamp(value);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name={icon} size={24} color="#B91C1C" />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={[styles.value, { color }]} accessibilityElementsHidden importantForAccessibility="no">
        {shown}
        {unit}
      </Text>
      <View style={styles.sliderRow}>
        <TouchableOpacity
          style={[styles.stepButton, (disabled || shown <= min) && styles.stepButtonDisabled]}
          onPress={() => commit(shown - step)}
          disabled={disabled || shown <= min}
          accessibilityRole="button"
          accessibilityLabel={`Diminuir ${title}`}
          accessibilityState={{ disabled: disabled || shown <= min }}
        >
          <Ionicons name="remove" size={22} color="#fff" />
        </TouchableOpacity>
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={shown}
          onSlidingStart={() => {
            draggingRef.current = true;
          }}
          onValueChange={setValue}
          onSlidingComplete={(v) => {
            draggingRef.current = false;
            void commit(v);
          }}
          minimumTrackTintColor={color}
          maximumTrackTintColor="#9CA3AF"
          thumbTintColor={color}
          disabled={disabled}
          accessibilityLabel={title}
          accessibilityValue={{ min, max, now: shown, text: `${shown}${unit}` }}
        />
        <TouchableOpacity
          style={[styles.stepButton, (disabled || shown >= max) && styles.stepButtonDisabled]}
          onPress={() => commit(shown + step)}
          disabled={disabled || shown >= max}
          accessibilityRole="button"
          accessibilityLabel={`Aumentar ${title}`}
          accessibilityState={{ disabled: disabled || shown >= max }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.labels}>
        <Text style={styles.label}>
          {min}
          {unit}
        </Text>
        <Text style={styles.label}>
          {max}
          {unit}
        </Text>
      </View>
      <Text style={styles.description}>{description}</Text>
      {remoteValue === undefined && (
        <Text style={styles.description}>
          Sem leitura do dispositivo: o valor mostrado é o padrão do app, não o valor em uso no robô.
        </Text>
      )}
      <FeedbackLine feedback={fb.feedback} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  value: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 48,
  },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 56,
  },
  label: {
    fontSize: 12,
    color: '#4B5563',
  },
  description: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 8,
  },
});
