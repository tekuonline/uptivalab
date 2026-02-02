/**
 * Form validation utilities
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate URL format
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate port number
 */
export const isValidPort = (port: string | number): boolean => {
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
  return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
};

/**
 * Validate required field
 */
export const isRequired = (value: string | null | undefined): boolean => {
  return value !== null && value !== undefined && value.trim().length > 0;
};

/**
 * Validate minimum length
 */
export const minLength = (value: string, min: number): boolean => {
  return value.length >= min;
};

/**
 * Validate maximum length
 */
export const maxLength = (value: string, max: number): boolean => {
  return value.length <= max;
};

/**
 * Validate number range
 */
export const inRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

/**
 * Validate hostname format
 */
export const isValidHostname = (hostname: string): boolean => {
  // Allow localhost, IP addresses, and domain names
  const hostnameRegex = /^(localhost|(\d{1,3}\.){3}\d{1,3}|([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})$/;
  return hostnameRegex.test(hostname);
};

/**
 * Validate IP address
 */
export const isValidIP = (ip: string): boolean => {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) return false;
  
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

/**
 * Sanitize input to prevent XSS
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate form fields with multiple rules
 */
export const validateForm = (
  fields: Record<string, string>,
  rules: Record<string, Array<{
    validator: (value: string) => boolean;
    message: string;
  }>>
): ValidationResult => {
  const errors: Record<string, string> = {};
  
  for (const [field, validators] of Object.entries(rules)) {
    const value = fields[field] || '';
    
    for (const rule of validators) {
      if (!rule.validator(value)) {
        errors[field] = rule.message;
        break; // Only show first error per field
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Common validation rule builders
 */
export const validators = {
  required: (fieldName: string) => ({
    validator: isRequired,
    message: `${fieldName} is required`,
  }),
  
  email: () => ({
    validator: isValidEmail,
    message: 'Invalid email address',
  }),
  
  url: () => ({
    validator: isValidUrl,
    message: 'Invalid URL format',
  }),
  
  port: () => ({
    validator: (value: string) => isValidPort(value),
    message: 'Port must be between 1 and 65535',
  }),
  
  minLength: (min: number) => ({
    validator: (value: string) => minLength(value, min),
    message: `Must be at least ${min} characters`,
  }),
  
  maxLength: (max: number) => ({
    validator: (value: string) => maxLength(value, max),
    message: `Must be no more than ${max} characters`,
  }),
  
  hostname: () => ({
    validator: isValidHostname,
    message: 'Invalid hostname format',
  }),
  
  ip: () => ({
    validator: isValidIP,
    message: 'Invalid IP address',
  }),
};
