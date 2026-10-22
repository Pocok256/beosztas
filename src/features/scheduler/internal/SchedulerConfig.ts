import type {
  SchedulerConfigField,
  SchedulerConfigManifest,
  SchedulerConfigOverride,
  SchedulerConfigValues
} from "@shared/types/SchedulerConfig";
import { ValidationError } from "@shared/errors/ValidationError";
import { SchedulerConfigOverrideSchema } from "@shared/validation/SchedulerConfigOverrideSchema";
type SchedulerConfigError = Error & {
  statusCode?: number;
};
type ResolveSchedulerConfigOptions = {
  env?: NodeJS.ProcessEnv;
  overrideStatusCode?: number;
};

type SchedulerConfigFieldDefinition = SchedulerConfigField & {
  sectionId: string;
};

type ParseNumericValueOptions = {
  sourceLabel: string;
  statusCode?: number;
};

const SCHEDULER_CONFIG_SECTIONS = [
  {
    id: "blockFlow",
    title: "Blokkok es parositas",
    description:
      "Ezek az ertekek azt szabalyzzak, mennyire ragaszkodjon a generator ugyanahhoz a parhoz, es mikor kezdjen el uj blokkot keresni."
  },
  {
    id: "primaryContinuity",
    title: "Primary folytonossag",
    description:
      "Ezek a sulyok a primary szerep napok kozotti megtartasarol dontenek, kulonosen akkor, amikor a par vagy a partner valtozik."
  },
  {
    id: "roleBalance",
    title: "Primary-secondary egyensuly",
    description:
      "Ezekkel lehet finomhangolni, hogy a rendszer mennyire tartsa kozel egymashoz az emberek primary es secondary terheleset."
  },
  {
    id: "workloadRotation",
    title: "Terheles es rotacio",
    description:
      "Ez a csoport azt befolyasolja, mennyire hamar pihentessen vagy forgasson uj embereket a rendszer, ha valaki mar elorebb jar az oraszamban."
  },
  {
    id: "lookahead",
    title: "Elorelatas",
    description:
      "Ezek a beallitasok azt jutalmazzak, ha olyan embert valaszt a rendszer, aki varhatoan tobb napon at folytathato lesz egy blokkban."
  }
];

