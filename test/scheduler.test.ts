import assert from "node:assert/strict";
import test from "node:test";

import { buildSchedule } from "../server";
import { buildScheduleHtml } from "../server";
import { buildScheduleXls } from "../server";
import { resolveSchedulerConfig } from "../server";
import { __private as schedulerPrivate } from "../src/features/scheduler/internal/SchedulerCore";

type SchedulerPrivateApi = {
  buildRoleSwapRanges: (days: unknown[], config?: unknown) => Array<{ startIndex: number; endIndex: number }>;
  repairPrimaryContinuityDays: (params: unknown) => Array<{ assignments: Array<{ role: string; name: string; hours: number }> }>;
};

const typedSchedulerPrivate = schedulerPrivate as SchedulerPrivateApi;

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

  const firstSplitDay = result.days.find((day) => day.assignments.length === 2);

  assert.ok(firstSplitDay);
  assert.deepEqual(
    firstSplitDay.assignments.map((assignment) => assignment.hours),
    [firstSplitDay.requiredHours, firstSplitDay.requiredHours]
  );
});

test("a ketfos napokon mindig van primary es secondary szerep", () => {
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: [] },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] },
      { name: "David", unavailableDays: [] }
    ]
  });

  for (const day of result.days.filter((entry) => entry.assignments.length === 2)) {
    assert.deepEqual(
      day.assignments.map((assignment) => assignment.role).sort(),
      ["primary", "secondary"]
    );
  }
});

test("az egyeduli muszak primarynak szamit minden osszesitesben", () => {
  const allDays = Array.from({ length: 31 }, (_, index) => index + 1);
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: allDays.filter((day) => day !== 1) },
      { name: "Bela", unavailableDays: [1] },
      { name: "Csilla", unavailableDays: [1] },
      { name: "David", unavailableDays: [1] }
    ]
  });

  const firstDay = result.days[0];
  const anna = result.personSummaries.find((person) => person.name === "Anna");

  assert.equal(firstDay.assignments.length, 1);
  assert.equal(firstDay.assignments[0].role, "primary");
  assert.ok(anna);
  assert.equal(anna.totalHours, firstDay.requiredHours);
  assert.equal(anna.primaryHours, firstDay.requiredHours);
  assert.equal(anna.primaryDays, 1);
  assert.equal(anna.secondaryHours, 0);
  assert.equal(anna.soloHours, 0);
});

test("a gyakran kapott szerepek tobbnapos blokkokban is megjelennek", () => {
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: [] },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] },
      { name: "David", unavailableDays: [] },
      { name: "Erika", unavailableDays: [] },
      { name: "Ferenc", unavailableDays: [] }
    ]
  });

  const peopleWithHeavyRoles = result.personSummaries.filter(
    (person) => person.primaryDays >= 4 || person.secondaryDays >= 4
  );

  assert.ok(peopleWithHeavyRoles.length > 0);

  for (const person of peopleWithHeavyRoles) {
    if (person.primaryDays >= 4) {
      assert.ok(person.longestPrimaryStreak >= 2);
    }

    if (person.secondaryDays >= 4) {
      assert.ok(person.longestSecondaryStreak >= 2);
    }
  }
});

test("a rendszer kozel tartja a primary es secondary oraszamokat", () => {
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: [] },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] },
      { name: "David", unavailableDays: [] },
      { name: "Erika", unavailableDays: [] },
      { name: "Ferenc", unavailableDays: [] }
    ]
  });

  const peopleWithBothRoles = result.personSummaries.filter(
    (person) => person.primaryHours > 0 && person.secondaryHours > 0
  );
  const hourDiffs = peopleWithBothRoles.map((person) => Math.abs(person.primaryHours - person.secondaryHours));
  const averageHourDiff = hourDiffs.reduce((sum, diff) => sum + diff, 0) / Math.max(1, hourDiffs.length);
  const primaryHours = result.personSummaries.map((person) => person.primaryHours);
  const primarySpread = Math.max(...primaryHours) - Math.min(...primaryHours);

  assert.ok(peopleWithBothRoles.length > 0);
  assert.ok(averageHourDiff <= 40);
  assert.ok(primarySpread <= 80);
});

