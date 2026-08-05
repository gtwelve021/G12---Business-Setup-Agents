# G12 ChatGPT App

This is a ChatGPT Apps SDK MCP server for `g12.ae`.

The production endpoint uses stateless Streamable HTTP so requests remain reliable across serverless instances. The results widget consumes the standard MCP Apps `ui/notifications/tool-result` bridge and retains `window.openai` only as a ChatGPT compatibility fallback.

It exposes:

- `search` - search public G12 WordPress content.
- `fetch` - fetch full page/post text by result id.
- `render_results` - show search results in a ChatGPT widget.
- `create_lead` - forward a consultation lead to WordPress or another webhook.

## Local setup

```powershell
cd chatgpt-app-g12
copy .env.example .env
npm install
npm run build
npm run test:mcp
npm start
```

The MCP endpoint is:

```text
http://127.0.0.1:2091/mcp
```

For ChatGPT local testing, expose it with a tunnel:

```powershell
ngrok http 2091
```

Then connect the tunnel URL ending in `/mcp` from ChatGPT developer settings.

## WordPress lead bridge

The app can search public WordPress content without extra WordPress code.

To enable lead capture:

1. Install and activate `Wordpress/wp-content/plugins/g12-chatgpt-bridge`.
2. In WordPress admin, set the bridge secret.
3. Set these app env vars:

```env
G12_LEAD_ENDPOINT=https://g12.ae/wp-json/g12-chatgpt/v1/leads
G12_LEAD_SECRET=the-same-secret-from-wordpress
```

Restart the MCP server after changing `.env`.

Lead submission requires an explicit user request for contact, at least one contact method, and consent to store the details. Identical retries reuse the same WordPress lead instead of creating duplicate posts or emails.
