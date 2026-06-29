import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarEstado, salvarEstado, registrarResposta, ESTADO_INICIAL } from '../src/state.js';

function fakeStorage(init) {
  const m = new Map(init ? [['sst_pr_state_v1', init]] : []);
  return { getItem:k=>m.get(k)??null, setItem:(k,v)=>m.set(k,v) };
}

test('carregarEstado vazio retorna ESTADO_INICIAL', () => {
  assert.deepEqual(carregarEstado(fakeStorage()), ESTADO_INICIAL);
});

test('carregarEstado corrompido cai no inicial', () => {
  assert.deepEqual(carregarEstado(fakeStorage('{lixo')), ESTADO_INICIAL);
});

test('salvar e recarregar preserva estado', () => {
  const s = fakeStorage();
  const e = { ...ESTADO_INICIAL, xp: 42 };
  salvarEstado(s, e);
  assert.equal(carregarEstado(s).xp, 42);
});

test('registrarResposta acerto soma xp, sobe caixa SRS e conta acerto', () => {
  const e = registrarResposta(ESTADO_INICIAL, 'q1', true, 2, '2026-06-27');
  assert.equal(e.xp, 20);
  assert.equal(e.srs.q1.caixa, 2);
  assert.deepEqual(e.respostas.q1, { acertos: 1, erros: 0 });
});

test('registrarResposta erro soma 2 xp, caixa 1 e conta erro', () => {
  const e = registrarResposta(ESTADO_INICIAL, 'q1', false, 3, '2026-06-27');
  assert.equal(e.xp, 2);
  assert.equal(e.srs.q1.caixa, 1);
  assert.deepEqual(e.respostas.q1, { acertos: 0, erros: 1 });
});
