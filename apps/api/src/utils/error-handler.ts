import { Prisma } from "@prisma/client";

import { log } from "../utils/logger.js";

export interface ApiError {
  error: string;
  message: string;
  code?: string;
}

/**
 * Converts various error types into user-friendly API error responses
 */
export function handleApiError(error: unknown, operation: string): ApiError {
  log.error(`Failed to ${operation}:`, error);

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return {
          error: "Duplicate entry",
          message: "A record with this information already exists",
          code: error.code
        };
      case 'P2025':
        // Check if this is a monitor connection error
        if (error.meta?.modelName === 'PublicStatusPage' || 
            error.message?.includes('Expected 1 records to be connected')) {
          return {
            error: "Invalid monitor IDs",
            message: "One or more monitor IDs provided do not exist. Please check that all monitor IDs are valid",
            code: error.code
          };
        }
        return {
          error: "Record not found",
          message: "The requested resource was not found",
          code: error.code
        };
      case 'P2003':
        return {
          error: "Invalid reference",
          message: "The operation failed because it depends on records that don't exist",
          code: error.code
        };
      case 'P2028':
        return {
          error: "Transaction timeout",
          message: "The operation took too long to complete. Please try again",
          code: error.code
        };
      default:
        return {
          error: "Database error",
          message: "A database operation failed. Please try again",
          code: error.code
        };
    }
  }

  // Handle Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      error: "Invalid data",
      message: "The provided data is invalid or incomplete",
    };
  }

  // Handle generic errors
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('connect ECONNREFUSED')) {
      return {
        error: "Connection failed",
        message: "Unable to connect to the service. Please try again later",
      };
    }

    if (error.message.includes('timeout')) {
      return {
        error: "Request timeout",
        message: "The operation took too long to complete. Please try again",
      };
    }

    // For other errors, provide a generic message but log the details
    return {
      error: "Operation failed",
      message: `Failed to ${operation}. Please try again or contact support if the problem persists`,
    };
  }

  // Handle unknown errors
  return {
    error: "Unknown error",
    message: `An unexpected error occurred while trying to ${operation}`,
  };
}

/**
 * Creates a standardized error response for Fastify
 */
export function createErrorResponse(error: unknown, operation: string, statusCode: number = 500) {
  const apiError = handleApiError(error, operation);
  return {
    statusCode,
    ...apiError
  };
}
