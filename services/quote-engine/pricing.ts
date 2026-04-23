import {
  PriceLookupInput,
  PriceLookupResult,
  PriceRow,
  RoomType,
  StayType,
  WeekdayKey,
} from "./types";

const ROOM_PRIORITY: RoomType[] = ["standard", "deluxe", "suite"];

const WEEKDAY_ORDER: WeekdayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const WEEKDAY_INDEX: Record<WeekdayKey, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const MOCK_PRICE_TABLE: PriceRow[] = WEEKDAY_ORDER.flatMap((weekday, index) => {
  const weekend = index === 5 || index === 6;
  return [
    {
      roomType: "standard",
      stayType: "overnight",
      weekday: index,
      price: weekend ? 90000 : 75000,
    },
    {
      roomType: "deluxe",
      stayType: "overnight",
      weekday: index,
      price: weekend ? 120000 : 100000,
    },
    {
      roomType: "suite",
      stayType: "overnight",
      weekday: index,
      price: weekend ? 160000 : 140000,
    },
    {
      roomType: "standard",
      stayType: "dayuse",
      weekday: index,
      price: weekend ? 50000 : 40000,
    },
    {
      roomType: "deluxe",
      stayType: "dayuse",
      weekday: index,
      price: weekend ? 70000 : 60000,
    },
    {
      roomType: "suite",
      stayType: "dayuse",
      weekday: index,
      price: weekend ? 100000 : 90000,
    },
  ];
});

function getWeekdayFromDate(requestedDate: string): number | null {
  const dt = new Date(`${requestedDate}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getDay();
}

function getTodayWeekday(now?: Date): number {
  return (now ?? new Date()).getDay();
}

function weekdayKeyFromIndex(index: number): WeekdayKey {
  return WEEKDAY_ORDER[index] ?? "monday";
}

function lookupPrice(stayType: StayType, roomType: RoomType, weekday: number): number | null {
  const row = MOCK_PRICE_TABLE.find(
    (item) => item.stayType === stayType && item.roomType === roomType && item.weekday === weekday,
  );
  return row?.price ?? null;
}

export function getQuotePrice(input: PriceLookupInput): PriceLookupResult {
  const stayType: StayType = input.stayType ?? "overnight";

  if (input.requestedDate) {
    const weekday = getWeekdayFromDate(input.requestedDate);
    if (weekday !== null) {
      const datePrice = lookupPrice(stayType, input.roomType, weekday);
      if (datePrice !== null) {
        return {
          roomType: input.roomType,
          stayType,
          price: datePrice,
          pricingSource: input.stayType ? "date_exact" : "stay_fallback",
          appliedDate: input.requestedDate,
          appliedWeekday: weekdayKeyFromIndex(weekday),
        };
      }
    }
  }

  if (input.requestedWeekday) {
    const weekdayIndex = WEEKDAY_INDEX[input.requestedWeekday];
    const weekdayPrice = lookupPrice(stayType, input.roomType, weekdayIndex);
    if (weekdayPrice !== null) {
      return {
        roomType: input.roomType,
        stayType,
        price: weekdayPrice,
        pricingSource: input.stayType ? "weekday" : "stay_fallback",
        appliedDate: "weekday-only",
        appliedWeekday: input.requestedWeekday,
      };
    }
  }

  const todayWeekday = getTodayWeekday(input.now);
  const fallbackPrice = lookupPrice(stayType, input.roomType, todayWeekday);

  if (fallbackPrice !== null) {
    return {
      roomType: input.roomType,
      stayType,
      price: fallbackPrice,
      pricingSource: input.stayType ? "today_fallback" : "stay_fallback",
      appliedDate: "today",
      appliedWeekday: weekdayKeyFromIndex(todayWeekday),
    };
  }

  return {
    roomType: input.roomType,
    stayType,
    price: 0,
    pricingSource: "pricing_table_missing",
    appliedDate: "unavailable",
    appliedWeekday: "monday",
  };
}

export function getDefaultRoomTypeCandidates(roomTypeCandidate: RoomType | null): RoomType[] {
  if (roomTypeCandidate) {
    return [roomTypeCandidate, ...ROOM_PRIORITY.filter((room) => room !== roomTypeCandidate)];
  }
  return [...ROOM_PRIORITY];
}
