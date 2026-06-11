import "dotenv/config";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createG12Server } from "../src/app.js";

const transports: Record<string, StreamableHTTPServerTransport> = {};

function renderBrowserStatus(res: any) {
  res
    .status(200)
    .setHeader("content-type", "text/html")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>G12 ChatGPT App</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; color: #172033; background: #f7f8fb; }
      main { max-width: 720px; margin: 48px auto; padding: 24px; background: #fff; border: 1px solid #dfe3eb; border-radius: 8px; }
      h1 { margin: 0 0 12px; font-size: 24px; }
      code { background: #eef1f6; border-radius: 4px; padding: 2px 5px; }
      .ok { color: #087443; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>G12 ChatGPT App MCP server</h1>
      <p class="ok">Serverless handler is available.</p>
      <p>This endpoint is for ChatGPT/MCP clients, not direct browser use.</p>
      <p>Use this URL in ChatGPT connector settings (with a valid session id):</p>
      <p><code>/mcp</code></p>
    </main>
  </body>
</html>`);
}

export default async function handler(req: any, res: any) {
  const method = String(req.method || "").toUpperCase();
  // Allow CORS preflight
  if (method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id");
    res.status(204).end();
    return;
  }

  const sessionId = String(req.headers["mcp-session-id"] || req.headers["mcp-session-id" as any]);
  let transport = sessionId ? transports[sessionId] : undefined;

  if (method === "POST") {
    // body may be parsed by the platform
    const body = req.body;

    if (!transport && isInitializeRequest(body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          if (transport) transports[newSessionId] = transport;
        }
      });

      transport.onclose = () => {
        if (transport?.sessionId) delete transports[transport.sessionId];
      };

      const server = createG12Server();
      await server.connect(transport);
    }

    if (!transport) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: missing valid MCP session id" },
        id: null
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
    return;
  }

  if (method === "GET") {
    if (!transport) {
      const accept = String(req.headers.accept || "");
      if (accept.includes("text/html")) {
        renderBrowserStatus(res);
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: missing valid MCP session id" },
        id: null
      });
      return;
    }

    await transport.handleRequest(req, res);
    return;
  }

  if (method === "DELETE") {
    if (!transport) {
      res.status(400).send("Missing valid MCP session id");
      return;
    }

    await transport.handleRequest(req, res);
    return;
  }

  res.status(405).send("Method Not Allowed");
}
