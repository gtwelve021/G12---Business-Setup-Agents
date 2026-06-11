import "dotenv/config";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createG12Server } from "./app.js";

const port = Number(process.env.PORT || 2091);
const app = express();
const transports: Record<string, StreamableHTTPServerTransport> = {};

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "g12-business-setup" });
});

function renderBrowserStatus(res: express.Response) {
  res
    .status(200)
    .type("html")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>G12 ChatGPT App</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        color: #172033;
        background: #f7f8fb;
      }
      main {
        max-width: 720px;
        margin: 48px auto;
        padding: 24px;
        background: #fff;
        border: 1px solid #dfe3eb;
        border-radius: 8px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 24px;
      }
      code {
        background: #eef1f6;
        border-radius: 4px;
        padding: 2px 5px;
      }
      .ok {
        color: #087443;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>G12 ChatGPT App MCP server</h1>
      <p class="ok">Server is running.</p>
      <p>This endpoint is for ChatGPT/MCP clients, not direct browser use.</p>
      <p>Use this URL in ChatGPT connector settings:</p>
      <p><code>http://127.0.0.1:${port}/mcp</code></p>
      <p>For public testing, run <code>ngrok http ${port}</code> and use the ngrok URL ending in <code>/mcp</code>.</p>
    </main>
  </body>
</html>`);
}

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport = sessionId ? transports[sessionId] : undefined;

  if (!transport && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        if (transport) {
          transports[newSessionId] = transport;
        }
      }
    });

    transport.onclose = () => {
      if (transport?.sessionId) {
        delete transports[transport.sessionId];
      }
    };

    const server = createG12Server();
    await server.connect(transport);
  }

  if (!transport) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: missing valid MCP session id"
      },
      id: null
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = sessionId ? transports[sessionId] : undefined;

  if (!transport) {
    const accept = String(req.headers.accept || "");
    if (accept.includes("text/html")) {
      renderBrowserStatus(res);
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: missing valid MCP session id"
      },
      id: null
    });
    return;
  }

  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = sessionId ? transports[sessionId] : undefined;

  if (!transport) {
    res.status(400).send("Missing valid MCP session id");
    return;
  }

  await transport.handleRequest(req, res);
});

app.listen(port, () => {
  console.log(`G12 ChatGPT app MCP server listening on http://127.0.0.1:${port}/mcp`);
});
