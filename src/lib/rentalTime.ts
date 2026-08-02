import { format, differenceInDays } from "date-fns";

// Exact hours between scheduled pickup and scheduled return (min 1).
export function rentalHours(startDate: string, endDate: string, pickupTime: string, returnTime: string): number {
  const startTs = new Date(`${startDate}T${pickupTime}`).getTime();
  const endTs = new Date(`${endDate}T${returnTime}`).getTime();
  return Math.max(1, Math.round((endTs - startTs) / 3600000));
}

// Calendar days spanned (inclusive).
export function rentalDays(startDate: string, endDate: string): number {
  return differenceInDays(new Date(endDate), new Date(startDate)) + 1;
}

// Tiered discount — must mirror supabase/functions/request-booking.
export function discountPercentForHours(hours: number): number {
  if (hours >= 720) return 20; // >= 30 days
  if (hours >= 168) return 10; // >= 7 days
  return 0;
}

// Hybrid day+hour pricing — must mirror the server exactly.
export function computeRentalSubtotal(dayRate: number, hourRate: number | null, hours: number): number {
  const fullDays = Math.floor(hours / 24);
  const remHours = hours % 24;
  const d = dayRate || 0;
  const h = hourRate && hourRate > 0 ? hourRate : d / 24;
  return fullDays * d + remHours * h;
}

export function computeRentalTotal(
  dayRate: number,
  hourRate: number | null,
  hours: number,
  promoDiscount = 0
): number {
  const subtotal = computeRentalSubtotal(dayRate, hourRate, hours);
  const pct = discountPercentForHours(hours);
  const base = subtotal - (subtotal * pct) / 100;
  return Math.max(0, Math.round((base - promoDiscount) * 100) / 100);
}

// "09:00" -> "9:00 AM"
export function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// "Aug 3 · 9:00 AM → Aug 5 · 6:00 PM"
export function formatRentalPeriod(
  startDate: string,
  endDate: string,
  pickupTime?: string | null,
  returnTime?: string | null
): string {
  const start = format(new Date(startDate), "MMM d, yyyy");
  const end = format(new Date(endDate), "MMM d, yyyy");
  if (pickupTime || returnTime) {
    return `${start} · ${formatTime(pickupTime)} → ${end} · ${formatTime(returnTime)}`;
  }
  return `${start} → ${end}`;
}

// "57 hrs", "2 days 9 hrs"
export function formatDuration(hours: number): string {
  if (hours < 24) return `${hours} hrs`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem > 0 ? `${days} d ${rem} hrs` : `${days} d`;
}

// Same-day rentals require returnTime after pickupTime.
export function isSameDayReturnValid(startDate: string, endDate: string, pickupTime: string, returnTime: string): boolean {
  if (startDate !== endDate) return true;
  const [sh, sm] = pickupTime.split(":").map(Number);
  const [eh, em] = returnTime.split(":").map(Number);
  return sh * 60 + sm < eh * 60 + em;
}
