// Dispositivo simulado do HydroBot. Lógica pura e determinística (gerador
// pseudoaleatório com semente), sem React, para poder ser testada isoladamente.
// Serve para testar a interface e as mensagens; não representa a física do robô.

import { DEFAULT_FIRE_PARAMS, FIRE_PARAM_RANGES, type FireParams } from './fireLevels';
import {
  LOW_WATER_PUMP_BLOCK,
  type FireScenario,
  type Motion,
  type Telemetry,
} from './telemetry';

export interface SimState {
  water: number;
  pumpOn: boolean;
  mode: 'AUTO' | 'MANUAL';
  motion: Motion;
  speed: number;
  pwmMin: number;
  pwmMax: number;
  scenario: FireScenario;
  params: FireParams;
  base: [number, number, number];
  calibrated: boolean;
  /** Ruído atual em [-1, 1] aplicado dentro da faixa do cenário. */
  noise: number;
  seed: number;
}

export type SimResult = { ok: true; state: SimState } | { ok: false; state: SimState; error: string };

export function createSimState(seed = 1): SimState {
  return {
    water: 75,
    pumpOn: false,
    mode: 'MANUAL',
    motion: 'STOPPED',
    speed: 100,
    pwmMin: 180,
    pwmMax: 255,
    scenario: 'none',
    params: { ...DEFAULT_FIRE_PARAMS },
    base: [200, 200, 200],
    calibrated: true,
    noise: 0,
    seed,
  };
}

// mulberry32: rápido e reprodutível a partir da semente
function nextRandom(seed: number): { value: number; seed: number } {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next };
}

/** Avança uma atualização periódica: só altera o ruído, nunca o cenário ou os parâmetros. */
export function simTick(state: SimState): SimState {
  const r = nextRandom(state.seed);
  return { ...state, noise: r.value * 2 - 1, seed: r.seed };
}

/** Intensidade sempre dentro da faixa do cenário atual, mesmo com ruído. */
export function simIntensity(state: SimState): number {
  const { thresh, ideal, danger } = state.params;
  const band = (lo: number, hi: number) => {
    const mid = (lo + hi) / 2;
    const spread = (hi - lo) * 0.2;
    return Math.min(hi, Math.max(lo, Math.round(mid + state.noise * spread)));
  };
  switch (state.scenario) {
    case 'none':
      return band(0, Math.max(0, Math.round(thresh * 0.6)));
    case 'detected':
      return band(thresh, ideal - 1);
    case 'reference':
      return band(ideal, danger - 1);
    case 'high':
      return band(danger, danger + Math.max(40, Math.round(danger * 0.3)));
  }
}

export function simTelemetry(state: SimState, receivedAt: number): Telemetry {
  const intensity = simIntensity(state);
  // A intensidade informada é a maior variação entre os três sensores.
  const delta_center = intensity;
  const delta_left = Math.round(intensity * 0.6);
  const delta_right = Math.round(intensity * 0.45);
  return {
    source: 'sim',
    receivedAt,
    water: state.water,
    pump: state.pumpOn ? state.pwmMax : 0,
    intensity,
    fire: intensity >= state.params.thresh,
    mode: state.mode,
    speed: state.speed,
    pwm_min: state.pwmMin,
    pwm_max: state.pwmMax,
    fire_thresh: state.params.thresh,
    fire_ideal: state.params.ideal,
    fire_danger: state.params.danger,
    sensor_left: state.base[0] + delta_left,
    sensor_center: state.base[1] + delta_center,
    sensor_right: state.base[2] + delta_right,
    delta_left,
    delta_center,
    delta_right,
    base_left: state.base[0],
    base_center: state.base[1],
    base_right: state.base[2],
    calibrated: state.calibrated,
    motion: state.motion,
    scenario: state.scenario,
  };
}

const SCENARIO_BY_ARG: Record<string, FireScenario> = {
  DETECTED: 'detected',
  REFERENCE: 'reference',
  HIGH: 'high',
};

