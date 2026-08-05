import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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
  metadata: z.record(z.string(), z.string()).optional()
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
    version: "1.1.0"
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
        "Use this when the user asks about UAE business setup, mainland, free zone, offshore, visas, corporate tax, or related G12 services.",
      inputSchema: {
        query: z.string().min(2).describe("Search phrase, for example 'Dubai mainland company setup'."),
        limit: z.number().int().min(1).max(10).optional()
      },
      outputSchema: searchOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
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
        openWorldHint: false,
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
            text: `${doc.title}\n${doc.url}\n\n${doc.text}`
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
