import assert from "node:assert/strict";
import test from "node:test";

import { shufflePeople } from "../src/features/schedule-ui/internal/shufflePeople";
import type { UiPerson } from "../src/features/schedule-ui/internal/State";

test("A keveres az ures es egyszemelyes listat is kezeli", () => {
  assert.deepEqual(shufflePeople([]), []);

  const person: UiPerson = { id: "bela", name: "Béla", unavailableDays: [2, 5] };
  assert.deepEqual(shufflePeople([person]), [person]);
});

test("Ket munkatars a teljes adatrekordjaval egyutt cserel helyet", () => {
  const bela: UiPerson = { id: "bela", name: "Béla", unavailableDays: [1, 3] };
  const oszkar: UiPerson = { id: "oszkar", name: "Oszkár", unavailableDays: [7, 9] };
  const people: UiPerson[] = [bela, oszkar];
  const shuffled: UiPerson[] = shufflePeople(people);

  assert.equal(shuffled[0], oszkar);
  assert.equal(shuffled[1], bela);
  assert.deepEqual(people, [bela, oszkar]);
  assert.deepEqual(shufflePeople(shuffled), people);
});

test("Ismetelt kevereskor mindenki elmozdul, az osszes sajat adata megmarad", () => {
  for (const count of [3, 4, 8, 20]) {
    const original: UiPerson[] = Array.from({ length: count }, (_, index) => ({
      id: `person-${index}`,
      name: `Munkatárs ${index}`,
      unavailableDays: [index + 1, index + 2],
      note: `További személyes adat ${index}`
    }));
    const snapshot: UiPerson[] = structuredClone(original);

    for (const person of original) {
      Object.freeze(person.unavailableDays);
      Object.freeze(person);
    }
    Object.freeze(original);

    let previous: UiPerson[] = original;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const shuffled: UiPerson[] = shufflePeople(previous);

      assert.equal(shuffled.length, original.length);
      assert.equal(new Set(shuffled).size, original.length);
      shuffled.forEach((person, index) => {
        assert.notEqual(person.id, previous[index].id);
        assert.equal(person, original.find((entry) => entry.id === person.id));
      });
      assert.deepEqual(original, snapshot);
      previous = shuffled;
    }
  }
});
