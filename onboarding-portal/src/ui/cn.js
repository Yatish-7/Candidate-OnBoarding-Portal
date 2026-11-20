// Joins class names, dropping anything falsy. cn('a', cond && 'b', null) → "a b"
export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}
