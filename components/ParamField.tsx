import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { announce, useBluetooth } from '../context/BluetoothContext';
import { useCommandFeedback } from '../hooks/useCommandFeedback';
import { FIRE_PARAM_RANGES, type FireParamKey, type FireParams } from '../services/fireLevels';
import { ACK_PREFIX_BY_COMMAND } from '../services/hydroBotProtocol';
import type { Telemetry } from '../services/telemetry';
import { validateFireParam } from '../utils/validation';
import FeedbackLine from './FeedbackLine';

const TELEMETRY_KEY: Record<FireParamKey, 'fire_thresh' | 'fire_ideal' | 'fire_danger'> = {
  thresh: 'fire_thresh',
  ideal: 'fire_ideal',
  danger: 'fire_danger',
};

interface Props {
  paramKey: FireParamKey;
  command: string;
  title: string;
  help: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Valores em vigor (aplicados), usados para a regra de ordem. */
  current: FireParams;
  editable: boolean;
  onConfirmed: (key: FireParamKey, value: number) => void;
}

/**
 * Campo numérico de parâmetro de fogo. A edição é livre (inclusive apagar
 * tudo); o erro aparece depois de sair do campo ou de tentar aplicar, e
 * nenhum comando inválido é enviado.
 */
export default function ParamField({
  paramKey,
  command,
  title,
  help,
  icon,
  current,
  editable,
  onConfirmed,
}: Props) {
  const currentValue = current[paramKey];
  const [text, setText] = useState(String(currentValue));
  const [dirty, setDirty] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const fb = useCommandFeedback();
  const { min, max } = FIRE_PARAM_RANGES[paramKey];

  // Nova sessão (troca de modo/desconexão): edição e erros anteriores deixam de valer.
  const { sessionId } = useBluetooth();
  const sessionRef = useRef(sessionId);
  useEffect(() => {
    if (sessionRef.current === sessionId) return;
    sessionRef.current = sessionId;
    setDirty(false);
    setShowErrors(false);
  }, [sessionId]);

  // Acompanha o valor em vigor enquanto o usuário não estiver editando.
  useEffect(() => {
    if (!dirty) setText(String(currentValue));
  }, [currentValue, dirty]);

  const validation = validateFireParam(paramKey, text, current);
  const error = showErrors && !validation.ok ? validation.error : null;

  const apply = async () => {
    setShowErrors(true);
    if (!validation.ok) {
      announce(`${title}: ${validation.error}`);
      inputRef.current?.focus();
      return;
    }
    // Valor válido: fecha o teclado para o resultado ("Em vigor") ficar visível.
    // O toque em Aplicar não é consumido pelo teclado porque as telas usam
    // keyboardShouldPersistTaps="handled".
    Keyboard.dismiss();
    const value = validation.value;
    const telemetryKey = TELEMETRY_KEY[paramKey];
    const { confirmed } = await fb.run(`${command}:${value}`, {
      label: `${title} = ${value}`,
      confirm: {
        ackPrefix: ACK_PREFIX_BY_COMMAND[command],
        ackValue: String(value),
        check: (t: Telemetry) => t[telemetryKey] === value,
      },
    });
    if (confirmed) {
      onConfirmed(paramKey, value);
      setDirty(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name={icon} size={24} color="#B91C1C" />
        <Text style={styles.title} nativeID={`label-${paramKey}`}>
          {title}
        </Text>
      </View>
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          style={[styles.input, error && styles.inputError, !editable && styles.inputDisabled]}
          value={text}
          onChangeText={(t) => {
            setText(t);
            setDirty(true);
          }}
          onBlur={() => setShowErrors(true)}
          onSubmitEditing={apply}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={6}
          editable={editable}
          accessibilityLabel={error ? `${title}. Erro: ${error}` : title}
          accessibilityHint={`${help} Inteiro de ${min} a ${max}.`}
          accessibilityLabelledBy={`label-${paramKey}`}
          accessibilityState={{ disabled: !editable }}
        />
        <TouchableOpacity
          style={[styles.applyButton, !editable && styles.applyButtonDisabled]}
          onPress={apply}
          disabled={!editable}
          accessibilityRole="button"
          accessibilityLabel={`Aplicar ${title}`}
          accessibilityState={{ disabled: !editable }}
        >
          <Text style={styles.applyButtonText}>Aplicar</Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={16} color="#B91C1C" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <Text style={styles.description}>
          {help} Inteiro de {min} a {max}. Em vigor: {currentValue}.
        </Text>
      )}
      {!editable && (
        <Text style={styles.description}>Conecte-se a um dispositivo para aplicar.</Text>
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
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#6B7280',
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#B91C1C',
    borderWidth: 2,
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
  },
  applyButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 8,
  },
  applyButtonDisabled: {
    backgroundColor: '#6B7280',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 8,
    lineHeight: 18,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    // #B91C1C sobre branco: contraste 6,47:1
    color: '#B91C1C',
    fontWeight: '500',
  },
});