test("a rendszer vedi a szuk elerhetosegu emberek korai napjait a teljesen szabad emberrel szemben", () => {
  const allDays = Array.from({ length: 31 }, (_, index) => index + 1);
  const earlyDays = [1, 2, 3, 4, 5, 6, 7];
  const lateDays = allDays.filter((day) => !earlyDays.includes(day));
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Always", unavailableDays: [] },
      { name: "EarlyA", unavailableDays: lateDays },
      { name: "EarlyB", unavailableDays: lateDays },
      { name: "LateA", unavailableDays: earlyDays },
      { name: "LateB", unavailableDays: earlyDays }
    ]
  });

  for (const day of result.days.slice(0, earlyDays.length)) {
    assert.deepEqual(
      day.assignments.map((assignment) => assignment.name).sort(),
      ["EarlyA", "EarlyB"]
    );
  }
});

test("a repair pass a teljes azonos paros blokkot es a szomszedos handoff blokkparokat is vegignezi", () => {
  const config = resolveSchedulerConfig();
  const people = [
    { id: "person-a", name: "A", color: null, unavailableDays: [] },
    { id: "person-b", name: "B", color: null, unavailableDays: [] },
    { id: "person-c", name: "C", color: null, unavailableDays: [] }
  ];
  const days = [
    {
      dayNumber: 1,
      assignments: [
        { personId: "person-a", name: "A", color: null, hours: 16, role: "primary" },
        { personId: "person-b", name: "B", color: null, hours: 16, role: "secondary" }
      ]
    },
    {
      dayNumber: 2,
      assignments: [
        { personId: "person-a", name: "A", color: null, hours: 16, role: "primary" },
        { personId: "person-b", name: "B", color: null, hours: 16, role: "secondary" }
      ]
    },
    {
      dayNumber: 3,
      assignments: [
        { personId: "person-b", name: "B", color: null, hours: 16, role: "primary" },
        { personId: "person-c", name: "C", color: null, hours: 16, role: "secondary" }
      ]
    },
    {
      dayNumber: 4,
      assignments: [
        { personId: "person-b", name: "B", color: null, hours: 16, role: "primary" },
        { personId: "person-c", name: "C", color: null, hours: 16, role: "secondary" }
      ]
    },
    {
      dayNumber: 5,
      assignments: [
        { personId: "person-a", name: "A", color: null, hours: 16, role: "primary" },
        { personId: "person-c", name: "C", color: null, hours: 16, role: "secondary" }
      ]
    },
    {
      dayNumber: 6,
      assignments: [
        { personId: "person-a", name: "A", color: null, hours: 16, role: "primary" },
        { personId: "person-c", name: "C", color: null, hours: 16, role: "secondary" }
      ]
    },
    {
      dayNumber: 7,
      assignments: [
        { personId: "person-a", name: "A", color: null, hours: 16, role: "primary" },
        { personId: "person-c", name: "C", color: null, hours: 16, role: "secondary" }
      ]
    },
    {
      dayNumber: 8,
      assignments: [
        { personId: "person-a", name: "A", color: null, hours: 16, role: "primary" },
        { personId: "person-c", name: "C", color: null, hours: 16, role: "secondary" }
      ]
    }
  ];

  const ranges = typedSchedulerPrivate.buildRoleSwapRanges(days, config);

  assert.ok(ranges.some((range) => range.startIndex === 0 && range.endIndex === 0));
  assert.ok(ranges.some((range) => range.startIndex === 0 && range.endIndex === 1));
  assert.ok(ranges.some((range) => range.startIndex === 1 && range.endIndex === 1));
  assert.ok(ranges.some((range) => range.startIndex === 4 && range.endIndex === 5));
  assert.ok(ranges.some((range) => range.startIndex === 6 && range.endIndex === 7));
  assert.ok(ranges.some((range) => range.startIndex === 1 && range.endIndex === 2));
  assert.ok(ranges.some((range) => range.startIndex === 2 && range.endIndex === 3));
  assert.ok(ranges.some((range) => range.startIndex === 0 && range.endIndex === 3));
});

