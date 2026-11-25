// Registers this website's operations with the agent runtime.
// agent-manifest.json loads this module through "actions.module". Only the names in
// "actions.agentTools" become model tools, called website_<name>.
import { App } from "./script.js";

class SiteActions {
  static registerActions(actions) {
    actions.register(SiteActions.readStateAction());
    actions.register(SiteActions.filterAction());
  }

  /**
   * Read action: the page's filters, the visible releases and the data freshness.
   */
  static readStateAction() {
    return {
      name: "get_site_state",
      description: "Read the page's current filters, the releases currently shown (publisher, date, title, sentiment, key figures, url for each) and the data freshness. Call it before answering about what the page shows or before changing filters, and again in each turn that needs it: the visitor can also use the page.",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: SiteActions.readState,
    };
  }

  static readState() {
    return App.page.getState();
  }

  /**
   * Write action: set the page's visible filters (the same controls the visitor can
   * click). Fully reversible via clear: true.
   */
  static filterAction() {
    return {
      name: "filter_releases",
      description: "Set the page's visible release filters and reload the list. Call it only when the visitor asks to show or filter releases on the page. Pass only the dimensions to change; pass clear: true to reset all filters. Returns the updated state with the new release list, or ok false with a reason. Does not place anything or contact anyone.",
      // Reversible: the visitor (or the agent) can reset the filters on the page.
      effect: "write",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          topic: {
            type: "string",
            enum: [
              "Consumer prices", "Producer prices", "Import prices", "Export prices",
              "GDP", "Industrial production", "Services production", "International trade",
              "Labour market", "Public finance", "Retail trade", "Construction",
              "Business surveys", "Other economic topics", "Non-economic topics",
            ],
            description: "Topic tag the shown releases must include. Omit to leave unchanged.",
          },
          country: {
            type: "string",
            enum: ["Euro area", "Italy", "Spain", "France", "Germany", "Ireland", "Other"],
            description: "Geographic scope of the shown releases. Omit to leave unchanged.",
          },
          sentiment: {
            type: "string",
            enum: ["positive", "negative", "neutral"],
            description: "Tone the shown releases convey. Omit to leave unchanged.",
          },
          publisher: {
            type: "string",
            enum: ["eurostat", "istat", "ine", "insee", "destatis", "cso", "dgecofin"],
            description: "Publishing agency slug. Omit to leave unchanged.",
          },
          dateFrom: {
            type: "string",
            description: "Only show releases published on or after this date, as YYYY-MM-DD. Omit to leave unchanged.",
          },
          dateTo: {
            type: "string",
            description: "Only show releases published up to this date, as YYYY-MM-DD. Omit to leave unchanged.",
          },
          clear: {
            type: "boolean",
            description: "True resets every filter to 'all'. Other fields are ignored when true.",
          },
        },
      },
      execute: SiteActions.setFilters,
    };
  }

  static async setFilters(args) {
    return App.page.setFilters(args);
  }
}

export const registerActions = SiteActions.registerActions;
