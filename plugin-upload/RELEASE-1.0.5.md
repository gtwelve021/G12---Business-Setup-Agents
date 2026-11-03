# G12 Business Setup 1.0.5 — prepared 3 November 2026

Server version: 1.2.0. Plugin identity and production MCP endpoint are preserved.

## Delivered

- `find_setup_options`: live G12 service-page search using supplied emirate and route preferences, an activity/visa/shareholder/budget brief, and questions for G12. It excludes unrelated service titles and pages explicitly naming another emirate. Search matches are not verified activity or location eligibility.
- `get_document_checklist`: extracts explicit document sections from the selected live WordPress page, keeps source URL, retrieval timestamp, shareholder headings and conditions. Missing or unavailable sections never produce guessed requirements.
- Existing search, fetch, visual results and consent-based contact tools remain available. Source-reading descriptions now distinguish G12 website statements from independent authority verification.
- Introduction page at `/chatgpt.html` with title/description metadata, install link, examples, FAQs and a browser-only message builder. No analytics, contact submission or storage is added to that page.
- Plugin 1.0.5 archive with updated discovery copy, example prompts, workflow skill and review cases. Compatible dependency updates produce a clean npm audit.

## Verification

- `npm --prefix chatgpt-app-g12 run test:mcp`: passed against a local MCP server using real G12 website responses. Six tools discovered; mainland/free-zone searches returned actual service pages; Dubai mainland checklist returned a source section; missing contact and false consent were rejected. No valid lead was submitted.
- `node chatgpt-app-g12/scripts/setup-tests.mjs`: passed. Covers split Elementor headings, source section boundaries, conditional text, unrelated service filtering, zero visas, missing sections, offline behavior, invalid IDs and read-only requests.
- `npm audit --omit=dev`: zero known vulnerabilities after compatible updates. Full install audit also reported zero.
- Introduction page: inspected locally in a real browser at 390px mobile and 1440px desktop. Message generation and clipboard copy worked; mobile had no horizontal overflow. Screenshots are in `E:/Project/G12/OPENAI/output/playwright/`.
- Plugin and server-source ZIPs: inspected for expected archive roots and entries; ZIP integrity checks passed; source archive excludes environment files, dependencies and logs.
- Vercel preview deployment `dpl_14VsWGSdMUjckXPfUamzfPax6B8i`: READY; final build emitted no TypeScript errors. Hosted runtime was not tested. Preview may require the owner's Vercel sign-in.

Preview introduction: https://g12-business-setup-agents-cjtuaksy5-g12s-projects.vercel.app/chatgpt.html

## Remaining public release steps

The public plugin has not been updated by this work. Deploy this server source to the existing production Vercel project, verify the production MCP endpoint, upload `g12-business-setup-agent-openai-plugin-1.0.5.zip` to the same OpenAI plugin, reconnect/rescan tools, complete the review process and verify the published workflow in ChatGPT. The ZIP alone does not deploy the new tools.

The introduction page has not been installed on g12.ae. No search-engine indexing, directory ranking, new customer usage or successful contact delivery is claimed. Confirm prices and any regulated requirements with G12 before adding a calculator or definitive eligibility feature.

Existing user changes to verification files, `.gitignore`, and the WordPress lead bridge were preserved and excluded from the feature commit. Git history records the GitHub update separately from the initial preview preparation.

Customer OAuth login is not implemented in this release. The choice between existing G12 accounts and a new email-code login remains pending; the package does not claim authenticated customer access.

## Design sources

- https://developers.openai.com/plugins/plan/tools
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/guides/optimize-metadata
