import { createHash } from "node:crypto";

export type SearchResult = {
  id: string;
  title: string;
  url: string;
  type: string;
  excerpt?: string;
};

export type DocumentResult = {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata?: Record<string, string>;
};

const DEFAULT_BASE_URL = "https://g12.ae";

function getBaseUrl() {
  return (process.env.G12_WORDPRESS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function stripHtml(value: unknown) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function endpointForSubtype(subtype: string) {
  if (subtype === "page") return "pages";
  if (subtype === "post") return "posts";
  return subtype;
}

async function wpFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    headers: {
      accept: "application/json",
      "user-agent": "G12-ChatGPT-App/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`WordPress request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function searchWordPress(query: string, limit = 8): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    search: query,
    per_page: String(Math.min(Math.max(limit, 1), 10))
  });

  type WpSearchItem = {
    id: number;
    title?: string;
    url?: string;
    type?: string;
    subtype?: string;
  };

  const items = await wpFetch<WpSearchItem[]>(`/wp-json/wp/v2/search?${params}`);

  return items.map((item) => {
    const subtype = item.subtype || item.type || "post";
    return {
      id: `${subtype}:${item.id}`,
      title: stripHtml(item.title) || "Untitled",
      url: item.url || getBaseUrl(),
      type: subtype
    };
  });
}

export async function fetchWordPressDocument(id: string): Promise<DocumentResult> {
  const [subtype, rawId] = id.includes(":") ? id.split(":", 2) : ["post", id];
  const numericId = Number.parseInt(rawId, 10);

  if (!Number.isFinite(numericId)) {
    throw new Error("Document id must be in the format post:123, page:123, or lp:123.");
  }

  type WpDocument = {
    id: number;
    slug?: string;
    link?: string;
    title?: { rendered?: string };
    excerpt?: { rendered?: string };
    content?: { rendered?: string };
  };

  const endpoint = endpointForSubtype(subtype);
  const doc = await wpFetch<WpDocument>(
    `/wp-json/wp/v2/${endpoint}/${numericId}?_fields=id,slug,link,title,excerpt,content`
  );

  const title = stripHtml(doc.title?.rendered) || "Untitled";
  const excerpt = stripHtml(doc.excerpt?.rendered);
  const content = stripHtml(doc.content?.rendered);
  const text = [excerpt, content].filter(Boolean).join("\n\n").slice(0, 12000);

  return {
    id,
    title,
    text,
    url: doc.link || getBaseUrl(),
    metadata: {
      source: "WordPress",
      type: subtype,
      slug: doc.slug || ""
    }
  };
}

export type LeadInput = {
  name: string;
  email?: string;
  phone?: string;
  service?: string;
  message: string;
  preferredContact?: "phone" | "email" | "whatsapp";
  consent: true;
};

export async function submitLead(input: LeadInput) {
  const endpoint = process.env.G12_LEAD_ENDPOINT?.trim();
  const secret = process.env.G12_LEAD_SECRET?.trim();

  if (!endpoint) {
    return {
      status: "not_configured" as const,
      message:
        "Lead endpoint is not configured. Ask the site admin to set G12_LEAD_ENDPOINT and G12_LEAD_SECRET."
    };
  }

  const idempotencyKey = createHash("sha256")
    .update(JSON.stringify({
      name: input.name.trim().toLowerCase(),
      email: input.email?.trim().toLowerCase() || "",
      phone: input.phone?.replace(/\s+/g, "") || "",
      service: input.service?.trim().toLowerCase() || "",
      message: input.message.trim().toLowerCase(),
      preferredContact: input.preferredContact || ""
    }))
    .digest("hex");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { authorization: `Bearer ${secret}` } : {})
    },
    body: JSON.stringify({
      ...input,
      idempotencyKey,
      source: "chatgpt_app",
      site: getBaseUrl()
    })
  });

  let body: { lead_id?: number | string; duplicate?: boolean; message?: string } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    body = {};
  }

  if (!response.ok) {
    return {
      status: "failed" as const,
      message: `G12 could not accept the consultation request (${response.status}). Please try again later.`
    };
  }

  return {
    status: "submitted" as const,
    message: body.duplicate
      ? "This consultation request was already received by G12."
      : "Your consultation request was submitted to G12.",
    ...(body.lead_id !== undefined ? { leadId: String(body.lead_id) } : {}),
    duplicate: Boolean(body.duplicate)
  };
}
