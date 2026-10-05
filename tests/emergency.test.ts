import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeEmergency,
  EMERGENCY_STEPS,
  type CommandOutcome,
  type EmergencyReport,
} from '../services/emergency';
import type { Telemetry } from '../services/telemetry';

const ok = (command: string, status: 'applied-sim' | 'sent'): CommandOutcome => ({ ok: true, status, command });
const fail = (command: string, error = 'erro'): CommandOutcome => ({ ok: false, status: 'failed', command, error });

function report(source: 'sim' | 'ble', outcomes: CommandOutcome[]): EmergencyReport {
  return {
    at: 1000,
    source,
    steps: EMERGENCY_STEPS.map((s, i) => ({ command: s.command, label: s.label, outcome: outcomes[i] })),
  };
}

test('ordem dos comandos: parar movimento, desligar bomba, sair do automático', () => {
  assert.deepEqual(EMERGENCY_STEPS.map((s) => s.command), ['STOP', 'PUMP_OFF', 'MODE_MANUAL']);
});

test('simulação com as três ações aplicadas', () => {
  const d = describeEmergency(report('sim', [ok('STOP', 'applied-sim'), ok('PUMP_OFF', 'applied-sim'), ok('MODE_MANUAL', 'applied-sim')]));
  assert.equal(d.tone, 'success');
  assert.equal(d.title, 'Parada de emergência aplicada na simulação');
  assert.deepEqual(d.lines.map((l) => l.text), ['Movimento parado', 'Bomba desligada', 'Modo manual']);
  assert.equal(d.canRetry, false);
});

test('BLE: escrita concluída não é apresentada como parada confirmada', () => {
  const d = describeEmergency(report('ble', [ok('STOP', 'sent'), ok('PUMP_OFF', 'sent'), ok('MODE_MANUAL', 'sent')]));
  assert.equal(d.tone, 'sent');
  assert.equal(d.title, 'Comandos de parada enviados');
  assert.ok(d.lines.every((l) => l.kind === 'sent'));
  assert.ok(!d.lines.some((l) => /parado|desligada|Modo manual$/.test(l.text)), 'sem estados não informados');
  assert.match(d.note, /não comprova/);
});

test('BLE: só mostra estados que a telemetria posterior informou', () => {
  const r = report('ble', [ok('STOP', 'sent'), ok('PUMP_OFF', 'sent'), ok('MODE_MANUAL', 'sent')]);
  const before: Telemetry = { source: 'ble', receivedAt: 900, pump: 0, mode: 'MANUAL' };
  assert.equal(describeEmergency(r, before).lines.filter((l) => l.kind === 'informed').length, 0, 'telemetria antiga ignorada');
  const afterPumpOnly: Telemetry = { source: 'ble', receivedAt: 1200, pump: 0 };
  const informed = describeEmergency(r, afterPumpOnly).lines.filter((l) => l.kind === 'informed');
  assert.deepEqual(informed.map((l) => l.text), ['Bomba informada pelo robô: desligada']);
});

test('falha parcial destaca a ação que falhou e oferece nova tentativa', () => {
  const d = describeEmergency(report('sim', [ok('STOP', 'applied-sim'), fail('PUMP_OFF', 'Falha simulada'), ok('MODE_MANUAL', 'applied-sim')]));
  assert.equal(d.tone, 'partial');
  assert.equal(d.title, 'Parada com falha parcial');
  assert.equal(d.lines[1].kind, 'fail');
  assert.match(d.lines[1].text, /Desligar bomba: falhou — Falha simulada/);
  assert.equal(d.canRetry, true);
});

test('falha total (ex.: sem conexão)', () => {
  const sim = describeEmergency(report('sim', EMERGENCY_STEPS.map((s) => fail(s.command, 'Não conectado'))));
  assert.equal(sim.tone, 'failed');
  assert.equal(sim.title, 'Parada de emergência não aplicada');
  assert.equal(sim.canRetry, true);
  const ble = describeEmergency(report('ble', EMERGENCY_STEPS.map((s) => fail(s.command, 'Não conectado'))));
  assert.equal(ble.title, 'Comandos de parada não enviados');
});
