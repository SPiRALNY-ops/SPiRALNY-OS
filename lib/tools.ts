/**
 * The ten Spiral OS tools, in the order of the Plan of Action (19 Nov 2026).
 * Descriptions, "used by" and build step are taken from the plan's tool pages.
 */
export type ToolIcon =
  | "home"
  | "leads"
  | "inbox"
  | "analytics"
  | "billing"
  | "agents"
  | "onboarding"
  | "calls"
  | "documents"
  | "brain";

export type Tool = {
  slug: string;
  name: string;
  icon: ToolIcon;
  step: 1 | 2 | 3 | 4;
  live: boolean;
  summary: string;
  points: string[];
  usedBy: string;
};

export const TOOLS: Tool[] = [
  {
    slug: "home",
    name: "Home",
    icon: "home",
    step: 1,
    live: false,
    summary: "Today's numbers on one screen.",
    points: [
      "New leads, sign-ups and cancellations today",
      "Anything waiting on you, like a license to transfer",
      "Built for your phone first",
    ],
    usedBy: "You, your team",
  },
  {
    slug: "leads",
    name: "Leads",
    icon: "leads",
    step: 1,
    live: false,
    summary: "Every lead, and exactly where they stand.",
    points: [
      "A board with stages: New, Contacted, Thinking it over, Getting their license, Signed, Not interested",
      "Each lead shows source, plan, state and full history",
      "Move a card and the right follow-up starts",
    ],
    usedBy: "Your team",
  },
  {
    slug: "inbox",
    name: "Inbox",
    icon: "inbox",
    step: 1,
    live: false,
    summary: "Every conversation in one place.",
    points: [
      "Cold email replies, support@ emails and texts in one list",
      "Each one labelled: interested, question, not now, NY or GA",
      "Reply from here, linked to the person's record",
    ],
    usedBy: "Your team",
  },
  {
    slug: "analytics",
    name: "Analytics",
    icon: "analytics",
    step: 1,
    live: true,
    summary: "Know what is working.",
    points: [
      "Sign-ups by source: Google, cold email, referral",
      "Which searches and pages bring sign-ups",
      "How fast leads hear back and how long until they pay",
      "Net agents per month by plan and state, and a forecast to 200 and 300",
    ],
    usedBy: "You",
  },
  {
    slug: "billing",
    name: "Billing",
    icon: "billing",
    step: 1,
    live: false,
    summary: "Every payment in one place.",
    points: [
      "Each agent's plan, last payment and next charge",
      "Failed payments and every follow-up sent",
      "Cancellations and their end dates",
    ],
    usedBy: "You, your team",
  },
  {
    slug: "agents",
    name: "Agents",
    icon: "agents",
    step: 2,
    live: false,
    summary: "Everything about each agent on one page.",
    points: [
      "Plan, state, license, orientation, profile, Spiral email, Cloud access, payments",
      "Change one status and every connected step updates",
      'Filters like "all Georgia agents" or "missing a profile"',
    ],
    usedBy: "You, your team",
  },
  {
    slug: "onboarding",
    name: "Onboarding",
    icon: "onboarding",
    step: 2,
    live: false,
    summary: "New agents' progress and your to-do list.",
    points: [
      "Where every new agent is, step by step",
      "Your license-transfer list: tap Done when transferred",
      "Stalled steps flagged, so nobody is forgotten",
    ],
    usedBy: "You, your team",
  },
  {
    slug: "calls",
    name: "Calls",
    icon: "calls",
    step: 3,
    live: false,
    summary: "Every call the AI phone assistant makes.",
    points: [
      "Recording and a short summary of each call",
      "Outcome: signed up online, call back, wants a person",
      "Hand any call to a person in one tap",
    ],
    usedBy: "Your team",
  },
  {
    slug: "documents",
    name: "Documents",
    icon: "documents",
    step: 4,
    live: false,
    summary: "Deal packages, ready to review.",
    points: [
      "Agents pick their state in Spiral Cloud and drop in every file at once",
      "You see the full package sorted and labelled, gaps flagged",
      "Approve it or send it back",
    ],
    usedBy: "You, agents",
  },
  {
    slug: "company-brain",
    name: "Company Brain",
    icon: "brain",
    step: 4,
    live: false,
    summary: "Ask your business anything.",
    points: [
      'Plain English: "How many agents signed up from Google last month?"',
      "Connected to every tool",
      "It only reads. It never changes anything",
    ],
    usedBy: "You",
  },
];

export const STEP_NAMES: Record<Tool["step"], string> = {
  1: "See everything",
  2: "Onboarding on autopilot",
  3: "AI that answers and calls",
  4: "Georgia and documents",
};

export function findTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
