// ── Stars ─────────────────────────────────────────────────────────────────────
(function createStars() {
  const container = document.getElementById('stars');
  for (let i = 0; i < 160; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    const op   = (Math.random() * 0.6 + 0.15).toFixed(2);
    s.style.cssText =
      `left:${Math.random()*100}%;top:${Math.random()*100}%;` +
      `width:${size}px;height:${size}px;` +
      `--o:${op};--d:${(Math.random()*3+3).toFixed(1)}s;--dl:${(Math.random()*6).toFixed(1)}s;`;
    container.appendChild(s);
  }
})();

// ── State ─────────────────────────────────────────────────────────────────────
let running = false;

const AGENT_NAMES = {
  1:'Niche Explorer', 2:'Review Analyzer', 3:'Ranker',
  4:'Product Strategist', 5:'Positioning Expert', 6:'Viability Analyst',
  7:'Service Consultant', 8:'Project Architect',
  9:'Modelo Serviço A', 10:'Modelo Serviço B', 11:'Modelo Serviço C', 12:'Líder de Serviços',
  13:'Modelo Projeto A', 14:'Modelo Projeto B', 15:'Modelo Projeto C', 16:'Líder de Projetos',
};

const STATUS_LABELS = { pending:'Aguardando', running:'Executando', done:'Concluído', error:'Erro' };
const STATUS_ICONS  = { pending:'⏳', running:'🔄', done:'✅', error:'❌' };

