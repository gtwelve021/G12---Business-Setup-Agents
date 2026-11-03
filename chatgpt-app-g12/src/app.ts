import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findSetupOptions, getDocumentChecklist } from "./setup.js";
import {
  fetchWordPressDocument,
  searchWordPress,
  submitLead
} from "./wordpress.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_URI = "ui://g12/results-v2.html";

const searchOutputSchema = {
  results: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string().url(),
      type: z.string(),
      excerpt: z.string().optional()
    })
  )
};

const fetchOutputSchema = {
  id: z.string(),
  title: z.string(),
  text: z.string(),
  url: z.string().url(),
  metadata: z.record(z.string(), z.string()).optional(),
  documentSections: z.array(z.object({ heading: z.string(), items: z.array(z.string()) })).optional()
};

const leadOutputSchema = {
  status: z.enum(["submitted", "failed", "not_configured"]),
  message: z.string(),
  leadId: z.string().optional(),
  duplicate: z.boolean().optional()
};

export function createG12Server() {
  const server = new McpServer({
    name: "g12-business-setup",
    version: "1.2.0"
  });

  const widgetHtml = readFileSync(join(__dirname, "widget.html"), "utf8");

  server.registerResource("g12-results-widget", TEMPLATE_URI, {}, async () => ({
    contents: [
      {
        uri: TEMPLATE_URI,
        mimeType: "text/html;profile=mcp-app",
        text: widgetHtml,
        _meta: {
          ui: {
            prefersBorder: true,
            domain: "https://g12-business-setup-agents.vercel.app",
            csp: {
              connectDomains: [],
              resourceDomains: []
            }
          },
          "openai/widgetDescription":
            "Shows G12 business setup pages and lets users open selected pages."
        }
      }
    ]
  }));

  server.registerTool(
    "search",
    {
      title: "Search G12 website",
      description:
        "Use this when the user wants public G12 service pages about UAE company formation, Dubai mainland, free-zone setup, visas, or related corporate services. This is G12 website search, not a government or legal verification tool. Use find_setup_options for a business setup brief; do not use for unrelated travel or general web search.",
      inputSchema: {
        query: z.string().min(2).describe("Search phrase, for example 'Dubai mainland company setup'."),
        limit: z.number().int().min(1).max(10).optional()
      },
      outputSchema: searchOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
        destructiveHint: false
      },
      _meta: {
        "openai/toolInvocation/invoking": "Searching G12...",
        "openai/toolInvocation/invoked": "Search complete."
      }
    },
    async ({ query, limit }) => {
      const results = await searchWordPress(query, limit ?? 8);
      return {
        structuredContent: { results },
        content: [
          {
            type: "text",
            text: results.length
              ? `Found ${results.length} G12 result(s).`
              : "No matching G12 pages were found."
          }
        ]
      };
    }
  );

  server.registerTool(
    "fetch",
    {
      title: "Fetch G12 page",
      description:
        "Use this when the user needs details from a specific G12 search result. Pass the id returned by search.",
      inputSchema: {
        id: z.string().describe("A result id returned by search, such as page:123 or post:456.")
      },
      outputSchema: fetchOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
        destructiveHint: false
      },
      _meta: {
        "openai/toolInvocation/invoking": "Opening G12 page...",
        "openai/toolInvocation/invoked": "Page loaded."
      }
    },
    async ({ id }) => {
      const doc = await fetchWordPressDocument(id);
      return {
        structuredContent: doc,
        content: [
          {
            type: "text",
            text: `${doc.title}\n${doc.url}\n\n${doc.text}\n\nSource: G12 website, not independent authority verification. Confirm current pricing, tax treatment and eligibility before relying on website claims.`
          }
        ]
      };
    }
  );

  server.registerTool(
    "render_results",
    {
      title: "Show G12 results",
      description:
        "Use this after search when a visual list of G12 website results would help the user choose a service page.",
      inputSchema: searchOutputSchema,
      outputSchema: searchOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      },
      _meta: {
        ui: { resourceUri: TEMPLATE_URI },
        "openai/outputTemplate": TEMPLATE_URI,
        "openai/toolInvocation/invoking": "Preparing results...",
        "openai/toolInvocation/invoked": "Results ready."
      }
    },
    async ({ results }) => ({
      structuredContent: { results },
      content: [
        {
          type: "text",
          text: `Showing ${results.length} G12 result(s).`
        }
      ]
    })
  );

  server.registerTool("find_setup_options", {
    title: "Find G12 setup options",
    description: "Use this when the user wants to start a UAE company, explore mainland versus free zone, or prepare a business setup consultation brief. Ask for their business activity first; include only preferences they actually provided. Searches live G12 pages. Does not determine legal eligibility, calculate prices, collect contact details or submit a lead.",
    inputSchema: {
      activity: z.string().trim().min(2).max(300).describe("Business activity in the user's words, e.g. IT consulting or clothing trading. Do not guess a licence code."),
      emirate: z.enum(["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"]).optional(),
      route: z.enum(["mainland", "free_zone", "unsure"]).optional(),
      visas: z.number().int().min(0).max(10000).optional().describe("User's requested number of visas, not an approved quota."),
      shareholders: z.enum(["individual", "corporate", "mixed"]).optional(),
      budgetAed: z.number().positive().max(1000000000).optional().describe("User's stated budget, not an estimate or G12 quote.")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
  }, async input => {
    const result = await findSetupOptions(input);
    return { structuredContent: result, content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  server.registerTool("get_document_checklist", {
    title: "Read source-linked document checklist",
    description: "Use this when the user asks what documents to prepare for a selected G12 setup page. First obtain an exact page id from search or find_setup_options. Returns only explicit document sections from that live page, or clearly reports that G12 confirmation is needed. Preserve conditional language and shareholder headings. Do not request document uploads or treat this as legal verification.",
    inputSchema: { id: z.string().regex(/^(?:page|post|lp):[1-9]\d*$/).describe("Exact id returned by G12 search; never invent a page id.") },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
  }, async ({ id }) => {
    try {
      const result = await getDocumentChecklist(id);
      return { structuredContent: result, content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch {
      return { isError: true, content: [{ type: "text", text: "The G12 source page could not be retrieved. No checklist was generated. Try again or ask G12 to confirm the requirements." }] };
    }
  });

  server.registerTool(
    "create_lead",
    {
      title: "Create G12 lead",
      description:
        "Use this only after the user explicitly asks G12 to contact them, provides a name and at least one contact method, and confirms that G12 may store their details and contact them.",
      inputSchema: {
        name: z.string().min(2),
        email: z.string().email().optional(),
        phone: z.string().min(5).optional(),
        service: z.string().optional(),
        message: z.string().min(10),
        preferredContact: z.enum(["phone", "email", "whatsapp"]).optional(),
        consent: z.literal(true).describe("Must be true only after the user explicitly agrees to lead storage and contact by G12.")
      },
      outputSchema: leadOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: true
      },
      _meta: {
        "openai/toolInvocation/invoking": "Sending request to G12...",
        "openai/toolInvocation/invoked": "Request handled."
      }
    },
    async (input) => {
      if (!input.email && !input.phone) {
        const result = {
          status: "failed" as const,
          message: "Provide at least one contact method: email or phone. No lead was submitted."
        };
        return {
          structuredContent: result,
          content: [{ type: "text", text: result.message }]
        };
      }

      const result = await submitLead(input);
      return {
        structuredContent: result,
        content: [
          {
            type: "text",
            text: result.message
          }
        ]
      };
    }
  );

  return server;
}
