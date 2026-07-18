/**
 * Reads a boolean feature flag from the environment.
 * Accepts 1/true/yes/on (case-insensitive) as true.
 */
export function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}
