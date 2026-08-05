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
```

Configure `G12_WORDPRESS_BASE_URL`, `G12_LEAD_ENDPOINT`, and
`G12_LEAD_SECRET` in the deployment environment. Keep `.env` local and never
commit it.
