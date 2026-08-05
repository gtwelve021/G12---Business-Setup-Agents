import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const port = 2092;
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["dist/server.js"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become healthy. ${stderr}`);
}

const client = new Client({ name: "g12-smoke-test", version: "1.0.0" });

try {
  await waitForHealth();
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
  await client.connect(transport);

  const listed = await client.listTools();
  assert.deepEqual(
    listed.tools.map((tool) => tool.name).sort(),
    ["create_lead", "fetch", "render_results", "search"]
  );
  const byName = Object.fromEntries(listed.tools.map((tool) => [tool.name, tool]));
  assert.deepEqual(byName.search.annotations, {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false
  });
  assert.equal(byName.create_lead.annotations.readOnlyHint, false);
  assert.equal(byName.create_lead.annotations.openWorldHint, true);
  assert.equal(byName.create_lead.annotations.destructiveHint, true);

  const search = await client.callTool({
    name: "search",
    arguments: { query: "Dubai mainland company setup", limit: 3 }
  });
  const searchContent = search.structuredContent;
  assert.ok(searchContent && Array.isArray(searchContent.results));
  assert.ok(searchContent.results.length > 0, "Expected at least one live G12 search result");

  const fetched = await client.callTool({
    name: "fetch",
    arguments: { id: searchContent.results[0].id }
  });
  assert.equal(fetched.structuredContent.id, searchContent.results[0].id);
  assert.ok(fetched.structuredContent.text.length > 0);

  const render = await client.callTool({
    name: "render_results",
    arguments: { results: searchContent.results }
  });
  assert.equal(render.structuredContent.results.length, searchContent.results.length);

  const noContact = await client.callTool({
    name: "create_lead",
    arguments: {
      name: "Submission Test",
      message: "Please contact me about mainland company setup.",
      consent: true
    }
  });
  assert.equal(noContact.structuredContent.status, "failed");
  assert.match(noContact.structuredContent.message, /contact method/i);

  console.log(JSON.stringify({
    ok: true,
    tools: listed.tools.map((tool) => tool.name),
    searchResults: searchContent.results.length,
    fetchedId: fetched.structuredContent.id,
    renderResults: render.structuredContent.results.length,
    noContactStatus: noContact.structuredContent.status
  }, null, 2));
} finally {
  await client.close().catch(() => {});
  child.kill();
}
