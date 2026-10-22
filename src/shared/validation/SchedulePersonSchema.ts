import { z } from "zod";

import type { SchedulePerson } from "@shared/types/ScheduleEntry";

/**
 * Runtime schema for a scheduler person input item.
 */
export const SchedulePersonSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  color: z
    .object({
      accent: z.string(),
      surface: z.string(),
      border: z.string(),
      text: z.string()
    })
    .nullable()
    .optional(),
  unavailableDays: z.array(z.number())
});

const SchedulePersonSchemaExhaustiveCheck: z.infer<typeof SchedulePersonSchema> = {} as SchedulePerson;
const SchedulePersonSchemaReverseCheck: SchedulePerson = {} as z.infer<typeof SchedulePersonSchema>;

export { SchedulePersonSchemaExhaustiveCheck, SchedulePersonSchemaReverseCheck };