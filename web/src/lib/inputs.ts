/**
 * What each text field accepts, filtered as the owner types or pastes, so a field never holds
 * something the app would refuse later: amounts take digits and one decimal point, handles the
 * directory's rule (ADR-024), names letters. Kit passphrases stay free on purpose.
 */

/** Amounts the owner types or gives: six decimals at most, every asset (USDC and EURC have no more). */
export const INPUT_DECIMALS = 6
const WHOLE_DIGITS = 9

/**
 * An amount as typed or pasted: digits and one decimal point, at most `decimals` decimals and 9 whole
 * digits. "," is the decimal point when it is the only separator ("1,5", a European keypad), a
 * thousands separator otherwise ("1,234.56"); spaces and apostrophes ("1'234.50") are dropped.
 */
export function cleanAmount(raw: string, decimals = INPUT_DECIMALS): string {
  const commas = raw.split(',').length - 1
  const text = (raw.includes('.') || commas > 1 ? raw.replace(/,/g, '') : raw.replace(',', '.')).replace(/[^\d.]/g, '')
  const point = text.indexOf('.')
  const whole = (point === -1 ? text : text.slice(0, point)).replace(/^0+(?=\d)/, '').slice(0, WHOLE_DIGITS)
  if (point === -1 || decimals === 0) return whole
  return `${whole || '0'}.${text.slice(point + 1).replace(/\./g, '').slice(0, decimals)}`
}

/** An @handle as the directory stores it: a lowercase letter, then letters, digits or "_", 20 at most. */
export function cleanHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 20)
}

/**
 * A recipient: a 0x address or an @handle, nothing else. An address is pulled out of a pasted
 * link or payment URI ("ethereum:0x…@84532").
 */
export function cleanRecipient(raw: string): string {
  const address = raw.match(/0x[0-9a-fA-F]{40}/)
  if (address && raw.trim() !== address[0]) return address[0]
  const text = raw.replace(/[^0-9a-zA-Z@_]/g, '')
  return text.startsWith('@') ? `@${cleanHandle(text)}` : text.replace(/@/g, '').slice(0, 42)
}

/**
 * A person's name: letters of any alphabet, spaces, apostrophes, hyphens and dots, 40 at most.
 * `digits` for the mock Swissquote sign-in, whose name is also the demo client's login.
 */
export function cleanName(raw: string, { digits = false }: { digits?: boolean } = {}): string {
  const allowed = new RegExp(`[^\\p{L}\\p{M}${digits ? '\\d' : ''} .'’-]`, 'gu')
  return raw
    .replace(allowed, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '')
    .slice(0, 40)
}

/** A value from the page's query string (a payment link), on the client only. */
export function queryParam(name: string): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(name) ?? ''
}
