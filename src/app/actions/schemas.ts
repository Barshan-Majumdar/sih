import { z } from "zod";

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(error: unknown): ActionResult<T> {
  if (error instanceof z.ZodError) {
    return { success: false, error: error.issues.map((i) => i.message).join(", ") };
  }
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "Something went wrong" };
}

export const projectRoleSchema = z.enum(["PROJECT_MANAGER", "SCHEDULER", "SUPERINTENDENT", "TRADE"]);

export const taskStatusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "DELAYED"]);

export const roadblockTypeSchema = z.enum([
  "CHANGE_ORDER",
  "INSPECTION",
  "LABOR",
  "MATERIAL",
  "WEATHER",
  "OTHER",
]);

export const commitmentStatusSchema = z.enum(["COMMITTED", "COMPLETED", "NOT_COMPLETED"]);

export const sirStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

export const submittalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "REVISE_RESUBMIT"]);

export const rfiStatusSchema = z.enum(["OPEN", "ANSWERED", "CLOSED"]);
