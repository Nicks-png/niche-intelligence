# Niche Intelligence

Pipeline de 6 agentes de IA para pesquisa de nichos de mercado e geração de soluções de negócio.

## Instalação

```bash
npm install
```

## Configuração

Edite o arquivo `.env` e adicione sua chave do OpenRouter:

```
OPENROUTER_API_KEY=sk-or-...
```

> Obtenha uma chave em: https://openrouter.ai → Settings → API Keys

## Execução

```bash
node server.js
```

Abra no navegador: **http://localhost:3000**

## Como funciona

```
Camada 1 (paralelo)
  Agent 1 — Niche Explorer    → mapeia 15 nichos
  Agent 2 — Review Analyzer   → analisa satisfação do consumidor
  Agent 3 — Ranker            → seleciona top 5 oportunidades

Camada 2 (paralelo, após Camada 1)
  Agent 4 — Product Strategist  → propõe produtos/serviços
  Agent 5 — Positioning Expert  → define estratégia de mercado
  Agent 6 — Viability Analyst   → avalia viabilidade e riscos
```

Modelo usado: `google/gemini-2.0-flash-exp` via OpenRouter
Atualizações em tempo real via SSE (Server-Sent Events)

## Requisitos

- Node.js 18+
- Conta no OpenRouter com API key válida