const MOTION_COMMANDS: Record<string, Motion> = {
  FWD: 'FWD',
  BACK: 'BACK',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
};

const FIRE_PARAM_BY_COMMAND: Record<string, keyof FireParams> = {
  SET_FIRE_THRESH: 'thresh',
  SET_FIRE_IDEAL: 'ideal',
  SET_FIRE_DANGER: 'danger',
};

export function simApplyCommand(state: SimState, command: string): SimResult {
  const [cmd, arg] = command.trim().split(':');
  const fail = (error: string): SimResult => ({ ok: false, state, error });
  const ok = (patch: Partial<SimState>): SimResult => ({ ok: true, state: { ...state, ...patch } });
  const num = arg !== undefined && /^\d+$/.test(arg) ? Number(arg) : NaN;

  if (cmd in MOTION_COMMANDS) {
    if (state.mode === 'AUTO') return fail('Ignorado: o modo automático está ativo.');
    return ok({ motion: MOTION_COMMANDS[cmd] });
  }

  switch (cmd) {
    case 'STOP':
      return ok({ motion: 'STOPPED' });
    case 'PUMP_ON':
      if (state.water <= LOW_WATER_PUMP_BLOCK) return fail('Nível de água insuficiente para ligar a bomba.');
      return ok({ pumpOn: true });
    case 'PUMP_OFF':
      return ok({ pumpOn: false });
    case 'AUTO':
    case 'MODE_AUTO':
      return ok({ mode: 'AUTO', motion: 'STOPPED' });
    case 'MANUAL':
    case 'MODE_MANUAL':
      return ok({ mode: 'MANUAL', motion: 'STOPPED' });
    case 'GET_STATUS':
      return ok({});
    case 'CALIBRATE':
      return ok({ calibrated: true });
    case 'FIRE_SIM': {
      if (arg === undefined) return ok({ scenario: 'reference' });
      const scenario = SCENARIO_BY_ARG[arg];
      return scenario ? ok({ scenario }) : fail(`Cenário de fogo desconhecido: ${arg}`);
    }
    case 'FIRE_STOP':
      return ok({ scenario: 'none' });
    case 'SIM_WATER':
      if (isNaN(num) || num > 100) return fail('Nível de água simulado deve ser de 0 a 100.');
      return ok({ water: num, pumpOn: state.pumpOn && num > 0 });
    case 'SET_SPEED':
      if (isNaN(num) || num < 30 || num > 100) return fail('Velocidade deve estar entre 30 e 100.');
      return ok({ speed: num });
    case 'SET_PWM_MIN':
      if (isNaN(num) || num < 150 || num > 255) return fail('PWM mínimo deve estar entre 150 e 255.');
      if (num > state.pwmMax) return fail(`PWM mínimo não pode passar do PWM máximo (${state.pwmMax}).`);
      return ok({ pwmMin: num });
    case 'SET_PWM_MAX':
      if (isNaN(num) || num < 180 || num > 255) return fail('PWM máximo deve estar entre 180 e 255.');
      if (num < state.pwmMin) return fail(`PWM máximo não pode ficar abaixo do PWM mínimo (${state.pwmMin}).`);
      return ok({ pwmMax: num });
  }

  const paramKey = FIRE_PARAM_BY_COMMAND[cmd];
  if (paramKey) {
    const { min, max } = FIRE_PARAM_RANGES[paramKey];
    if (isNaN(num) || num < min || num > max) return fail(`Valor deve estar entre ${min} e ${max}.`);
    const params = { ...state.params, [paramKey]: num };
    if (!(params.thresh < params.ideal && params.ideal < params.danger)) {
      return fail('A ordem limiar < referência < perigo não seria mantida.');
    }
    return ok({ params });
  }

  return fail(`Comando não reconhecido pela simulação: ${cmd}`);
}
