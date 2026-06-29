import { srsNext, xpPorResposta, checarConquistas } from './logic.js';

// Polyfill for Node 16 compatibility
if (!globalThis.structuredClone) {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

const CHAVE = 'sst_pr_state_v1';

export const ESTADO_INICIAL = {
  versao: 1, xp: 0, streak: 0, ultimoDia: null, freezesUsadosSemana: 0, semanaFreeze: null,
  conquistas: [], srs: {}, respostas: {}, simulados: [],
  modoCalmo: true, fonteGrande: false, // acessibilidade (Modo Calmo ligado por padrão)
};

export function carregarEstado(storage) {
  try {
    const raw = storage.getItem(CHAVE);
    if (!raw) return structuredClone(ESTADO_INICIAL);
    const e = JSON.parse(raw);
    if (!e || e.versao !== 1) return structuredClone(ESTADO_INICIAL);
    return { ...structuredClone(ESTADO_INICIAL), ...e };
  } catch {
    return structuredClone(ESTADO_INICIAL);
  }
}

export function salvarEstado(storage, estado) {
  storage.setItem(CHAVE, JSON.stringify(estado));
}

export function registrarResposta(estado, questaoId, acertou, dificuldade, hojeISO) {
  const e = structuredClone(estado);
  e.xp += xpPorResposta(acertou, dificuldade);
  e.srs[questaoId] = srsNext(e.srs[questaoId], acertou, hojeISO);
  const r = e.respostas[questaoId] ?? { acertos: 0, erros: 0 };
  if (acertou) r.acertos++; else r.erros++;
  e.respostas[questaoId] = r;
  e.conquistas = [...e.conquistas, ...checarConquistas(e)];
  return e;
}
