const EMAIL_PATTERN =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const CARD_CANDIDATE_PATTERN = /(?<![\d*])\d(?:[ -]?\d){12,18}(?![\d*])/g;

/** `jane.doe@example.com` → `j***@example.com` (ADR 0005). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

/** `4242 4242 4242 4242` → `**** **** **** 4242` (ADR 0005). */
export function maskCard(card: string): string {
  const digits = card.replace(/\D/g, '');
  if (digits.length < 12) return '****';
  return `**** **** **** ${digits.slice(-4)}`;
}

function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function cardNumbersIn(text: string): string[] {
  return [...text.matchAll(CARD_CANDIDATE_PATTERN)]
    .map((match) => match[0])
    .filter((candidate) => passesLuhn(candidate.replace(/\D/g, '')));
}

export interface UnmaskedPii {
  kind: 'email' | 'card';
  /** Already masked, safe to print in test failures. */
  masked: string;
}

/** Finds unmasked emails and (Luhn-valid) card numbers in any string or key inside `value`. */
export function findUnmaskedPii(value: unknown): UnmaskedPii[] {
  const found: UnmaskedPii[] = [];
  walkStrings(value, (text) => {
    for (const match of text.matchAll(EMAIL_PATTERN)) {
      found.push({ kind: 'email', masked: maskEmail(match[0]) });
    }
    for (const card of cardNumbersIn(text)) {
      found.push({ kind: 'card', masked: maskCard(card) });
    }
    return text;
  });
  return found;
}

/** Returns a copy of `value` with every email and card number in its strings and keys masked. */
export function maskPiiDeep<T>(value: T): T {
  return walkStrings(value, (text) => {
    let masked = text.replace(EMAIL_PATTERN, maskEmail);
    for (const card of cardNumbersIn(masked)) {
      masked = masked.replace(card, maskCard(card));
    }
    return masked;
  });
}

/** Visits every string in `value`, including plain-object keys. */
function walkStrings<T>(value: T, visit: (text: string) => string): T {
  if (typeof value === 'string') return visit(value) as T;
  if (Array.isArray(value)) {
    return value.map((item: unknown) => walkStrings(item, visit)) as T;
  }
  if (value !== null && typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype) return value;
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      let newKey = visit(key);
      // Two keys that mask to the same text must not overwrite each other.
      for (let n = 2; newKey !== key && newKey in result; n++) {
        newKey = `${visit(key)} (${n})`;
      }
      result[newKey] = walkStrings(item, visit);
    }
    return result as T;
  }
  return value;
}
