/** Parse Supabase "try again after N seconds" OTP rate-limit messages. */
export function parseOtpCooldown(message: string): number | undefined {
  const match = message.match(/after (\d+) seconds?/i);
  return match ? Number(match[1]) : undefined;
}
