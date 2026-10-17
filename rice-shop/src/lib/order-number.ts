/** 例: R261017-4K7Q2M（日付 + ランダム 6 桁） */
export function newOrderNumber(now = new Date()): string {
  const d = now.toISOString().slice(2, 10).replaceAll("-", "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const rand = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `R${d}-${rand}`;
}
