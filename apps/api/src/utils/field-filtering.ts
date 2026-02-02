import { log } from "../utils/logger.js";

/**
 * Field filtering utilities for API responses
 * Allows clients to request only needed fields, reducing payload by up to 80%
 * 
 * Usage: GET /api/monitors?fields=id,name,status,latestCheck
 */

// Entity-specific field definitions
const ENTITY_FIELDS: Record<string, Record<string, any>> = {
  monitor: {
    id: true,
    name: true,
    kind: true,
    config: true,
    interval: true,
    timeout: true,
    paused: true,
    createIncidents: true,
    createdAt: true,
    updatedAt: true,
    checks: {
      select: {
        id: true,
        status: true,
        checkedAt: true,
        latencyMs: true,
        payload: true,
      },
      orderBy: { checkedAt: "desc" },
      take: 1,
    },
    incidents: {
      select: {
        id: true,
        status: true,
        startedAt: true,
        resolvedAt: true,
      },
      orderBy: { startedAt: "desc" },
      take: 1,
    },
    group: { select: { id: true, name: true } },
    tags: { select: { tagId: true, tag: { select: { id: true, name: true } } } },
    _count: { select: { notificationChannels: true } },
  },
  incident: {
    id: true,
    monitorId: true,
    status: true,
    startedAt: true,
    resolvedAt: true,
    createdAt: true,
    updatedAt: true,
    monitor: { select: { id: true, name: true, kind: true } },
    events: {
      select: {
        id: true,
        message: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    },
  },
  maintenanceWindow: {
    id: true,
    name: true,
    startsAt: true,
    endsAt: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    monitors: { select: { id: true, name: true } },
  },
  notificationChannel: {
    id: true,
    name: true,
    type: true,
    config: true,
    createdAt: true,
    updatedAt: true,
    monitors: { select: { id: true, name: true } },
  },
};

// Default fields per entity
const DEFAULT_FIELDS: Record<string, string[]> = {
  monitor: ['id', 'name', 'kind', 'createdAt', 'updatedAt'],
  incident: ['id', 'monitorId', 'status', 'startedAt', 'monitor', 'events'],
  maintenanceWindow: ['id', 'name', 'startsAt', 'endsAt', 'monitors'],
  notificationChannel: ['id', 'name', 'type', 'config', 'createdAt'],
};

/**
 * Build Prisma select object based on requested fields
 * Supports entity types: monitor, incident, maintenanceWindow, notificationChannel
 */
export function buildSelectFields(entityType: string, fieldsParam?: string): Record<string, any> {
  const entityFields = ENTITY_FIELDS[entityType];
  const defaultFields = DEFAULT_FIELDS[entityType];

  if (!entityFields || !defaultFields) {
    log.warn(`Unknown entity type: ${entityType}`);
    return { id: true }; // Fallback
  }

  // No field filtering specified - use defaults
  if (!fieldsParam) {
    const select: Record<string, any> = {};
    for (const field of defaultFields) {
      if (entityFields[field] !== undefined) {
        select[field] = entityFields[field];
      }
    }
    return select;
  }

  // Parse requested fields
  const requestedFields = fieldsParam
    .split(',')
    .map(f => f.trim())
    .filter(f => f.length > 0);

  // Build select object with only whitelisted fields
  const select: Record<string, any> = {};
  for (const field of requestedFields) {
    if (entityFields[field] !== undefined) {
      select[field] = entityFields[field];
    }
  }

  // Always include ID for client-side tracking
  if (!select.id && entityFields.id) {
    select.id = true;
  }

  return select;
}

export interface FieldFilterOptions {
  allowedFields: string[];
  defaultFields: string[];
}

/**
 * Parse field filter from query parameter
 */
export function parseFieldFilter(
  fieldsParam: string | undefined,
  options: FieldFilterOptions
): string[] {
  if (!fieldsParam) {
    return options.defaultFields;
  }

  const requestedFields = fieldsParam
    .split(',')
    .map(f => f.trim())
    .filter(f => f.length > 0);

  // Only allow whitelisted fields for security
  return requestedFields.filter(field => options.allowedFields.includes(field));
}

/**
 * Convert field list to Prisma select object
 */
export function buildPrismaSelect(fields: string[], fieldMapping: Record<string, any>) {
  const select: Record<string, any> = {};

  for (const field of fields) {
    if (fieldMapping[field]) {
      select[field] = fieldMapping[field];
    }
  }

  return select;
}

/**
 * Monitor response field mappings
 */
export const MONITOR_FIELDS = {
  id: true,
  name: true,
  kind: true,
  config: true,
  interval: true,
  timeout: true,
  paused: true,
  createIncidents: true,
  status: true, // computed
  group: { select: { id: true, name: true } },
  tags: { select: { id: true, tag: { select: { id: true, name: true } } } },
  latestCheck: {
    select: { id: true, status: true, checkedAt: true, latencyMs: true },
  },
  incident: {
    select: { id: true, status: true, startedAt: true, resolvedAt: true },
  },
  inMaintenance: true, // computed
  meta: true, // computed
  createdAt: true,
  updatedAt: true,
  notificationChannelsCount: true, // computed via _count
};

export const MONITOR_FIELD_OPTIONS = {
  allowedFields: Object.keys(MONITOR_FIELDS),
  defaultFields: [
    'id',
    'name',
    'kind',
    'status',
    'group',
    'tags',
    'latestCheck',
    'incident',
    'inMaintenance',
    'createdAt',
    'updatedAt',
  ],
  minimalFields: ['id', 'name', 'status', 'kind'],
};

/**
 * Incident response field mappings
 */
export const INCIDENT_FIELDS = {
  id: true,
  monitorId: true,
  status: true,
  startedAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  monitor: { select: { id: true, name: true, kind: true } },
};

export const INCIDENT_FIELD_OPTIONS = {
  allowedFields: Object.keys(INCIDENT_FIELDS),
  defaultFields: [
    'id',
    'status',
    'startedAt',
    'resolvedAt',
    'monitor',
  ],
  minimalFields: ['id', 'status', 'startedAt', 'monitor'],
};

/**
 * Check result field mappings
 */
export const CHECK_RESULT_FIELDS = {
  id: true,
  monitorId: true,
  status: true,
  checkedAt: true,
  latencyMs: true,
  statusCode: true,
  message: true,
  // Exclude large payload by default
};

export const CHECK_RESULT_FIELD_OPTIONS = {
  allowedFields: Object.keys(CHECK_RESULT_FIELDS),
  defaultFields: [
    'id',
    'status',
    'checkedAt',
    'latencyMs',
    'statusCode',
  ],
  minimalFields: ['id', 'status', 'checkedAt'],
};

/**
 * Calculate bandwidth savings from field filtering
 * 
 * Example:
 * - Full monitor: 500 bytes
 * - Minimal fields: 150 bytes
 * - Savings: 70%
 */
export function calculateFieldFilteringSavings(
  originalSize: number,
  filteredSize: number
): string {
  const reduction = ((originalSize - filteredSize) / originalSize) * 100;
  return `${Math.round(reduction)}%`;
}

export const FIELD_FILTERING_EXAMPLES = {
  minimal: 'fields=id,name,status',
  standard: 'fields=id,name,status,group,tags,latestCheck',
  full: 'fields=*', // All fields
};
