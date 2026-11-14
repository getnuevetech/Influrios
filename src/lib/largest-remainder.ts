/** Deterministic largest-remainder split. Equal fractions go to the earlier share. */
export function allocateByLargestRemainder(totalCents: number, weightsBps: number[]): number[] | null {
  if (!Number.isInteger(totalCents) || totalCents < 0) return null;
  if (weightsBps.length === 0) return null;
  if (weightsBps.some((weight) => !Number.isInteger(weight) || weight < 0)) return null;
  if (weightsBps.reduce((sum, weight) => sum + weight, 0) !== 10_000) return null;
  if (totalCents === 0) return weightsBps.map(() => 0);
  const amounts = weightsBps.map((weight) => Math.floor((totalCents * weight) / 10_000));
  let left = totalCents - amounts.reduce((sum, amount) => sum + amount, 0);
  const order = weightsBps
    .map((weight, index) => ({ index, remainder: (totalCents * weight) % 10_000 }))
    .sort((leftRow, rightRow) => rightRow.remainder - leftRow.remainder || leftRow.index - rightRow.index);
  for (const row of order) {
    if (left <= 0) break;
    amounts[row.index] += 1;
    left -= 1;
  }
  if (left !== 0 || amounts.reduce((sum, amount) => sum + amount, 0) !== totalCents) return null;
  return amounts;
}
