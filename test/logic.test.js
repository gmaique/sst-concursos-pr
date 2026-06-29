import { test } from 'node:test';
import assert from 'node:assert/strict';
import { srsNext, estaVencida, addDias, INTERVALOS, xpPorResposta, nivelDe, bumpStreak, semanaISO, montarFila, checarConquistas, proficienciaTema, proficienciaGlobal, diasAteProva, faseRetaFinal, DATA_PROVA, diaSemana, planoDeHoje, intercalarPorTema } from '../src/logic.js';

test('addDias soma dias em ISO', () => {
  assert.equal(addDias('2026-06-27', 3), '2026-06-30');
  assert.equal(addDias('2026-06-30', 1), '2026-07-01');
});

test('srsNext: acerto sobe uma caixa e agenda pelo intervalo', () => {
  const r = srsNext({ caixa: 2, proximaRevisao: '2026-06-27' }, true, '2026-06-27');
  assert.equal(r.caixa, 3);
  assert.equal(r.proximaRevisao, addDias('2026-06-27', INTERVALOS[2])); // caixa 3 -> 3 dias
});

test('srsNext: acerto na caixa 5 permanece em 5', () => {
  const r = srsNext({ caixa: 5, proximaRevisao: '2026-06-27' }, true, '2026-06-27');
  assert.equal(r.caixa, 5);
});

test('srsNext: erro volta pra caixa 1 e reaparece hoje', () => {
  const r = srsNext({ caixa: 4, proximaRevisao: '2026-06-27' }, false, '2026-06-27');
  assert.equal(r.caixa, 1);
  assert.equal(r.proximaRevisao, '2026-06-27'); // INTERVALOS[0] = 0
});

test('estaVencida: item sem revisão está vencido', () => {
  assert.equal(estaVencida({}, '2026-06-27'), true);
  assert.equal(estaVencida({ caixa: 2, proximaRevisao: '2026-06-28' }, '2026-06-27'), false);
  assert.equal(estaVencida({ caixa: 2, proximaRevisao: '2026-06-27' }, '2026-06-27'), true);
});

test('xpPorResposta', () => {
  assert.equal(xpPorResposta(true, 3), 30);
  assert.equal(xpPorResposta(false, 3), 2);
});

test('nivelDe', () => {
  assert.equal(nivelDe(0).nivel, 1);
  assert.equal(nivelDe(150).nivel, 2);
  assert.equal(nivelDe(700).nivel, 5);
});

test('nivelDe: limites exatos', () => {
  assert.equal(nivelDe(99).nivel, 1);
  assert.equal(nivelDe(100).nivel, 2);   // cruza o threshold
  assert.equal(nivelDe(250).nivel, 3);
});

test('nivelDe: nível máximo não gera NaN', () => {
  const r = nivelDe(1000);
  assert.equal(r.maxed, true);
  assert.equal(r.xpNoNivel / r.xpProxNivel, 1); // barra cheia, sem NaN
  assert.ok(Number.isFinite(r.xpNoNivel / r.xpProxNivel));
});

test('bumpStreak: mesmo dia não muda', () => {
  const s = { streak: 3, ultimoDia: '2026-06-27', freezesUsadosSemana: 0 };
  assert.deepEqual(bumpStreak(s, '2026-06-27'), s);
});

test('bumpStreak: dia seguinte incrementa', () => {
  const r = bumpStreak({ streak: 3, ultimoDia: '2026-06-27', freezesUsadosSemana: 0 }, '2026-06-28');
  assert.equal(r.streak, 4);
});

test('bumpStreak: pulou 1 dia usa freeze e mantém', () => {
  const r = bumpStreak({ streak: 3, ultimoDia: '2026-06-27', freezesUsadosSemana: 0 }, '2026-06-29');
  assert.equal(r.streak, 3);
  assert.equal(r.freezesUsadosSemana, 1);
});

test('bumpStreak: pulou sem freeze zera pra 1', () => {
  const r = bumpStreak({ streak: 3, ultimoDia: '2026-06-27', freezesUsadosSemana: 1 }, '2026-06-29');
  assert.equal(r.streak, 1);
});

test('bumpStreak: freeze usado em semana anterior libera de novo na semana seguinte', () => {
  // '2026-06-26' e '2026-06-28' estão ambos na semana W26 (seg 22/06 – dom 28/06)
  // Usa freeze em '2026-06-28' (semana W26), gerando semanaFreeze='2026-W26'
  const aposFreeze = bumpStreak({ streak: 3, ultimoDia: '2026-06-26', freezesUsadosSemana: 0, semanaFreeze: null }, '2026-06-28');
  assert.equal(aposFreeze.freezesUsadosSemana, 1);
  assert.equal(aposFreeze.semanaFreeze, '2026-W26');
  assert.equal(aposFreeze.streak, 3); // manteve streak via freeze

  // Em '2026-07-13' (semana W29), o freeze deve estar disponível novamente
  const outraSemana = bumpStreak({ ...aposFreeze, ultimoDia: '2026-07-12' }, '2026-07-13');
  // Semana nova: freezesValidos deve ser 0 (reset), dia seguinte normal
  assert.equal(outraSemana.freezesUsadosSemana, 0);
  assert.equal(outraSemana.semanaFreeze, '2026-W29');

  // Confirma: nessa nova semana, um pulo de 2 dias usaria o freeze
  const usaFreezeNovamente = bumpStreak({ ...aposFreeze, ultimoDia: '2026-07-11' }, '2026-07-13');
  assert.equal(usaFreezeNovamente.streak, 3); // manteve streak
  assert.equal(usaFreezeNovamente.freezesUsadosSemana, 1); // freeze consumido
  assert.equal(usaFreezeNovamente.semanaFreeze, '2026-W29');
});

