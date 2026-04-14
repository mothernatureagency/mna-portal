/**
 * Custom display names for users.
 * Maps email addresses to their preferred display name.
 * Falls back to extracting the first part of the email if not mapped.
 */

const DISPLAY_NAMES: Record<string, string> = {
  'mn@mothernatureagency.com': 'Alexus',
  'admin@mothernatureagency.com': 'Admin',
  'info@mothernatureagency.com': 'Info',
  'jkulkusky@primeivhydration.com': 'Justin',
};

/**
 * Get the display name for a user email.
 * Checks the custom mapping first, then falls back to email prefix.
 */
export function getDisplayName(email: string): string {
  if (!email) return '';

  // Check custom mapping
  const mapped = DISPLAY_NAMES[email.toLowerCase()];
  if (mapped) return mapped;

  // Fallback: extract first name from email
  const name = email.split('@')[0].split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Get the brand name for the overview / business context.
 * Used when displaying the agency-level view.
 */
export function getAgencyDisplayName(): string {
  return 'MN';
}
