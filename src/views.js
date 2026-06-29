import { nivelDe, planoDeHoje, planoSemana, diaSemana } from './logic.js';

const TEMAS = ['nrs','higiene','seguranca','ergonomia','gestao-sst','legislacao','portugues','raciocinio'];
const TEMA_LABELS = {
  'nrs':'Normas Regulamentadoras', 'higiene':'Higiene Ocupacional', 'seguranca':'Segurança do Trabalho',
  'ergonomia':'Ergonomia', 'gestao-sst':'Gestão de SST', 'legislacao':'Legislação',
  'portugues':'Português', 'raciocinio':'Raciocínio Lógico',
};
const TEMA_EMOJI = {
  'nrs':'📋', 'higiene':'🧪', 'seguranca':'🦺', 'ergonomia':'🧍', 'gestao-sst':'🗂️',
  'legislacao':'⚖️', 'portugues':'📖', 'raciocinio':'🧩',
};
const labelTema = t => TEMA_LABELS[t] ?? t;

// Timer da discursiva — limpo ao trocar de tema ou sair da tela
let _discTimerInterval = null;
export function pararTimerDiscursiva() {
  if (_discTimerInterval) { clearInterval(_discTimerInterval); _discTimerInterval = null; }
}

function pctTema(estado, questoes, tema){
  const ids = questoes.filter(q=>q.tema===tema).map(q=>q.id);
  let ac=0, tot=0;
  for (const id of ids){ const r=estado.respostas[id]; if(r){ ac+=r.acertos; tot+=r.acertos+r.erros; } }
  return tot? Math.round(ac/tot*100) : null;
}

