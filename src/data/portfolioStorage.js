const RECENTS_STORAGE_KEY = 'mjmstocks.recentSymbols'
const FAVORITES_STORAGE_KEY = 'mjmstocks.favoriteSymbols'
const FAVORITES_MANUAL_ORDER_KEY = 'mjmstocks.favoriteManualOrder'
const OWNED_POSITIONS_STORAGE_KEY = 'mjmstocks.ownedPositions'

function readJsonArray(key) {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
  } catch {
    return []
  }
}

function writeJsonArray(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function getRecentSymbols() {
  return readJsonArray(RECENTS_STORAGE_KEY).filter(
    (item) => typeof item === 'string',
  )
}

export function setRecentSymbols(symbols) {
  writeJsonArray(
    RECENTS_STORAGE_KEY,
    symbols.filter((item) => typeof item === 'string').slice(0, 3),
  )
}

export function getFavoriteSymbols() {
  return readJsonArray(FAVORITES_STORAGE_KEY).filter(
    (item) => typeof item === 'string',
  )
}

export function setFavoriteSymbols(symbols) {
  writeJsonArray(
    FAVORITES_STORAGE_KEY,
    symbols.filter((item) => typeof item === 'string'),
  )
}

export function getFavoriteManualOrder() {
  return readJsonArray(FAVORITES_MANUAL_ORDER_KEY).filter(
    (item) => typeof item === 'string',
  )
}

export function setFavoriteManualOrder(symbols) {
  writeJsonArray(
    FAVORITES_MANUAL_ORDER_KEY,
    symbols.filter((item) => typeof item === 'string'),
  )
}

export function getOwnedPositions() {
  const positions = readJsonArray(OWNED_POSITIONS_STORAGE_KEY)
  return positions.filter(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof item.symbol === 'string' &&
      typeof item.quantity === 'number',
  )
}