const SCHEDULER_CONFIG_FIELDS: SchedulerConfigFieldDefinition[] = [
  {
    key: "sameAssignmentBonus",
    sectionId: "blockFlow",
    envName: "SCHEDULER_SAME_ASSIGNMENT_BONUS",
    label: "Azonos blokk bonusz",
    description:
      "Ennyire eri meg a rendszernek ugyanazzal a parral vagy ugyanazzal a solo emberrel folytatni a kovetkezo napot.",
    min: 0,
    max: 600,
    step: 1,
    defaultValue: 54
  },
  {
    key: "sameAssignmentDecayStartStreak",
    sectionId: "blockFlow",
    envName: "SCHEDULER_SAME_ASSIGNMENT_DECAY_START_STREAK",
    label: "Bonusz csokkenes indulasa",
    description:
      "Hany egymas utani kozos nap utan kezdjen csokkenni az azonos blokk bonusza. Nagyobb ertek hosszabb blokkokat enged.",
    min: 1,
    max: 14,
    step: 1,
    defaultValue: 2
  },
  {
    key: "sameAssignmentDecayPerDay",
    sectionId: "blockFlow",
    envName: "SCHEDULER_SAME_ASSIGNMENT_DECAY_PER_DAY",
    label: "Bonusz csokkenese naponkent",
    description:
      "Amikor egy blokk mar tul hosszu, naponkent ennyivel csokken az azonos blokk bonusza.",
    min: 0,
    max: 120,
    step: 1,
    defaultValue: 12
  },
  {
    key: "sameAssignmentMinimumBonus",
    sectionId: "blockFlow",
    envName: "SCHEDULER_SAME_ASSIGNMENT_MINIMUM_BONUS",
    label: "Minimum blokk bonusz",
    description:
      "A blokkfolytonossag jutalma eddig az also szintig csokkenhet, de ez ala mar nem megy.",
    min: 0,
    max: 300,
    step: 1,
    defaultValue: 18
  },
  {
    key: "partialContinuationBonus",
    sectionId: "blockFlow",
    envName: "SCHEDULER_PARTIAL_CONTINUATION_BONUS",
    label: "Reszleges atfedes bonusz",
    description:
      "Ennyi pluszt kap az a jelolt, ahol a tegnapi emberek kozul legalabb egy bent marad.",
    min: 0,
    max: 300,
    step: 1,
    defaultValue: 24
  },
  {
    key: "fullBreakPenalty",
    sectionId: "blockFlow",
    envName: "SCHEDULER_FULL_BREAK_PENALTY",
    label: "Teljes blokktores buntetes",
    description:
      "Ennyire fajjon a rendszernek, ha a tegnapi beosztott emberek kozul senki nem marad bent.",
    min: 0,
    max: 300,
    step: 1,
    defaultValue: 18
  },
  {
    key: "primaryContinuationBonus",
    sectionId: "primaryContinuity",
    envName: "SCHEDULER_PRIMARY_CONTINUATION_BONUS",
    label: "Primary tovabbvitele bonusz",
    description:
      "Ennyire preferalja a generator, ha a tegnapi primary ugyanabban a szerepben tud tovabbmenni.",
    min: 0,
    max: 600,
    step: 1,
    defaultValue: 180
  },
  {
    key: "primaryDemotionPenalty",
    sectionId: "primaryContinuity",
    envName: "SCHEDULER_PRIMARY_DEMOTION_PENALTY",
    label: "Primary visszasorolasi buntetes",
    description:
      "Ekkora levonas jar, ha a tegnapi primary bent marad ugyan, de mar csak secondary vagy nem-primary szerepet kap.",
    min: 0,
    max: 700,
    step: 1,
    defaultValue: 220
  },
  {
    key: "primaryAvailableButDroppedPenalty",
    sectionId: "primaryContinuity",
    envName: "SCHEDULER_PRIMARY_AVAILABLE_BUT_DROPPED_PENALTY",
    label: "Elerheto primary eldobasa",
    description:
      "Ennyire buntesse a rendszer, ha a tegnapi primary dolgozhatna, de teljesen kikerul a napbol.",
    min: 0,
    max: 400,
    step: 1,
    defaultValue: 96
  },
  {
    key: "samePairPrimaryLockBonus",
    sectionId: "primaryContinuity",
    envName: "SCHEDULER_SAME_PAIR_PRIMARY_LOCK_BONUS",
    label: "Azonos par primary-zar bonusz",
    description:
      "Ha ugyanaz a ket ember visz tovabb egy blokkot, ez jutalmazza, hogy a primary ne cserelodjon fel feleslegesen.",
    min: 0,
    max: 700,
    step: 1,
    defaultValue: 220
  },
  {
    key: "samePairPrimarySwapPenalty",
    sectionId: "primaryContinuity",
    envName: "SCHEDULER_SAME_PAIR_PRIMARY_SWAP_PENALTY",
    label: "Azonos par primary-csere buntetes",
    description:
      "Ha ugyanaz a par marad, de a primary felcserelodik, ekkora buntetes jar erte.",
    min: 0,
    max: 800,
    step: 1,
    defaultValue: 360
  },
  {
    key: "sameRoleLayoutBonus",
    sectionId: "primaryContinuity",
    envName: "SCHEDULER_SAME_ROLE_LAYOUT_BONUS",
    label: "Valtozatlan szerepelosztas bonusz",
    description:
      "Ennyit erjen meg, ha ugyanabban a parban ugyanaz marad primary es secondary is.",
    min: 0,
    max: 300,
    step: 1,
    defaultValue: 48
  },
  {
    key: "swappedRoleLayoutPenalty",
    sectionId: "primaryContinuity",
    envName: "SCHEDULER_SWAPPED_ROLE_LAYOUT_PENALTY",
    label: "Felcserelt szerepelosztas buntetes",
    description:
      "Ennyire vegye rossz neven a rendszer, ha ugyanaz a par marad, de a primary es a secondary helyet cserel.",
    min: 0,
    max: 400,
    step: 1,
    defaultValue: 72
  },
  {
    key: "primaryRoleHourTolerance",
    sectionId: "roleBalance",
    envName: "SCHEDULER_PRIMARY_ROLE_HOUR_TOLERANCE",
    label: "Primary ora tures",
    description:
      "Ennyi oraval lehet valaki elorebb primaryban a secondaryhez kepest, mielott buntetni kezdi a rendszer.",
    min: 0,
    max: 96,
    step: 1,
    defaultValue: 24
  },
  {
    key: "roleGapHourDivisor",
    sectionId: "roleBalance",
    envName: "SCHEDULER_ROLE_GAP_HOUR_DIVISOR",
    label: "Orakulonbseg oszto",
    description:
      "A primary-secondary orakulonbseg javulasa ezzel az osztoval kerul at pontszamba. Kisebb ertek agresszivebb kiegyenlitest jelent.",
    min: 1,
    max: 200,
    step: 1,
    defaultValue: 32
  },
  {
    key: "roleGapDayWeight",
    sectionId: "roleBalance",
    envName: "SCHEDULER_ROLE_GAP_DAY_WEIGHT",
    label: "Napkulonbseg sulya",
    description:
      "A primary es secondary napok kozti kulonbseg ennyire hasson a score-ra.",
    min: 0,
    max: 80,
    step: 1,
    defaultValue: 10
  },
  {
    key: "projectedPrimaryHourPenalty",
    sectionId: "roleBalance",
    envName: "SCHEDULER_PROJECTED_PRIMARY_HOUR_PENALTY",
    label: "Primary ora tullogas buntetese",
    description:
      "Ha valaki a primary tolerancia fole menne, orankent ennyi buntetest kapjon a jelolt.",
    min: 0,
    max: 20,
    step: 0.05,
    defaultValue: 1.35
  },
  {
    key: "projectedPrimaryDayPenalty",
    sectionId: "roleBalance",
    envName: "SCHEDULER_PROJECTED_PRIMARY_DAY_PENALTY",
    label: "Primary nap tullogas buntetese",
    description:
      "Ha valaki a kiosztott napjaihoz kepest tul sok primary napot kapna, naponkent ennyi buntetes jarjon.",
    min: 0,
    max: 80,
    step: 0.5,
    defaultValue: 14
  },
  {
    key: "preservedRoleGapWeight",
    sectionId: "roleBalance",
    envName: "SCHEDULER_PRESERVED_ROLE_GAP_WEIGHT",
    label: "Megorzott primary blokk szerep-egyensuly sulya",
    description:
      "Amikor a tegnapi primary tovabbmegy, a szerepkiegyenlites ennyire szolhat bele a dontesbe. Kisebb ertek erosebb folytonossagot jelent.",
    min: 0,
    max: 2,
    step: 0.01,
    defaultValue: 0.12
  },
  {
    key: "preservedPrimaryPenaltyWeight",
    sectionId: "roleBalance",
    envName: "SCHEDULER_PRESERVED_PRIMARY_PENALTY_WEIGHT",
    label: "Megorzott primary blokk tullogasi sulya",
    description:
      "Amikor ugyanaz a primary megy tovabb, a primary tullogas buntetese ennyivel legyen felszorozva.",
    min: 0,
    max: 2,
    step: 0.01,
    defaultValue: 0.4
  },
  {
    key: "maxHoursBonus",
    sectionId: "roleBalance",
    envName: "SCHEDULER_MAX_HOURS_BONUS",
    label: "Pontosan 168 orara kifuto bonusz",
    description:
      "Ha egy uj muszak utan valaki pont eleri a 168 oras plafont, ekkora jutalom jarjon.",
    min: 0,
    max: 80,
    step: 1,
    defaultValue: 14
  },
  {
    key: "availabilityScarcityWeight",
    sectionId: "workloadRotation",
    envName: "SCHEDULER_AVAILABILITY_SCARCITY_WEIGHT",
    label: "Ritka elerhetoseg sulya",
    description:
      "Ennyire kedvezzen a rendszer annak, akinek kevesebb vallalt napja van a honapban.",
    min: 0,
    max: 80,
    step: 1,
    defaultValue: 18
  },
  {
    key: "workStreakSoftLimit",
    sectionId: "workloadRotation",
    envName: "SCHEDULER_WORK_STREAK_SOFT_LIMIT",
    label: "Munka blokk puhabb hosszhatar",
    description:
      "Eddig a blokkhosszig no a folytonossagi bonusz, utana mar fokozatosan bunteti a tul hosszu sorozatokat.",
    min: 1,
    max: 14,
    step: 1,
    defaultValue: 3
  },
  {
    key: "workRestartPenalty",
    sectionId: "workloadRotation",
    envName: "SCHEDULER_WORK_RESTART_PENALTY",
    label: "Blokk ujrainditasi buntetes",
    description:
      "Ha valaki mar dolgozott a honapban, de nem tegnap, ennyi levonassal indul ujra nala a blokk.",
    min: 0,
    max: 40,
    step: 1,
    defaultValue: 3
  },
  {
    key: "workContinuationBaseBonus",
    sectionId: "workloadRotation",
    envName: "SCHEDULER_WORK_CONTINUATION_BASE_BONUS",
    label: "Blokkfolytatas alapbonusz",
    description:
      "Ha valaki tegnap is dolgozott, ennyi alapjutalmat kapjon a folytatasra.",
    min: 0,
    max: 80,
    step: 1,
    defaultValue: 18
  },
  {
    key: "workContinuationGrowthBonus",
    sectionId: "workloadRotation",
    envName: "SCHEDULER_WORK_CONTINUATION_GROWTH_BONUS",
    label: "Blokkfolytatas novekmeny",
    description:
      "A puha hosszhatarig naponkent ennyivel nojon a blokkfolytatas bonusza.",
    min: 0,
    max: 30,
    step: 1,
    defaultValue: 5
  },
  {
    key: "workContinuationOverflowPenalty",
    sectionId: "workloadRotation",
    envName: "SCHEDULER_WORK_CONTINUATION_OVERFLOW_PENALTY",
    label: "Tul hosszu blokk buntetese",
    description:
      "A puha hosszhatar utan minden extra nap ennyi buntetest hozzon a blokkfolytatas score-ba.",
    min: 0,
    max: 30,
    step: 1,
    defaultValue: 7
  },
  {
    key: "totalHoursLeadGrace",
    sectionId: "workloadRotation",
    envName: "SCHEDULER_TOTAL_HOURS_LEAD_GRACE",
    label: "Oraelony tures",
    description:
      "Ennyi teljes oraval lehet valaki a legkevesebbet dolgozo ember elott buntetes nelkul.",
    min: 0,
    max: 96,
    step: 1,
    defaultValue: 24
  },
  {
    key: "totalHoursLeadPenalty",
    sectionId: "workloadRotation",
    envName: "SCHEDULER_TOTAL_HOURS_LEAD_PENALTY",
    label: "Oraelony buntetese",
    description:
      "A tures feletti teljes oraelony orankent ennyi buntetest kapjon.",
    min: 0,
    max: 10,
    step: 0.1,
    defaultValue: 3.5
  },
  {
    key: "primaryHoursLeadGrace",
    sectionId: "workloadRotation",
    envName: "SCHEDULER_PRIMARY_HOURS_LEAD_GRACE",
    label: "Primary oraelony tures",
    description:
      "Ennyi primary oraval lehet valaki a legkevesebb primaryt dolgozo ember elott buntetes nelkul.",
    min: 0,
    max: 96,
    step: 1,
    defaultValue: 24
  },
  {
    key: "primaryHoursLeadPenalty",
    sectionId: "workloadRotation",
    envName: "SCHEDULER_PRIMARY_HOURS_LEAD_PENALTY",
    label: "Primary oraelony buntetese",
    description:
      "A tures feletti primary oraelony orankent ennyi buntetest kapjon a primary jelolt.",
    min: 0,
    max: 10,
    step: 0.1,
    defaultValue: 1.5
  },
  {
    key: "futureAvailabilityMaxDays",
    sectionId: "lookahead",
    envName: "SCHEDULER_FUTURE_AVAILABILITY_MAX_DAYS",
    label: "Elorelatas maximum napja",
    description:
      "Legfeljebb hany kovetkezo napig nezze a rendszer, hogy valaki varhatoan bent tarthato-e egy blokkban.",
    min: 1,
    max: 14,
    step: 1,
    defaultValue: 5
  },
  {
    key: "futureAvailabilityBonusPerDay",
    sectionId: "lookahead",
    envName: "SCHEDULER_FUTURE_AVAILABILITY_BONUS_PER_DAY",
    label: "Elore lathato folytathatosag bonusza",
    description:
      "Minden varhatoan folytathato nap ennyi pluszpontot adjon annak, aki primarynak vagy solo szerepbe kerulne.",
    min: 0,
    max: 60,
    step: 1,
    defaultValue: 10
  },
  {
    key: "fairTargetImprovementDivisor",
    sectionId: "lookahead",
    envName: "SCHEDULER_FAIR_TARGET_IMPROVEMENT_DIVISOR",
    label: "Fair celkozelites oszto",
    description:
      "Az oraszam kiegyenlitesebol szarmazo nyereseget ezzel az osztoval alakitsuk pontszamma. Kisebb ertek erosebb egalizalast jelent.",
    min: 1,
    max: 500,
    step: 1,
    defaultValue: 160
  }
];