test("a continuity repair csokkenti a primary-megszakitast, de nem nullazhatja le egyik dolgozo primary orait sem", () => {
  const config = resolveSchedulerConfig();
  const people = [
    { id: "person-a", name: "A", color: null, unavailableDays: [] },
    { id: "person-b", name: "B", color: null, unavailableDays: [] }
  ];
  const days = [
    {
      dayNumber: 1,
      assignments: [
        { personId: "person-a", name: "A", color: null, hours: 16, role: "primary" },
        { personId: "person-b", name: "B", color: null, hours: 16, role: "secondary" }
      ]
    },
    {
      dayNumber: 2,
      assignments: [
        { personId: "person-a", name: "A", color: null, hours: 16, role: "primary" },
        { personId: "person-b", name: "B", color: null, hours: 16, role: "secondary" }
      ]
    },
    {
      dayNumber: 3,
      assignments: [
        { personId: "person-a", name: "A", color: null, hours: 16, role: "secondary" },
        { personId: "person-b", name: "B", color: null, hours: 16, role: "primary" }
      ]
    },
    {
      dayNumber: 4,
      assignments: [
        { personId: "person-a", name: "A", color: null, hours: 16, role: "secondary" },
        { personId: "person-b", name: "B", color: null, hours: 16, role: "primary" }
      ]
    }
  ];

  const repairedDays = typedSchedulerPrivate.repairPrimaryContinuityDays({ config, people, days });
  const primaryByDay = repairedDays.map(
    (day) => day.assignments.find((assignment) => assignment.role === "primary")?.name
  );
  const switchCount = primaryByDay.reduce((count, name, index) => {
    if (index === 0 || name === primaryByDay[index - 1]) {
      return count;
    }

    return count + 1;
  }, 0);

  const primaryHoursByPerson = repairedDays.reduce<Record<string, number>>(
    (summary, day) => {
      for (const assignment of day.assignments) {
        if (assignment.role === "primary") {
          summary[assignment.name] = (summary[assignment.name] || 0) + assignment.hours;
        }
      }

      return summary;
    },
    {}
  );

  assert.ok(switchCount <= 1);
  assert.ok((primaryHoursByPerson.A || 0) > 0);
  assert.ok((primaryHoursByPerson.B || 0) > 0);
});

test("ha ugyanaz a ket ember visz egy tobbnapos blokkot, a primary szerep nem valt naponta", () => {
  const firstBlockDays = [1, 2, 3, 4, 5, 6, 7, 8];
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Apa", unavailableDays: [] },
      { name: "Peti", unavailableDays: [] },
      { name: "Anna", unavailableDays: firstBlockDays },
      { name: "Gergo", unavailableDays: firstBlockDays },
      { name: "Anya", unavailableDays: firstBlockDays },
      { name: "Oszkar", unavailableDays: firstBlockDays }
    ]
  });

  const pairedBlock = result.days.slice(0, firstBlockDays.length);

  for (const day of pairedBlock) {
    assert.equal(day.assignments.length, 2);
    assert.deepEqual(
      day.assignments.map((assignment) => assignment.name).sort(),
      ["Apa", "Peti"]
    );
  }

  const primaryByDay = pairedBlock.map(
    (day) => day.assignments.find((assignment) => assignment.role === "primary")?.name
  );
  const switchCount = primaryByDay.reduce((count, name, index) => {
    if (index === 0 || name === primaryByDay[index - 1]) {
      return count;
    }

    return count + 1;
  }, 0);

  assert.ok(switchCount <= 1);
});

