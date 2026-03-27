// ── State ───────────────────────────────────────────────────────────────────
let running = false;

// ── Agent metadata ───────────────────────────────────────────────────────────
const AGENTS = {
  1: 'Niche Explorer',
  2: 'Review Analyzer',
  3: 'Ranker',
  4: 'Product Strategist',
  5: 'Positioning Expert',
  6: 'Viability Analyst',
};

const STATUS_ICONS = {
  pending: '⏳',
  running: '🔄',
  done:    '✅',
  error:   '❌',
};

// ── Pipeline runner ──────────────────────────────────────────────────────────
function runPipeline() {
  if (running) return;
  running = true;

  const btn = document.getElementById('btnRun');
  btn.disabled = true;
  document.getElementById('btnLabel').textContent = 'Executando…';
  document.getElementById('btnIcon').className = 'spinner';
  document.getElementById('btnIcon').textContent = '↻';

  // Reset agents
  for (let i = 1; i <= 6; i++) setAgentStatus(i, 'pending');

  document.getElementById('pipelineStatus').textContent = 'executando';
  document.getElementById('pipelineStatus').className = 'section-badge running';
  document.getElementById('resultsSection').classList.add('hidden');
  document.getElementById('errorBanner').classList.add('hidden');

  const es = new EventSource('/run-pipeline');

  es.addEventListener('agent', e => {
    const { id, status } = JSON.parse(e.data);
    setAgentStatus(id, status);
  });

  es.addEventListener('complete', e => {
    const data = JSON.parse(e.data);
    es.close();
    finishPipeline(data);
  });

  es.addEventListener('error', e => {
    if (e.data) {
      const { message } = JSON.parse(e.data);
      showError(message);
    }
    es.close();
    resetButton();
  });

  es.onerror = () => {
    if (!running) return;
    showError('Conexão com o servidor perdida.');
    es.close();
    resetButton();
  };
}

// ── UI helpers ───────────────────────────────────────────────────────────────
function setAgentStatus(id, status) {
  const card  = document.getElementById(`agent-${id}`);
  const badge = document.getElementById(`badge-${id}`);
  const icon  = card.querySelector('.agent-status-icon');

  card.className  = `agent-card ${status}`;
  badge.className = `agent-badge ${status}`;
  icon.textContent = STATUS_ICONS[status] ?? '⏳';

  const labels = { pending: 'Aguardando', running: 'Executando', done: 'Concluído', error: 'Erro' };
  badge.textContent = labels[status] ?? status;

  if (status === 'running') {
    icon.classList.add('spinner');
  } else {
    icon.classList.remove('spinner');
  }
}

function resetButton() {
  running = false;
  const btn = document.getElementById('btnRun');
  btn.disabled = false;
  document.getElementById('btnLabel').textContent = 'Iniciar Pipeline';
  const icon = document.getElementById('btnIcon');
  icon.className = '';
  icon.textContent = '▶';
  document.getElementById('pipelineStatus').textContent = 'concluído';
  document.getElementById('pipelineStatus').className = 'section-badge done';
}

function showError(msg) {
  const el = document.getElementById('errorBanner');
  el.textContent = '⚠ ' + msg;
  el.classList.remove('hidden');
  document.getElementById('pipelineStatus').textContent = 'erro';
  document.getElementById('pipelineStatus').className = 'section-badge';
}

// ── Finish & render ──────────────────────────────────────────────────────────
function finishPipeline({ ranked, products, positioning, viability }) {
  resetButton();
  renderNiches(ranked);
  renderSolutions(ranked, products, positioning, viability);
  document.getElementById('resultsSection').classList.remove('hidden');
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Tab switcher ─────────────────────────────────────────────────────────────
function showTab(name) {
  ['niches', 'solutions'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== name);
    document.getElementById(`tab-btn-${t}`).classList.toggle('active', t === name);
  });
}

// ── Render: Niches table ─────────────────────────────────────────────────────
function renderNiches(ranked) {
  if (!ranked?.length) {
    document.getElementById('tab-niches').innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Sem dados de nichos.</p>';
    return;
  }

  const rows = ranked.map(n => `
    <tr>
      <td><div class="rank-badge">${n.rank ?? '—'}</div></td>
      <td><strong>${esc(n.niche_name)}</strong></td>
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

  document.getElementById('tab-niches').innerHTML = `
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

// ── Render: Solutions cards ──────────────────────────────────────────────────
function renderSolutions(ranked, products, positioning, viability) {
  if (!ranked?.length) {
    document.getElementById('tab-solutions').innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Sem dados de soluções.</p>';
    return;
  }

  const cards = ranked.map((niche, i) => {
    const prod = products?.find(p => matchNiche(p.niche_name, niche.niche_name)) ?? {};
    const pos  = positioning?.find(p => matchNiche(p.niche_name, niche.niche_name)) ?? {};
    const via  = viability?.find(p => matchNiche(p.niche_name, niche.niche_name)) ?? {};

    return `
      <div class="solution-card">
        <div class="solution-header">
          <span class="solution-rank">Rank #${niche.rank ?? i + 1}</span>
          <span class="solution-niche">${esc(niche.niche_name)}</span>
          <span class="score-val">${niche.opportunity_score ?? '—'}/10</span>
        </div>
        <div class="solution-cols">

          <!-- Product col -->
          <div class="sol-col">
            <div class="sol-col-title">📦 Produto / Serviço</div>
            ${prod.solution_type ? `<span class="pill pill-${prod.solution_type}">${prod.solution_type}</span>` : ''}
            <div class="sol-label">Nome</div>
            <div class="sol-value bold">${esc(prod.solution_name ?? '—')}</div>
            <div class="sol-label">Descrição</div>
            <div class="sol-value">${esc(prod.description ?? '—')}</div>
            ${prod.key_features?.length ? `
              <div class="sol-label">Funcionalidades</div>
              <div class="tag-list">${prod.key_features.map(f => `<span class="tag-item">${esc(f)}</span>`).join('')}</div>
            ` : ''}
          </div>

          <!-- Positioning col -->
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

          <!-- Viability col -->
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
            ${via.effort_level ? `<span class="${levelClass(via.effort_level)} level-badge">${via.effort_level}</span>` : '<span class="sol-value">—</span>'}
            <div class="sol-label">Potencial de receita</div>
            ${via.revenue_potential ? `<span class="${levelClass(via.revenue_potential)} level-badge">${via.revenue_potential}</span>` : '<span class="sol-value">—</span>'}
            ${via.main_risks?.length ? `
              <div class="sol-label">Riscos</div>
              <div class="tag-list">${via.main_risks.map(r => `<span class="tag-item">${esc(r)}</span>`).join('')}</div>
            ` : ''}
          </div>

        </div>
      </div>
    `;
  }).join('');

  document.getElementById('tab-solutions').innerHTML = `<div class="solution-cards">${cards}</div>`;
}

// ── Utilities ────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function matchNiche(a, b) {
  if (!a || !b) return false;
  return a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
}

function gradeClass(grade) {
  if (grade < 5)  return 'grade-red';
  if (grade <= 7) return 'grade-amber';
  return 'grade-green';
}

function levelClass(level) {
  const map = { low: 'level-low', medium: 'level-medium', high: 'level-high' };
  return map[level] ?? 'level-medium';
}
