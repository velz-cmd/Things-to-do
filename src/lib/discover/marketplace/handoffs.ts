export function poolFundingHandoff(programId: string, returnTo: string) {
  const normalizedProgramId = programId.trim();
  if (!normalizedProgramId) {
    throw new Error("Pool funding requires a program ID");
  }

  const params = new URLSearchParams({
    intent: "back-pool",
    programId: normalizedProgramId,
  });
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    params.set("returnTo", returnTo);
  }
  return `/capital?${params.toString()}`;
}
