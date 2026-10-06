import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keyboardOverlap, scrollTargetForItem, tabBarHeight } from '../utils/layoutMetrics';

test('sobreposição do teclado desconta a barra de abas e zera ao fechar', () => {
  assert.equal(keyboardOverlap(300, 88), 212);
  assert.equal(keyboardOverlap(60, 88), 0);
  assert.equal(keyboardOverlap(0, 88), 0, 'teclado fechado não deixa espaço extra');
});

test('item já visível não provoca rolagem', () => {
  assert.equal(scrollTargetForItem({ itemTop: 100, itemHeight: 150, scrollY: 0, viewportHeight: 600, overlap: 0 }), null);
});

test('item encoberto pelo teclado sobe até ficar acima dele', () => {
  // área livre = 600 - 250 = 350; base do item com margem = 480 + 150 + 12 = 642
  const y = scrollTargetForItem({ itemTop: 480, itemHeight: 150, scrollY: 0, viewportHeight: 600, overlap: 250 });
  assert.equal(y, 642 - 350);
  const visibleBottom = y! + 600 - 250;
  assert.ok(480 + 150 <= visibleBottom, 'campo, Aplicar e erro acima do teclado');
  assert.ok(480 >= y!, 'título continua visível');
});

test('item acima da área visível rola para cima', () => {
  assert.equal(scrollTargetForItem({ itemTop: 200, itemHeight: 100, scrollY: 400, viewportHeight: 600, overlap: 0 }), 188);
});

test('item maior que a área livre (fonte ampliada) alinha o topo', () => {
  assert.equal(scrollTargetForItem({ itemTop: 900, itemHeight: 500, scrollY: 0, viewportHeight: 700, overlap: 300 }), 888);
});

test('barra de abas cresce com a escala de fonte e soma o inset do sistema', () => {
  assert.equal(tabBarHeight(1, 0), 68);
  assert.equal(tabBarHeight(1, 24), 92);
  assert.equal(tabBarHeight(2, 0), 84);
  assert.equal(tabBarHeight(0.85, 0), 68, 'fonte reduzida mantém a altura mínima');
});