const KNOWN_CONFIG_KEYS = new Set<keyof SchedulerConfigValues>(SCHEDULER_CONFIG_FIELDS.map((field) => field.key));

function createSchedulerConfigError(message: string, statusCode?: number): ValidationError {
  return new ValidationError({
    message,
    statusCode,
    constraint: "scheduler-config"
  });
}

export function cloneSchedulerConfig(config: SchedulerConfigValues): SchedulerConfigValues {
  return { ...config };
}

function parseNumericValue(
  rawValue: unknown,
  field: SchedulerConfigFieldDefinition,
  options: ParseNumericValueOptions
): number {
  const numericValue = typeof rawValue === "number" ? rawValue : Number(String(rawValue).trim());

  if (!Number.isFinite(numericValue)) {
    throw createSchedulerConfigError(
      `${field.label} hibas erteket kapott a ${options.sourceLabel} forrasbol.`,
      options.statusCode
    );
  }

  if (numericValue < field.min || numericValue > field.max) {
    throw createSchedulerConfigError(
      `${field.label} csak ${field.min} es ${field.max} kozotti ertek lehet.`,
      options.statusCode
    );
  }

  return numericValue;
}

export function resolveSchedulerConfig(
  overrides: SchedulerConfigOverride = {},
  options: ResolveSchedulerConfigOptions = {}
): SchedulerConfigValues {
  const env = options.env || process.env;
  const overrideStatusCode = options.overrideStatusCode ?? 400;
  const parsedOverrides = SchedulerConfigOverrideSchema.parse(overrides);

  if (parsedOverrides != null && (typeof parsedOverrides !== "object" || Array.isArray(parsedOverrides))) {
    throw createSchedulerConfigError("A scheduler finomhangolo beallitasai hibasak.", overrideStatusCode);
  }

  for (const key of Object.keys(parsedOverrides || {}) as Array<keyof SchedulerConfigValues>) {
    if (!KNOWN_CONFIG_KEYS.has(key)) {
      throw createSchedulerConfigError(`Ismeretlen scheduler beallitas: ${key}.`, overrideStatusCode);
    }
  }

  const resolved = {} as SchedulerConfigValues;

  for (const field of SCHEDULER_CONFIG_FIELDS) {
    const hasOverride = parsedOverrides != null && Object.prototype.hasOwnProperty.call(parsedOverrides, field.key);
    const envValue = env?.[field.envName];

    if (hasOverride) {
      resolved[field.key] = parseNumericValue(parsedOverrides[field.key], field, {
        sourceLabel: "keresben",
        statusCode: overrideStatusCode
      });
      continue;
    }

    if (envValue != null && String(envValue).trim() !== "") {
      resolved[field.key] = parseNumericValue(envValue, field, {
        sourceLabel: `kornyezeti valtozo (${field.envName})`
      });
      continue;
    }

    resolved[field.key] = field.defaultValue;
  }

  return resolved;
}

export function getSchedulerConfigManifest(options: ResolveSchedulerConfigOptions = {}): SchedulerConfigManifest {
  const values = resolveSchedulerConfig({}, options);

  return {
    values,
    sections: SCHEDULER_CONFIG_SECTIONS.map((section) => ({
      ...section,
      fields: SCHEDULER_CONFIG_FIELDS.filter((field) => field.sectionId === section.id).map((field) => ({
        key: field.key,
        envName: field.envName,
        label: field.label,
        description: field.description,
        min: field.min,
        max: field.max,
        step: field.step,
        defaultValue: values[field.key]
      }))
    }))
  } as SchedulerConfigManifest;
}
