export interface TaskClassification {
  category: string;
  company: string | null;
  objective: string;
  secondaryObjective?: string;
  requiredEvidence: string[];
  requiredConnectors: string[];
  missingInputs: string[];
  confidence: number;
  isDemo: boolean;
  suggestedTitle: string;
  targetValueUsd: number | null;
  merchantId: string | null;
  question?: string;
}

const COMPANY_PATTERNS: Array<{ pattern: RegExp; company: string; merchantId?: string }> = [
  { pattern: /\b(emirates|ek\d+)/i, company: "Emirates", merchantId: "emirates" },
  { pattern: /\b(qatar|qr\d+)/i, company: "Qatar Airways", merchantId: "qatar" },
  { pattern: /\b(skydemo|sd-?\d+)/i, company: "SkyDemo Airlines", merchantId: "skydemo-airlines" },
  { pattern: /\b(streamdemo|streamly)\b/i, company: "StreamDemo", merchantId: "streamdemo" },
  { pattern: /\b(adobe)\b/i, company: "Adobe", merchantId: "adobe" },
  { pattern: /\b(canva)\b/i, company: "Canva", merchantId: "canva" },
  { pattern: /\b(dhl)\b/i, company: "DHL", merchantId: "dhl" },
  { pattern: /\b(fedex)\b/i, company: "FedEx", merchantId: "fedex" },
  { pattern: /\b(ups)\b/i, company: "UPS", merchantId: "ups" },
  { pattern: /\b(parceldemo)\b/i, company: "ParcelDemo", merchantId: "parceldemo" },
];

function extractAmount(text: string): number | null {
  const m = text.match(/\$?\s*(\d+(?:\.\d{2})?)/);
  return m ? parseFloat(m[1]) : null;
}

function extractTracking(text: string): string | null {
  const m = text.match(/\b([A-Z0-9]{10,})\b/);
  return m?.[1] ?? null;
}

