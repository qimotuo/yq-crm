const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/

export function sanitizePrice(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (PRICE_PATTERN.test(text)) return text
  const matched = text.match(/\d+(\.\d{1,2})?/)
  return matched ? matched[0] : ''
}

export function isValidPrice(value) {
  const text = String(value ?? '').trim()
  return !text || PRICE_PATTERN.test(text)
}
