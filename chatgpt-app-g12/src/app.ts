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
const TEMPLATE_URI = "ui://g12/results.html";

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

export function createG12Server() {
  const server = new McpServer({
    name: "g12-business-setup",
    version: "0.1.0"
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
            csp: {
              connectDomains: ["https://g12.ae"],
              resourceDomains: ["https://g12.ae"]
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
        openWorldHint: true
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
        openWorldHint: true
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
        readOnlyHint: true
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
        "Use this when the user asks G12 to contact them about company formation, visas, corporate services, or consultation.",
      inputSchema: {
        name: z.string().min(2),
        email: z.string().email().optional(),
        phone: z.string().min(5).optional(),
        service: z.string().optional(),
        message: z.string().min(10),
        preferredContact: z.enum(["phone", "email", "whatsapp"]).optional()
      },
      outputSchema: {
        status: z.enum(["submitted", "failed", "not_configured"]),
        message: z.string(),
        details: z.string().optional()
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true
      },
      _meta: {
        "openai/toolInvocation/invoking": "Sending request to G12...",
        "openai/toolInvocation/invoked": "Request handled."
      }
    },
    async (input) => {
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
