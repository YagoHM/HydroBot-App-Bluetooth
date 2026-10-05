// Faixas de intensidade de fogo compartilhadas entre a simulação, o Monitor
// e a validação dos parâmetros. A intensidade é uma unidade relativa: o app
// não conhece uma unidade física (°C, cm) documentada para ela.

export interface FireParams {
  /** Limiar de detecção (SET_FIRE_THRESH). */
  thresh: number;
  /** Intensidade de referência para atuação (SET_FIRE_IDEAL). */
  ideal: number;
  /** Intensidade de perigo (SET_FIRE_DANGER). */
  danger: number;
}

export type FireParamKey = keyof FireParams;

/** Valores usados pelo app enquanto o dispositivo não informa os seus. */
export const DEFAULT_FIRE_PARAMS: FireParams = { thresh: 50, ideal: 200, danger: 350 };

export const FIRE_PARAM_RANGES: Record<FireParamKey, { min: number; max: number }> = {
  thresh: { min: 20, max: 200 },
  ideal: { min: 100, max: 400 },
  danger: { min: 200, max: 600 },
};

export const FIRE_PARAM_LABELS: Record<FireParamKey, string> = {
  thresh: 'limiar de detecção',
  ideal: 'intensidade de referência',
  danger: 'intensidade de perigo',
};

export type FireLevel = 'none' | 'detected' | 'reference' | 'high';

export function classifyIntensity(intensity: number, params: FireParams): FireLevel {
  if (intensity >= params.danger) return 'high';
  if (intensity >= params.ideal) return 'reference';
  if (intensity >= params.thresh) return 'detected';
  return 'none';
}

export const FIRE_LEVEL_LABEL: Record<FireLevel, string> = {
  none: 'Abaixo do limiar de detecção',
  detected: 'Acima do limiar de detecção',
  reference: 'Na faixa de referência',
  high: 'Acima da intensidade de perigo',
};

export const FIRE_LEVEL_SHORT: Record<FireLevel, string> = {
  none: 'Normal',
  detected: 'Detecção',
  reference: 'Referência',
  high: 'Elevada',
};

/** Cores de texto com contraste ≥ 4,5:1 sobre branco e sobre #F3F4F6. */
export const FIRE_LEVEL_TEXT_COLOR: Record<FireLevel, string> = {
  none: '#047857',
  detected: '#92400E',
  reference: '#9A3412',
  high: '#B91C1C',
};

/** Cores de preenchimento (barras e ícones), sempre acompanhadas de texto. */
export const FIRE_LEVEL_FILL_COLOR: Record<FireLevel, string> = {
  none: '#10B981',
  detected: '#FCD34D',
  reference: '#F59E0B',
  high: '#DC2626',
};

export const FIRE_LEVEL_ICON: Record<FireLevel, 'checkmark-circle' | 'eye' | 'locate' | 'warning'> = {
  none: 'checkmark-circle',
  detected: 'eye',
  reference: 'locate',
  high: 'warning',
};
