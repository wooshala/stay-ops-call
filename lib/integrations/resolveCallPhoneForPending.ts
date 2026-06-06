import { normalizePhone } from "@/lib/utils/phone";

export function resolveCallPhoneForPending(input: {
  phone_number?: string | null;
  normalized_phone?: string | null;
}): string | null {
  const normalized = input.normalized_phone?.trim();
  if (normalized) return normalized;
  const raw = input.phone_number?.trim();
  if (raw) return raw;
  return null;
}

export function buildPendingEventPhoneFields(input: {
  phone_number?: string | null;
  normalized_phone?: string | null;
}) {
  const phone = resolveCallPhoneForPending(input);
  const digits = phone ? normalizePhone(phone) : null;
  return {
    phone,
    customer_phone: phone,
    normalized_phone: digits,
    phone_number: input.phone_number?.trim() || phone,
  };
}
