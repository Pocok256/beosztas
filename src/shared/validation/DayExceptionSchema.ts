import { z } from "zod";

import type { DayException } from "@shared/types/ScheduleEntry";

/**
 * Runtime schema for a manual day override entry.
 */
export const DayExceptionSchema = z.object({
  dayNumber: z.number(),
  type: z.enum(["workday", "dayoff"]),
  note: z.string().optional()
});

const DayExceptionSchemaExhaustiveCheck: z.infer<typeof DayExceptionSchema> = {} as DayException;
const DayExceptionSchemaReverseCheck: DayException = {} as z.infer<typeof DayExceptionSchema>;

export { DayExceptionSchemaExhaustiveCheck, DayExceptionSchemaReverseCheck };