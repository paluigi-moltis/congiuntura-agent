# 🤖 congiuntura-agent

**The Open Agentic Web version of [Congiuntura Live](https://congiuntura.by.gg8.eu/)** — a browser-run multi-agent assistant that answers questions about the European economic outlook, grounded in live press-release data from six official statistical agencies (Eurostat, Istat, INE, INSEE, Destatis, CSO).

Built for the [Open Agentic Web Challenge](https://cognizant-agenticweb.devpost.com/) (Cognizant AI Lab · MIT NANDA · Mozilla Otari · AWS).

> 🔗 **Live site:** https://congiuntura-agent.by.gg8.eu
> 📊 **Human site:** https://congiuntura.by.gg8.eu (repo: [paluigi/congiuntura-live](https://github.com/paluigi/congiuntura-live))
> 📋 **Spec:** [Worldwide Agentic Web MVP Specification](https://github.com/cognizant-ai-labs/agentic-web/blob/main/docs/worldwide_agentic_web_mvp_spec.md)

---

## What visitors can do

Ask questions like:

- *"What's the latest signal on euro-area inflation?"*
- *"Any negative labour-market news from Germany this month?"*
- *"Which agencies published GDP data last week, and what was the tone?"*
- *"Which euro-area releases are due this week? What were the previous values?"*
- *"Show me only negative Italy retail-trade releases"* — the agent drives the site's own filters

Every answer cites the underlying press releases (agency, date, link).

## How it works

```
visitor's browser
├── agentified dashboard (static HTML/JS + chat assistant)
├── browser runtime (nsdeploy-derived) runs the agent network locally
│     ├── outlook_assistant (front agent)
│     ├── releases_specialist ──┐
│     └── calendar_specialist ──┤  MCP (read-only) → congiuntura-live API
│                               ┘        → MongoDB congiuntura DB
└── visitor's own LLM key (BYOK) — the site never pays for inference
```

- **Network runs in the browser**: the agent graph is published as data (`congiuntura_outlook.network.json`, Neuro SAN HOCON profile) — no server-side agent code.
- **BYOK first**: visitors paste their own key (OpenRouter, OpenAI-compatible endpoints; Otari-hosted supported). The key stays in the browser, attached only to model requests.
- **Read-only MCP grounding**: answers come from a read-only MCP server on the existing congiuntura-live app, using a dedicated read-only MongoDB user.
- **Open peers**: `peer_policy: "open"` — other agentic websites can load and run this network in *their* visitors' browsers, after consent.

## What this repo contains

| Path | Purpose |
|---|---|
| `site/` | The agentified dashboard: `index.html`, `site.js`, `site-actions.js`, assistant CSS |
| `site/agent-manifest.json` | Public manifest: network name, front agent, hocon pointer, peer policy, sample queries |
| `site/congiuntura_outlook.hocon` | Authoring source of the agent network (built artifact: `.network.json`) |
| `site/links.json` | Peer-network link map |
| `site/runtime/` | Browser runtime (from the [agentic-web](https://github.com/cognizant-ai-labs/agentic-web) `agentify-website` skill) |
| `site/bridge/` | Action bridge for other agent sites calling this network |
| `deploy/` | nginx container + compose service + reverse-proxy notes |
| `tests/` | Node tests from the agentify skill (call budget, manifest consistency, validator) |

*(paths materialize as phases land — see the implementation plan)*

## Status

🚧 Work in progress for the hackathon deadline. Phases:

- [ ] Phase 1 — read-only MCP server in congiuntura-live
- [ ] Phase 2 — agentified static bundle (this repo)
- [ ] Phase 3 — deploy at congiuntura-agent.by.gg8.eu
- [ ] Phase 4 — submission (video, screenshots, devpost)

## License

MIT
