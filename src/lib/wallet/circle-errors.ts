/** Operator hint — not shown to end users. */
export const CIRCLE_ENTITY_SECRET_SETUP_HINT =
  "Circle Entity Secret is a separate 64-character hex key (not API Key or Client Key). " +
  "See docs/CIRCLE-SETUP.md.";

const ENTITY_SECRET_CODES = new Set([156013, 156016, 156019]);

function circleErrorCode(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { code?: number; response?: { data?: { code?: number } } };
  return e.code ?? e.response?.data?.code;
}

function isEntitySecretError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = circleErrorCode(err);
  if (code != null && ENTITY_SECRET_CODES.has(code)) return true;
  const e = err as { message?: string; response?: { data?: { message?: string } } };
  const msg = `${e.message ?? ""} ${e.response?.data?.message ?? ""}`.toLowerCase();
  return msg.includes("entity secret") || msg.includes("entitysecret");
}

function rawCircleMessage(err: unknown): string {
  if (err instanceof Error && err.message && err.message !== "Error") {
    return err.message;
  }
  if (!err || typeof err !== "object") return "Circle API request failed";

  const e = err as {
    message?: string;
    code?: number;
    response?: {
      data?: {
        message?: string;
        code?: number;
        errors?: Array<{ error?: string; message?: string }>;
      };
    };
  };

  const data = e.response?.data;
  const detail = data?.errors?.map((x) => x.message ?? x.error).filter(Boolean).join("; ");
  return (
    detail ??
    data?.message ??
    e.message ??
    (e.code ? `Circle error ${e.code}` : "Circle API request failed")
  );
}

/** End-user copy for toasts and API errors — never mentions Vercel or env var names. */
export function circleUserMessage(err: unknown): string {
  if (isEntitySecretError(err)) {
    return "RESOLVE wallet payments are temporarily unavailable. Choose Connected wallet (you sign on Arc) or try again shortly.";
  }

  const base = rawCircleMessage(err);
  if (isEntitySecretError(base)) {
    return "RESOLVE wallet payments are temporarily unavailable. Choose Connected wallet (you sign on Arc) or try again shortly.";
  }

  if (/not configured|not available/i.test(base)) {
    return "Payments are not available from your RESOLVE wallet right now. Use Connected wallet to pay on Arc.";
  }

  if (/insufficient|balance/i.test(base)) {
    return base;
  }

  if (/timed out|timeout/i.test(base)) {
    return "Arc transfer is still confirming. Check Capital for pending activity or try Connected wallet.";
  }

  return base;
}

/** Operator / log message — includes setup hints for entity secret issues. */
export function circleErrorMessage(err: unknown): string {
  if (isEntitySecretError(err)) {
    return `Circle entity secret is missing or not registered. ${CIRCLE_ENTITY_SECRET_SETUP_HINT}`;
  }

  const base = rawCircleMessage(err);
  if (isEntitySecretError(base)) {
    return `Circle entity secret is missing or not registered. ${CIRCLE_ENTITY_SECRET_SETUP_HINT}`;
  }
  return base;
}
