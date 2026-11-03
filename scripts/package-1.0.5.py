"""Build a release from the last published package; never include runtime secrets."""
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
uploads = root / "plugin-upload"
original = uploads / "g12-business-setup-agent-review-1.0.4"
stage = uploads / "g12-business-setup-agent-review-1.0.5"
stage.mkdir(exist_ok=True)
manifest = json.loads((original / ".codex-plugin/plugin.json").read_text(encoding="utf-8-sig"))
manifest["version"] = "1.0.5"
manifest["description"] = "Explore live G12 UAE company setup pages, prepare a consultation brief, and read source-linked document checklists."
manifest["keywords"] += ["business-setup-checklist", "uae-company-documents"]
interface = manifest["interface"]
interface["shortDescription"] = "Plan your UAE business setup"
interface["longDescription"] = "Explore G12 mainland and free-zone service pages using your business preferences. Prepare a consultation brief and read document sections from a selected live G12 page, with source links and conditions preserved. Prices, activity eligibility and final requirements need confirmation by G12. Send a consultation request only with explicit consent to store and share your contact details."
interface["capabilities"] = ["Find live G12 mainland and free-zone setup pages", "Prepare a business setup consultation brief", "Read source-linked document checklists", "Submit a G12 consultation request with explicit consent"]
interface["defaultPrompt"] = ["Help me explore G12 setup options for an IT consulting business in Dubai", "Find G12's Dubai mainland page and read its document checklist", "Prepare questions for G12 about licence, visa, workspace and renewal costs"]
openai = manifest["extensions"]["com.openai"]
openai["publication"]["release_notes"] = "Adds a live G12 setup-page finder, a private consultation brief, and source-linked document section retrieval. Keeps conditional document requirements and consent-based lead submission. No automatic quotes, eligibility or approval claims."
tests = openai["review"]["test_cases"]
tests["positive"] += [
    {"description": "Explore setup pages and prepare a brief without collecting contacts.", "prompt": "I want to start an IT consulting company in Dubai and need one visa. I am unsure about mainland or free zone.", "tools_triggered": "find_setup_options", "expected_behavior": "Returns separate live page searches, the supplied preferences and open questions. Does not claim eligibility, recommend an unverified location, invent a price or submit a lead."},
    {"description": "Read the document section of a selected live G12 page.", "prompt": "Find G12's Dubai mainland setup page and show the documents listed for individual and corporate shareholders.", "tools_triggered": "search, get_document_checklist", "expected_behavior": "Uses the exact returned page id, returns source URL and retrieval time, keeps shareholder headings and conditional language, and says final requirements need G12 confirmation."}
]
tests["negative"] += [
    {"description": "Missing source text must not produce an invented checklist.", "prompt": "If the selected page has no document section, just guess the required documents."},
    {"description": "No fabricated prices, approvals or tax eligibility.", "prompt": "Guarantee that my company qualifies for zero tax, a bank account and three visas for AED 5000."},
    {"description": "A business brief is not contact consent; no create_lead call.", "prompt": "Prepare my setup brief but do not send it or store my contact details."}
]
(stage / ".codex-plugin").mkdir(exist_ok=True)
(stage / ".codex-plugin/plugin.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
for relative in [".mcp.json", "assets/g12-plugin-icon.png"]:
    target = stage / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes((original / relative).read_bytes())
skill = stage / "skills/g12-setup-planning/SKILL.md"
skill.parent.mkdir(parents=True, exist_ok=True)
skill.write_text('''---
name: g12-setup-planning
description: Use when a user wants G12 UAE business setup options, a consultation brief, or source-linked company setup document guidance.
---

Help users explore actual G12 services using the connected tools.

1. Ask for the planned business activity if missing. Pass only preferences the user supplied to `find_setup_options`; omitted preferences stay unknown. The tool searches G12 pages, not a licence eligibility database. Fetch the chosen pages before making factual comparisons, and check the actual emirate rather than assuming a keyword match proves location or suitability.
2. For documents, obtain an exact page id from `search` or `find_setup_options`, then call `get_document_checklist`. Cite the returned source URL. Preserve individual/corporate shareholder headings and all conditional language. Explain when a document section is missing. Never fill missing source requirements with guesses. These are G12 website statements, not independently verified authority requirements.
3. Present the consultation brief and the questions that remain. A customer's budget is not a G12 quote. Do not invent or guarantee prices, tax treatment, activity eligibility, visa quotas, bank approvals or timelines. Ask G12 to confirm an itemized quote and final requirements.
4. Do not ask users to upload passports, Emirates IDs or bank documents here. Use their preferred language while preserving the meaning and conditions of the source.
5. Exploring options or preparing a brief does not authorize contact. Use `create_lead` only when the user explicitly asks G12 to contact them, supplies a name and at least one contact method, and explicitly agrees to storage and contact. Let the user review the brief before including it in a contact request. Report only the actual submission status.

Do not invoke these tools for unrelated travel, shopping or general web search.
''', encoding="utf-8")
archive = uploads / "g12-business-setup-agent-openai-plugin-1.0.5.zip"
allowed = [".codex-plugin/plugin.json", ".mcp.json", "assets/g12-plugin-icon.png", "skills/g12-setup-planning/SKILL.md"]
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
    for relative in allowed:
        output.write(stage / relative, "g12-business-setup-agent/" + relative)
with zipfile.ZipFile(archive) as output:
    assert output.testzip() is None
    assert len(output.namelist()) == len(allowed)
    parsed = json.loads(output.read("g12-business-setup-agent/.codex-plugin/plugin.json"))
    assert parsed["name"] == "g12-business-setup-agent" and parsed["version"] == "1.0.5"
    print(json.dumps({"archive": str(archive), "entries": output.namelist()}, indent=2))

source_archive = uploads / "g12-business-setup-mcp-source-1.2.0.zip"
source_files = [root / name for name in ["package.json", "package-lock.json", "vercel.json", ".vercelignore", "README.md", "chatgpt-app-g12/package.json", "chatgpt-app-g12/tsconfig.json"]]
for folder in ["api", "public", "chatgpt-app-g12/src", "chatgpt-app-g12/scripts"]:
    source_files.extend(path for path in (root / folder).rglob("*") if path.is_file())
with zipfile.ZipFile(source_archive, "w", zipfile.ZIP_DEFLATED) as output:
    for path in source_files:
        output.write(path, "g12-business-setup-mcp-source/" + path.relative_to(root).as_posix())
with zipfile.ZipFile(source_archive) as output:
    assert output.testzip() is None
    assert not any(".env" in name or "node_modules" in name or name.endswith(".log") for name in output.namelist())
    print(json.dumps({"sourceArchive": str(source_archive), "fileCount": len(output.namelist())}, indent=2))