export function classifyTaskInput(input: string): TaskClassification {
  const text = input.trim();
  const lower = text.toLowerCase();
  const amount = extractAmount(text);
  const tracking = extractTracking(text);

  let company: string | null = null;
  let merchantId: string | null = null;
  for (const cp of COMPANY_PATTERNS) {
    if (cp.pattern.test(text)) {
      company = cp.company;
      merchantId = cp.merchantId ?? null;
      break;
    }
  }

  const isDemo =
    /\b(demo|skydemo|streamdemo|parceldemo|streamly)\b/i.test(text) ||
    company === "SkyDemo Airlines" ||
    company === "StreamDemo" ||
    company === "ParcelDemo";

  if (
    /\b(cancel|subscription|unused|billing|renewal|trial)\b/i.test(lower) &&
    !/\b(refund|flight|parcel|package|wallet)\b/i.test(lower)
  ) {
    const missing: string[] = [];
    if (!company) missing.push("company");
    return {
      category: "subscription_cancellation",
      company,
      objective: "cancel_subscription",
      secondaryObjective: /\brefund\b/i.test(lower) ? "refund_request" : undefined,
      requiredEvidence: ["receipt", "account email", "billing date"],
      requiredConnectors: ["gmail", "browser", "arc"],
      missingInputs: missing,
      confidence: company ? 0.88 : 0.55,
      isDemo: isDemo || company === "StreamDemo",
      suggestedTitle: company
        ? `Cancel ${company} subscription${amount ? ` ($${amount}/mo)` : ""}`
        : text,
      targetValueUsd: amount ?? 12.99,
      merchantId: merchantId ?? (company ? company.toLowerCase().replace(/\s+/g, "-") : "streamdemo"),
      question: !company ? "Which subscription company is this about?" : undefined,
    };
  }

  if (
    /\b(flight|airline|delayed|cancelled flight|boarding|refund)\b/i.test(lower) &&
    !/\b(parcel|package|dhl|fedex)\b/i.test(lower)
  ) {
    const missing: string[] = [];
    if (!company) missing.push("airline");
    return {
      category: "airline_refund",
      company,
      objective: "refund_request",
      requiredEvidence: ["booking reference", "flight details", "delay proof"],
      requiredConnectors: ["gmail", "browser", "arc"],
      missingInputs: missing,
      confidence: company ? 0.9 : 0.6,
      isDemo: isDemo || company === "SkyDemo Airlines",
      suggestedTitle: company
        ? `Get refund from ${company}${amount ? ` ($${amount})` : ""}`
        : text,
      targetValueUsd: amount ?? 43,
      merchantId: merchantId ?? "skydemo-airlines",
      question: !company
        ? "Which airline is this about? Or should I search your Gmail for flight bookings?"
        : undefined,
    };
  }

  if (/\b(parcel|package|tracking|dhl|fedex|ups|delivery|lost)\b/i.test(lower)) {
    const missing: string[] = [];
    if (!tracking) missing.push("tracking_number");
    if (!company) missing.push("carrier");
    return {
      category: "parcel_claim",
      company,
      objective: "parcel_compensation",
      requiredEvidence: ["tracking number", "order email", "delivery status"],
      requiredConnectors: ["browser", "arc"],
      missingInputs: missing,
      confidence: tracking && company ? 0.85 : 0.5,
      isDemo: isDemo || company === "ParcelDemo",
      suggestedTitle: company
        ? `Claim compensation from ${company}${amount ? ` ($${amount})` : ""}`
        : text,
      targetValueUsd: amount ?? 25,
      merchantId: merchantId ?? "parceldemo",
      question: !tracking
        ? "Do you have a tracking number? Or should I search Gmail for shipment emails?"
        : !company
          ? "Which carrier handled this parcel?"
          : undefined,
    };
  }

  if (/\b(wallet|crypto|approval|usdc|token|chain)\b/i.test(lower)) {
    return {
      category: "wallet_guardian",
      company: null,
      objective: "wallet_scan",
      requiredEvidence: ["wallet address"],
      requiredConnectors: ["wallet", "arc"],
      missingInputs: ["wallet_address"],
      confidence: 0.7,
      isDemo: false,
      suggestedTitle: text,
      targetValueUsd: amount ?? 0,
      merchantId: "guardian",
      question: "Which wallet address should I scan?",
    };
  }

  if (/\b(dispute|duplicate|charge|unauthorized)\b/i.test(lower)) {
    const missing: string[] = [];
    if (!company) missing.push("merchant");
    if (!amount) missing.push("amount");
    return {
      category: "charge_dispute",
      company,
      objective: "dispute_charge",
      requiredEvidence: ["charge amount", "charge date", "merchant name"],
      requiredConnectors: ["gmail", "browser", "arc"],
      missingInputs: missing,
      confidence: company && amount ? 0.8 : 0.5,
      isDemo: false,
      suggestedTitle: text,
      targetValueUsd: amount,
      merchantId: company?.toLowerCase().replace(/\s+/g, "-") ?? null,
      question: !company ? "Which merchant charged you?" : !amount ? "What was the charge amount?" : undefined,
    };
  }

  if (/\b(find|discover|subscriptions)\b/i.test(lower)) {
    return {
      category: "subscription_cancellation",
      company: null,
      objective: "discover_subscriptions",
      requiredEvidence: [],
      requiredConnectors: ["gmail"],
      missingInputs: ["gmail"],
      confidence: 0.75,
      isDemo: false,
      suggestedTitle: "Find subscriptions I still pay for",
      targetValueUsd: null,
      merchantId: null,
      question: "Connect Gmail to discover recurring subscriptions, or enter a company manually.",
    };
  }

  return {
    category: "manual",
    company,
    objective: "manual_task",
    requiredEvidence: ["company", "what happened"],
    requiredConnectors: ["browser", "arc"],
    missingInputs: company ? [] : ["company"],
    confidence: 0.4,
    isDemo: isDemo,
    suggestedTitle: text,
    targetValueUsd: amount,
    merchantId: merchantId,
    question: !company ? "Which company is this about?" : undefined,
  };
}
