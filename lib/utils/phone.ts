/**
 * Korean phone normalization: digits only.
 * Empty or no digits → null
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (input == null || input === "") return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) return null;
  return digits;
}
