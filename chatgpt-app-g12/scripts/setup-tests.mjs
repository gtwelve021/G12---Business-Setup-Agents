import assert from "node:assert/strict";
import { extractDocumentSections, fetchWordPressDocument } from "../dist/wordpress.js";
import { findSetupOptions, getDocumentChecklist } from "../dist/setup.js";

const html = '<h2>Documents Required for</h2><div></div><h2>Dubai Mainland Business Setup</h2><h3>For Individual Shareholders</h3><ul><li>Passport copy</li><li>NOC, if required</li></ul><h3>For Corporate Shareholders</h3><p>Board resolution</p><h2>Pricing</h2><p>AED 999</p>';
const sections = extractDocumentSections(html);
assert.equal(sections.length, 1);
assert.match(sections[0].heading, /Dubai Mainland/);
assert.deepEqual(sections[0].items, ['For Individual Shareholders', 'Passport copy', 'NOC, if required', 'For Corporate Shareholders', 'Board resolution']);
assert.deepEqual(extractDocumentSections('<h2>Welcome</h2><p>No checklist here</p>'), []);

const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), method: options?.method || 'GET' });
  if (String(url).includes('/search?')) return Response.json([{ id: 14102, title: 'Business Setup in Dubai Mainland', url: 'https://g12.ae/business-setup-in-dubai-mainland/', subtype: 'page' }, { id: 2, title: 'Dubai Golden Visa', url: 'https://g12.ae/golden-visa-dubai/', subtype: 'page' }]);
  return Response.json({ id: 14102, title: { rendered: 'Dubai Mainland' }, content: { rendered: html }, link: 'https://g12.ae/business-setup-in-dubai-mainland/', modified_gmt: '2026-10-01T00:00:00' });
};
try {
  const plan = await findSetupOptions({ activity: 'IT consulting', route: 'unsure', visas: 0, budgetAed: 15000 });
  assert.equal(plan.options.length, 2);
  assert.equal(plan.options[0].results.length, 1, 'Unrelated visa and tax pages must not be setup options');
  assert.equal(plan.options[1].results.length, 0, 'Mainland pages must not be free-zone options');
  assert.equal(plan.profile.visas, 0);
  assert.match(plan.consultationBrief, /customer input, not a quote/);
  assert.ok(calls.every(call => call.url.includes('subtype=page')));
  const checklist = await getDocumentChecklist('page:14102');
  assert.equal(checklist.status, 'source_found');
  assert.ok(checklist.sections[0].items.includes('NOC, if required'));
  assert.ok(checklist.source.retrievedAt);
  await assert.rejects(fetchWordPressDocument('users:1'));
  await assert.rejects(fetchWordPressDocument('page:12garbage'));
  assert.ok(calls.every(call => call.method === 'GET'), 'Read-only setup tools must never submit a lead');

  globalThis.fetch = async () => Response.json({ id: 1, title: { rendered: 'No documents' }, content: { rendered: '<p>Welcome</p>' }, link: 'https://g12.ae/' });
  assert.equal((await getDocumentChecklist('page:1')).status, 'needs_g12_confirmation');
  globalThis.fetch = async () => { throw new Error('offline'); };
  const offline = await findSetupOptions({ activity: 'Trading', route: 'mainland' });
  assert.equal(offline.options[0].status, 'temporarily_unavailable');
  assert.deepEqual(offline.options[0].results, []);
  console.log('Setup checks passed: source boundaries, split headings, conditions, missing sources, offline behavior, read-only requests and invalid IDs.');
} finally {
  globalThis.fetch = originalFetch;
}
