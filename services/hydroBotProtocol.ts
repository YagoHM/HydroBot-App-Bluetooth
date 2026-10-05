export const HYDROBOT_DEVICE_NAME = 'HydroBot';
export const HYDROBOT_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const HYDROBOT_RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const HYDROBOT_TX_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export type HydroBotMode = 'MANUAL' | 'AUTO';

export type HydroBotCommand =
  | 'FWD'
  | 'BACK'
  | 'LEFT'
  | 'RIGHT'
  | 'STOP'
  | 'PUMP_ON'
  | 'PUMP_OFF'
  | 'MODE_AUTO'
  | 'MODE_MANUAL'
  | 'CALIBRATE'
  | 'GET_STATUS'
  | `SET_SPEED:${number}`
  | `SET_SPEED_L:${number}`
  | `SET_SPEED_R:${number}`
  | `SET_TURN_SPEED:${number}`
  | `SET_MOTOR_PWM_MIN:${number}`
  | `SET_KICK_FWD:${number}`
  | `SET_KICK_BACK:${number}`
  | `SET_KICK_PWM:${number}`
  | `SET_PWM_MIN:${number}`
  | `SET_PWM_MAX:${number}`
  | `SET_FIRE_THRESH:${number}`
  | `SET_FIRE_DANGER:${number}`
  | `SET_FIRE_IDEAL:${number}`;

export type HydroBotTelemetry = {
  water: number;
  pump: number;
  intensity: number;
  mode: HydroBotMode;
  fire: boolean;
  speed: number;
  speed_l: number;
  speed_r: number;
  turn_speed: number;
  motor_pwm_min: number;
  kick_fwd_ms: number;
  kick_back_ms: number;
  kick_pwm: number;
  pwm_min: number;
  pwm_max: number;
  fire_thresh: number;
  fire_danger: number;
  fire_ideal: number;
  sensor_left: number;
  sensor_center: number;
  sensor_right: number;
  delta_left: number;
  delta_center: number;
  delta_right: number;
  base_left: number;
  base_center: number;
  base_right: number;
  calibrated: boolean;
};

export type HydroBotEvent =
  | 'ready'
  | 'ok'
  | 'error'
  | 'calibrating'
  | 'calibrated'
  | 'fire-too-close'
  | 'fire-fighting'
  | 'fire-approaching'
  | 'fire-out'
  | 'fire-lost'
  | 'mode'
  | 'unknown';

export type ParsedHydroBotMessage =
  | { kind: 'telemetry'; raw: string; telemetry: Partial<HydroBotTelemetry> }
  | { kind: 'event'; raw: string; event: HydroBotEvent; value?: string };

// Valores padrão anteriormente registrados aqui para o firmware (não confirmados):
// fire_thresh 200, fire_danger 1400, fire_ideal 800. Eles estão fora das faixas
// aceitas pela tela de Configurações (20–200, 200–600, 100–400); confirme a escala
// real com o firmware antes de alterar essas faixas.

/**
 * Prefixo da resposta que o firmware envia ao aplicar cada parâmetro.
 * Só é usado como evidência de aplicação quando a resposta chega de fato.
 */
export const ACK_PREFIX_BY_COMMAND: Record<string, string> = {
  SET_SPEED: 'SPEED_SET:',
  SET_PWM_MIN: 'PWM_MIN_SET:',
  SET_PWM_MAX: 'PWM_MAX_SET:',
  SET_FIRE_THRESH: 'FIRE_THRESH_SET:',
  SET_FIRE_DANGER: 'FIRE_DANGER_SET:',
  SET_FIRE_IDEAL: 'FIRE_IDEAL_SET:',
};

const EVENT_PREFIXES: [string, HydroBotEvent][] = [
  ['OK:', 'ok'],
  ['ERR:', 'error'],
  ['SPEED_SET:', 'ok'],
  ['SPEED_L_SET:', 'ok'],
  ['SPEED_R_SET:', 'ok'],
  ['TURN_SPEED_SET:', 'ok'],
  ['MOTOR_PWM_MIN_SET:', 'ok'],
  ['KICK_FWD_SET:', 'ok'],
  ['KICK_BACK_SET:', 'ok'],
  ['KICK_PWM_SET:', 'ok'],
  ['PWM_MIN_SET:', 'ok'],
  ['PWM_MAX_SET:', 'ok'],
  ['FIRE_THRESH_SET:', 'ok'],
  ['FIRE_DANGER_SET:', 'ok'],
  ['FIRE_IDEAL_SET:', 'ok'],
  ['CAL_DONE:', 'calibrated'],
  ['MODE:', 'mode'],
];

function numberFrom(value: unknown): number | undefined {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function boolFrom(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return undefined;
}

function modeFrom(value: unknown): HydroBotMode | undefined {
  return value === 'AUTO' || value === 'MANUAL' ? value : undefined;
}

export function encodeHydroBotCommand(command: HydroBotCommand): string {
  return `${command.trim()}\n`;
}

export function sanitizeTelemetry(input: Record<string, unknown>): Partial<HydroBotTelemetry> {
  const output: Partial<HydroBotTelemetry> = {};
  const numericKeys: (keyof HydroBotTelemetry)[] = [
    'water',
    'pump',
    'intensity',
    'speed',
    'speed_l',
    'speed_r',
    'turn_speed',
    'motor_pwm_min',
    'kick_fwd_ms',
    'kick_back_ms',
    'kick_pwm',
    'pwm_min',
    'pwm_max',
    'fire_thresh',
    'fire_danger',
    'fire_ideal',
    'sensor_left',
    'sensor_center',
    'sensor_right',
    'delta_left',
    'delta_center',
    'delta_right',
    'base_left',
    'base_center',
    'base_right',
  ];

  for (const key of numericKeys) {
    const value = numberFrom(input[key]);
    if (value !== undefined) {
      output[key] = value as never;
    }
  }

  const mode = modeFrom(input.mode);
  if (mode) output.mode = mode;

  const fire = boolFrom(input.fire);
  if (fire !== undefined) output.fire = fire;

  const calibrated = boolFrom(input.calibrated);
  if (calibrated !== undefined) output.calibrated = calibrated;

  return output;
}

export function parseHydroBotMessage(message: string): ParsedHydroBotMessage[] {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw) => {
      if (raw.startsWith('{') && raw.endsWith('}')) {
        try {
          return {
            kind: 'telemetry',
            raw,
            telemetry: sanitizeTelemetry(JSON.parse(raw) as Record<string, unknown>),
          };
        } catch {
          return { kind: 'event', raw, event: 'unknown' };
        }
      }

      if (raw === 'READY') return { kind: 'event', raw, event: 'ready' };
      if (raw === 'CAL_START') return { kind: 'event', raw, event: 'calibrating' };
      if (raw === 'FIRE_TOO_CLOSE') return { kind: 'event', raw, event: 'fire-too-close' };
      if (raw === 'FIRE_FIGHTING') return { kind: 'event', raw, event: 'fire-fighting' };
      if (raw === 'FIRE_APPROACHING') return { kind: 'event', raw, event: 'fire-approaching' };
      if (raw === 'FIRE_OUT') return { kind: 'event', raw, event: 'fire-out' };
      if (raw === 'FIRE_LOST') return { kind: 'event', raw, event: 'fire-lost' };

      for (const [prefix, event] of EVENT_PREFIXES) {
        if (raw.startsWith(prefix)) {
          return { kind: 'event', raw, event, value: raw.slice(prefix.length) };
        }
      }

      return { kind: 'event', raw, event: 'unknown' };
    });
}
