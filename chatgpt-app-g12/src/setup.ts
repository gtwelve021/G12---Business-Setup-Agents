import { fetchWordPressDocument, searchWordPress } from "./wordpress.js";

export type SetupProfile = {
  activity: string;
  emirate?: string;
  route?: "mainland" | "free_zone" | "unsure";
  visas?: number;
  shareholders?: "individual" | "corporate" | "mixed";
  budgetAed?: number;
};

const locationNames: Record<string, RegExp> = {
  Dubai: /\bdubai\b/i,
  "Abu Dhabi": /\babu[ -]dhabi\b/i,
  Sharjah: /\bsharjah\b/i,
  Ajman: /\bajman\b/i,
  "Ras Al Khaimah": /\bras[ -]al[ -]khaimah\b|\brakez\b|\brak[ -]dao\b/i,
  Fujairah: /\bfujairah\b/i,
  "Umm Al Quwain": /\bumm[ -]al[ -]quwain\b|\buaq\b/i
};

export async function findSetupOptions(profile: SetupProfile) {
  const routes = profile.route && profile.route !== "unsure" ? [profile.route] : ["mainland", "free_zone"];
  const options = await Promise.all(routes.map(async route => {
    const term = route === "mainland" ? "mainland" : "free zone";
    const query = profile.emirate ? `${profile.emirate} ${term}` : term;
    try {
      const matches = await searchWordPress(query, 10, true);
      const results = matches.filter(result => {
        const label = `${result.title} ${result.url.split("/").filter(Boolean).slice(-1)[0]}`;
        const otherLocation = profile.emirate && Object.entries(locationNames).some(([name, pattern]) =>
          name !== profile.emirate && pattern.test(label)
        );
        return !otherLocation && /business setup|company (?:formation|setup)/i.test(result.title) &&
          (route === "mainland" ? /mainland/i.test(result.title) : /free[ -]?zone/i.test(result.title));
      }).slice(0, 5);
      return { route, query, status: results.length ? "found" : "no_matches", results };
    } catch {
      return { route, query, status: "temporarily_unavailable", results: [] };
    }
  }));
  const questions = [
    "Confirm the exact licensed activity and any external approvals with G12.",
    "Confirm where you will operate and serve customers before selecting a mainland or free-zone licence.",
    "Request an itemized quote including licence, registration, workspace, visas where needed, and renewal costs."
  ];
  if (!profile.emirate) questions.push("Which emirate would you prefer, or are you open to options?");
  if (profile.visas === undefined) questions.push("How many owner and employee visas do you need?");
  if (!profile.shareholders) questions.push("Will the shareholders be individuals, companies, or both?");
  const brief = [
    `Business activity: ${profile.activity}`,
    `Preferred emirate: ${profile.emirate || "Open / to confirm"}`,
    `Route to explore: ${profile.route || "unsure"}`,
    `Visas requested: ${profile.visas ?? "To confirm"}`,
    `Shareholders: ${profile.shareholders || "To confirm"}`,
    `Customer budget: ${profile.budgetAed === undefined ? "To confirm" : `AED ${profile.budgetAed} (customer input, not a quote)`}`
  ].join("\n");
  return {
    profile, options, questions, consultationBrief: brief,
    retrievedAt: new Date().toISOString(),
    guidance: "These are G12 setup pages matching a search query, not activity or emirate eligibility decisions or ranked recommendations. A page may mention an emirate without being located there; fetch selected pages and confirm the actual location before suggesting a match. Fetch selected pages before comparing facts. Do not infer activity eligibility, tax treatment, prices, visa quotas, bank approval or timelines. No contact details were requested or submitted. A consultation brief may be sent only through create_lead after explicit contact and storage consent."
  };
}

export async function getDocumentChecklist(id: string) {
  const doc = await fetchWordPressDocument(id);
  const sections = doc.documentSections || [];
  return {
    status: sections.length ? "source_found" : "needs_g12_confirmation",
    source: { id: doc.id, title: doc.title, url: doc.url, ...doc.metadata },
    sections,
    nextSteps: [
      "Confirm the selected licence, activity and shareholder type with G12 before treating this list as your final requirements.",
      "Keep all 'if applicable' and 'if required' conditions and individual/corporate shareholder headings when presenting this checklist.",
      "Prepare documents privately. Do not upload passport copies, Emirates IDs or bank records into this chat."
    ],
    guidance: sections.length
      ? "This checklist quotes document sections on the selected live G12 page. It is not an authority-verified or complete application checklist. Do not add requirements absent from these sections."
      : "No explicit document section was found. Do not invent a checklist. Open the source page or ask G12 to confirm the requirements."
  };
}