test("ha a primary ember marad es csak a partner cserelodik, a primary szerep folytatodik", () => {
  const laterDays = [10, 11, 12, 13];
  const activeDays = new Set([1, 2, 3, 4, ...laterDays]);
  const firstPartnerDays = new Set([1, 2]);
  const secondPartnerDays = new Set([3, 4, 10, 12]);

  const result = buildSchedule({
    month: "2026-05",
    people: [
      {
        name: "A",
        unavailableDays: Array.from({ length: 31 }, (_, index) => index + 1).filter((day) => firstPartnerDays.has(day) === false)
      },
      {
        name: "B",
        unavailableDays: Array.from({ length: 31 }, (_, index) => index + 1).filter((day) => activeDays.has(day) === false)
      },
      {
        name: "C",
        unavailableDays: Array.from({ length: 31 }, (_, index) => index + 1).filter((day) => secondPartnerDays.has(day) === false)
      },
      { name: "D", unavailableDays: Array.from({ length: 31 }, (_, index) => index + 1) },
      { name: "E", unavailableDays: Array.from({ length: 31 }, (_, index) => index + 1) },
      { name: "F", unavailableDays: Array.from({ length: 31 }, (_, index) => index + 1) }
    ]
  });

  const firstTwoDays = result.days.slice(0, 2);
  const nextTwoDays = result.days.slice(2, 4);

  for (const day of firstTwoDays) {
    assert.deepEqual(
      day.assignments.map((assignment) => assignment.name).sort(),
      ["A", "B"]
    );
  }

  for (const day of nextTwoDays) {
    assert.deepEqual(
      day.assignments.map((assignment) => assignment.name).sort(),
      ["B", "C"]
    );
  }

  const firstBlockPrimary = firstTwoDays[0].assignments.find((assignment) => assignment.role === "primary")?.name;
  const handoffPrimary = firstTwoDays[1].assignments.find((assignment) => assignment.role === "primary")?.name;
  const secondBlockPrimary = nextTwoDays[0].assignments.find((assignment) => assignment.role === "primary")?.name;

  const firstBlockSwitchCount = firstTwoDays.reduce((count, day, index) => {
    if (index === 0) {
      return count;
    }

    const previousPrimary = firstTwoDays[index - 1].assignments.find((assignment) => assignment.role === "primary")?.name;
    const currentPrimary = day.assignments.find((assignment) => assignment.role === "primary")?.name;
    return previousPrimary === currentPrimary ? count : count + 1;
  }, 0);

  const secondBlockSwitchCount = nextTwoDays.reduce((count, day, index) => {
    if (index === 0) {
      return count;
    }

    const previousPrimary = nextTwoDays[index - 1].assignments.find((assignment) => assignment.role === "primary")?.name;
    const currentPrimary = day.assignments.find((assignment) => assignment.role === "primary")?.name;
    return previousPrimary === currentPrimary ? count : count + 1;
  }, 0);

  assert.ok(["A", "B"].includes(firstBlockPrimary ?? ""));
  assert.equal(handoffPrimary, "B");
  assert.equal(secondBlockPrimary, "B");
  assert.ok(firstBlockSwitchCount <= 1);
  assert.ok(secondBlockSwitchCount <= 1);
});

test("a rendszer inkabb blokkok kozott cserel primaryt, hogy kozel fele-fele maradjon", () => {
  const blockOneDays = [1, 2, 3, 4];
  const blockTwoDays = [15, 16, 17, 18];
  const forcedDays = new Set([...blockOneDays, ...blockTwoDays]);
  const allDays = Array.from({ length: 30 }, (_, index) => index + 1);

  const result = buildSchedule({
    month: "2026-06",
    people: [
      {
        name: "Apa",
        unavailableDays: allDays.filter((day) => !forcedDays.has(day))
      },
      {
        name: "Peti",
        unavailableDays: allDays.filter((day) => !forcedDays.has(day))
      },
      {
        name: "Anna",
        unavailableDays: allDays.filter((day) => forcedDays.has(day))
      },
      {
        name: "Gergo",
        unavailableDays: allDays.filter((day) => forcedDays.has(day))
      },
      {
        name: "Anya",
        unavailableDays: allDays.filter((day) => forcedDays.has(day))
      },
      {
        name: "Oszkar",
        unavailableDays: allDays.filter((day) => forcedDays.has(day))
      }
    ]
  });

  const firstBlock = result.days.filter((day) => blockOneDays.includes(day.dayNumber));
  const secondBlock = result.days.filter((day) => blockTwoDays.includes(day.dayNumber));

  for (const block of [firstBlock, secondBlock]) {
    for (const day of block) {
      assert.equal(day.assignments.length, 2);
      assert.deepEqual(
        day.assignments.map((assignment) => assignment.name).sort(),
        ["Apa", "Peti"]
      );
    }
  }

  const firstBlockPrimary = firstBlock[0].assignments.find((assignment) => assignment.role === "primary")?.name;
  const secondBlockPrimary = secondBlock[0].assignments.find((assignment) => assignment.role === "primary")?.name;

  assert.ok(firstBlock.every((day) => day.assignments.find((assignment) => assignment.role === "primary")?.name === firstBlockPrimary));
  assert.ok(secondBlock.every((day) => day.assignments.find((assignment) => assignment.role === "primary")?.name === secondBlockPrimary));
  assert.notEqual(firstBlockPrimary, secondBlockPrimary);

  const apa = result.personSummaries.find((person) => person.name === "Apa");
  const peti = result.personSummaries.find((person) => person.name === "Peti");

  assert.ok(apa);
  assert.ok(peti);
  assert.equal(Math.abs(apa.primaryHours - apa.secondaryHours), 0);
  assert.equal(Math.abs(peti.primaryHours - peti.secondaryHours), 0);
});

