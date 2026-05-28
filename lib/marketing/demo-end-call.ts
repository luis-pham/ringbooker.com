const FINAL_GOODBYE_PATTERNS = [
  /\b(goodbye|bye for now|have a great day|have a good day|thanks for calling)\b[.!?\s]*$/i,
  /\b(feel free to call back|call back anytime)\b/i,
  /\b(adios|adiós|hasta luego|hasta pronto|que tenga un buen dia|que tenga un buen día|gracias por llamar|gracias,? hasta luego)\b[.!?\s]*$/i,
  /\b(tam biet|tạm biệt|chao anh|chào anh|chao chi|chào chị)\b[.!?\s]*$/i,
  /\b(cam on anh|cảm ơn anh|cam on chi|cảm ơn chị)\b.*\b(tam biet|tạm biệt|chao anh|chào anh|chao chi|chào chị)\b/i,
  /\b(chuc anh mot ngay tot lanh|chúc anh một ngày tốt lành|chuc chi mot ngay tot lanh|chúc chị một ngày tốt lành)\b/i,
  /(再见|拜拜|谢谢来电|感谢来电|祝您一天愉快|祝你一天愉快)[。！？!?\s]*$/i,
  /(안녕히 계세요|안녕히 가세요|감사합니다|전화해 주셔서 감사합니다|좋은 하루 되세요)[.!?\s]*$/i,
];

const NON_FINAL_GREETING_PATTERNS = [
  /\bhow can i help\b/i,
  /\bhow may i help\b/i,
  /\bwhat can i help\b/i,
];

export function assistantTranscriptEndsDemo(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  if (NON_FINAL_GREETING_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  return FINAL_GOODBYE_PATTERNS.some((pattern) => pattern.test(normalized));
}
