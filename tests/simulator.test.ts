import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyIntensity } from '../services/fireLevels';
import {
  createSimState,
  simApplyCommand,
  simTelemetry,
  simTick,
  type SimState,
} from '../services/simulator';

function run(state: SimState, ...commands: string[]): SimState {
  for (const c of commands) {
    const r = simApplyCommand(state, c);
    assert.equal(r.ok, true, `${c} deveria ser aceito: ${r.ok ? '' : r.error}`);
    state = r.state;
  }
  return state;
}

function ticks(state: SimState, n: number, check: (s: SimState) => void = () => {}): SimState {
  for (let i = 0; i < n; i++) {
    state = simTick(state);
    check(state);
  }
  return state;
}

test('sem fogo: intensidade sempre abaixo do limiar e fire=false', () => {
  ticks(createSimState(7), 200, (s) => {
    const t = simTelemetry(s, 0);
    assert.equal(t.fire, false);
    assert.equal(classifyIntensity(t.intensity!, s.params), 'none');
  });
});

test('cada cenário permanece na sua faixa ao longo das atualizações', () => {
  const cases = [
    ['FIRE_SIM:DETECTED', 'detected'],
    ['FIRE_SIM:REFERENCE', 'reference'],
    ['FIRE_SIM', 'reference'],
    ['FIRE_SIM:HIGH', 'high'],
  ] as const;
  for (const [cmd, level] of cases) {
    ticks(run(createSimState(3), cmd), 200, (s) => {
      const t = simTelemetry(s, 0);
      assert.equal(t.fire, true);
      assert.equal(classifyIntensity(t.intensity!, s.params), level);
      assert.equal(t.intensity, t.delta_center, 'intensidade = maior variação');
    });
  }
});

test('FIRE_STOP cancela de forma persistente', () => {
  const s = run(createSimState(11), 'FIRE_SIM:HIGH', 'FIRE_STOP');
  ticks(s, 300, (x) => {
    assert.equal(simTelemetry(x, 0).fire, false);
    assert.equal(x.scenario, 'none');
  });
});

test('parâmetros aplicados ficam em campos próprios e reclassificam a simulação', () => {
  let s = run(createSimState(5), 'FIRE_SIM:DETECTED');
  assert.ok(simTelemetry(s, 0).intensity! < 200);
  s = run(s, 'SET_FIRE_DANGER:500', 'SET_FIRE_IDEAL:300', 'SET_FIRE_THRESH:100');
  assert.deepEqual(s.params, { thresh: 100, ideal: 300, danger: 500 });
  assert.deepEqual(s.base, [200, 200, 200], 'base dos sensores não é sobrescrita');
  ticks(s, 100, (x) => {
    const t = simTelemetry(x, 0);
    assert.equal(t.fire_thresh, 100);
    assert.equal(t.fire_ideal, 300);
    assert.equal(t.fire_danger, 500);
    assert.equal(classifyIntensity(t.intensity!, x.params), 'detected');
  });
});

test('rejeita parâmetros fora de faixa ou fora de ordem', () => {
  const s = createSimState();
  assert.equal(simApplyCommand(s, 'SET_FIRE_THRESH:10').ok, false);
  assert.equal(simApplyCommand(s, 'SET_FIRE_THRESH:200').ok, false);
  assert.equal(simApplyCommand(s, 'SET_FIRE_DANGER:abc').ok, false);
  assert.equal(simApplyCommand(s, 'SET_PWM_MIN:256').ok, false);
  const narrowed = run(s, 'SET_PWM_MAX:200');
  assert.equal(simApplyCommand(narrowed, 'SET_PWM_MIN:210').ok, false);
});

test('movimento simulado responde aos direcionais e ao STOP', () => {
  let s = run(createSimState(), 'FWD');
  assert.equal(simTelemetry(s, 0).motion, 'FWD');
  s = run(s, 'LEFT');
  assert.equal(s.motion, 'LEFT');
  s = run(s, 'STOP');
  assert.equal(s.motion, 'STOPPED');
});

test('bomba: estado e PWM coerentes', () => {
  let s = run(createSimState(), 'PUMP_ON');
  assert.equal(simTelemetry(s, 0).pump, 255);
  s = run(s, 'SET_PWM_MAX:200');
  assert.equal(simTelemetry(s, 0).pump, 200);
  s = run(s, 'PUMP_OFF');
  assert.equal(simTelemetry(s, 0).pump, 0);
});

test('água baixa bloqueia ligar, mas não desligar a bomba', () => {
  let s = run(createSimState(), 'PUMP_ON', 'SIM_WATER:8');
  assert.equal(s.pumpOn, true);
  s = run(s, 'PUMP_OFF');
  assert.equal(s.pumpOn, false);
  assert.equal(simApplyCommand(s, 'PUMP_ON').ok, false);
});

test('parada de emergência em AUTO com fogo e bomba ativos', () => {
  let s = run(createSimState(9), 'FIRE_SIM:HIGH', 'PUMP_ON', 'MODE_AUTO');
  assert.equal(simApplyCommand(s, 'FWD').ok, false, 'direcionais ignorados em AUTO');
  s = run(s, 'STOP', 'PUMP_OFF', 'MODE_MANUAL');
  s = ticks(s, 50);
  const t = simTelemetry(s, 0);
  assert.equal(t.motion, 'STOPPED');
  assert.equal(t.pump, 0);
  assert.equal(t.mode, 'MANUAL', 'AUTO não retoma sozinho');
  assert.equal(t.fire, true, 'fogo não desaparece com a parada');
  assert.equal(t.scenario, 'high');
});

test('simulação é reprodutível pela semente', () => {
  const a = ticks(run(createSimState(42), 'FIRE_SIM:REFERENCE'), 20);
  const b = ticks(run(createSimState(42), 'FIRE_SIM:REFERENCE'), 20);
  assert.equal(simTelemetry(a, 0).intensity, simTelemetry(b, 0).intensity);
});

test('comando desconhecido é recusado', () => {
  assert.equal(simApplyCommand(createSimState(), 'DANCE').ok, false);
});
