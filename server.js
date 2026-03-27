require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const MODEL  = 'google/gemini-3.1-flash-lite-preview';
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ── LLM call ────────────────────────────────────────────────────────────────
async function callLLM(system, user) {
  const res = await fetch(OR_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer':  'http://localhost:3000',
      'X-Title':       'Niche Intelligence',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${res.status}: ${txt}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ── JSON extractor ───────────────────────────────────────────────────────────
function parseJSON(text) {
  const clean = text.trim();
  try { return JSON.parse(clean); } catch {}
  const arr = clean.match(/\[[\s\S]*\]/);
  if (arr) { try { return JSON.parse(arr[0]); } catch {} }
  throw new Error('Resposta não é JSON válido');
}

// ── Agent runner with 1 retry ────────────────────────────────────────────────
async function runAgent(system, user) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callLLM(system, user);
      return { ok: true, data: parseJSON(text) };
    } catch (e) {
      console.error(`[Agent error attempt ${attempt + 1}]`, e.message);
      if (attempt === 1) return { ok: false, error: e.message };
    }
  }
}

// ── Pipeline SSE endpoint ────────────────────────────────────────────────────
app.get('/run-pipeline', async (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const emit = (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    // ── LAYER 1: Agents 1 + 2 in parallel ──────────────────────────────────
    emit('agent', { id: 1, status: 'running' });
    emit('agent', { id: 2, status: 'running' });

    const [r1, r2] = await Promise.all([
      runAgent(
        'You are a market research specialist. Respond in Brazilian Portuguese (pt-BR). Respond with valid JSON only — no markdown, no commentary.',
        'Return a JSON array of exactly 15 diverse market niches, each with: ' +
        'name (string), description (string), estimated_demand ("low"|"medium"|"high"), ' +
        'competition_level ("low"|"medium"|"high"). Array only, nothing else.'
      ),
      runAgent(
        'You are a consumer sentiment analyst. Respond in Brazilian Portuguese (pt-BR). Respond with valid JSON only — no markdown, no commentary.',
        'Analyze consumer satisfaction across 15 diverse market niches based on your training data. ' +
        'Return a JSON array with: niche_name (string), avg_rating (number 1-10), ' +
        'main_complaints (string[]), satisfaction_level ("low"|"medium"|"high"). Array only, nothing else.'
      ),
    ]);

    emit('agent', { id: 1, status: r1.ok ? 'done' : 'error', error: r1.error });
    emit('agent', { id: 2, status: r2.ok ? 'done' : 'error', error: r2.error });

    if (!r1.ok && !r2.ok) {
      emit('error', { message: 'Layer 1 completamente falhou. Pipeline encerrado.' });
      return res.end();
    }

    // ── Agent 3: Ranker ─────────────────────────────────────────────────────
    emit('agent', { id: 3, status: 'running' });

    const r3 = await runAgent(
      'You are a market opportunity classifier. Respond in Brazilian Portuguese (pt-BR). Respond with valid JSON only — no markdown, no commentary.',
      `Cross-reference the two datasets below. Return the top 5 niches with the highest opportunity score.\n` +
      `Scoring priority: low competition + low satisfaction + high demand.\n\n` +
      `Niches dataset: ${JSON.stringify(r1.data ?? [])}\n` +
      `Reviews dataset: ${JSON.stringify(r2.data ?? [])}\n\n` +
      `Return a JSON array with: rank (number), niche_name (string), opportunity_score (number 0-10), reason (string). Array only.`
    );

    emit('agent', { id: 3, status: r3.ok ? 'done' : 'error', error: r3.error });

    if (!r3.ok) {
      emit('error', { message: 'Ranker falhou. Não é possível prosseguir para a Layer 2.' });
      return res.end();
    }

    const top5 = JSON.stringify(r3.data);

    // ── LAYER 2: Agents 4 + 5 + 6 in parallel ──────────────────────────────
    emit('agent', { id: 4, status: 'running' });
    emit('agent', { id: 5, status: 'running' });
    emit('agent', { id: 6, status: 'running' });

    const [r4, r5, r6] = await Promise.all([
      runAgent(
        'You are a product development expert. Respond in Brazilian Portuguese (pt-BR). Respond with valid JSON only — no markdown, no commentary.',
        `For each of the top 5 niches below, propose what to build.\n` +
        `Return a JSON array with: niche_name (string), solution_type ("product"|"service"|"platform"), ` +
        `solution_name (string), description (string), key_features (string[]).\n\n` +
        `Top 5 niches: ${top5}\n\nArray only, nothing else.`
      ),
      runAgent(
        'You are a brand and go-to-market strategist. Respond in Brazilian Portuguese (pt-BR). Respond with valid JSON only — no markdown, no commentary.',
        `For each of the top 5 niches below, suggest a positioning strategy.\n` +
        `Return a JSON array with: niche_name (string), target_audience (string), ` +
        `value_proposition (string), differentiation (string), main_channels (string[]).\n\n` +
        `Top 5 niches: ${top5}\n\nArray only, nothing else.`
      ),
      runAgent(
        'You are a business viability analyst. Respond in Brazilian Portuguese (pt-BR). Respond with valid JSON only — no markdown, no commentary.',
        `For each of the top 5 niches below, estimate execution effort and business viability.\n` +
        `Return a JSON array with: niche_name (string), effort_level ("low"|"medium"|"high"), ` +
        `revenue_potential ("low"|"medium"|"high"), main_risks (string[]), opportunity_grade (number 0-10).\n\n` +
        `Top 5 niches: ${top5}\n\nArray only, nothing else.`
      ),
    ]);

    emit('agent', { id: 4, status: r4.ok ? 'done' : 'error', error: r4.error });
    emit('agent', { id: 5, status: r5.ok ? 'done' : 'error', error: r5.error });
    emit('agent', { id: 6, status: r6.ok ? 'done' : 'error', error: r6.error });

    // ── LAYER 3: Agents 7 + 8 in parallel (top 1 niche only) ───────────────
    const top1 = JSON.stringify(r3.data?.[0] ?? r3.data);

    emit('agent', { id: 7, status: 'running' });
    emit('agent', { id: 8, status: 'running' });

    const [r7, r8] = await Promise.all([
      runAgent(
        'You are a freelance and consulting services advisor. Respond in Brazilian Portuguese (pt-BR). Respond with valid JSON only — no markdown, no commentary.',
        `Based on the #1 ranked market niche below, list 6 services that a developer or consultant can offer to companies or projects in this niche.\n` +
        `Return a JSON array with: service_name (string), description (string), target_client (string), delivery_format (string), price_range (string), skills_required (string[]).\n\n` +
        `Top niche: ${top1}\n\nArray only, nothing else.`
      ),
      runAgent(
        'You are a project architect and indie developer advisor. Respond in Brazilian Portuguese (pt-BR). Respond with valid JSON only — no markdown, no commentary.',
        `Based on the #1 ranked market niche below, propose 5 concrete projects or products to build to address the demand.\n` +
        `Return a JSON array with: project_name (string), description (string), type ("saas"|"app"|"ferramenta"|"plataforma"|"conteúdo"), monetization (string), estimated_complexity ("baixo"|"médio"|"alto"), tech_stack (string[]).\n\n` +
        `Top niche: ${top1}\n\nArray only, nothing else.`
      ),
    ]);

    emit('agent', { id: 7, status: r7.ok ? 'done' : 'error', error: r7.error });
    emit('agent', { id: 8, status: r8.ok ? 'done' : 'error', error: r8.error });

    emit('complete', {
      ranked:      r3.data,
      products:    r4.data ?? [],
      positioning: r5.data ?? [],
      viability:   r6.data ?? [],
      services:    r7.data ?? [],
      projects:    r8.data ?? [],
      top1Niche:   r3.data?.[0]?.niche_name ?? '',
    });

    res.end();

  } catch (e) {
    emit('error', { message: e.message });
    res.end();
  }
});

app.listen(3000, () => {
  console.log('▶  Niche Intelligence  →  http://localhost:3000');
});