// ── Start pipeline ────────────────────────────────────────────────────────────
function startPipeline() {
  if (running) return;
  running = true;

  // Transition landing → app
  const landing = document.getElementById('landingView');
  landing.classList.add('exiting');
  setTimeout(() => landing.style.display = 'none', 600);

  document.getElementById('appView').classList.remove('hidden');
  document.body.classList.add('pipeline-active');

  for (let i = 1; i <= 16; i++) setAgent(i, 'pending');
  document.getElementById('errorBanner').classList.add('hidden');
  document.getElementById('resultsPanel').classList.add('hidden');

  const es = new EventSource('/run-pipeline');

  es.addEventListener('agent', e => {
    const { id, status } = JSON.parse(e.data);
    setAgent(id, status);
    if (status === 'running') {
      document.getElementById('loadingText').textContent =
        `Agente ${id} — ${AGENT_NAMES[id]}…`;
    }
  });

  es.addEventListener('complete', e => {
    es.close();
    finish(JSON.parse(e.data));
  });

  es.addEventListener('error', e => {
    if (e.data) showError(JSON.parse(e.data).message);
    es.close();
    doneLoading();
  });

  es.onerror = () => {
    if (!running) return;
    showError('Conexão com o servidor perdida.');
    es.close();
    doneLoading();
  };
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function setAgent(id, status) {
  const card  = document.getElementById(`agent-${id}`);
  const badge = document.getElementById(`badge-${id}`);
  const icon  = document.getElementById(`icon-${id}`);
  if (!card) return;
  card.className  = card.className.replace(/\b(running|done|error|pending)\b/g, '').trim() + ` ${status}`;
  badge.className = `agent-badge ${status}`;
  badge.textContent = STATUS_LABELS[status] ?? status;
  icon.textContent  = STATUS_ICONS[status]  ?? '⏳';
}

function doneLoading() {
  running = false;
  document.getElementById('loadingText').textContent = 'Concluído.';
}

function showError(msg) {
  const el = document.getElementById('errorBanner');
  el.textContent = '⚠ ' + msg;
  el.classList.remove('hidden');
}

// ── Finish ────────────────────────────────────────────────────────────────────
function finish({ ranked, products, positioning, viability, services, projects, top1Niche, best_service, best_project }) {
  doneLoading();
  renderNiches(ranked);
  renderSolutions(ranked, products, positioning, viability);
  renderServices(services, top1Niche);
  renderProjects(projects, top1Niche);
  renderWinner('bestServiceResult', '🛠 Serviço Vencedor', best_service, 'service');
  renderWinner('bestProjectResult', '🚀 Projeto Vencedor', best_project, 'project');

  document.body.classList.remove('pipeline-active');
  document.body.classList.add('results-ready');

  const panel = document.getElementById('resultsPanel');
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Render: Niches ────────────────────────────────────────────────────────────
function renderNiches(ranked) {
  if (!ranked?.length) { document.getElementById('nichesResult').innerHTML = empty(); return; }
  const rows = ranked.map(n => `
    <tr>
      <td><div class="rank-badge">${n.rank??'—'}</div></td>
      <td><strong style="color:var(--text)">${esc(n.niche_name)}</strong></td>
      <td><div class="score-bar-wrap"><div class="score-bar"><div class="score-bar-fill" style="width:${((n.opportunity_score??0)/10)*100}%"></div></div><span class="score-val">${n.opportunity_score??'—'}</span></div></td>
      <td><span class="reason-text">${esc(n.reason??'')}</span></td>
    </tr>`).join('');
  document.getElementById('nichesResult').innerHTML =
    `<table class="niches-table"><thead><tr><th>#</th><th>Nicho</th><th>Score</th><th>Justificativa</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ── Render: Solutions ─────────────────────────────────────────────────────────
function renderSolutions(ranked, products, positioning, viability) {
  if (!ranked?.length) { document.getElementById('solutionsResult').innerHTML = empty(); return; }
  const cards = ranked.map((niche, i) => {
    const prod = products?.find(p    => match(p.niche_name, niche.niche_name)) ?? {};
    const pos  = positioning?.find(p => match(p.niche_name, niche.niche_name)) ?? {};
    const via  = viability?.find(p   => match(p.niche_name, niche.niche_name)) ?? {};
    return `<div class="solution-card">
      <div class="solution-header">
        <span class="solution-rank">Rank #${niche.rank??i+1}</span>
        <span class="solution-niche">${esc(niche.niche_name)}</span>
        <span class="score-val">${niche.opportunity_score??'—'}/10</span>
      </div>
      <div class="solution-cols">
        <div class="sol-col">
          <div class="sol-col-title">📦 Produto / Serviço</div>
          ${prod.solution_type?`<span class="pill pill-${prod.solution_type}">${typeLabel(prod.solution_type)}</span>`:''}
          <div class="sol-label">Nome</div><div class="sol-value bold">${esc(prod.solution_name??'—')}</div>
          <div class="sol-label">Descrição</div><div class="sol-value">${esc(prod.description??'—')}</div>
          ${prod.key_features?.length?`<div class="sol-label">Funcionalidades</div><div class="tag-list">${prod.key_features.map(f=>`<span class="tag-item">${esc(f)}</span>`).join('')}</div>`:''}
        </div>
        <div class="sol-col">
          <div class="sol-col-title">🎯 Posicionamento</div>
          <div class="sol-label">Público-alvo</div><div class="sol-value">${esc(pos.target_audience??'—')}</div>
          <div class="sol-label">Proposta de valor</div><div class="sol-value">${esc(pos.value_proposition??'—')}</div>
          <div class="sol-label">Diferencial</div><div class="sol-value">${esc(pos.differentiation??'—')}</div>
          ${pos.main_channels?.length?`<div class="sol-label">Canais</div><div class="tag-list">${pos.main_channels.map(c=>`<span class="tag-item">${esc(c)}</span>`).join('')}</div>`:''}
        </div>
        <div class="sol-col">
          <div class="sol-col-title">📊 Viabilidade</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            ${via.opportunity_grade!=null?`<div class="${gradeClass(via.opportunity_grade)} grade-badge">${via.opportunity_grade}</div>`:''}
            <div><div class="sol-label" style="margin-top:0">Nota</div><div class="sol-value bold">${via.opportunity_grade??'—'}/10</div></div>
          </div>
          <div class="sol-label">Esforço</div>${via.effort_level?`<span class="${levelClass(via.effort_level)} level-badge">${levelLabel(via.effort_level)}</span>`:'<span class="sol-value">—</span>'}
          <div class="sol-label">Receita potencial</div>${via.revenue_potential?`<span class="${levelClass(via.revenue_potential)} level-badge">${levelLabel(via.revenue_potential)}</span>`:'<span class="sol-value">—</span>'}
          ${via.main_risks?.length?`<div class="sol-label">Riscos</div><div class="tag-list">${via.main_risks.map(r=>`<span class="tag-item">${esc(r)}</span>`).join('')}</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('solutionsResult').innerHTML = `<div class="solution-cards">${cards}</div>`;
}

// ── Render: Services ──────────────────────────────────────────────────────────
function renderServices(services, top1Niche) {
  if (top1Niche) document.getElementById('layer3Subtitle').textContent = `Baseado no nicho #1: ${top1Niche}`;
  if (!services?.length) { document.getElementById('servicesResult').innerHTML = empty(); return; }
  const cards = services.map(s => `
    <div class="service-card">
      <div class="service-name">${esc(s.service_name)}</div>
      <div class="service-desc">${esc(s.description)}</div>
      <div class="sol-label">Cliente-alvo</div><div class="sol-value">${esc(s.target_client??'—')}</div>
      <div class="sol-label">Formato de entrega</div><div class="sol-value">${esc(s.delivery_format??'—')}</div>
      <div class="sol-label">Faixa de preço</div><div class="sol-value bold">${esc(s.price_range??'—')}</div>
      ${s.skills_required?.length?`<div class="sol-label">Habilidades</div><div class="tag-list">${s.skills_required.map(sk=>`<span class="tag-item">${esc(sk)}</span>`).join('')}</div>`:''}
    </div>`).join('');
  document.getElementById('servicesResult').innerHTML = `<div class="service-cards">${cards}</div>`;
}

// ── Render: Projects ──────────────────────────────────────────────────────────
function renderProjects(projects) {
  if (!projects?.length) { document.getElementById('projectsResult').innerHTML = empty(); return; }
  const cc = c => ({ baixo:'level-low', médio:'level-medium', alto:'level-high' })[c?.toLowerCase()] ?? 'level-medium';
  const cards = projects.map(p => `
    <div class="project-card">
      <div class="project-name">${esc(p.project_name)}</div>
      <div class="project-meta">
        ${p.type?`<span class="pill pill-service" style="text-transform:capitalize">${esc(p.type)}</span>`:''}
        ${p.estimated_complexity?`<span class="${cc(p.estimated_complexity)} level-badge">${esc(p.estimated_complexity)}</span>`:''}
      </div>
      <div class="project-desc">${esc(p.description)}</div>
      <div class="sol-label">Monetização</div><div class="sol-value">${esc(p.monetization??'—')}</div>
      ${p.tech_stack?.length?`<div class="sol-label">Stack</div><div class="tag-list">${p.tech_stack.map(t=>`<span class="tag-item">${esc(t)}</span>`).join('')}</div>`:''}
    </div>`).join('');
  document.getElementById('projectsResult').innerHTML = `<div class="project-cards">${cards}</div>`;
}

// ── Render: Winner card ───────────────────────────────────────────────────────
function renderWinner(containerId, title, data, type) {
  const el = document.getElementById(containerId);
  if (!data?.model) { el.innerHTML = `<p style="color:var(--text3);text-align:center;padding:24px">Modelo não disponível.</p>`; return; }
  const m = data.model;
  const isService = type === 'service';
  const mainName = esc(isService ? (m.chosen_service??m.approach_name??'—') : (m.chosen_project??m.approach_name??'—'));

  const rows = isService ? `
    <div class="sol-label">Abordagem</div><div class="sol-value bold">${esc(m.approach_name??'—')}</div>
    <div class="sol-label">Resumo</div><div class="sol-value">${esc(m.summary??'—')}</div>
    <div class="sol-label">Cliente-alvo</div><div class="sol-value">${esc(m.target_client??'—')}</div>
    <div class="sol-label">Modelo de precificação</div><div class="sol-value bold">${esc(m.pricing_model??'—')}</div>
    <div class="sol-label">Receita mensal estimada</div><div class="sol-value bold" style="color:var(--green)">${esc(m.estimated_monthly_revenue??'—')}</div>
    ${m.key_deliverables?.length?`<div class="sol-label">Entregas</div><div class="tag-list">${m.key_deliverables.map(d=>`<span class="tag-item">${esc(d)}</span>`).join('')}</div>`:''}
    ${m.implementation_steps?.length?`<div class="sol-label">Etapas</div><ol style="padding-left:16px;margin-top:4px">${m.implementation_steps.map(s=>`<li style="font-size:0.76rem;color:var(--text2);margin-bottom:3px;line-height:1.4">${esc(s)}</li>`).join('')}</ol>`:''}
    ${m.competitive_advantage?`<div class="sol-label">Vantagem competitiva</div><div class="sol-value">${esc(m.competitive_advantage)}</div>`:''}
  ` : `
    <div class="sol-label">Abordagem</div><div class="sol-value bold">${esc(m.approach_name??'—')}</div>
    <div class="sol-label">Resumo</div><div class="sol-value">${esc(m.summary??'—')}</div>
    <div class="sol-label">Monetização</div><div class="sol-value">${esc(m.monetization??'—')}</div>
    <div class="sol-label">MRR estimado</div><div class="sol-value bold" style="color:var(--green)">${esc(m.estimated_mrr??'—')}</div>
    <div class="sol-label">Prazo para lançamento</div><div class="sol-value bold">${esc(m.time_to_launch??'—')}</div>
    ${m.mvp_features?.length?`<div class="sol-label">MVP</div><div class="tag-list">${m.mvp_features.map(f=>`<span class="tag-item">${esc(f)}</span>`).join('')}</div>`:''}
    ${m.tech_stack?.length?`<div class="sol-label">Stack</div><div class="tag-list">${m.tech_stack.map(t=>`<span class="tag-item">${esc(t)}</span>`).join('')}</div>`:''}
    ${m.launch_steps?.length?`<div class="sol-label">Lançamento</div><ol style="padding-left:16px;margin-top:4px">${m.launch_steps.map(s=>`<li style="font-size:0.76rem;color:var(--text2);margin-bottom:3px;line-height:1.4">${esc(s)}</li>`).join('')}</ol>`:''}
  `;

  el.innerHTML = `
    <div class="winner-card">
      <div class="winner-card-header">
        <span class="winner-card-type">${title}</span>
        <span class="winner-card-name">${mainName}</span>
        <span class="winner-badge">⭐ ${esc(data.winner??'')} · ${data.score??'—'}/10</span>
      </div>
      <div class="winner-card-body">
        ${data.justification?`<div class="winner-justification">${esc(data.justification)}</div>`:''}
        ${rows}
      </div>
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function empty() { return `<p style="color:var(--text3);text-align:center;padding:24px 0">Sem dados.</p>`; }
function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function match(a,b) { if(!a||!b) return false; const al=a.toLowerCase(),bl=b.toLowerCase(); return al.includes(bl)||bl.includes(al); }
function gradeClass(g) { return g<5?'grade-red':g<=7?'grade-amber':'grade-green'; }
function levelClass(l) { return {low:'level-low',medium:'level-medium',high:'level-high'}[l]??'level-medium'; }
function levelLabel(l) { return {low:'Baixo',medium:'Médio',high:'Alto'}[l]??l; }
function typeLabel(t)  { return {product:'Produto',service:'Serviço',platform:'Plataforma'}[t]??t; }
