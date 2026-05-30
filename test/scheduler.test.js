const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSchedule, buildScheduleCsv } = require("../lib/scheduler");

test("a generator egy honap minden napjara legfeljebb ket embert oszt be", () => {
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: [3, 4] },
      { name: "Bela", unavailableDays: [8, 9] },
      { name: "Csilla", unavailableDays: [14, 15] },
      { name: "David", unavailableDays: [20, 21] }
    ]
  });

  assert.equal(result.days.length, 31);

  for (const day of result.days) {
    assert.ok(day.assignments.length <= 2);
    for (const assignment of day.assignments) {
      assert.equal(assignment.hours, day.requiredHours);
    }
    const assignedHours = day.assignments.reduce((sum, assignment) => sum + assignment.hours, 0);
    assert.equal(assignedHours, day.requiredHours * day.assignments.length);
  }
});

test("ket ember eseten mindketten a teljes napi orat kapjak", () => {
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: [] },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] },
      { name: "David", unavailableDays: [] }
    ]
  });

  assert.equal(result.days[0].assignments.length, 2);
  assert.deepEqual(
    result.days[0].assignments.map((assignment) => assignment.hours),
    [result.days[0].requiredHours, result.days[0].requiredHours]
  );
});

test("a magyar unnepnapokat 24 oras munkaszuneti napkent kezeli", () => {
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: [] },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] }
    ]
  });

  const laborDay = result.days.find((day) => day.dateIso === "2026-05-01");
  const regularWeekday = result.days.find((day) => day.dateIso === "2026-05-04");

  assert.ok(laborDay);
  assert.equal(laborDay.holiday, true);
  assert.equal(laborDay.requiredHours, 24);
  assert.ok(/munka|unnep/i.test(laborDay.holidayLabel));

  assert.ok(regularWeekday);
  assert.equal(regularWeekday.holiday, false);
  assert.equal(regularWeekday.requiredHours, 16);
});

test("a kezileg felvett kivetelek felulirjak a nap logikajat", () => {
  const result = buildSchedule({
    month: "2026-08",
    exceptions: [
      { dayNumber: 8, type: "workday", note: "Ledolgozos szombat" },
      { dayNumber: 21, type: "dayoff", note: "Athelyezett pihenonap" }
    ],
    people: [
      { name: "Anna", unavailableDays: [] },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] }
    ]
  });

  const movedWorkday = result.days.find((day) => day.dateIso === "2026-08-08");
  const movedRestDay = result.days.find((day) => day.dateIso === "2026-08-21");

  assert.ok(movedWorkday);
  assert.equal(movedWorkday.weekend, true);
  assert.equal(movedWorkday.overrideType, "workday");
  assert.equal(movedWorkday.requiredHours, 16);
  assert.equal(movedWorkday.workFreeDay, false);

  assert.ok(movedRestDay);
  assert.equal(movedRestDay.weekend, false);
  assert.equal(movedRestDay.overrideType, "dayoff");
  assert.equal(movedRestDay.requiredHours, 24);
  assert.equal(movedRestDay.workFreeDay, true);
});

test("a generator tiszteletben tartja a nem vallalt napokat, ha van eleg ember", () => {
  const result = buildSchedule({
    month: "2026-06",
    people: [
      { name: "Anna", unavailableDays: [1, 2, 3, 4, 5] },
      { name: "Bela", unavailableDays: [6, 7, 8, 9, 10] },
      { name: "Csilla", unavailableDays: [11, 12, 13, 14, 15] },
      { name: "David", unavailableDays: [16, 17, 18, 19, 20] }
    ]
  });

  const forbiddenByPerson = new Map(
    result.people.map((person) => [person.name, new Set(person.unavailableDays)])
  );

  for (const day of result.days) {
    for (const assignment of day.assignments) {
      assert.equal(forbiddenByPerson.get(assignment.name).has(day.dayNumber), false);
    }
  }
});

test("ha a 168 ora nem oszthato ki mindenkinek, a rendszer figyelmeztetest ad", () => {
  const result = buildSchedule({
    month: "2026-02",
    people: Array.from({ length: 7 }, (_, index) => ({ name: `Ember ${index + 1}`, unavailableDays: [] }))
  });

  assert.equal(result.summary.feasibleForAll168, false);
  assert.ok(result.warnings.length > 0);
});

test("senki nem lepheti at a 168 orat", () => {
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: [] },
      { name: "Bela", unavailableDays: [] }
    ]
  });

  for (const person of result.personSummaries) {
    assert.ok(person.totalHours <= 168);
  }

  assert.ok(result.days.some((day) => day.assignments.length === 0));
});

test("minden ember kap egyedi szint a beosztashoz", () => {
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: [] },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] },
      { name: "David", unavailableDays: [] }
    ]
  });

  const accentColors = new Set(result.people.map((person) => person.color.accent));
  assert.equal(accentColors.size, result.people.length);
  assert.ok(result.days[0].assignments.every((assignment) => assignment.color?.accent));
});

test("a csv export tartalmazza a napi es a szemelyenkenti osszesitot", () => {
  const schedule = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: [] },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] }
    ]
  });

  const csv = buildScheduleCsv({
    ...schedule,
    createdAt: "2026-05-08T10:00:00.000Z"
  });

  assert.match(csv, /Datum;Nap;Tipus;Orak szemelyenkent/);
  assert.match(csv, /Ember;Osszes ora;Elteres a 168 oratol/);
  assert.match(csv, /Anna/);
});

test("az elso napon kezdodo blokk is beleszamit a blokkszamba", () => {
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: Array.from({ length: 26 }, (_, index) => index + 6) },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] }
    ]
  });

  const anna = result.personSummaries.find((person) => person.name === "Anna");
  assert.ok(anna);
  assert.equal(anna.blocks >= 1, true);
});