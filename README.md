# G12 Business Setup Agents

ChatGPT App MCP server for finding G12 UAE business-setup services and, only
after explicit user consent, submitting a contact request to G12.

## Project layout

- `chatgpt-app-g12/` - TypeScript MCP server and ChatGPT widget.
- `api/mcp.ts` - Vercel serverless MCP endpoint.
- `wordpress-plugin/g12-chatgpt-bridge/` - authenticated WordPress lead bridge.
- `chatgpt-app-submission.json` - review metadata and positive/negative test cases.

## Verification

```powershell
cd chatgpt-app-g12
npm ci
npm run typecheck
npm run test:mcp
npm run test:setup
```

Configure `G12_WORDPRESS_BASE_URL`, `G12_LEAD_ENDPOINT`, and
`G12_LEAD_SECRET` in the deployment environment. Keep `.env` local and never
commit it.

## Setup planning update

Server 1.2.0 adds `find_setup_options` and `get_document_checklist` alongside
the original four tools. The finder searches live service pages, keeps the
customer's preferences in a consultation brief, excludes clearly unrelated
services and other emirates named in page titles, and lists unresolved questions.
It does not assess activity eligibility or calculate quotes. The checklist reads
explicit document sections from a selected WordPress page; it keeps conditional
wording and shareholder headings and reports when no source section is found.
Website claims are not independently verified authority requirements.

Customer OAuth login is not part of this update. Choosing the customer account
system and configuring an authorization service remain separate work.

`public/chatgpt.html` introduces the existing public plugin. Its message builder
runs entirely in the browser and does not submit a lead. There are no tracking
scripts. Publication on a preview host is not evidence of Google indexing or
of installation on the main G12 website.

Build the next plugin ZIP and a sanitized server-source ZIP with:

```powershell
python scripts/package-1.0.5.py
```

The plugin ZIP preserves the published `g12-business-setup-agent` identity and
the `https://agent.g12.ae/mcp` endpoint. The ZIP alone does not deploy server
code. Deploy server 1.2.0 to the existing production project before submitting
plugin 1.0.5, reconnect/rescan its MCP tools in the portal, then verify the
published plugin in ChatGPT. Do not use the older source snapshot ZIP for this
release. Keep the currently published version available until the update is ready.

Implementation follows [OpenAI tool planning](https://developers.openai.com/plugins/plan/tools)
and [metadata guidance](https://developers.openai.com/plugins/guides/optimize-metadata).
