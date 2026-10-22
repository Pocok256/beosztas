import { z } from "zod";

import type { GenerateScheduleInput } from "@shared/types/GenerateScheduleInput";

import { DayExceptionSchema } from "./DayExceptionSchema";
import { SchedulerConfigOverrideSchema } from "./SchedulerConfigOverrideSchema";
import { SchedulePersonSchema } from "./SchedulePersonSchema";

/**
 * Runtime schema for the monthly schedule generation request payload.
 */
export const GenerateScheduleInputSchema = z.object({
  month: z.string(),
  people: z.array(SchedulePersonSchema),
  exceptions: z.array(DayExceptionSchema).nullable().optional(),
  config: SchedulerConfigOverrideSchema.optional()
});

const GenerateScheduleInputSchemaExhaustiveCheck: z.infer<typeof GenerateScheduleInputSchema> =
  {} as GenerateScheduleInput;
const GenerateScheduleInputSchemaReverseCheck: GenerateScheduleInput = {} as z.infer<
  typeof GenerateScheduleInputSchema
>;

export {
  GenerateScheduleInputSchemaExhaustiveCheck,
  GenerateScheduleInputSchemaReverseCheck
};