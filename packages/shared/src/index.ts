import { z } from "zod";

export const StatusStateSchema = z.enum(["up", "down", "pending"]);
export type StatusState = z.infer<typeof StatusStateSchema>;

export const MonitorSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  interval: z.number(),
  timeout: z.number().optional(),
  status: StatusStateSchema.optional(),
  lastCheck: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});
export type Monitor = z.infer<typeof MonitorSchema>;

export const CheckResultSchema = z.object({
  id: z.string(),
  monitorId: z.string(),
  status: StatusStateSchema,
  latencyMs: z.number().nullable(),
  checkedAt: z.string(),
});
export type CheckResult = z.infer<typeof CheckResultSchema>;

export const IncidentSchema = z.object({
  id: z.string(),
  monitorId: z.string(),
  status: z.enum(["OPEN", "INVESTIGATING", "MITIGATED", "RESOLVED"]),
  startedAt: z.string(),
  resolvedAt: z.string().nullable(),
});
export type Incident = z.infer<typeof IncidentSchema>;

export const IncidentEventSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  message: z.string(),
  createdAt: z.string(),
});
export type IncidentEvent = z.infer<typeof IncidentEventSchema>;

export const IncidentWithRelationsSchema = IncidentSchema.extend({
  monitor: z
    .object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
    })
    .optional(),
  events: z.array(IncidentEventSchema).optional(),
});
export type IncidentWithRelations = z.infer<typeof IncidentWithRelationsSchema>;

export const NotificationChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  config: z.record(z.unknown()).optional(),
});
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const StatusPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  heroMessage: z.string().nullable(),
  showIncidents: z.boolean().optional(),
  showMaintenance: z.boolean().optional(),
});
export type StatusPage = z.infer<typeof StatusPageSchema>;

export const ApiErrorSchema = z.object({ message: z.string() });
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().optional(),
  });

export type PaginatedResponse<T> = {
  data: T[];
  total?: number;
};
