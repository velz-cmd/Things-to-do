export type RecognitionFormula =
  | { mode: "fixed"; amountMicroUsdc: bigint }
  | { mode: "per_unit"; rateMicroUsdc: bigint; minimumUnits?: bigint; maximumPayableUnits?: bigint }
  | { mode: "milestone"; milestones: ReadonlyArray<{ units: bigint; amountMicroUsdc: bigint }> }
  | { mode: "hybrid"; approvedBaseMicroUsdc: bigint; rateMicroUsdc: bigint; maximumMicroUsdc: bigint };

export function calculateRecognition(input: { formula: RecognitionFormula; verifiedUnits: bigint; approved: boolean; participantCapMicroUsdc?: bigint; campaignRemainingMicroUsdc: bigint }) {
  const units = input.verifiedUnits < BigInt(0) ? BigInt(0) : input.verifiedUnits;
  let calculated = BigInt(0);
  switch (input.formula.mode) {
    case "fixed": calculated = input.approved ? input.formula.amountMicroUsdc : BigInt(0); break;
    case "per_unit": {
      if (units < (input.formula.minimumUnits ?? BigInt(0))) break;
      const payable = input.formula.maximumPayableUnits !== undefined && units > input.formula.maximumPayableUnits ? input.formula.maximumPayableUnits : units;
      calculated = payable * input.formula.rateMicroUsdc;
      break;
    }
    case "milestone": calculated = input.formula.milestones.filter((milestone) => units >= milestone.units).reduce((sum, milestone) => sum + milestone.amountMicroUsdc, BigInt(0)); break;
    case "hybrid": calculated = (input.approved ? input.formula.approvedBaseMicroUsdc : BigInt(0)) + units * input.formula.rateMicroUsdc; calculated = calculated > input.formula.maximumMicroUsdc ? input.formula.maximumMicroUsdc : calculated; break;
  }
  if (input.participantCapMicroUsdc !== undefined && calculated > input.participantCapMicroUsdc) calculated = input.participantCapMicroUsdc;
  if (calculated > input.campaignRemainingMicroUsdc) calculated = input.campaignRemainingMicroUsdc;
  return { amountMicroUsdc: calculated, verifiedUnits: units };
}
