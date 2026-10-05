import type { HydroBotTelemetry } from './hydroBotProtocol';

export type DataSource = 'sim' | 'ble';

export type Motion = 'STOPPED' | 'FWD' | 'BACK' | 'LEFT' | 'RIGHT';

export type FireScenario = 'none' | 'detected' | 'reference' | 'high';

/**
 * Telemetria exibida pelo app. Campos ausentes significam "sem leitura" e
 * nunca devem ser exibidos como zero. `motion` e `scenario` só existem na
 * simulação.
 */
export type Telemetry = Partial<HydroBotTelemetry> & {
  source: DataSource;
  receivedAt: number;
  motion?: Motion;
  scenario?: FireScenario;
};

/** Abaixo deste nível de água (%) o app não tenta ligar a bomba. */
export const LOW_WATER_PUMP_BLOCK = 10;

/** PWM máximo do contrato da bomba (0–255). */
export const PUMP_PWM_MAX = 255;

export const MOTION_LABEL: Record<Motion, string> = {
  STOPPED: 'Parado',
  FWD: 'Para frente',
  BACK: 'Para trás',
  LEFT: 'Girando à esquerda',
  RIGHT: 'Girando à direita',
};
