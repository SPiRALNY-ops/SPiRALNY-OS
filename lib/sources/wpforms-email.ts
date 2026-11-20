/**
 * Reads the WPForms notification we add to each Spiral NY sign-up form.
 *
 * We write the notification's message ourselves, so it starts with a fixed
 * block of "Label: value" lines built from WPForms smart tags (tag names from
 * https://wpforms.com/docs/how-to-use-smart-tags-in-wpforms/). WPForms does not
 * document how {all_fields} is laid out, so nothing depends on it: it is kept
 * only as extra detail. Each form gets two notifications with the same body:
 * one for completed entries (Type: complete) and one with "Enable for
 * abandoned forms entries" switched on (Type: abandoned).
 *
 * The message for each form is notificationMessage() below.
 */
export const NOTIFICATION_SUBJECT = {
  complete: "Spiral OS entry: complete",
  abandoned: "Spiral OS entry: abandoned",
};

/**
 * The four sign-up forms on spiralny.com, with field IDs read from each form's
 * public HTML (2026-11-21). Names, emails, phones, licence numbers and totals use
 * the same IDs on every form. On the two commission forms the plan is a choice
 * (field 22); on Referral and Park Your License the form itself is the plan.
 */
export const SPIRAL_FORMS = [
  { id: 23785, label: "100% commission", page: "/100-commission-brokerage/", plan: '{field_id="22"}' },
  { id: 24913, label: "No commission splits", page: "/new-york-no-commission-splits-brokerage/", plan: '{field_id="22"}' },
  { id: 23741, label: "Referral agent", page: "/new-york-real-estate-referral-agent/", plan: "Referral Licensed Agent Package" },
  { id: 25662, label: "Park your license", page: "/park-your-license-and-stay-active-in-brooklyn/", plan: "Park your License Agent Package" },
] as const;

/** The "Email Message" for one form's Spiral OS notification. */
export function notificationMessage(form: (typeof SPIRAL_FORMS)[number], type: "complete" | "abandoned"): string {
  return `Spiral OS entry
Type: ${type}
Form ID: {form_id}
Form: {form_name}
Entry ID: {entry_id}
Page: {page_url}
Name: {field_id="1"}
Email: {field_id="2"}
Phone: {field_id="3"}
License: {field_id="4"}
Plan: ${form.plan}
Amount: {field_id="15"}
---
{all_fields}`;
}

export type ParsedEntry = {
  entryType: "complete" | "abandoned";
  formId: number | null;
  formName: string | null;
  entryId: string | null;
  pageUrl: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  licenseNumber: string | null;
  plan: string | null;
  amountCents: number | null;
  fields: Record<string, string>;
};

const KEYS: Record<string, keyof ParsedEntry | "type"> = {
  type: "type",
  "form id": "formId",
  form: "formName",
  "entry id": "entryId",
  page: "pageUrl",
  name: "fullName",
  email: "email",
  phone: "phone",
  license: "licenseNumber",
  plan: "plan",
  amount: "amountCents",
};

const EMAIL_RE = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const MARKER = "spiral os entry";

/** Returns null for emails that aren't Spiral OS entries (e.g. a reply to one). */
export function parseSpiralEntry(subject: string, text: string): ParsedEntry | null {
  if (!subject.toLowerCase().includes(MARKER) && !text.toLowerCase().includes(MARKER)) return null;
  if (/^\s*(re|fwd?):/i.test(subject)) return null;

  const lines = text.split("\n").map((l) => l.trim());
  const divider = lines.findIndex((l) => /^-{3,}$/.test(l));
  const head = divider === -1 ? lines : lines.slice(0, divider);
  const rest = divider === -1 ? [] : lines.slice(divider + 1).filter(Boolean);

  const raw: Record<string, string> = {};
  for (const line of head) {
    const m = line.match(/^([A-Za-z][A-Za-z ]{0,30}?)\s*:\s*(.*)$/);
    if (m && KEYS[m[1].toLowerCase()] && !(m[1].toLowerCase() in raw)) raw[m[1].toLowerCase()] = m[2].trim();
  }
  if (!raw["form id"] && !raw["entry id"]) return null;

  const clean = (v: string | undefined) => {
    const s = (v ?? "").trim();
    // An unreplaced smart tag means the field ID in the notification was wrong.
    return s && !/^\{[^}]*\}$/.test(s) ? s : null;
  };

  const typeText = (clean(raw.type) ?? subject).toLowerCase();
  const entryType = typeText.includes("abandon") ? "abandoned" : "complete";

  let email = clean(raw.email)?.match(EMAIL_RE)?.[0] ?? null;
  if (!email) email = rest.join("\n").match(EMAIL_RE)?.[0] ?? null;

  const formId = Number.parseInt(clean(raw["form id"]) ?? "", 10);

  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (clean(v)) fields[k] = v;
  if (rest.length) fields.all_fields = rest.join("\n").slice(0, 5000);

  return {
    entryType,
    formId: Number.isFinite(formId) ? formId : null,
    formName: clean(raw.form),
    entryId: clean(raw["entry id"]),
    pageUrl: clean(raw.page),
    fullName: clean(raw.name),
    email: email ? email.toLowerCase() : null,
    phone: normalizePhone(clean(raw.phone)),
    licenseNumber: clean(raw.license),
    plan: clean(raw.plan),
    amountCents: parseAmountCents(clean(raw.amount)),
    fields,
  };
}

/** US numbers as 10 digits (drops a leading +1); other lengths kept as digits; too short = null. */
export function normalizePhone(value: string | null): string | null {
  if (!value) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length >= 7 ? digits : null;
}

/** "$498.16", "498.16 USD", "$1,234" -> cents. */
export function parseAmountCents(value: string | null): number | null {
  if (!value) return null;
  const m = value.replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
  if (!m) return null;
  return Math.round(Number(m[0]) * 100);
}
