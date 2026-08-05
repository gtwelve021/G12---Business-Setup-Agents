import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = process.env.G12_MCP_URL ?? "https://g12-business-setup-agents.vercel.app/mcp";
const client = new Client({ name: "g12-live-smoke-test", version: "1.0.0" });

try {
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));

  const listed = await client.listTools();
  assert.deepEqual(
    listed.tools.map((tool) => tool.name).sort(),
    ["create_lead", "fetch", "render_results", "search"]
  );

  const search = await client.callTool({
    name: "search",
    arguments: { query: "Dubai mainland company setup", limit: 3 }
  });
  assert.ok(Array.isArray(search.structuredContent?.results));
  assert.ok(search.structuredContent.results.length > 0);

  const first = search.structuredContent.results[0];
  const fetched = await client.callTool({ name: "fetch", arguments: { id: first.id } });
  assert.equal(fetched.structuredContent?.id, first.id);
  assert.ok(fetched.structuredContent?.text?.length > 0);

  const rendered = await client.callTool({
    name: "render_results",
    arguments: { results: search.structuredContent.results }
  });
  assert.equal(rendered.structuredContent?.results?.length, search.structuredContent.results.length);

  const rejectedLead = await client.callTool({
    name: "create_lead",
    arguments: {
      name: "Submission Test",
      message: "Please contact me about mainland company setup.",
      consent: true
    }
  });
  assert.equal(rejectedLead.structuredContent?.status, "failed");

  let submittedLead;
  if (process.env.G12_RUN_LIVE_LEAD === "1") {
    const testLeadArguments = {
      name: "Submission Test",
      email: "submission-test@example.com",
      service: "Dubai mainland company setup",
      preferredContact: "email",
      message: "Automated production readiness test for the G12 ChatGPT App review.",
      consent: true
    };
    const firstSubmission = await client.callTool({
      name: "create_lead",
      arguments: testLeadArguments
    });
    const repeatedSubmission = await client.callTool({
      name: "create_lead",
      arguments: testLeadArguments
    });
    assert.equal(firstSubmission.structuredContent?.status, "submitted");
    assert.equal(repeatedSubmission.structuredContent?.status, "submitted");
    assert.equal(firstSubmission.structuredContent?.leadId, repeatedSubmission.structuredContent?.leadId);
    assert.equal(repeatedSubmission.structuredContent?.duplicate, true);
    submittedLead = {
      leadId: firstSubmission.structuredContent.leadId,
      duplicateRetry: repeatedSubmission.structuredContent.duplicate
    };
  }

  console.log(JSON.stringify({
    ok: true,
    endpoint,
    tools: listed.tools.map((tool) => tool.name),
    searchResults: search.structuredContent.results.length,
    fetchedId: fetched.structuredContent.id,
    noContactStatus: rejectedLead.structuredContent.status,
    submittedLead
  }, null, 2));
} finally {
  await client.close().catch(() => {});
}
