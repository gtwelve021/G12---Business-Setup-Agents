import "dotenv/config";
import express from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createG12Server } from "./app.js";

const port = Number(process.env.PORT || 2091);
const app = express();

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

app.post("/mcp", async (req, res, next) => {
  const server = createG12Server();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    next(error);
  }
});

app.get("/mcp", async (req, res) => {
  const accept = String(req.headers.accept || "");
  if (accept.includes("text/html")) {
    renderBrowserStatus(res);
    return;
  }
  res.setHeader("Allow", "POST, OPTIONS");
  res.status(405).send("Method Not Allowed");
});

app.delete("/mcp", (_req, res) => {
  res.setHeader("Allow", "POST, OPTIONS");
  res.status(405).send("Method Not Allowed");
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("MCP request failed", error);
  if (!res.headersSent) {
    res.status(500).json({
      jsonrpc: "2.0",
      error: { code: -32603, message: "Internal server error" },
      id: null
    });
  }
});

app.listen(port, () => {
  console.log(`G12 ChatGPT app MCP server listening on http://127.0.0.1:${port}/mcp`);
});
