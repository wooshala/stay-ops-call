export function getDefaultSlaHours(state: string): number {
  switch (state) {
    case "inquiry":
      return 24;
    case "reservation_received":
      return 0.25; // 15 minutes
    case "confirmed":
      return 3;
    default:
      return 24;
  }
}