test("a szerepkoros osszegzo bontja a 16 es 24 oras primary es secondary napokat", () => {
  const result = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: [] },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] },
      { name: "David", unavailableDays: [] },
      { name: "Erika", unavailableDays: [] },
      { name: "Ferenc", unavailableDays: [] }
    ]
  });

  const primaryDays16 = result.days.filter((day) => day.assignments.length > 0 && day.requiredHours === 16).length;
  const primaryDays24 = result.days.filter((day) => day.assignments.length > 0 && day.requiredHours === 24).length;
  const splitDays16 = result.days.filter((day) => day.assignments.length === 2 && day.requiredHours === 16).length;
  const splitDays24 = result.days.filter((day) => day.assignments.length === 2 && day.requiredHours === 24).length;
  const totals = result.personSummaries.reduce(
    (summary, person) => ({
      primary16Days: summary.primary16Days + person.primary16Days,
      primary24Days: summary.primary24Days + person.primary24Days,
      secondary16Days: summary.secondary16Days + person.secondary16Days,
      secondary24Days: summary.secondary24Days + person.secondary24Days
    }),
    { primary16Days: 0, primary24Days: 0, secondary16Days: 0, secondary24Days: 0 }
  );

  assert.equal(totals.primary16Days, primaryDays16);
  assert.equal(totals.secondary16Days, splitDays16);
  assert.equal(totals.primary24Days, primaryDays24);
  assert.equal(totals.secondary24Days, splitDays24);

  for (const person of result.personSummaries) {
    assert.equal(person.primary16Days + person.primary24Days, person.primaryDays);
    assert.equal(person.secondary16Days + person.secondary24Days, person.secondaryDays);
  }
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
  assert.ok(/munka|unnep/i.test(laborDay.holidayLabel ?? ""));

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
      assert.equal(forbiddenByPerson.get(assignment.name)?.has(day.dayNumber) ?? false, false);
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

