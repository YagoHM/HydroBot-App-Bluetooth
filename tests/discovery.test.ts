import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyDiscovery, DISCOVERY_LABEL } from '../services/hydroBotProtocol';

test('serviço de dados anunciado tem prioridade, mas não é apresentado como validado', () => {
  assert.equal(classifyDiscovery('Qualquer', ['6E400001-B5A3-F393-E0A9-E50E24DCCA9E']), 'service');
  assert.match(DISCOVERY_LABEL.service, /confirmada só ao conectar/);
});

test('nome com "HydroBot" sem o serviço anunciado', () => {
  assert.equal(classifyDiscovery('HydroBot_ESP32', null), 'name');
  assert.equal(classifyDiscovery('meu-hydrobot', []), 'name');
});

test('dispositivo sem indícios fica como não verificado', () => {
  assert.equal(classifyDiscovery('Fone JBL', ['0000180f-0000-1000-8000-00805f9b34fb']), 'unknown');
  assert.equal(classifyDiscovery(null, undefined), 'unknown');
  assert.match(DISCOVERY_LABEL.unknown, /não verificada/);
});

test('nenhum rótulo afirma que o dispositivo é o HydroBot validado', () => {
  for (const label of Object.values(DISCOVERY_LABEL)) {
    assert.ok(!/validado|é o HydroBot/i.test(label), label);
  }
});
