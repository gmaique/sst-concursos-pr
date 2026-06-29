import { carregarEstado, salvarEstado, registrarResposta, ESTADO_INICIAL } from './src/state.js';
import { montarFila, bumpStreak, nivelDe, proficienciaGlobal, proficienciaTema, checarConquistas, NOMES_CONQUISTAS, diasAteProva, faseRetaFinal } from './src/logic.js';
import { renderInicio, renderSessao, renderTemas, renderPerfil, renderSimulado, renderSimuladoSessao, renderSimuladoResultado, renderPlano, pararTimerDiscursiva } from './src/views.js';

const views = [...document.querySelectorAll('.view')];
const navBtns = [...document.querySelectorAll('.nav-btn')];
function showView(id) {
  views.forEach(v => v.hidden = (v.id !== id));
  navBtns.forEach(b => b.setAttribute('aria-current', String(b.dataset.view === id)));
}
navBtns.forEach(b => b.addEventListener('click', () => {
  pararCronometro();
  pararTimerDiscursiva();
  showView(b.dataset.view);
  pintar(b.dataset.view);
}));

const hojeISO = new Date().toISOString().slice(0, 10);
// Vários concursos, sem data única: estudo contínuo (sem contagem regressiva)
const FASE_CONTINUA = 'Estudo contínuo';
const META = 10;
let estado = carregarEstado(localStorage);
let questoes = [];
let discursivas = [];
let sessao = null; // { modo, fila, indice, xpGanho, acertos } or { modo:'simulado', fila, indice, respostas, inicioMs }

// Cronômetro global do simulado
let _cronometroInterval = null;

function pararCronometro() {
  if (_cronometroInterval) { clearInterval(_cronometroInterval); _cronometroInterval = null; }
}

const elInicio = document.getElementById('view-inicio');
const elSessao = document.getElementById('view-sessao');

// Toast de celebração de conquista (some após 3s)
function mostrarToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = [
    'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
    'background:var(--cor-primaria,#0a7c4e)', 'color:#fff',
    'padding:12px 20px', 'border-radius:12px', 'font-weight:600',
    'z-index:9999', 'box-shadow:0 4px 16px rgba(0,0,0,0.18)',
    'font-size:1rem', 'text-align:center', 'max-width:90vw',
    'animation:fadeIn 0.3s',
  ].join(';');
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function respondidasHoje() {
  return (estado.metaDia?.dia === hojeISO) ? estado.metaDia.count : 0;
}

function pontoFracoInfo() {
  const TEMAS = ['nrs','higiene','seguranca','ergonomia','gestao-sst','legislacao','portugues','raciocinio'];
  let piorTema = null, piorPct = Infinity;
  for (const t of TEMAS) {
    const ids = questoes.filter(q => q.tema === t).map(q => q.id);
    let ac = 0, tot = 0;
    for (const id of ids) { const r = estado.respostas[id]; if (r) { ac += r.acertos; tot += r.acertos + r.erros; } }
    if (tot < 3) continue; // precisa de histórico mínimo pra sugerir
    const pct = ac / tot;
    if (pct < piorPct) { piorPct = pct; piorTema = t; }
  }
  return piorTema ? { tema: piorTema, pct: Math.round(piorPct * 100) } : null;
}

function pintarInicio() {
  renderInicio(elInicio, {
    estado,
    meta: META,
    respondidasHoje: respondidasHoje(),
    onIniciarSessao: iniciarSessao,
    diasProva: undefined, // sem data única -> sem contagem regressiva
    fase: FASE_CONTINUA,
    pontoFraco: pontoFracoInfo(),
    onTreinarFraco: () => { const pf = pontoFracoInfo(); if (pf) iniciarSessaoTema(pf.tema); },
  });
}

function pintar(view){
  if (view==='view-inicio') return pintarInicio();
  if (view==='view-temas') return renderTemas(document.getElementById('view-temas'),
    { estado, questoes, onTreinarTema: iniciarSessaoTema });
  if (view==='view-perfil') {
    const profGlobal = proficienciaGlobal(estado, questoes);
    const profTemas = {};
    const TEMAS = ['nrs','higiene','seguranca','ergonomia','gestao-sst','legislacao','portugues','raciocinio'];
    for (const t of TEMAS) profTemas[t] = proficienciaTema(estado, questoes, t);
    return renderPerfil(document.getElementById('view-perfil'),
      { estado, questoes, nivelDe, onReset, profGlobal, profTemas,
        onModoCalmo: () => { estado.modoCalmo = !estado.modoCalmo; salvarEstado(localStorage, estado); aplicarAcessibilidade(); pintar('view-perfil'); },
        onFonte: () => { estado.fonteGrande = !estado.fonteGrande; salvarEstado(localStorage, estado); aplicarAcessibilidade(); pintar('view-perfil'); } });
  }
  if (view==='view-simulado') return renderSimulado(document.getElementById('view-simulado'),
    { discursiva: discursivas[0], discursivas, onSimulado: iniciarSimulado, totalQuestoes: questoes.length });
  if (view==='view-plano') return renderPlano(document.getElementById('view-plano'), {
    hojeISO, fase: FASE_CONTINUA, pontoFraco: pontoFracoInfo(),
    onComecar: (plano) => {
      if (plano.tipo === 'materia') return iniciarSessaoTema(plano.tema);
      if (plano.tipo === 'revisao' && plano.simulado) return iniciarSimulado();
      return iniciarSessao(); // revisão/treino misto (SRS prioriza vencidas)
    },
  });
}