test("ha valaki dolgozik a honapban, akkor kap legalabb valamennyi primary orat is", () => {
  const result = buildSchedule({
    month: "2026-07",
    people: [
      { name: "TEszt", unavailableDays: [] },
      { name: "Bela", unavailableDays: [14, 15, 16, 17, 18, 19, 20, 21, 22] },
      { name: "Géza", unavailableDays: [22, 23, 24, 25, 26, 27, 28, 29, 30] },
      { name: "Oszkár", unavailableDays: [7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { name: "Albert", unavailableDays: [1, 2, 3] },
      { name: "Andi", unavailableDays: [29, 30, 31] },
      { name: "Tihamér", unavailableDays: [] }
    ],
    config: {
      sameAssignmentBonus: 54,
      sameAssignmentDecayStartStreak: 2,
      sameAssignmentDecayPerDay: 12,
      sameAssignmentMinimumBonus: 18,
      partialContinuationBonus: 24,
      fullBreakPenalty: 18,
      primaryContinuationBonus: 180,
      primaryDemotionPenalty: 220,
      primaryAvailableButDroppedPenalty: 96,
      samePairPrimaryLockBonus: 220,
      samePairPrimarySwapPenalty: 360,
      sameRoleLayoutBonus: 48,
      swappedRoleLayoutPenalty: 72,
      primaryRoleHourTolerance: 24,
      roleGapHourDivisor: 32,
      roleGapDayWeight: 10,
      projectedPrimaryHourPenalty: 1.35,
      projectedPrimaryDayPenalty: 14,
      preservedRoleGapWeight: 0.12,
      preservedPrimaryPenaltyWeight: 0.4,
      maxHoursBonus: 14,
      availabilityScarcityWeight: 18,
      workStreakSoftLimit: 3,
      workRestartPenalty: 3,
      workContinuationBaseBonus: 18,
      workContinuationGrowthBonus: 5,
      workContinuationOverflowPenalty: 7,
      totalHoursLeadGrace: 24,
      totalHoursLeadPenalty: 3.5,
      primaryHoursLeadGrace: 24,
      primaryHoursLeadPenalty: 1.5,
      futureAvailabilityMaxDays: 5,
      futureAvailabilityBonusPerDay: 10,
      fairTargetImprovementDivisor: 160
    }
  });

  const workedPeople = result.personSummaries.filter((person) => person.totalHours > 0);
  assert.ok(workedPeople.length > 0);

  for (const person of workedPeople) {
    assert.ok(person.primaryHours > 0, `${person.name} nem maradhat primary ora nelkul.`);
  }
});

test("az utovizsgalo logika a blokk szelen is tud primary-secondary cseret talalni, ha az erdemben javitja a primary egyensulyt", () => {
  const result = buildSchedule({
    month: "2026-07",
    people: [
      { name: "asd", unavailableDays: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26] },
      { name: "dddd", unavailableDays: [12, 13, 14, 15, 16, 17, 18, 19, 20] },
      { name: "fffff", unavailableDays: [20, 21, 22, 23, 24, 25, 26, 27, 28] },
      { name: "ffff", unavailableDays: [1, 2, 3, 4, 5] },
      { name: "gggggg", unavailableDays: [1, 2, 3] },
      { name: "mmmmmmmm", unavailableDays: [] },
      { name: "nnnnnnn", unavailableDays: [] }
    ],
    config: {
      sameAssignmentBonus: 54,
      sameAssignmentDecayStartStreak: 2,
      sameAssignmentDecayPerDay: 12,
      sameAssignmentMinimumBonus: 18,
      partialContinuationBonus: 24,
      fullBreakPenalty: 18,
      primaryContinuationBonus: 180,
      primaryDemotionPenalty: 220,
      primaryAvailableButDroppedPenalty: 96,
      samePairPrimaryLockBonus: 220,
      samePairPrimarySwapPenalty: 360,
      sameRoleLayoutBonus: 48,
      swappedRoleLayoutPenalty: 72,
      primaryRoleHourTolerance: 24,
      roleGapHourDivisor: 32,
      roleGapDayWeight: 10,
      projectedPrimaryHourPenalty: 1.35,
      projectedPrimaryDayPenalty: 14,
      preservedRoleGapWeight: 0.12,
      preservedPrimaryPenaltyWeight: 0.4,
      maxHoursBonus: 14,
      availabilityScarcityWeight: 18,
      workStreakSoftLimit: 3,
      workRestartPenalty: 3,
      workContinuationBaseBonus: 18,
      workContinuationGrowthBonus: 5,
      workContinuationOverflowPenalty: 7,
      totalHoursLeadGrace: 24,
      totalHoursLeadPenalty: 3.5,
      primaryHoursLeadGrace: 24,
      primaryHoursLeadPenalty: 1.5,
      futureAvailabilityMaxDays: 5,
      futureAvailabilityBonusPerDay: 10,
      fairTargetImprovementDivisor: 160
    }
  });

  const primaryHours = result.personSummaries.map((person) => person.primaryHours);
  const primarySpread = Math.max(...primaryHours) - Math.min(...primaryHours);
  const fffff = result.personSummaries.find((person) => person.name === "fffff");
  const ffff = result.personSummaries.find((person) => person.name === "ffff");

  assert.ok(fffff);
  assert.ok(ffff);
  assert.ok(primarySpread <= 40, `A primary szoras tul nagy maradt: ${primarySpread}`);
  assert.ok(fffff.primaryHours <= 96, `fffff primary oraja tul magas maradt: ${fffff.primaryHours}`);
  assert.ok(ffff.primaryHours >= 80, `ffff primary oraja tul alacsony maradt: ${ffff.primaryHours}`);
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

  const accentColors = new Set(result.people.map((person) => person.color?.accent ?? ""));
  assert.equal(accentColors.size, result.people.length);
  assert.ok(result.days[0].assignments.every((assignment) => assignment.color?.accent));
});

test("az xls export tartalmazza a napi es a szemelyenkenti osszesitot", () => {
  const schedule = buildSchedule({
    month: "2026-05",
    people: [
      { name: "Anna", unavailableDays: [] },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] }
    ]
  });

  const xls = buildScheduleXls({
    ...schedule,
    id: "schedule-fixture-2026-05",
    createdAt: "2026-05-08T10:00:00.000Z"
  });

  assert.match(xls, /<Worksheet ss:Name="Havi matrix">/);
  assert.match(xls, /<Data ss:Type="String">Anna<\/Data>/);
  assert.match(xls, /<Data ss:Type="String">P<\/Data>/);
  assert.match(xls, /<Worksheet ss:Name="Havi matrix">[\s\S]*Tabla nezetu osszesito[\s\S]*<Data ss:Type="String">Primary ora<\/Data>/);
  assert.match(xls, /<Worksheet ss:Name="Osszesites">/);
  assert.match(xls, /<Data ss:Type="String">Primary ora<\/Data>/);
});

