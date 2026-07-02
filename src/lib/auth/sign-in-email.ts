import { getAppBaseUrl } from "@/lib/browser/app-url";

export function buildSignInEmailHtml(input: {
  magicLink: string;
  otp?: string;
  expiresMinutes: number;
}) {
  const appUrl = getAppBaseUrl();
  const otpBlock = input.otp
    ? `<p style="margin:24px 0;font-size:28px;font-weight:700;letter-spacing:0.35em;color:#0ea5e9">${input.otp}</p>
       <p style="margin:0 0 24px;color:#94a3b8;font-size:14px">Or enter this code on the sign-in screen.</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#05080c;font-family:system-ui,-apple-system,sans-serif;color:#e2e8f0">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.2em;color:#38bdf8">RESOLVE</p>
    <h1 style="margin:0 0 16px;font-size:24px;color:#fff">Sign in to RESOLVE</h1>
    <p style="margin:0 0 24px;color:#94a3b8;line-height:1.6">
      Tap the button below to finish signing in. This link expires in ${input.expiresMinutes} minutes and works once.
    </p>
    ${otpBlock}
    <a href="${input.magicLink}" style="display:inline-block;background:#0ea5e9;color:#041018;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px">
      Sign in to RESOLVE
    </a>
    <p style="margin:28px 0 0;color:#64748b;font-size:12px;line-height:1.6">
      If you did not request this email, you can ignore it.<br />
      <a href="${appUrl}" style="color:#38bdf8">${appUrl}</a>
    </p>
  </div>
</body>
</html>`;
}

export function mapAuthEmailError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit")) {
    return "Too many sign-in emails sent. Wait about an hour, or configure Resend SMTP in Supabase. Try Google sign-in meanwhile.";
  }
  if (lower.includes("after") && lower.includes("seconds")) {
    return message;
  }
  if (lower.includes("invalid") && lower.includes("email")) {
    return "Enter a valid email address.";
  }
  return message;
}
