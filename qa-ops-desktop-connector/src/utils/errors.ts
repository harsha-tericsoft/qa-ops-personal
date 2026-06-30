/**
 * Custom error types for Desktop Connector
 */

export class DesktopConnectorError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'DesktopConnectorError'
  }
}

export class ConfigError extends DesktopConnectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFIG_ERROR', message, 400, details)
    this.name = 'ConfigError'
  }
}

export class AuthenticationError extends DesktopConnectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('AUTH_ERROR', message, 401, details)
    this.name = 'AuthenticationError'
  }
}

export class ServerError extends DesktopConnectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('SERVER_ERROR', message, 500, details)
    this.name = 'ServerError'
  }
}

export class RoamError extends DesktopConnectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('ROAM_ERROR', message, 503, details)
    this.name = 'RoamError'
  }
}

export interface ErrorResponse {
  success: false
  error: string
  code: string
  statusCode: number
  details?: Record<string, unknown>
}

export function createErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof DesktopConnectorError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    }
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
    }
  }

  return {
    success: false,
    error: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  }
}
