import "dotenv/config";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createG12Server } from "../chatgpt-app-g12/src/app.js";

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

  if (method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Protocol-Version");
    res.status(204).end();
    return;
  }

  if (method === "POST") {
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
      console.error("MCP request failed", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null
        });
      }
    }
    return;
  }

  if (method === "GET") {
    const accept = String(req.headers.accept || "");
    if (accept.includes("text/html")) {
      renderBrowserStatus(res);
      return;
    }
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(405).send("Method Not Allowed");
    return;
  }

  if (method === "DELETE") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(405).send("Method Not Allowed");
    return;
  }

  res.status(405).send("Method Not Allowed");
}