function onReset(){ estado = structuredClone(ESTADO_INICIAL); salvarEstado(localStorage, estado); aplicarAcessibilidade(); pintar('view-perfil'); }

function aplicarAcessibilidade(){
  document.body.classList.toggle('calmo', !!estado.modoCalmo);
  document.body.classList.toggle('fonte-grande', !!estado.fonteGrande);
}

function iniciarSessaoTema(tema){
  pararCronometro();
  const filtradas = questoes.filter(q=>q.tema===tema);
  sessao = { modo:'estudo', fila: montarFila(filtradas, estado.srs, hojeISO, META), indice:0, xpGanho:0, acertos:0 };
  showView('view-sessao'); pintarSessao();
}

function iniciarSessao() {
  pararCronometro();
  const fila = montarFila(questoes, estado.srs, hojeISO, META);
  sessao = { modo:'estudo', fila, indice: 0, xpGanho: 0, acertos: 0 };
  showView('view-sessao');
  pintarSessao();
}

// Fisher-Yates shuffle (in-place, returns array)
function embaralhar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Cotas no formato real da prova do CPM (~30 questões)
const COTA_SIMULADO = { nrs:8, higiene:4, seguranca:4, ergonomia:2, 'gestao-sst':4, legislacao:3, portugues:3, raciocinio:2 };
const SIMULADO_MIN = 35; // tempo recomendado (minutos) — vira alerta, não corta

function iniciarSimulado() {
  pararCronometro();
  const fila = embaralhar(
    Object.entries(COTA_SIMULADO).flatMap(([tema, n]) =>
      embaralhar(questoes.filter(q => q.tema === tema)).slice(0, n)
    )
  );
  sessao = { modo:'simulado', fila, indice: 0, respostas: [], inicioMs: Date.now(), tempoMin: SIMULADO_MIN };
  showView('view-sessao');
  pintarSimuladoSessao();
}

function temaMaisFraco() {
  const TEMAS = ['nrs','higiene','seguranca','ergonomia','gestao-sst','legislacao','portugues','raciocinio'];
  let piorTema = null, piorPct = Infinity;
  for (const t of TEMAS) {
    const ids = questoes.filter(q => q.tema === t).map(q => q.id);
    if (ids.length === 0) continue;
    let ac = 0, tot = 0;
    for (const id of ids) { const r = estado.respostas[id]; if (r) { ac += r.acertos; tot += r.acertos + r.erros; } }
    if (tot === 0) continue; // sem histórico, não conta
    const pct = ac / tot;
    if (pct < piorPct) { piorPct = pct; piorTema = t; }
  }
  return piorTema;
}