test('montarFila: vencidas primeiro, depois novas, corta na meta', () => {
  const questoes = [{id:'a'},{id:'b'},{id:'c'},{id:'d'}];
  const srsMap = {
    a: { caixa:2, proximaRevisao:'2026-06-26' }, // vencida
    b: { caixa:3, proximaRevisao:'2026-06-30' }, // não vencida
  };
  const fila = montarFila(questoes, srsMap, '2026-06-27', 2);
  assert.deepEqual(fila.map(q=>q.id), ['a','c']); // a (vencida) + c (nova), corta em 2
});

test('checarConquistas desbloqueia marcos atingidos', () => {
  const e = { streak: 7, conquistas: [], respostas: { a:{acertos:1,erros:0} } };
  const novas = checarConquistas(e);
  assert.ok(novas.includes('streak-7'));
  assert.ok(novas.includes('primeiro-passo'));
});

test('checarConquistas não repete já desbloqueadas', () => {
  const e = { streak: 7, conquistas: ['streak-7','primeiro-passo'], respostas: { a:{acertos:1,erros:0} } };
  assert.deepEqual(checarConquistas(e), []);
});

test('proficienciaTema: pondera por dificuldade', () => {
  const questoes = [
    { id:'a', tema:'didatica', dificuldade:3 },
    { id:'b', tema:'didatica', dificuldade:1 },
    { id:'c', tema:'avaliacao', dificuldade:2 },
  ];
  const estado = { respostas: {
    a: { acertos:1, erros:0 },  // dif3 acertou
    b: { acertos:0, erros:1 },  // dif1 errou
    // c sem resposta
  }};
  // num = 3*1 + 1*0 = 3; den = 3*1 + 1*1 = 4 => 75
  assert.equal(proficienciaTema(estado, questoes, 'didatica'), 75);
  assert.equal(proficienciaTema(estado, questoes, 'avaliacao'), null); // sem respostas
});

test('proficienciaGlobal: null sem respostas, senão pondera', () => {
  const questoes = [{ id:'a', tema:'x', dificuldade:2 }];
  assert.equal(proficienciaGlobal({ respostas:{} }, questoes), null);
  assert.equal(proficienciaGlobal({ respostas:{ a:{acertos:1,erros:1} } }, questoes), 50);
});

test('diasAteProva conta dias inteiros (prova 29/11/2026)', () => {
  assert.equal(diasAteProva('2026-11-29'), 0);
  assert.equal(diasAteProva('2026-11-28'), 1);
  assert.equal(diasAteProva('2026-11-22'), 7);
  assert.equal(diasAteProva('2026-11-30'), -1);
});

test('faseRetaFinal escolhe a fase certa', () => {
  assert.equal(faseRetaFinal('2026-06-27').fase, 'Aquecendo os motores'); // ~155 dias
  assert.equal(faseRetaFinal('2026-11-10').fase, 'Pegando o ritmo');      // 19 dias
  assert.equal(faseRetaFinal('2026-11-20').fase, 'Reta final');           // 9 dias
  assert.equal(faseRetaFinal('2026-11-25').fase, 'Véspera');              // 4 dias
  assert.equal(faseRetaFinal('2026-11-29').fase, 'É hoje!');              // 0
  assert.equal(faseRetaFinal('2026-06-27').metaRecomendada, 8);
});

test('diaSemana: 0=domingo .. 6=sábado', () => {
  assert.equal(diaSemana('2026-11-29'), 0); // domingo
  assert.equal(diaSemana('2026-11-30'), 1); // segunda
  assert.equal(diaSemana('2026-12-05'), 6); // sábado
});

test('planoDeHoje: matéria no dia útil, descanso no domingo, revisão na véspera', () => {
  assert.equal(planoDeHoje('2026-11-30', 'Aquecendo os motores', null).tema, 'portugues'); // segunda
  assert.equal(planoDeHoje('2026-11-29', 'Aquecendo os motores', null).tipo, 'descanso');   // domingo
  assert.equal(planoDeHoje('2026-11-30', 'Véspera', null).tipo, 'revisao');                  // véspera força revisão
});

test('intercalarPorTema: não repete a mesma matéria seguida quando há variedade', () => {
  const arr = [{tema:'a'},{tema:'a'},{tema:'b'},{tema:'b'}];
  const out = intercalarPorTema(arr);
  let seguidas = 0;
  for (let i=1;i<out.length;i++) if (out[i].tema===out[i-1].tema) seguidas++;
  assert.equal(seguidas, 0);
});
