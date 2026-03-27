// ── Matrix Rain ──────────────────────────────────────────────────────────────
(function initMatrix() {
  const canvas = document.getElementById('matrixCanvas');
  const ctx    = canvas.getContext('2d');
  const CHARS  = '01';
  const SIZE   = 14;
  let cols, drops;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    cols  = Math.floor(canvas.width / SIZE);
    drops = Array.from({ length: cols }, () => Math.random() * -50);
  }

  function draw() {
    ctx.fillStyle = 'rgba(1, 10, 4, 0.06)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = SIZE + 'px "Share Tech Mono", monospace';

    drops.forEach((y, i) => {
      const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
      const bright = y * SIZE > canvas.height * 0.7 ? 0.9 : 0.35 + Math.random() * 0.25;
      ctx.fillStyle = `rgba(0, 255, 65, ${bright})`;
      ctx.fillText(ch, i * SIZE, y * SIZE);

      if (y * SIZE > canvas.height && Math.random() > 0.97) {
        drops[i] = 0;
      }
      drops[i] += 0.5;
    });
  }

  resize();
  window.addEventListener('resize', resize);
  setInterval(draw, 45);
})();

// ── State ─────────────────────────────────────────────────────────────────────
let running = false;

const AGENT_NAMES = {
  1:  'Niche Explorer',
  2:  'Review Analyzer',
  3:  'Ranker',
  4:  'Product Strategist',
  5:  'Positioning Expert',
  6:  'Viability Analyst',
  7:  'Service Consultant',
  8:  'Project Architect',
  9:  'Modelo Serviço A',
  10: 'Modelo Serviço B',
  11: 'Modelo Serviço C',
  12: 'Líder de Serviços',
  13: 'Modelo Projeto A',
  14: 'Modelo Projeto B',
  15: 'Modelo Projeto C',
  16: 'Líder de Projetos',
};

const STATUS_LABELS = { pending: 'Aguardando', running: 'Executando', done: 'Concluído', error: 'Erro' };
const STATUS_ICONS  = { pending: '⏳', running: '🔄', done: '✅', error: '❌' };

// ── Pipeline ──────────────────────────────────────────────────────────────────
function runPipeline() {
  if (running) return;
  running = true;

  for (let i = 1; i <= 16; i++) setAgent(i, 'pending');
  document.getElementById('pipelineStatus').textContent = 'executando';
  document.getElementById('pipelineStatus').className   = 'section-badge running';
  document.getElementById('resultsSection').classList.add('hidden');
  document.getElementById('errorBanner').classList.add('hidden');
  document.getElementById('btnRun').disabled = true;
  showLoading(true, 'Inicializando agentes…');

  const es = new EventSource('/run-pipeline');

  es.addEventListener('agent', e => {
    const { id, status } = JSON.parse(e.data);
    setAgent(id, status);
    if (status === 'running') {
      setLoadingText(`Agente ${id} — ${AGENT_NAMES[id]}`);
    }
  });

  es.addEventListener('complete', e => {
    es.close();
    const data = JSON.parse(e.data);
    showLoading(false);
    finish(data);
  });

  es.addEventListener('error', e => {
    if (e.data) showError(JSON.parse(e.data).message);
    es.close();
    showLoading(false);
    resetBtn();
  });

  es.onerror = () => {
    if (!running) return;
    showError('Conexão com o servidor perdida.');
    es.close();
    showLoading(false);
    resetBtn();
  };
}

// ── Loading overlay ───────────────────────────────────────────────────────────
function showLoading(visible, text) {
  const el = document.getElementById('loadingOverlay');
  el.classList.toggle('hidden', !visible);
  if (text) setLoadingText(text);
}

function setLoadingText(text) {
  document.getElementById('loadingAgentLabel').textContent = text;
}

// ── Agent card update ─────────────────────────────────────────────────────────
function setAgent(id, status) {
  const card  = document.getElementById(`agent-${id}`);
  const badge = document.getElementById(`badge-${id}`);
  const icon  = document.getElementById(`icon-${id}`);

  card.className  = `agent-card ${status}`;
  badge.className = `agent-badge ${status}`;
  badge.textContent = STATUS_LABELS[status] ?? status;
  icon.textContent  = STATUS_ICONS[status]  ?? '⏳';
}

function resetBtn() {
  running = false;
  document.getElementById('btnRun').disabled = false;
  document.getElementById('pipelineStatus').textContent = 'concluído';
  document.getElementById('pipelineStatus').className   = 'section-badge done';
}