test("az xls export a mintafajlhoz hasonlo matrixot es szerepkoros jeloleseket hasznal", () => {
  const xls = buildScheduleXls({
    id: "xls-fixture-basic",
    month: "2026-05",
    monthLabel: "2026. majus",
    summary: {
      totalDays: 2,
      overrideDays: 0,
      overrideDayoffDays: 0,
      overrideWorkdayDays: 0,
      weekendDays: 1,
      holidayDays: 0,
      weekdayDays: 1,
      workFreeDays: 1,
      totalRequiredHours: 40,
      minimumCoverageHours: 40,
      maximumAssignableHours: 80,
      targetTotalHours: 336,
      targetScheduledHours: 80,
      scheduledHours: 56,
      averageRequiredHours: 20,
      desiredTargetHours: 168,
      feasibleForAll168: true,
      coveragePossibleWithinCap: true,
      theoreticalAverageHours: 20,
      maxFeasibleAverageHours: 20,
      scheduledAverageHours: 28
    },
    people: [{ name: "Anna", unavailableDays: [] }, { name: "Bela", unavailableDays: [] }],
    config: resolveSchedulerConfig(),
    exceptions: [],
    days: [
      {
        dateIso: "2026-05-01",
        weekdayIndex: 1,
        weekdayLabel: "Hetfo",
        holiday: false,
        holidayLabel: null,
        dayNumber: 1,
        overrideLabel: null,
        overrideType: null,
        weekend: false,
        workFreeDay: false,
        requiredHours: 16,
        assignments: [
          { personId: "person-1", name: "Anna", color: null, hours: 16, role: "primary" },
          { personId: "person-2", name: "Bela", color: null, hours: 16, role: "secondary" }
        ]
      },
      {
        dateIso: "2026-05-02",
        weekdayIndex: 6,
        weekdayLabel: "Szombat",
        holiday: false,
        holidayLabel: null,
        dayNumber: 2,
        overrideLabel: null,
        overrideType: null,
        weekend: true,
        workFreeDay: true,
        requiredHours: 24,
        assignments: [{ personId: "person-1", name: "Anna", color: null, hours: 24, role: "solo" }]
      }
    ],
    personSummaries: [
      {
        id: "person-1",
        name: "Anna",
        color: null,
        totalHours: 40,
        primaryHours: 16,
        primary16Days: 1,
        primary24Days: 0,
        secondaryHours: 0,
        secondary16Days: 0,
        secondary24Days: 0,
        soloHours: 24,
        targetDelta: -128,
        workedDays: 2,
        primaryDays: 1,
        secondaryDays: 0,
        soloDays: 0,
        splitDays: 1,
        blocks: 1,
        primaryBlocks: 1,
        secondaryBlocks: 0,
        longestStreak: 2,
        longestPrimaryStreak: 1,
        longestSecondaryStreak: 0,
        roleBalanceDelta: 16,
        unavailableDays: []
      },
      {
        id: "person-2",
        name: "Bela",
        color: null,
        totalHours: 16,
        primaryHours: 0,
        primary16Days: 0,
        primary24Days: 0,
        secondaryHours: 16,
        secondary16Days: 1,
        secondary24Days: 0,
        soloHours: 0,
        targetDelta: -152,
        workedDays: 1,
        primaryDays: 0,
        secondaryDays: 1,
        soloDays: 0,
        splitDays: 1,
        blocks: 1,
        primaryBlocks: 0,
        secondaryBlocks: 1,
        longestStreak: 1,
        longestPrimaryStreak: 0,
        longestSecondaryStreak: 1,
        roleBalanceDelta: -16,
        unavailableDays: []
      }
    ],
    warnings: [],
    createdAt: "2026-05-01T08:00:00.000Z"
  });

  assert.match(xls, /ss:StyleID="primaryAssignment"><Data ss:Type="String">K: 16:00 - 08:00 \(primary\)<\/Data>/);
  assert.match(xls, /ss:StyleID="secondaryAssignment"><Data ss:Type="String">K: 16:00 - 08:00 \(secondary\)<\/Data>/);
  assert.match(xls, /ss:StyleID="primaryAssignment"><Data ss:Type="String">K: 08:00 - 08:00 \(primary\)<\/Data>/);
  assert.match(xls, /<Data ss:Type="String">Anna<\/Data><\/Cell><Cell><Data ss:Type="Number">40<\/Data>/);
});

