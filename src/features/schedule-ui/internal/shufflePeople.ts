import type { UiPerson } from "./State.js";

/**
 * Returns a random cyclic permutation of complete person records.
 * With at least two people, every person moves to a different position.
 * The original list and each person's data remain intact.
 */
export function shufflePeople(people: readonly UiPerson[]): UiPerson[] {
  const shuffled: UiPerson[] = [...people];

  // Sattolo's algorithm excludes the current index so nobody stays in place.
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex: number = Math.floor(Math.random() * index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