function showError(msg) {
  const el = document.getElementById('errorBanner');
  el.textContent = '⚠ ' + msg;
  el.classList.remove('hidden');
  document.getElementById('pipelineStatus').textContent = 'erro';
  document.getElementById('pipelineStatus').className   = 'section-badge';
}

// ── Finish ────────────────────────────────────────────────────────────────────
function finish({ ranked, products, positioning, viability, services, projects, top1Niche, best_service, best_project }) {
  resetBtn();
  renderNiches(ranked);
  renderSolutions(ranked, products, positioning, viability);
  renderServices(services, top1Niche);
  renderProjects(projects, top1Niche);
  renderWinner('bestServiceResult', '🛠 Serviço Vencedor', best_service, 'service');
  renderWinner('bestProjectResult', '🚀 Projeto Vencedor', best_project, 'project');
  const sec = document.getElementById('resultsSection');
  sec.classList.remove('hidden');
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Render: Niches table ──────────────────────────────────────────────────────
function renderNiches(ranked) {
  if (!ranked?.length) {
    document.getElementById('nichesResult').innerHTML =
      '<p style="color:var(--text3);text-align:center;padding:32px">Sem dados de nichos.</p>';
    return;
  }

  const rows = ranked.map(n => `
    <tr>
      <td><div class="rank-badge">${n.rank ?? '—'}</div></td>
      <td><strong style="color:var(--text)">${esc(n.niche_name)}</strong></td>
      <td>
        <div class="score-bar-wrap">
          <div class="score-bar">
            <div class="score-bar-fill" style="width:${((n.opportunity_score ?? 0) / 10) * 100}%"></div>
          </div>
          <span class="score-val">${n.opportunity_score ?? '—'}</span>
        </div>
      </td>
      <td><span class="reason-text">${esc(n.reason ?? '')}</span></td>
    </tr>
  `).join('');

  document.getElementById('nichesResult').innerHTML = `
    <table class="niches-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Nicho</th>
          <th>Score</th>
          <th>Justificativa</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Render: Solutions ─────────────────────────────────────────────────────────
function renderSolutions(ranked, products, positioning, viability) {
  if (!ranked?.length) {
    document.getElementById('solutionsResult').innerHTML =
      '<p style="color:var(--text3);text-align:center;padding:32px">Sem dados de soluções.</p>';
    return;
  }

  const cards = ranked.map((niche, i) => {
    const prod = products?.find(p    => match(p.niche_name,    niche.niche_name)) ?? {};
    const pos  = positioning?.find(p => match(p.niche_name,    niche.niche_name)) ?? {};
    const via  = viability?.find(p   => match(p.niche_name,    niche.niche_name)) ?? {};

    return `
      <div class="solution-card">
        <div class="solution-header">
          <span class="solution-rank">Rank #${niche.rank ?? i + 1}</span>
          <span class="solution-niche">${esc(niche.niche_name)}</span>
          <span class="score-val">${niche.opportunity_score ?? '—'}/10</span>
        </div>
        <div class="solution-cols">

          <div class="sol-col">
            <div class="sol-col-title">📦 Produto / Serviço</div>
            ${prod.solution_type ? `<span class="pill pill-${prod.solution_type}">${typeLabel(prod.solution_type)}</span>` : ''}
            <div class="sol-label">Nome</div>
            <div class="sol-value bold">${esc(prod.solution_name ?? '—')}</div>
            <div class="sol-label">Descrição</div>
            <div class="sol-value">${esc(prod.description ?? '—')}</div>
            ${prod.key_features?.length ? `
              <div class="sol-label">Funcionalidades</div>
              <div class="tag-list">${prod.key_features.map(f => `<span class="tag-item">${esc(f)}</span>`).join('')}</div>
            ` : ''}
          </div>

          <div class="sol-col">
            <div class="sol-col-title">🎯 Posicionamento</div>
            <div class="sol-label">Público-alvo</div>
            <div class="sol-value">${esc(pos.target_audience ?? '—')}</div>
            <div class="sol-label">Proposta de valor</div>
            <div class="sol-value">${esc(pos.value_proposition ?? '—')}</div>
            <div class="sol-label">Diferencial</div>
            <div class="sol-value">${esc(pos.differentiation ?? '—')}</div>
            ${pos.main_channels?.length ? `
              <div class="sol-label">Canais principais</div>
              <div class="tag-list">${pos.main_channels.map(c => `<span class="tag-item">${esc(c)}</span>`).join('')}</div>
            ` : ''}
          </div>

          <div class="sol-col">
            <div class="sol-col-title">📊 Viabilidade</div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
              ${via.opportunity_grade != null ? `<div class="${gradeClass(via.opportunity_grade)} grade-badge">${via.opportunity_grade}</div>` : ''}
              <div>
                <div class="sol-label" style="margin-top:0">Nota geral</div>
                <div class="sol-value bold">${via.opportunity_grade ?? '—'}/10</div>
              </div>
            </div>
            <div class="sol-label">Esforço</div>
            ${via.effort_level ? `<span class="${levelClass(via.effort_level)} level-badge">${levelLabel(via.effort_level)}</span>` : '<span class="sol-value">—</span>'}
            <div class="sol-label">Potencial de receita</div>
            ${via.revenue_potential ? `<span class="${levelClass(via.revenue_potential)} level-badge">${levelLabel(via.revenue_potential)}</span>` : '<span class="sol-value">—</span>'}
            ${via.main_risks?.length ? `
              <div class="sol-label">Riscos</div>
              <div class="tag-list">${via.main_risks.map(r => `<span class="tag-item">${esc(r)}</span>`).join('')}</div>
            ` : ''}
          </div>

        </div>
      </div>
    `;
  }).join('');

  document.getElementById('solutionsResult').innerHTML = `<div class="solution-cards">${cards}</div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function match(a, b) {
  if (!a || !b) return false;
  const al = a.toLowerCase(), bl = b.toLowerCase();
  return al.includes(bl) || bl.includes(al);
}

function gradeClass(g) {
  return g < 5 ? 'grade-red' : g <= 7 ? 'grade-amber' : 'grade-green';
}

function levelClass(l) {
  return { low: 'level-low', medium: 'level-medium', high: 'level-high' }[l] ?? 'level-medium';
}

function levelLabel(l) {
  return { low: 'Baixo', medium: 'Médio', high: 'Alto' }[l] ?? l;
}

function typeLabel(t) {
  return { product: 'Produto', service: 'Serviço', platform: 'Plataforma' }[t] ?? t;
}

// ── Render: Winner card (Layer 4) ─────────────────────────────────────────────
function renderWinner(containerId, title, data, type) {
  const el = document.getElementById(containerId);
  if (!data?.model) {
    el.innerHTML = `<p style="color:var(--text3);text-align:center;padding:24px">Modelo não disponível.</p>`;
    return;
  }

  const m = data.model;
  const isService = type === 'service';

  const mainName  = esc(isService ? (m.chosen_service ?? m.approach_name ?? '—') : (m.chosen_project ?? m.approach_name ?? '—'));
  const approach  = esc(m.approach_name ?? '');

  const rows = isService ? `
    <div class="sol-label">Abordagem</div>
    <div class="sol-value bold">${approach}</div>
    <div class="sol-label">Resumo</div>
    <div class="sol-value">${esc(m.summary ?? '—')}</div>
    <div class="sol-label">Cliente-alvo</div>
    <div class="sol-value">${esc(m.target_client ?? '—')}</div>
    <div class="sol-label">Modelo de precificação</div>
    <div class="sol-value bold">${esc(m.pricing_model ?? '—')}</div>
    <div class="sol-label">Receita mensal estimada</div>
    <div class="sol-value bold" style="color:var(--green);text-shadow:0 0 8px rgba(0,255,65,0.4)">${esc(m.estimated_monthly_revenue ?? '—')}</div>
    ${m.key_deliverables?.length ? `
      <div class="sol-label">Entregas principais</div>
      <div class="tag-list">${m.key_deliverables.map(d => `<span class="tag-item">${esc(d)}</span>`).join('')}</div>
    ` : ''}
    ${m.implementation_steps?.length ? `
      <div class="sol-label">Etapas de implementação</div>
      <ol style="padding-left:16px;margin-top:4px">
        ${m.implementation_steps.map(s => `<li style="font-size:0.78rem;color:var(--text2);margin-bottom:4px;line-height:1.4">${esc(s)}</li>`).join('')}
      </ol>
    ` : ''}
    ${m.competitive_advantage ? `
      <div class="sol-label">Vantagem competitiva</div>
      <div class="sol-value">${esc(m.competitive_advantage)}</div>
    ` : ''}
  ` : `
    <div class="sol-label">Abordagem</div>
    <div class="sol-value bold">${approach}</div>
    <div class="sol-label">Resumo</div>
    <div class="sol-value">${esc(m.summary ?? '—')}</div>
    <div class="sol-label">Monetização</div>
    <div class="sol-value">${esc(m.monetization ?? '—')}</div>
    <div class="sol-label">MRR estimado</div>
    <div class="sol-value bold" style="color:var(--green);text-shadow:0 0 8px rgba(0,255,65,0.4)">${esc(m.estimated_mrr ?? '—')}</div>
    <div class="sol-label">Prazo para lançamento</div>
    <div class="sol-value bold">${esc(m.time_to_launch ?? '—')}</div>
    ${m.mvp_features?.length ? `
      <div class="sol-label">Funcionalidades do MVP</div>
      <div class="tag-list">${m.mvp_features.map(f => `<span class="tag-item">${esc(f)}</span>`).join('')}</div>
    ` : ''}
    ${m.tech_stack?.length ? `
      <div class="sol-label">Stack tecnológica</div>
      <div class="tag-list">${m.tech_stack.map(t => `<span class="tag-item">${esc(t)}</span>`).join('')}</div>
    ` : ''}
    ${m.launch_steps?.length ? `
      <div class="sol-label">Etapas de lançamento</div>
      <ol style="padding-left:16px;margin-top:4px">
        ${m.launch_steps.map(s => `<li style="font-size:0.78rem;color:var(--text2);margin-bottom:4px;line-height:1.4">${esc(s)}</li>`).join('')}
      </ol>
    ` : ''}
  `;

  el.innerHTML = `
    <div class="winner-card">
      <div class="winner-card-header">
        <span class="winner-card-type">${title}</span>
        <span class="winner-card-name">${mainName}</span>
        <span class="winner-badge">⭐ ${esc(data.winner ?? '')} · ${data.score ?? '—'}/10</span>
      </div>
      <div class="winner-card-body">
        ${data.justification ? `<div class="winner-justification">${esc(data.justification)}</div>` : ''}
        ${rows}
      </div>
    </div>
  `;
}

// ── Render: Services (Layer 3) ────────────────────────────────────────────────
function renderServices(services, top1Niche) {
  if (top1Niche) {
    document.getElementById('layer3Subtitle').textContent =
      `Baseado no nicho #1: ${top1Niche}`;
  }

  if (!services?.length) {
    document.getElementById('servicesResult').innerHTML =
      '<p style="color:var(--text3);text-align:center;padding:24px">Sem dados de serviços.</p>';
    return;
  }

  const cards = services.map(s => `
    <div class="service-card">
      <div class="service-name">${esc(s.service_name)}</div>
      <div class="service-desc">${esc(s.description)}</div>
      <div class="sol-label">Cliente-alvo</div>
      <div class="sol-value">${esc(s.target_client ?? '—')}</div>
      <div class="sol-label">Formato de entrega</div>
      <div class="sol-value">${esc(s.delivery_format ?? '—')}</div>
      <div class="sol-label">Faixa de preço</div>
      <div class="sol-value bold">${esc(s.price_range ?? '—')}</div>
      ${s.skills_required?.length ? `
        <div class="sol-label">Habilidades necessárias</div>
        <div class="tag-list">${s.skills_required.map(sk => `<span class="tag-item">${esc(sk)}</span>`).join('')}</div>
      ` : ''}
    </div>
  `).join('');

  document.getElementById('servicesResult').innerHTML =
    `<div class="service-cards">${cards}</div>`;
}

// ── Render: Projects (Layer 3) ────────────────────────────────────────────────
function renderProjects(projects, top1Niche) {
  if (!projects?.length) {
    document.getElementById('projectsResult').innerHTML =
      '<p style="color:var(--text3);text-align:center;padding:24px">Sem dados de projetos.</p>';
    return;
  }

  const complexClass = c => ({ baixo: 'level-low', médio: 'level-medium', alto: 'level-high' })[c?.toLowerCase()] ?? 'level-medium';

  const cards = projects.map(p => `
    <div class="project-card">
      <div class="project-name">${esc(p.project_name)}</div>
      <div class="project-meta">
        ${p.type ? `<span class="pill pill-service" style="text-transform:capitalize">${esc(p.type)}</span>` : ''}
        ${p.estimated_complexity ? `<span class="${complexClass(p.estimated_complexity)} level-badge">${esc(p.estimated_complexity)}</span>` : ''}
      </div>
      <div class="project-desc">${esc(p.description)}</div>
      <div class="sol-label">Monetização</div>
      <div class="sol-value">${esc(p.monetization ?? '—')}</div>
      ${p.tech_stack?.length ? `
        <div class="sol-label">Stack tecnológica</div>
        <div class="tag-list">${p.tech_stack.map(t => `<span class="tag-item">${esc(t)}</span>`).join('')}</div>
      ` : ''}
    </div>
  `).join('');

  document.getElementById('projectsResult').innerHTML =
    `<div class="project-cards">${cards}</div>`;
}
