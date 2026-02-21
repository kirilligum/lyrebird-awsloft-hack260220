export function stableHash(input = '') {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function seedFromText(input = '', count = 12) {
  const hash = stableHash(input)
  return hash.padEnd(count, hash).slice(0, count)
}
