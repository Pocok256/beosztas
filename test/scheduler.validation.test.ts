import assert from "node:assert/strict";
import test from "node:test";

import { buildSchedule } from "../server";

type SchedulerValidationError = {
  statusCode?: number;
  message?: string;
};

test("buildSchedule hibat dob, ha a honap formatuma nem megfelelo", () => {
  assert.throws(
    () => buildSchedule({ month: "2026-1", people: [{ name: "Test", unavailableDays: [] }] }),
    (error: SchedulerValidationError) => error.statusCode === 400 && Boolean(error.message?.includes("ervenyes honapot"))
  );

  assert.throws(
    () => buildSchedule({ month: "invalid", people: [{ name: "Test", unavailableDays: [] }] }),
    (error: SchedulerValidationError) => error.statusCode === 400
  );
});

test("buildSchedule hibat dob, ha nincsenek megadva emberek", () => {
  assert.throws(
    () => buildSchedule({ month: "2026-05", people: [] }),
    (error: SchedulerValidationError) => error.statusCode === 400 && Boolean(error.message?.includes("legalabb egy embert"))
  );

  assert.throws(
    () => buildSchedule({ month: "2026-05", people: undefined as never }),
    (error: SchedulerValidationError) => error.statusCode === 400
  );
});

test("buildSchedule hibat dob, ha valakinek hianyzik a neve vagy tul hosszu", () => {
  assert.throws(
    () => buildSchedule({ month: "2026-05", people: [{ name: "   ", unavailableDays: [] }] }),
    (error: SchedulerValidationError) => error.statusCode === 400 && Boolean(error.message?.includes("neve hianyzik"))
  );

  assert.throws(
    () => buildSchedule({ month: "2026-05", people: [{ name: "A".repeat(61), unavailableDays: [] }] }),
    (error: SchedulerValidationError) => error.statusCode === 400 && Boolean(error.message?.includes("tul hosszu"))
  );
});

test("buildSchedule hibat dob, ha egy nev tobbszor szerepel", () => {
  assert.throws(
    () => buildSchedule({ month: "2026-05", people: [{ name: "Kovacs Anna", unavailableDays: [] }, { name: "Kovacs Anna", unavailableDays: [] }] }),
    (error: SchedulerValidationError) => error.statusCode === 400 && Boolean(error.message?.includes("tobbszor szerepel"))
  );
});

test("buildSchedule hibat dob, ha a kivetelek formatuma hibas", () => {
  assert.throws(
    () => buildSchedule({ month: "2026-05", people: [{ name: "Test", unavailableDays: [] }], exceptions: {} as never }),
    (error: SchedulerValidationError) => error.statusCode === 400 && Boolean(error.message?.includes("kivetelek listaja hibas"))
  );

  assert.throws(
    () => buildSchedule({ month: "2026-05", people: [{ name: "Test", unavailableDays: [] }], exceptions: [{ dayNumber: 32, type: "workday" }] }),
    (error: SchedulerValidationError) => error.statusCode === 400 && Boolean(error.message?.includes("kivetel napja hibas"))
  );

  assert.throws(
    () => buildSchedule({ month: "2026-05", people: [{ name: "Test", unavailableDays: [] }], exceptions: [{ dayNumber: 5, type: "invalid" as never }] }),
    (error: SchedulerValidationError) => error.statusCode === 400 && Boolean(error.message?.includes("kivetel tipusa hibas"))
  );

  assert.throws(
    () => buildSchedule({ month: "2026-05", people: [{ name: "Test", unavailableDays: [] }], exceptions: [{ dayNumber: 5, type: "workday" }, { dayNumber: 5, type: "dayoff" }] }),
    (error: SchedulerValidationError) => error.statusCode === 400 && Boolean(error.message?.includes("csak egy kivetel adható meg"))
  );
});

test("buildSchedule elfogadja a null kiveteleket es ures listava normalizalja", () => {
  const result = buildSchedule({
    month: "2026-05",
    people: [{ name: "Test", unavailableDays: [] }],
    exceptions: null
  });

  assert.deepEqual(result.exceptions, []);
});

test("buildSchedule hibat dob, ha a scheduler finomhangolo config hibas", () => {
  assert.throws(
    () => buildSchedule({ month: "2026-05", people: [{ name: "Test", unavailableDays: [] }], config: [] as never }),
    (error: SchedulerValidationError) => error.statusCode === 400 && Boolean(error.message?.includes("finomhangolo"))
  );

  assert.throws(
    () => buildSchedule({ month: "2026-05", people: [{ name: "Test", unavailableDays: [] }], config: { unknownKey: 1 } as never }),
    (error: SchedulerValidationError) => error.statusCode === 400 && Boolean(error.message?.includes("Ismeretlen scheduler beallitas"))
  );

  assert.throws(
    () => buildSchedule({ month: "2026-05", people: [{ name: "Test", unavailableDays: [] }], config: { sameAssignmentBonus: -1 } }),
    (error: SchedulerValidationError) => error.statusCode === 400 && Boolean(error.message?.includes("Azonos blokk bonusz"))
  );
});

test("buildSchedule visszaadja a felulirt scheduler konfiguraciot", () => {
  const result = buildSchedule({
    month: "2026-05",
    people: [{ name: "Test", unavailableDays: [] }],
    config: {
      sameAssignmentBonus: 77,
      futureAvailabilityMaxDays: 3
    }
  });

  assert.equal(result.config.sameAssignmentBonus, 77);
  assert.equal(result.config.futureAvailabilityMaxDays, 3);
});

test("buildSchedule figyelembe veszi a scheduler env alapertelmezett ertekeit", () => {
  const originalValue = process.env.SCHEDULER_SAME_ASSIGNMENT_BONUS;
  process.env.SCHEDULER_SAME_ASSIGNMENT_BONUS = "91";

  try {
    const result = buildSchedule({
      month: "2026-05",
      people: [{ name: "Test", unavailableDays: [] }]
    });

    assert.equal(result.config.sameAssignmentBonus, 91);
  } finally {
    if (originalValue == null) {
      delete process.env.SCHEDULER_SAME_ASSIGNMENT_BONUS;
    } else {
      process.env.SCHEDULER_SAME_ASSIGNMENT_BONUS = originalValue;
    }
  }
});
