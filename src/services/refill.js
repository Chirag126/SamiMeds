export const DEFAULT_REFILL_DAYS = 5;

/** Days of medicine left, or null when stock isn't tracked. */
export function daysLeft(medicine) {
  if (medicine.stock == null || !medicine.times?.length) return null;
  const perDay = (medicine.pillsPerDose || 1) * medicine.times.length;
  return Math.floor(medicine.stock / perDay);
}

export function needsRefill(medicine) {
  const days = daysLeft(medicine);
  return days != null && medicine.active && days <= (medicine.refillThresholdDays ?? DEFAULT_REFILL_DAYS);
}

/** Stock change when a dose is taken (-) or un-taken (+). Never goes below zero. */
export function adjustStock(medicine, direction) {
  if (medicine.stock == null) return medicine;
  const delta = (medicine.pillsPerDose || 1) * direction;
  const stock = Math.max(0, medicine.stock + delta);
  return { ...medicine, stock, refillAlertSent: needsRefill({ ...medicine, stock }) ? medicine.refillAlertSent : false };
}
