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

export const DEFAULT_TELEMETRY: HydroBotTelemetry = {
  water: 0,
  pump: 0,
  intensity: 0,
  mode: 'MANUAL',
  fire: false,
  speed: 60,
  speed_l: 60,
  speed_r: 60,
  turn_speed: 55,
  motor_pwm_min: 110,
  kick_fwd_ms: 80,
  kick_back_ms: 150,
  kick_pwm: 100,
  pwm_min: 180,
  pwm_max: 255,
  fire_thresh: 200,
  fire_danger: 1400,
  fire_ideal: 800,
};

const EVENT_PREFIXES: Array<[string, HydroBotEvent]> = [
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
  const numericKeys: Array<keyof HydroBotTelemetry> = [
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