function formatarTempo(ms) {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// Mascote "Sabido" — livrinho graduado (SVG inline, sem dependências)
const MASCOTE = `<svg class="mascote" viewBox="0 0 64 64" width="46" height="46" aria-hidden="true">
  <defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8B6BFF"/><stop offset="1" stop-color="#6D4BFF"/></linearGradient></defs>
  <rect x="12" y="20" width="40" height="36" rx="10" fill="url(#mg)"/>
  <rect x="17" y="26" width="30" height="24" rx="7" fill="#fff"/>
  <circle cx="26" cy="36" r="3.4" fill="#2A1A6E"/><circle cx="38" cy="36" r="3.4" fill="#2A1A6E"/>
  <circle cx="27.2" cy="34.9" r="1.1" fill="#fff"/><circle cx="39.2" cy="34.9" r="1.1" fill="#fff"/>
  <path d="M26 43 q6 5 12 0" stroke="#2A1A6E" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <circle cx="20" cy="44" r="2.4" fill="#FFB6C1" opacity=".7"/><circle cx="44" cy="44" r="2.4" fill="#FFB6C1" opacity=".7"/>
  <path d="M32 6 L52 15 L32 24 L12 15 Z" fill="#2A1A6E"/>
  <rect x="27" y="16" width="10" height="6" fill="#2A1A6E"/>
  <line x1="52" y1="15" x2="52" y2="25" stroke="#FF9F1C" stroke-width="2"/>
  <circle cx="52" cy="26" r="2.6" fill="#FF9F1C"/>
</svg>`;

const FASES_ORDEM = ['Construção de base','Intensificação','Revisão concentrada','Véspera','Dia da prova / pós'];

// Trilha sinuosa até a prova (assinatura) — nós = fases, bandeira no fim
function trilhaSVG(faseAtual) {
  const idx = Math.max(0, FASES_ORDEM.indexOf(faseAtual));
  const pts = [[18,58],[88,30],[160,60],[232,30],[300,52]];
  const d = `M${pts[0][0]} ${pts[0][1]} Q53 8 ${pts[1][0]} ${pts[1][1]} T${pts[2][0]} ${pts[2][1]} Q196 8 ${pts[3][0]} ${pts[3][1]} T${pts[4][0]} ${pts[4][1]}`;
  const nodes = pts.map((p,i)=>{
    const passou = i < idx, atual = i === idx;
    const r = atual ? 9 : 6;
    const fill = passou ? '#12C99B' : atual ? '#FF9F1C' : '#E0D8FA';
    const stroke = atual ? '#fff' : 'none';
    const check = passou ? `<path d="M${p[0]-3} ${p[1]} l2.2 2.4 l4-4.6" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : '';
    const glow = atual ? `<circle cx="${p[0]}" cy="${p[1]}" r="14" fill="#FF9F1C" opacity=".18"/>` : '';
    return `${glow}<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>${check}`;
  }).join('');
  const fx = pts[4][0]+8, fy = pts[4][1];
  const flag = `<line x1="${fx}" y1="${fy-20}" x2="${fx}" y2="${fy+8}" stroke="#2A1A6E" stroke-width="2.2"/>
    <path d="M${fx} ${fy-20} h16 v11 h-16 z" fill="#2A1A6E"/>
    <path d="M${fx} ${fy-20} h4 v4 h4 v-4 h4 v4 h4 v4 h-4 v-4 h-4 v4 h-4 v-4 h-4 z" fill="#FFC04D"/>`;
  return `<svg class="trilha-svg" viewBox="0 0 332 74" aria-hidden="true">
    <path d="${d}" stroke="#E0D8FA" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="1 11"/>
    ${nodes}${flag}</svg>`;
}

export function renderInicio(el, ctx) {
  const { estado, meta, respondidasHoje, diasProva, fase, dica, pontoFraco } = ctx;
  const hoje = respondidasHoje ?? 0;
  const { nivel, xpNoNivel, xpProxNivel } = nivelDe(estado.xp);
  const freezeDisponivel = (estado.freezesUsadosSemana ?? 0) < 1;
  const metaCumprida = hoje >= meta;
  const xpPct = Math.min(100, xpProxNivel ? xpNoNivel / xpProxNivel * 100 : 100);

  const calmo = diasProva > 60; // longe da prova: tom tranquilo, número menor
  const trilhaHtml = (diasProva !== undefined && fase) ? `
    <div class="card trilha card--destaque">
      <div class="card-titulo">🎖️ Jornada até o CPM</div>
      <div class="trilha-topo">
        <span class="dias${calmo ? ' dias--calmo' : ''}">${diasProva > 0 ? diasProva : '🎉'}</span>
        <span class="lbl">${diasProva > 0 ? (calmo ? 'dias — tem tempo de sobra 😉' : 'dias restantes') : 'é a sua vez!'}</span>
      </div>
      <div class="trilha-data">Admissão CPM-PR · 6º ano · 29/11/2026</div>
      ${trilhaSVG(fase)}
      <div class="trilha-fase">${fase}<small>${dica}</small></div>
    </div>` : '';

  // Guia do dia da prova — aparece só na última semana
  const guiaProva = (diasProva !== undefined && diasProva >= 0 && diasProva <= 7) ? `
    <div class="card" style="border-left:6px solid var(--mango)">
      <div class="card-titulo">🎒 Guia do dia da prova</div>
      <ul style="margin:0 0 0 18px;color:var(--texto);font-weight:600;line-height:1.9;font-size:14px">
        <li>Leve: documento com foto (ou certidão), lápis, borracha e caneta azul</li>
        <li>Leve água e um lanchinho 🍎</li>
        <li>Durma cedo na véspera e tome um bom café da manhã</li>
        <li>Leia <b>todas</b> as alternativas antes de marcar</li>
        <li>Travou? Pula e volta depois — não perca tempo numa só</li>
        <li>Cuidado pra marcar na linha certa do gabarito</li>
        <li>Respira fundo: você estudou pra isso! 💪</li>
      </ul>
    </div>` : '';

  el.innerHTML = `
    <div class="topbar">
      ${MASCOTE}
      <div class="saud">
        <h1>Bora aprender!</h1>
        <p>${respondidasHoje ? 'Cada questão te deixa mais esperto 💪' : 'Um pouquinho todo dia — você consegue!'}</p>
      </div>
      <div class="nivel-badge">⭐ Nível ${nivel}</div>
    </div>

    ${trilhaHtml}
    ${guiaProva}

    <div class="card">
      <div class="pills">
        <span class="pill pill--streak">🔥 ${estado.streak} ${estado.streak === 1 ? 'dia' : 'dias'}</span>
        <span class="pill pill--xp">⚡ ${estado.xp} XP</span>
        ${freezeDisponivel ? `<span class="pill pill--freeze">🧊 freeze</span>` : ''}
      </div>
      <div class="barra barra--xp" style="margin-top:14px"><i style="width:${xpPct}%"></i></div>
      <p class="legenda">${metaCumprida ? '✅ Meta de hoje feita — você treinou o cérebro! Pode descansar 🌙' : `Faltam <b>${meta - hoje}</b> questões para a meta de hoje 🔥`}</p>
    </div>

    <button class="btn ${metaCumprida ? 'btn-fantasma' : 'btn-primaria'}" id="btn-estudar" style="margin:4px 0 16px">${metaCumprida ? 'Estudar mais um pouco' : '▶ Estudar agora'}</button>

    ${pontoFraco ? `
    <button class="card" id="btn-ponto-fraco" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:none;border-left:6px solid var(--coral);cursor:pointer;margin-bottom:16px">
      <span style="font-size:30px">${TEMA_EMOJI[pontoFraco.tema] ?? '🎯'}</span>
      <span style="flex:1">
        <b style="font-family:var(--display);color:var(--ink);font-size:16px">Foco de hoje: ${labelTema(pontoFraco.tema)}</b>
        <small style="display:block;color:var(--texto-sec);font-weight:600;margin-top:2px">É onde você mais erra (${pontoFraco.pct}% de acerto). Bora reforçar! 💪</small>
      </span>
      <span style="color:var(--coral);font-weight:800;font-size:18px">▶</span>
    </button>` : ''}

    <div class="tiles">
      <button class="tile tile--plano" data-goto="view-plano"><span class="ic">🗓️</span><span><b>Plano</b><small>o que estudar hoje</small></span></button>
      <button class="tile tile--temas" data-goto="view-temas"><span class="ic">📚</span><span><b>Matérias</b><small>treine por assunto</small></span></button>
      <button class="tile tile--simulado" data-goto="view-simulado"><span class="ic">📝</span><span><b>Simulado</b><small>modo prova</small></span></button>
      <button class="tile tile--perfil" data-goto="view-perfil"><span class="ic">📊</span><span><b>Perfil</b><small>seu progresso</small></span></button>
    </div>
  `;
  el.querySelector('#btn-estudar').addEventListener('click', ctx.onIniciarSessao);
  const elFraco = el.querySelector('#btn-ponto-fraco');
  if (elFraco && typeof ctx.onTreinarFraco === 'function') elFraco.addEventListener('click', ctx.onTreinarFraco);
  // tiles reaproveitam a navegação inferior existente
  el.querySelectorAll('[data-goto]').forEach(t => t.addEventListener('click', () => {
    const nav = document.querySelector(`.nav-btn[data-view="${t.dataset.goto}"]`);
    if (nav) nav.click();
  }));
}

export function renderSessao(el, ctx) {
  const { fila, indice } = ctx;
  if (!fila || indice >= fila.length) {
    const total = fila?.length ?? 0;
    const acertos = ctx.acertosSessao ?? 0;
    const xp = ctx.xpGanho ?? 0;
    const streak = ctx.streak ?? 0;
    const conquistasNovas = ctx.conquistasNovas ?? [];
    const nomes = ctx.nomes ?? {};
    const conquistasBadge = conquistasNovas.length > 0
      ? conquistasNovas.map(id => `<div class="conquista">🏅 ${nomes[id] ?? id}</div>`).join('')
      : '';
    const temFraco = typeof ctx.onTreinarFraco === 'function';
    el.innerHTML = `<div class="card fim">
      <div class="selo">🎉</div>
      <h2>Sessão concluída!</h2>
      <div class="ganho">+${xp} XP</div>
      <p class="resumo">${acertos}/${total} acertos · 🔥 ${streak} ${streak === 1 ? 'dia' : 'dias'}</p>
      ${conquistasBadge}
    </div>
    <button class="btn btn-primaria" id="btn-voltar-inicio">Voltar ao início</button>
    ${temFraco ? `<button class="btn btn-fantasma" id="btn-treinar-fraco" style="margin-top:10px">🎯 Treinar ponto fraco</button>` : ''}`;
    el.querySelector('#btn-voltar-inicio').addEventListener('click', ctx.onVoltarInicio);
    if (temFraco) el.querySelector('#btn-treinar-fraco').addEventListener('click', ctx.onTreinarFraco);
    return;
  }
  const q = fila[indice];
  const letras = ['A','B','C','D','E','F'];
  el.innerHTML = `
    <div class="quiz-top">
      <div class="barra"><i style="width:${(indice) / fila.length * 100}%"></i></div>
      <span class="cron">${indice + 1}/${fila.length}</span>
    </div>
    <div class="card">
      <span class="tag-tema">${q.tema}</span>
      <p class="enunciado">${q.enunciado}</p>
      <div id="alts">${q.alternativas.map((a, i) => `<button class="alt" data-i="${i}"><span class="letra">${letras[i]}</span><span>${a}</span></button>`).join('')}</div>
      <div id="feedback" class="feedback" hidden></div>
      <div id="confianca" class="confianca" hidden>
        <span>Você já sabia ou chutou?</span>
        <div class="confianca-bts">
          <button class="conf-bt" data-conf="sabia">😎 Já sabia</button>
          <button class="conf-bt" data-conf="chute">🤔 Chutei</button>
        </div>
      </div>
      <button class="btn btn-primaria" id="btn-prox" hidden style="margin-top:14px">Próxima →</button>
    </div>`;
  const alts = el.querySelector('#alts');
  alts.addEventListener('click', e => {
    const btn = e.target.closest('.alt'); if (!btn || alts.dataset.lock) return;
    alts.dataset.lock = '1';
    const escolhida = Number(btn.dataset.i);
    const acertou = escolhida === q.correta;
    [...alts.children].forEach((b, i) => {
      if (i === q.correta) b.classList.add('alt--acerto');
      else if (i === escolhida) b.classList.add('alt--erro');
      b.disabled = true;
    });
    const fb = el.querySelector('#feedback');
    fb.hidden = false;
    fb.classList.add(acertou ? 'feedback--ok' : 'feedback--erro');
    fb.innerHTML = `<b>${acertou ? '🎉 Acertou!' : '❌ Quase!'}</b><br>${q.explicacao}`;
    el.querySelector('#confianca').hidden = false;
    el.querySelector('#btn-prox').hidden = false;
    ctx.onResponder(q, acertou);
    // metacognição: registra se sabia ou chutou (1 toque, opcional)
    const confDiv = el.querySelector('#confianca');
    confDiv.querySelectorAll('.conf-bt').forEach(cb => cb.addEventListener('click', () => {
      if (confDiv.dataset.lock) return;
      confDiv.dataset.lock = '1';
      cb.classList.add('conf-bt--sel');
      confDiv.querySelectorAll('.conf-bt').forEach(b => b.disabled = true);
      if (typeof ctx.onConfianca === 'function') ctx.onConfianca(q, acertou, cb.dataset.conf);
    }));
  });
  el.querySelector('#btn-prox').addEventListener('click', ctx.onProxima);
}

// Modo Prova: sem feedback de certo/errado, sem explicação, com cronômetro
export function renderSimuladoSessao(el, ctx) {
  const { fila, indice, inicioMs, onCronometroTick, onResponder, onProxima } = ctx;
  const q = fila[indice];
  const total = fila.length;
  const progresso = `${indice + 1}/${total}`;
  const decorrido = formatarTempo(Date.now() - inicioMs);

  const letras = ['A','B','C','D','E','F'];
  const tempoMin = ctx.tempoMin ?? 35;
  el.innerHTML = `
    <div class="quiz-top">
      <div class="barra"><i style="width:${indice / total * 100}%"></i></div>
      <span class="cron"><span id="cronometro">${decorrido}</span></span>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="tag-tema">${labelTema(q.tema)}</span>
        <span style="font-family:var(--display);font-weight:600;color:var(--texto-sec)">${progresso}</span>
      </div>
      <p class="enunciado">${q.enunciado}</p>
      <div id="alts-simulado">${q.alternativas.map((a, i) => `<button class="alt" data-i="${i}"><span class="letra">${letras[i]}</span><span>${a}</span></button>`).join('')}</div>
      <button class="btn btn-primaria" id="btn-prox-sim" hidden style="margin-top:14px">Próxima →</button>
    </div>`;

  // Cronômetro: fica laranja se passar do tempo recomendado (treina ritmo)
  const elCron = el.querySelector('#cronometro');
  onCronometroTick(() => {
    if (elCron && elCron.isConnected) {
      const ms = Date.now() - inicioMs;
      elCron.textContent = formatarTempo(ms);
      if (ms > tempoMin*60*1000) elCron.style.color = '#FFC04D';
    }
  });

  const alts = el.querySelector('#alts-simulado');
  const btnProx = el.querySelector('#btn-prox-sim');

  alts.addEventListener('click', e => {
    const btn = e.target.closest('.alt'); if (!btn || alts.dataset.lock) return;
    alts.dataset.lock = '1';
    const escolhida = Number(btn.dataset.i);
    const acertou = escolhida === q.correta;
    // Modo prova: sem revelar certo/errado, só marca a escolhida e segue
    [...alts.children].forEach(b => { b.disabled = true; });
    btn.querySelector('.letra').style.background = 'var(--grape)';
    btn.querySelector('.letra').style.color = '#fff';
    onResponder(q, acertou, escolhida);
    btnProx.hidden = false;
  });

  btnProx.addEventListener('click', onProxima);
}

// Tela de resultado do simulado (com gabarito comentado dos erros)
export function renderSimuladoResultado(el, ctx) {
  const { total, acertos, porTema, duracaoMs, onVoltar, erros } = ctx;
  const pctBruto = total ? Math.round(acertos / total * 100) : 0;
  const letras = ['A','B','C','D','E','F'];
  const emoji = pctBruto>=70 ? '🏆' : pctBruto>=55 ? '💪' : '🌱';
  const recado = pctBruto>=70 ? 'Mandou muito bem!' : pctBruto>=55 ? 'Tá no caminho — continua!' : 'Cada erro é um aprendizado. Bora revisar!';

  const temasHtml = Object.entries(porTema)
    .filter(([, p]) => p !== null)
    .map(([t, p]) => `<div class="linha"><span class="nome" style="min-width:96px">${labelTema(t)}</span>
      <span class="barra" style="flex:1"><i style="width:${p}%"></i></span><span class="pct">${p}%</span></div>`).join('');

  const errosHtml = (erros && erros.length) ? erros.map(e => `
    <details style="margin-bottom:8px">
      <summary style="font-weight:700;color:var(--ink)">${labelTema(e.tema)}: ${e.enunciado.slice(0,70)}${e.enunciado.length>70?'…':''}</summary>
      <div style="margin-top:8px;font-size:14px;line-height:1.5">
        <p style="margin-bottom:8px">${e.enunciado}</p>
        ${e.alternativas.map((a,i)=>`<div style="padding:4px 8px;border-radius:8px;margin:3px 0;${i===e.correta?'background:#E9FBF4;color:var(--mint-deep);font-weight:700':i===e.escolhida?'background:#FFF0F3;color:var(--coral-deep)':''}">${letras[i]}) ${a} ${i===e.correta?'✓':i===e.escolhida?'✗ (você marcou)':''}</div>`).join('')}
        <p style="margin-top:8px;color:var(--texto-sec)"><b>Por quê:</b> ${e.explicacao}</p>
      </div>
    </details>`).join('') : '<p style="color:var(--mint-deep);font-weight:700">🎉 Você não errou nenhuma! Incrível!</p>';

  el.innerHTML = `
    <div class="card fim">
      <div class="selo">${emoji}</div>
      <h2>Resultado do Simulado</h2>
      <div class="ganho">${acertos}/${total}</div>
      <p class="resumo">${pctBruto}% de acerto · ⏱️ ${formatarTempo(duracaoMs)}<br>${recado}</p>
    </div>
    ${temasHtml ? `<div class="card"><div class="card-titulo">📊 Como foi por matéria</div>${temasHtml}</div>` : ''}
    <div class="card"><div class="card-titulo">📝 O que errei (revise!)</div>${errosHtml}</div>
    <button class="btn btn-primaria" id="btn-voltar">Voltar ao início</button>`;

  el.querySelector('#btn-voltar').addEventListener('click', onVoltar);
}

export function renderTemas(el, ctx){
  const { estado, questoes } = ctx;
  el.innerHTML = `<h2>Matérias</h2>` + TEMAS.map(t=>{
    const n = questoes.filter(q=>q.tema===t).length;
    const p = pctTema(estado, questoes, t);
    const semQuestoes = n === 0;
    return `<div class="card" style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:10px">
      <span class="chip-tema">${TEMA_EMOJI[t] ?? ''} ${labelTema(t)}</span>
      <span style="font-weight:700;color:var(--texto-sec)">${semQuestoes ? 'sem questões' : (p===null?`${n} questões`:p+'%')}</span>
      <button class="btn btn-primaria" style="width:auto;padding:8px 16px${semQuestoes ? ';opacity:0.4;cursor:not-allowed' : ''}" data-tema="${t}"${semQuestoes ? ' disabled' : ''}>Treinar</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-tema]:not([disabled])').forEach(b=>b.addEventListener('click', ()=>ctx.onTreinarTema(b.dataset.tema)));
}

export function renderPerfil(el, ctx){
  const { estado, questoes, profGlobal, profTemas } = ctx;
  const { nivelDe: nivelDeFn } = ctx;
  const respondidas = Object.values(estado.respostas).reduce((s,r)=>s+r.acertos+r.erros,0);

  const simulados = estado.simulados ?? [];
  const ultimosSimulados = simulados.slice(-5).reverse();
  const simuladosHtml = ultimosSimulados.length === 0
    ? '<p style="color:var(--cor-texto-sec)">Nenhum simulado ainda.</p>'
    : ultimosSimulados.map(s => {
        const pct = s.total ? Math.round(s.acertos / s.total * 100) : 0;
        return `<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;padding:6px 0;border-bottom:1px solid var(--cor-borda,#eee);font-size:0.9rem">
          <span>${s.data}</span>
          <span>${s.acertos}/${s.total} (${pct}%)</span>
          <span>TRI: ${s.proficienciaGlobal !== null && s.proficienciaGlobal !== undefined ? s.proficienciaGlobal : '—'}</span>
          <span>${formatarTempo(s.duracaoMs)}</span>
        </div>`;
      }).join('');

  const temasHtml = TEMAS.map(t => {
    const pBruto = pctTema(estado, questoes, t);
    const pTri = profTemas?.[t];
    return `<div class="linha">
      <span class="nome" style="min-width:96px">${labelTema(t)}</span>
      <span class="barra" style="flex:1"><i style="width:${pTri ?? 0}%"></i></span>
      <span class="pct">${pTri === null || pTri === undefined ? '—' : pTri}</span>
    </div>`;
  }).join('');

  el.innerHTML = `<h2>Perfil</h2>
    <div class="card" style="margin-top:12px">
      <p class="streak">🔥 ${estado.streak} dias</p>
      <p>Nível ${nivelDeFn(estado.xp).nivel} · ${estado.xp} XP</p>
      <p>${respondidas} questões respondidas</p>
      <p>Proficiência TRI global: <strong>${profGlobal !== null && profGlobal !== undefined ? profGlobal : '—'}</strong></p>
      <p>Conquistas: ${estado.conquistas.length? estado.conquistas.join(', '): 'nenhuma ainda'}</p>
    </div>
    <div class="card">
      <div class="card-titulo">📊 Proficiência por tema</div>
      ${temasHtml}
    </div>
    <div class="card" style="margin-top:16px">
      <h3 style="margin-bottom:8px">Últimos simulados</h3>
      ${simuladosHtml}
    </div>
    <div class="card">
      <div class="card-titulo">♿ Acessibilidade</div>
      <div class="acc-row">
        <span class="lbl-acc">Modo calmo<small>Cores suaves, sem animações</small></span>
        <button class="toggle" id="tg-calmo" aria-pressed="${!!estado.modoCalmo}">${estado.modoCalmo ? 'Ligado' : 'Desligado'}</button>
      </div>
      <div class="acc-row">
        <span class="lbl-acc">Texto maior<small>Aumenta a leitura</small></span>
        <button class="toggle" id="tg-fonte" aria-pressed="${!!estado.fonteGrande}">${estado.fonteGrande ? 'Ligado' : 'Desligado'}</button>
      </div>
    </div>
    <button class="btn" id="reset" style="margin-top:16px;background:var(--cor-erro);color:#fff">Resetar progresso</button>`;
  const tgC = el.querySelector('#tg-calmo'); if (tgC && ctx.onModoCalmo) tgC.addEventListener('click', ctx.onModoCalmo);
  const tgF = el.querySelector('#tg-fonte'); if (tgF && ctx.onFonte) tgF.addEventListener('click', ctx.onFonte);
  el.querySelector('#reset').addEventListener('click', ()=>{
    const resp = prompt('Isto APAGA tudo: XP, ofensiva, conquistas e todo o histórico. Não dá pra desfazer.\n\nSe tem certeza, digite APAGAR:');
    if (resp && resp.trim().toUpperCase() === 'APAGAR') ctx.onReset();
  });
}

export function renderSimulado(el, ctx){
  const n = ctx.totalQuestoes ?? 30;
  el.innerHTML = `<h2>Simulado</h2>
    <div class="card card--destaque">
      <div class="card-titulo">📝 Modo Prova</div>
      <p style="color:var(--texto-sec);font-weight:600;line-height:1.5">
        ${n} questões de todas as matérias, embaralhadas, com cronômetro — igual ao dia da prova.
        Você só vê o resultado no final! ⏱️
      </p>
      <ul style="margin:12px 0 16px 18px;color:var(--texto-sec);font-weight:600;line-height:1.9;font-size:14px">
        <li>Sem dicas durante a prova</li>
        <li>Veja seu acerto por matéria no fim</li>
        <li>Treine o tempo e a concentração</li>
      </ul>
      <button class="btn btn-primaria" id="btn-simulado">▶ Começar simulado</button>
    </div>`;
  el.querySelector('#btn-simulado').addEventListener('click', () => ctx.onSimulado());
}

export function renderPlano(el, ctx) {
  const { hojeISO, fase, pontoFraco } = ctx;
  const plano = planoDeHoje(hojeISO, fase, pontoFraco ? pontoFraco.tema : null);
  const wdHoje = diaSemana(hojeISO);

  // título e ação do "plano de hoje"
  let titulo, sub, botao = true;
  if (plano.tipo === 'descanso') { titulo = '😌 Dia de descanso'; sub = 'Recarregue as energias — amanhã a gente volta!'; botao = false; }
  else if (plano.tipo === 'revisao') { titulo = plano.simulado ? '🎯 Revisão + Simulado' : '🔁 Revisão de hoje'; sub = `~${plano.minutos} min · leve e focado`; }
  else { titulo = `${TEMA_EMOJI[plano.tema] ?? '📘'} Hoje é dia de ${labelTema(plano.tema)}`; sub = `~${plano.minutos} min · uma matéria por dia`; }

  const passosHtml = plano.passos.map((p,i) =>
    `<div class="linha"><span style="width:26px;height:26px;border-radius:8px;background:var(--nuvem);color:var(--grape-deep);font-family:var(--display);font-weight:700;display:flex;align-items:center;justify-content:center;flex:0 0 auto">${i+1}</span><span class="nome" style="font-weight:600">${p}</span></div>`
  ).join('');

  const semana = planoSemana();
  const semanaHtml = semana.map(d => {
    const hoje = d.wd === wdHoje;
    let ic = '💤', txt = 'Folga';
    if (d.tipo === 'materia') { ic = TEMA_EMOJI[d.tema]; txt = labelTema(d.tema); }
    else if (d.tipo === 'revisao') { ic = '🎯'; txt = 'Revisão'; }
    return `<div class="linha" style="${hoje?'background:#EFEAFF;border-radius:12px;padding:8px 10px':''}">
      <span class="nome" style="min-width:46px;${hoje?'color:var(--grape-deep)':''}">${d.abbr}${hoje?' •':''}</span>
      <span style="flex:1">${ic} ${txt}</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <h2>Plano de estudos</h2>
    <div class="card card--destaque">
      <div class="card-titulo">${titulo}</div>
      <p style="color:var(--texto-sec);font-weight:600;margin-bottom:12px">${sub}</p>
      ${passosHtml}
      ${botao ? `<button class="btn btn-primaria" id="btn-comecar-plano" style="margin-top:14px">▶ Começar agora</button>` : ''}
    </div>
    <div class="card">
      <div class="card-titulo">🗓️ Sua semana</div>
      ${semanaHtml}
      <p class="legenda" style="margin-top:10px">1 matéria por dia, sábado é simulado e domingo é descanso. Leve e constante 🌱</p>
    </div>`;

  const b = el.querySelector('#btn-comecar-plano');
  if (b) b.addEventListener('click', () => ctx.onComecar(plano));
}