function pintarSessao() {
  if (sessao?.modo === 'simulado') { pintarSimuladoSessao(); return; }
  renderSessao(elSessao, {
    fila: sessao.fila,
    indice: sessao.indice,
    xpGanho: sessao.xpGanho,
    acertosSessao: sessao.acertos,
    conquistasNovas: sessao.conquistasNovas ?? [],
    nomes: NOMES_CONQUISTAS,
    streak: estado.streak,
    onResponder: (q, acertou) => {
      const conquistasAntes = estado.conquistas.length;
      const antes = estado.xp;
      estado = registrarResposta(estado, q.id, acertou, q.dificuldade, hojeISO);
      sessao.xpGanho += estado.xp - antes;
      if (acertou) sessao.acertos++;
      // Incrementa contador de meta diária
      const countAntes = (estado.metaDia?.dia === hojeISO) ? estado.metaDia.count : 0;
      estado.metaDia = { dia: hojeISO, count: countAntes + 1 };
      salvarEstado(localStorage, estado);
      // Detectar e celebrar conquistas novas
      const novas = estado.conquistas.slice(conquistasAntes);
      if (novas.length > 0) {
        sessao.conquistasNovas = [...(sessao.conquistasNovas ?? []), ...novas];
        for (const id of novas) {
          mostrarToast('🏆 Conquista desbloqueada: ' + (NOMES_CONQUISTAS[id] ?? id));
        }
      }
    },
    onConfianca: (q, acertou, conf) => {
      // metacognição: guarda a confiança e corrige o agendamento
      if (estado.respostas[q.id]) estado.respostas[q.id].confianca = conf;
      // acertou no chute = não é domínio: traz de volta cedo (caixa 1, hoje)
      if (acertou && conf === 'chute') {
        estado.srs[q.id] = { caixa: 1, proximaRevisao: hojeISO };
      }
      salvarEstado(localStorage, estado);
    },
    onProxima: () => {
      sessao.indice++;
      if (sessao.indice >= sessao.fila.length) {
        const streakAntes = estado.streak ?? 0;
        estado = { ...estado, ...bumpStreak(estado, hojeISO) };
        // recorde pessoal de ofensiva (não se perde, mesmo se o streak zerar)
        estado.recordeStreak = Math.max(estado.recordeStreak ?? 0, estado.streak, streakAntes);
        // consolo se a ofensiva quebrou (zerou pra 1 vindo de >=3) — sem culpa
        if (streakAntes >= 3 && estado.streak === 1) {
          mostrarToast('🌙 A ofensiva recomeçou, mas tudo que você aprendeu ficou! Seu recorde: ' + estado.recordeStreak + ' dias 💜');
        }
        // Checar conquistas novas após bump de streak (streak-7 surge aqui)
        const novasStreak = checarConquistas(estado).filter(c => !estado.conquistas.includes(c));
        if (novasStreak.length > 0) {
          estado.conquistas = [...estado.conquistas, ...novasStreak];
          sessao.conquistasNovas = [...(sessao.conquistasNovas ?? []), ...novasStreak];
        }
        salvarEstado(localStorage, estado);
      }
      pintarSessao();
    },
    onVoltarInicio: () => { showView('view-inicio'); pintarInicio(); },
    onTreinarFraco: () => {
      const t = temaMaisFraco();
      if (t) iniciarSessaoTema(t);
    },
  });
}

function pintarSimuladoSessao() {
  if (sessao.indice >= sessao.fila.length) {
    pararCronometro();
    finalizarSimulado();
    return;
  }
  renderSimuladoSessao(elSessao, {
    fila: sessao.fila,
    indice: sessao.indice,
    inicioMs: sessao.inicioMs,
    tempoMin: sessao.tempoMin,
    onCronometroTick: (atualizarCronometro) => {
      pararCronometro();
      _cronometroInterval = setInterval(atualizarCronometro, 1000);
    },
    onResponder: (q, acertou, escolhida) => {
      sessao.respostas.push({ id: q.id, tema: q.tema, dificuldade: q.dificuldade, acertou,
        escolhida, enunciado: q.enunciado, alternativas: q.alternativas, correta: q.correta, explicacao: q.explicacao });
    },
    onProxima: () => {
      sessao.indice++;
      pintarSimuladoSessao();
    },
  });
}

function finalizarSimulado() {
  const { fila, respostas, inicioMs } = sessao;
  const duracaoMs = Date.now() - inicioMs;
  const total = fila.length;
  const acertos = respostas.filter(r => r.acertou).length;

  // Monta estado temporário para cálculo de proficiência TRI
  const estadoTemp = { respostas: {} };
  for (const r of respostas) {
    estadoTemp.respostas[r.id] = r.acertou
      ? { acertos: 1, erros: 0 }
      : { acertos: 0, erros: 1 };
  }
  const profGlobal = proficienciaGlobal(estadoTemp, fila);
  const temasUnicos = [...new Set(fila.map(q => q.tema))];
  const porTema = {};
  for (const t of temasUnicos) porTema[t] = proficienciaTema(estadoTemp, fila, t);

  // Persiste resultado
  const registro = {
    data: new Date().toISOString().slice(0, 10),
    duracaoMs,
    total,
    acertos,
    proficienciaGlobal: profGlobal,
    porTema,
  };
  estado.simulados = [...(estado.simulados ?? []), registro];
  salvarEstado(localStorage, estado);

  renderSimuladoResultado(elSessao, {
    total,
    acertos,
    profGlobal,
    porTema,
    duracaoMs,
    erros: respostas.filter(r => !r.acertou),
    onVoltar: () => { showView('view-inicio'); pintarInicio(); },
  });
}

(async function init() {
  aplicarAcessibilidade(); // aplica Modo Calmo / texto maior já no carregamento
  questoes = await (await fetch('data/questoes.json')).json();
  discursivas = await (await fetch('data/discursivas.json')).json();
  showView('view-inicio');
  pintarInicio();
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
