// Regras da parada de emergência que não dependem de React: quais comandos
// são enviados e como o resultado é descrito ao usuário. O texto distingue
// "aplicado na simulação", "enviado" (escrita BLE concluída, sem comprovar
// parada física) e "falhou".

import type { DataSource, Telemetry } from './telemetry';

/**
 * Resultado de um comando, sem exagerar o que se sabe:
 * - "applied-sim": a simulação aplicou o comando;
 * - "sent": a escrita BLE terminou, mas o dispositivo ainda não confirmou;
 * - "failed": o comando não foi aplicado/enviado.
 */
export type CommandOutcome =
  | { ok: true; status: 'applied-sim' | 'sent'; command: string }
  | { ok: false; status: 'failed'; command: string; error: string };

export interface EmergencyStep {
  command: string;
  label: string;
  outcome: CommandOutcome;
}

export interface EmergencyReport {
  at: number;
  source: DataSource;
  steps: EmergencyStep[];
}

/** Ordem de envio: cada comando é tentado mesmo que o anterior falhe. */
export const EMERGENCY_STEPS: { command: string; label: string; simState: string }[] = [
  { command: 'STOP', label: 'Parar movimento', simState: 'Movimento parado' },
  { command: 'PUMP_OFF', label: 'Desligar bomba', simState: 'Bomba desligada' },
  { command: 'MODE_MANUAL', label: 'Sair do modo automático', simState: 'Modo manual' },
];

export type EmergencyTone = 'success' | 'sent' | 'partial' | 'failed';
export type LineKind = 'ok' | 'sent' | 'fail' | 'informed';

export interface EmergencyLine {
  kind: LineKind;
  text: string;
}

export interface EmergencyDescription {
  tone: EmergencyTone;
  title: string;
  lines: EmergencyLine[];
  note: string;
  canRetry: boolean;
  /** Frase curta para o leitor de tela. */
  announcement: string;
}

function lineFor(step: EmergencyStep): EmergencyLine {
  const { outcome } = step;
  if (!outcome.ok) return { kind: 'fail', text: `${step.label}: falhou — ${outcome.error}` };
  if (outcome.status === 'sent') {
    return { kind: 'sent', text: `${step.label}: comando enviado (sem confirmação do robô)` };
  }
  const simState = EMERGENCY_STEPS.find((s) => s.command === step.command)?.simState;
  return { kind: 'ok', text: simState ?? `${step.label}: aplicado na simulação` };
}

/**
 * Estados informados pela telemetria recebida depois do envio. Só aparecem
 * os campos que o protocolo trouxe; nada é deduzido do envio em si.
 */
export function informedStates(report: EmergencyReport, after: Telemetry | null): EmergencyLine[] {
  if (report.source !== 'ble' || !after || after.source !== 'ble' || after.receivedAt < report.at) {
    return [];
  }
  const lines: EmergencyLine[] = [];
  if (after.pump !== undefined) {
    lines.push({
      kind: 'informed',
      text: `Bomba informada pelo robô: ${after.pump > 0 ? 'LIGADA' : 'desligada'}`,
    });
  }
  if (after.mode !== undefined) {
    lines.push({
      kind: 'informed',
      text: `Modo informado pelo robô: ${after.mode === 'AUTO' ? 'automático' : 'manual'}`,
    });
  }
  return lines;
}

export function describeEmergency(
  report: EmergencyReport,
  after: Telemetry | null = null,
): EmergencyDescription {
  const sim = report.source === 'sim';
  const failures = report.steps.filter((s) => !s.outcome.ok).length;
  const lines = report.steps.map(lineFor);

  if (failures === report.steps.length) {
    // Mesma causa em todas as ações (ex.: sem conexão): mostra a causa uma vez.
    const errors = report.steps.map((s) => (s.outcome.ok ? '' : s.outcome.error));
    const commonCause = errors.every((e) => e === errors[0]) ? errors[0] : null;
    return {
      tone: 'failed',
      title: sim ? 'Parada de emergência não aplicada' : 'Comandos de parada não enviados',
      lines: commonCause
        ? [
            { kind: 'fail', text: `Nenhum comando de parada foi enviado: ${commonCause}` },
            {
              kind: 'fail',
              text: `Não enviados: ${report.steps.map((s) => s.label.toLowerCase()).join(', ')}.`,
            },
          ]
        : lines,
      note: 'Nenhum comando de parada foi aplicado. Verifique a conexão e tente novamente; se o robô estiver ativo, desligue a alimentação dele.',
      canRetry: true,
      announcement: 'Falha: a parada de emergência não foi aplicada',
    };
  }
  if (failures > 0) {
    return {
      tone: 'partial',
      title: 'Parada com falha parcial',
      lines: [...lines, ...informedStates(report, after)],
      note: 'Pelo menos um comando de parada não foi aplicado. Tente novamente; se persistir, desligue a alimentação do robô.',
      canRetry: true,
      announcement: `Parada de emergência com ${failures} falha${failures > 1 ? 's' : ''}`,
    };
  }
  if (sim) {
    return {
      tone: 'success',
      title: 'Parada de emergência aplicada na simulação',
      lines,
      note: 'A detecção de fogo continua ativa. Nada é retomado sozinho: escolha o modo e os comandos novamente quando quiser.',
      canRetry: false,
      announcement: 'Parada de emergência aplicada na simulação',
    };
  }
  return {
    tone: 'sent',
    title: 'Comandos de parada enviados',
    lines: [...lines, ...informedStates(report, after)],
    note: 'O envio por Bluetooth não comprova que o robô parou. Confirme visualmente; a saída do modo automático depende do firmware.',
    canRetry: false,
    announcement: 'Comandos de parada enviados. Confirme visualmente que o robô parou.',
  };
}
