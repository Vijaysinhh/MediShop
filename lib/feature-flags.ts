export function isEnabledFlag(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

// Safe default: voice sale is absent unless a build explicitly enables it.
export const voiceSaleEnabled = isEnabledFlag(
  process.env.NEXT_PUBLIC_ENABLE_VOICE_SALE,
);