test("az xls export escape-eli a specialis karaktereket es jelzi a kiveteles napokat", () => {
  const schedule = buildSchedule({
    month: "2026-08",
    exceptions: [
      { dayNumber: 8, type: "workday", note: "Ledolgozos szombat" },
      { dayNumber: 21, type: "dayoff", note: "Athelyezett pihenonap" }
    ],
    people: [
      { name: 'Anna; "QA"', unavailableDays: [] },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] }
    ]
  });

  const xls = buildScheduleXls({
    ...schedule,
    id: "schedule-fixture-2026-08",
    createdAt: "2026-08-01T08:00:00.000Z"
  });

  assert.match(xls, /Anna; &quot;QA&quot;/);
  assert.match(xls, /<Worksheet ss:Name="Specialis napok">/);
  assert.match(xls, /Kiveteles munkanap/);
  assert.match(xls, /Kiveteles szunnap/);
  assert.match(xls, /<Data ss:Type="String">Megjegyzes<\/Data>/);
});

test("a html export escape-eli a tartalmat es szin nelkul is renderel", () => {
  const schedule = buildSchedule({
    month: "2026-08",
    exceptions: [{ dayNumber: 8, type: "workday", note: "Ledolgozos szombat" }],
    people: [
      { name: "<Anna>", unavailableDays: [] },
      { name: "Bela", unavailableDays: [] },
      { name: "Csilla", unavailableDays: [] }
    ]
  });

  const html = buildScheduleHtml({
    ...schedule,
    id: "html-fixture-2026-08",
    createdAt: "2026-08-01T08:00:00.000Z",
    warnings: ["Figyelem <script>alert(1)</script>"],
    people: schedule.people.map((person) =>
      person.name === "<Anna>" ? { ...person, color: null } : person
    ),
    personSummaries: schedule.personSummaries.map((person) =>
      person.name === "<Anna>" ? { ...person, color: null } : person
    ),
    days: schedule.days.map((day) => ({
      ...day,
      assignments: day.assignments.map((assignment) =>
        assignment.name === "<Anna>" ? { ...assignment, color: null } : assignment
      )
    }))
  });

  assert.match(html, /&lt;Anna&gt;/);
  assert.match(html, /Figyelem &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /style=""/);
  assert.match(html, /Kiveteles munkanap/);
  assert.match(html, /bg-red-100 text-red-700/);
  assert.match(html, /bg-yellow-100 text-yellow-800/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
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