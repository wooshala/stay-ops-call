export const OPERATION_CASE_SEVERITY = {
  medium: "medium",
  high: "high",
} as const;

export type OperationCaseSeverity =
  (typeof OPERATION_CASE_SEVERITY)[keyof typeof OPERATION_CASE_SEVERITY];

export const OPERATION_CASE_STATUS = {
  open: "open",
  in_progress: "in_progress",
  resolved: "resolved",
  closed: "closed",
} as const;

export type OperationCaseStatus =
  (typeof OPERATION_CASE_STATUS)[keyof typeof OPERATION_CASE_STATUS];

export const OPERATION_CASE_CHANNEL_TYPE = {
  call: "call",
  chat: "chat",
  email: "email",
  other: "other",
} as const;

export type OperationCaseChannelType =
  (typeof OPERATION_CASE_CHANNEL_TYPE)[keyof typeof OPERATION_CASE_CHANNEL_TYPE];

export function isOperationCaseSeverity(x: unknown): x is OperationCaseSeverity {
  return x === "medium" || x === "high";
}

export function isOperationCaseStatus(x: unknown): x is OperationCaseStatus {
  return x === "open" || x === "in_progress" || x === "resolved" || x === "closed";
}

export function isOperationCaseChannelType(x: unknown): x is OperationCaseChannelType {
  return x === "call" || x === "chat" || x === "email" || x === "other";
}

export function assertOperationCaseEnumValues(input: {
  severity: unknown;
  status: unknown;
  channel_type: unknown;
}): void {
  const bad: string[] = [];
  if (!isOperationCaseSeverity(input.severity)) bad.push(`severity=${String(input.severity)}`);
  if (!isOperationCaseStatus(input.status)) bad.push(`status=${String(input.status)}`);
  if (!isOperationCaseChannelType(input.channel_type)) bad.push(`channel_type=${String(input.channel_type)}`);
  if (bad.length) {
    throw new Error(`workflow enum validation failed (${bad.join(", ")})`);
  }
}

