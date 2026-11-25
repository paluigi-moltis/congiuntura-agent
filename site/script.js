// Congiuntura Agent dashboard — client-rendered from the read-only MCP tools
// on congiuntura.by.gg8.eu. The page and the assistant share one state object:
// the agent drives the same filters the visitor can click.
//
// Data source: https://congiuntura.by.gg8.eu/mcp (JSON-RPC 2.0, read-only).
// CORS on that endpoint allows this origin.

const MCP_URL = "https://congiuntura.by.gg8.eu/mcp";

const TOPICS = [
  "Consumer prices", "Producer prices", "Import prices", "Export prices",
  "GDP", "Industrial production", "Services production", "International trade",
  "Labour market", "Public finance", "Retail trade", "Construction",
  "Business surveys", "Other economic topics", "Non-economic topics",
];
const COUNTRIES = ["Euro area", "Italy", "Spain", "France", "Germany", "Ireland", "Other"];
const SENTIMENTS = ["positive", "negative", "neutral"];
const PUBLISHERS = {
  eurostat: "Eurostat", istat: "Istat", ine: "INE", insee: "INSEE",
  destatis: "Destatis", cso: "CSO", dgecofin: "DG EcoFin",
};

let rpcId = 0;

/**
 * Minimal MCP client: initialize handshake, then JSON-RPC tools/call.
 */
class Mcp {
  static sessionId = null;

  static async rpc(method, params) {
    const body = { jsonrpc: "2.0", id: ++rpcId, method, params: params || {} };
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (Mcp.sessionId) headers["Mcp-Session-Id"] = Mcp.sessionId;
    const resp = await fetch(MCP_URL, { method: "POST", headers, body: JSON.stringify(body) });
    const sid = resp.headers.get("Mcp-Session-Id");
    if (sid) Mcp.sessionId = sid;
    const json = await resp.json();
    if (json.error) throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
    return json.result;
  }

  static async init() {
    await Mcp.rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "congiuntura-agent-dashboard", version: "1.0.0" },
    });
    await Mcp.rpc("notifications/initialized", {});
  }

  static async callTool(name, args) {
    const result = await Mcp.rpc("tools/call", { name, arguments: args || {} });
    if (result.isError) {
      const text = (result.content || []).map((c) => c.text).join("\n");
      throw new Error(text || `Tool ${name} failed`);
    }
    return result.structuredContent ?? JSON.parse((result.content || [{ text: "{}" }])[0].text);
  }
}

/**
 * The page object the assistant shares with the visitor: one state, one set of
 * operations. The agent's site-actions wrap these same methods.
 */
export class App {
  static page = null;

  static start() {
    App.page = new Dashboard();
    return App.page;
  }
}

class Dashboard {
  constructor() {
    this.state = {
      version: 0,
      today: new Date().toISOString().slice(0, 10),
      filters: { topics: [], countries: [], sentiments: [], publishers: [], dateFrom: "", dateTo: "" },
      releases: [],
      totalMatching: 0,
      freshness: null,
      lastError: null,
    };
  }

  // ── MCP access ────────────────────────────────────────────

  async loadData() {
    const [releases, status] = await Promise.all([
      Mcp.callTool("search_releases", {
        topic: this.state.filters.topics[0] || undefined,
        country: this.state.filters.countries[0] || undefined,
        sentiment: this.state.filters.sentiments[0] || undefined,
        publisher: this.state.filters.publishers[0] || undefined,
        date_from: this.state.filters.dateFrom || undefined,
        date_to: this.state.filters.dateTo || undefined,
        limit: 30,
      }),
      Mcp.callTool("get_pipeline_status", {}),
    ]);
    this.state.releases = releases.results || [];
    this.state.totalMatching = releases.total_matching ?? this.state.releases.length;
    this.state.freshness = status.pipelines || [];
    this.state.lastError = null;
    this.state.version += 1;
    this.render();
    return this.getState();
  }

  // ── Operations (shared by the visitor's clicks and the agent's actions) ──

