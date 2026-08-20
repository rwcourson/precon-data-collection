/** External Magnus/API answers use current locked revisions only. */
export function magnusExternalScope<T extends { status: string }>(
  rounds: T[]
): T[] {
  return rounds.filter((round) => round.status === "locked");
}
