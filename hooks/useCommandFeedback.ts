import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useBluetooth,
  type CommandOutcome,
  type ConfirmOptions,
} from '../context/BluetoothContext';

export type Feedback =
  | { kind: 'pending'; text: string }
  | { kind: 'success'; text: string }
  | { kind: 'info'; text: string }
  | { kind: 'error'; text: string };

interface RunOptions {
  /** Nome da ação mostrado ao usuário (ex.: "Bomba ligada"). */
  label: string;
  /** Como reconhecer a confirmação no modo BLE, se o protocolo oferecer alguma. */
  confirm?: ConfirmOptions;
}

export interface RunResult {
  outcome: CommandOutcome;
  /** true se aplicado na simulação ou confirmado pelo dispositivo. */
  confirmed: boolean;
}

/**
 * Envia um comando e descreve o resultado sem exagerar: aplicado na simulação,
 * enviado (sem confirmação), confirmado pelo dispositivo ou falha.
 */
export function useCommandFeedback() {
  const { sendCommand, waitForConfirmation } = useBluetooth();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (command: string, { label, confirm }: RunOptions): Promise<RunResult> => {
      const id = ++runIdRef.current;
      const update = (f: Feedback | null) => {
        if (mountedRef.current && id === runIdRef.current) setFeedback(f);
      };
      update({ kind: 'pending', text: `${label}: enviando…` });
      const outcome = await sendCommand(command);
      let confirmed = outcome.ok && outcome.status === 'applied-sim';

      if (!outcome.ok) {
        update({ kind: 'error', text: `${label}: falhou. ${outcome.error}` });
      } else if (outcome.status === 'applied-sim') {
        update({ kind: 'success', text: `${label}: aplicado na simulação.` });
      } else if (confirm) {
        update({
          kind: 'pending',
          text: `${label}: comando enviado, aguardando confirmação do dispositivo…`,
        });
        confirmed = await waitForConfirmation(confirm);
        update(
          confirmed
            ? { kind: 'success', text: `${label}: confirmado pelo dispositivo.` }
            : {
                kind: 'info',
                text: `${label}: comando enviado, mas o dispositivo não confirmou em ${Math.round((confirm.timeoutMs ?? 3000) / 1000)} s. Verifique o robô antes de considerar aplicado.`,
              },
        );
      } else {
        update({
          kind: 'info',
          text: `${label}: comando enviado. O app não recebe confirmação deste comando.`,
        });
      }
      return { outcome, confirmed };
    },
    [sendCommand, waitForConfirmation],
  );

  const clear = useCallback(() => {
    runIdRef.current += 1;
    setFeedback(null);
  }, []);

  return { feedback, run, setFeedback, clear };
}
