/**
 * Gmail API v1 (read only): find the WPForms "Spiral OS entry" notifications
 * in admin@outreachify.io and read their text.
 * Shapes from https://gmail.googleapis.com/$discovery/rest?version=v1.
 */
import { requestJson, type Fetch } from "./http";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
};

export type GmailMessage = { id: string; threadId?: string; internalDate?: string; payload?: GmailPart };

export async function listMessageIds(fetchFn: Fetch, accessToken: string, q: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q, maxResults: "500" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await requestJson<{ messages?: { id: string }[]; nextPageToken?: string }>(
      fetchFn,
      `${BASE}/messages?${params}`,
      { service: "Gmail", headers: { authorization: `Bearer ${accessToken}` } },
    );
    ids.push(...(res.messages ?? []).map((m) => m.id));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return ids;
}

export function getMessage(fetchFn: Fetch, accessToken: string, id: string): Promise<GmailMessage> {
  return requestJson<GmailMessage>(fetchFn, `${BASE}/messages/${encodeURIComponent(id)}?format=full`, {
    service: "Gmail",
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

const decode = (data: string) => Buffer.from(data, "base64url").toString("utf8");

function findPart(part: GmailPart | undefined, mimeType: string): GmailPart | undefined {
  if (!part) return undefined;
  if (part.mimeType === mimeType && part.body?.data && !part.filename) return part;
  for (const child of part.parts ?? []) {
    const hit = findPart(child, mimeType);
    if (hit) return hit;
  }
  return undefined;
}

/** HTML email to readable lines: block ends become new lines, tags dropped, entities decoded. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6]|table|section)>/gi, "\n")
      .replace(/<\/(td|th)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED[code.toLowerCase()] ?? m;
  });
}

export type ReadableMessage = { id: string; subject: string; receivedAt: Date; text: string };

/** Subject, received time and plain text (text/plain preferred, else the HTML part converted). */
export function readMessage(message: GmailMessage): ReadableMessage {
  const headers = message.payload?.headers ?? [];
  const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "";
  const plain = findPart(message.payload, "text/plain");
  const html = findPart(message.payload, "text/html");
  const text = plain?.body?.data ? decode(plain.body.data) : html?.body?.data ? htmlToText(decode(html.body.data)) : "";
  return {
    id: message.id,
    subject,
    receivedAt: new Date(Number(message.internalDate ?? Date.now())),
    text: text.replace(/\r\n/g, "\n"),
  };
}
