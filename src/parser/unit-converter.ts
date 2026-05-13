const UNITS_TO_PER_INCH: Record<string, number> = {
  INCH: 1,
  MIL: 1000,
  MM: 25.4,
  MICRON: 25400,
};

export function resolveUnits(unitStr: string, userValue?: number): number {
  if (unitStr === 'USER' && userValue) return userValue;
  return UNITS_TO_PER_INCH[unitStr.toUpperCase()] ?? 1;
}
