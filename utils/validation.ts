import {
  FIRE_PARAM_LABELS,
  FIRE_PARAM_RANGES,
  type FireParamKey,
  type FireParams,
} from '../services/fireLevels';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type IntegerParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

/**
 * Aceita apenas o texto completo como inteiro decimal (ex.: "120").
 * Rejeita vazio, sinais, decimais ("50.5", "50,5"), notação científica ("1e2")
 * e qualquer caractere extra ("20abc"). Espaços nas pontas são ignorados.
 */
export function parseDecimalInteger(text: string): IntegerParseResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, error: 'Digite um valor.' };
  if (/^-/.test(trimmed)) return { ok: false, error: 'Use apenas números positivos.' };
  if (/^\d+[.,]\d*$/.test(trimmed)) {
    return { ok: false, error: 'Use um número inteiro, sem casas decimais.' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: 'Use apenas dígitos de 0 a 9 (sem letras ou símbolos).' };
  }
  return { ok: true, value: Number(trimmed) };
}

/**
 * Valida um parâmetro de fogo: inteiro, dentro da faixa e mantendo a ordem
 * limiar de detecção < intensidade de referência < intensidade de perigo,
 * comparada com os valores em vigor dos outros dois parâmetros.
 */
export function validateFireParam(
  key: FireParamKey,
  text: string,
  current: FireParams,
): IntegerParseResult {
  const parsed = parseDecimalInteger(text);
  if (!parsed.ok) return parsed;
  const { value } = parsed;
  const { min, max } = FIRE_PARAM_RANGES[key];
  if (value < min || value > max) {
    return { ok: false, error: `O valor deve estar entre ${min} e ${max}.` };
  }
  if (key === 'thresh' && value >= current.ideal) {
    return {
      ok: false,
      error: `Deve ser menor que a ${FIRE_PARAM_LABELS.ideal} em vigor (${current.ideal}).`,
    };
  }
  if (key === 'ideal' && value <= current.thresh) {
    return {
      ok: false,
      error: `Deve ser maior que o ${FIRE_PARAM_LABELS.thresh} em vigor (${current.thresh}).`,
    };
  }
  if (key === 'ideal' && value >= current.danger) {
    return {
      ok: false,
      error: `Deve ser menor que a ${FIRE_PARAM_LABELS.danger} em vigor (${current.danger}).`,
    };
  }
  if (key === 'danger' && value <= current.ideal) {
    return {
      ok: false,
      error: `Deve ser maior que a ${FIRE_PARAM_LABELS.ideal} em vigor (${current.ideal}).`,
    };
  }
  return { ok: true, value };
}
