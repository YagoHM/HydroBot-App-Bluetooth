import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_FIRE_PARAMS } from '../services/fireLevels';
import { parseDecimalInteger, validateFireParam } from '../utils/validation';

test('aceita apenas inteiros decimais completos', () => {
  assert.deepEqual(parseDecimalInteger('120'), { ok: true, value: 120 });
  assert.deepEqual(parseDecimalInteger(' 45 '), { ok: true, value: 45 });
  for (const bad of ['', '   ', '20abc', '50.5', '50,5', '1e2', '-5', '0x10', '+20', '2 0']) {
    assert.equal(parseDecimalInteger(bad).ok, false, `deveria rejeitar "${bad}"`);
  }
});

test('mensagens específicas por tipo de erro', () => {
  const msg = (t: string) => {
    const r = parseDecimalInteger(t);
    return r.ok ? '' : r.error;
  };
  assert.match(msg(''), /Digite um valor/);
  assert.match(msg('50.5'), /sem casas decimais/);
  assert.match(msg('20abc'), /apenas dígitos/);
  assert.match(msg('1e2'), /apenas dígitos/);
  assert.match(msg('-1'), /positivos/);
});

test('limites das faixas atuais', () => {
  const p = DEFAULT_FIRE_PARAMS; // 50 / 200 / 350
  assert.equal(validateFireParam('thresh', '20', p).ok, true);
  assert.equal(validateFireParam('thresh', '19', p).ok, false);
  assert.equal(validateFireParam('thresh', '199', p).ok, true);
  assert.equal(validateFireParam('thresh', '201', p).ok, false);
  assert.equal(validateFireParam('danger', '600', p).ok, true);
  assert.equal(validateFireParam('danger', '601', p).ok, false);
  assert.equal(validateFireParam('ideal', '100', p).ok, true);
  assert.equal(validateFireParam('ideal', '99', p).ok, false);
});

test('mantém limiar < referência < perigo', () => {
  const p = { thresh: 50, ideal: 200, danger: 350 };
  assert.equal(validateFireParam('thresh', '200', p).ok, false);
  assert.equal(validateFireParam('ideal', '350', p).ok, false);
  assert.equal(validateFireParam('ideal', '50', p).ok, false);
  assert.equal(validateFireParam('danger', '200', p).ok, false);
  assert.equal(validateFireParam('danger', '201', p).ok, true);
});