  /**
   * Read the full page state as plain JSON.
   */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Set the visible filters and reload the release list.
   * Reversible: the visitor can click "Clear" and the agent can set them back.
   *
   * :param filters: {topic?, country?, sentiment?, publisher?, dateFrom?, dateTo?, clear?}
   * :return: {ok, reason?, field?, state}
   */
  async setFilters(filters) {
    if (!filters || typeof filters !== "object") {
      return { ok: false, reason: "filters must be an object", field: "filters" };
    }
    if (filters.clear) {
      this.state.filters = { topics: [], countries: [], sentiments: [], publishers: [], dateFrom: "", dateTo: "" };
    } else {
      const f = this.state.filters;
      if (filters.topic !== undefined) {
        if (filters.topic && !TOPICS.includes(filters.topic)) {
          return { ok: false, reason: `unknown topic: ${filters.topic}`, field: "topic" };
        }
        f.topics = filters.topic ? [filters.topic] : [];
      }
      if (filters.country !== undefined) {
        if (filters.country && !COUNTRIES.includes(filters.country)) {
          return { ok: false, reason: `unknown country: ${filters.country}`, field: "country" };
        }
        f.countries = filters.country ? [filters.country] : [];
      }
      if (filters.sentiment !== undefined) {
        if (filters.sentiment && !SENTIMENTS.includes(filters.sentiment)) {
          return { ok: false, reason: `unknown sentiment: ${filters.sentiment}`, field: "sentiment" };
        }
        f.sentiments = filters.sentiment ? [filters.sentiment] : [];
      }
      if (filters.publisher !== undefined) {
        if (filters.publisher && !Object.keys(PUBLISHERS).includes(filters.publisher)) {
          return { ok: false, reason: `unknown publisher: ${filters.publisher}`, field: "publisher" };
        }
        f.publishers = filters.publisher ? [filters.publisher] : [];
      }
      if (filters.dateFrom !== undefined) {
        if (filters.dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom)) {
          return { ok: false, reason: "dateFrom must be YYYY-MM-DD", field: "dateFrom" };
        }
        f.dateFrom = filters.dateFrom;
      }
      if (filters.dateTo !== undefined) {
        if (filters.dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo)) {
          return { ok: false, reason: "dateTo must be YYYY-MM-DD", field: "dateTo" };
        }
        f.dateTo = filters.dateTo;
      }
    }
    await this.loadData();
    return { ok: true, state: this.getState() };
  }

  // ── Rendering ─────────────────────────────────────────────

  render() {
    this.renderStats();
    this.renderFilters();
    this.renderReleases();
    this.renderFreshness();
  }

  renderStats() {
    const el = document.querySelector("#stats");
    if (!el) return;
    const f = this.state.filters;
    const active = f.topics.length + f.countries.length + f.sentiments.length
      + f.publishers.length + (f.dateFrom ? 1 : 0) + (f.dateTo ? 1 : 0);
    el.textContent = `${this.state.totalMatching} releases match`
      + (active ? ` — ${active} filter(s) active` : "");
  }

  renderFilters() {
    const f = this.state.filters;
    const setSelect = (id, value) => {
      const sel = document.querySelector(id);
      if (sel) sel.value = value || "";
    };
    setSelect("#f-topic", f.topics[0]);
    setSelect("#f-country", f.countries[0]);
    setSelect("#f-sentiment", f.sentiments[0]);
    setSelect("#f-publisher", f.publishers[0]);
    const from = document.querySelector("#f-from");
    const to = document.querySelector("#f-to");
    if (from) from.value = f.dateFrom;
    if (to) to.value = f.dateTo;
  }

  renderReleases() {
    const container = document.querySelector("#releases");
    if (!container) return;
    if (this.state.lastError) {
      container.innerHTML = `<p class="error">${this.state.lastError}</p>`;
      return;
    }
    if (!this.state.releases.length) {
      container.innerHTML = "<p>No releases match these filters.</p>";
      return;
    }
    const rows = this.state.releases.map((r) => {
      const date = (r.published || "").slice(0, 10);
      const agency = PUBLISHERS[r.publisher] || r.publisher || "?";
      const title = r.title_en || r.title || "(untitled)";
      const figs = r.key_figures ? `<span class="figs">${escapeHtml(r.key_figures)}</span>` : "";
      const sentiment = r.sentiment ? `<span class="sentiment sentiment-${r.sentiment}">${r.sentiment}</span>` : "";
      const topics = (r.topics || []).join(", ");
      return `<article class="release">
        <header>${escapeHtml(agency)} · <time>${escapeHtml(date)}</time> ${sentiment}</header>
        <h3><a href="${escapeHtml(r.url || "#")}" target="_blank" rel="noopener">${escapeHtml(title)}</a></h3>
        <p class="summary">${escapeHtml(r.summary_en || "")}</p>
        <p class="meta">${figs} ${topics ? `<span class="topics">${escapeHtml(topics)}</span>` : ""}</p>
      </article>`;
    });
    container.innerHTML = rows.join("");
  }

  renderFreshness() {
    const el = document.querySelector("#freshness");
    if (!el) return;
    const press = (this.state.freshness || []).find((p) => p.key === "press_releases")
      || (this.state.freshness || [])[0];
    if (press && press.last_run) {
      el.textContent = `Data updated ${String(press.last_run).slice(0, 16).replace("T", " ")} UTC`;
    } else {
      el.textContent = "";
    }
  }
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ── Static page wiring ──────────────────────────────────────

function fillSelect(id, values, label) {
  const sel = document.querySelector(id);
  if (!sel) return;
  sel.innerHTML = `<option value="">${label}</option>`
    + values.map((v) => `<option value="${v}">${v}</option>`).join("");
}

function wireControls(page) {
  const ids = ["#f-topic", "#f-country", "#f-sentiment", "#f-publisher", "#f-from", "#f-to"];
  const readFilters = () => ({
    topic: document.querySelector("#f-topic").value || null,
    country: document.querySelector("#f-country").value || null,
    sentiment: document.querySelector("#f-sentiment").value || null,
    publisher: document.querySelector("#f-publisher").value || null,
    dateFrom: document.querySelector("#f-from").value || null,
    dateTo: document.querySelector("#f-to").value || null,
    clear: !ids.some((id) => document.querySelector(id).value),
  });
  const apply = () => page.setFilters(readFilters());
  for (const id of ids) {
    document.querySelector(id)?.addEventListener("change", apply);
  }
  document.querySelector("#f-clear")?.addEventListener("click", () => page.setFilters({ clear: true }));
}

if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", async () => {
    const page = App.start();
    fillSelect("#f-topic", TOPICS, "All topics");
    fillSelect("#f-country", COUNTRIES, "All countries");
    fillSelect("#f-sentiment", SENTIMENTS, "All sentiments");
    fillSelect("#f-publisher", Object.keys(PUBLISHERS), "All agencies");
    wireControls(page);
    try {
      await Mcp.init();
      await page.loadData();
    } catch (error) {
      page.state.lastError = `Could not load data: ${error.message}`;
      page.render();
    }
  });
}
