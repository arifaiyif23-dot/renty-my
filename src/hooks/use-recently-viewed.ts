const STORAGE_KEY = 'renty:recentlyViewed'
const MAX_ITEMS = 10
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

interface RecentlyViewedItem {
  id: string
  title: string
  image: string
  pricePerDay: number
  category: string
  location: string
  timestamp: number
}

export function addRecentlyViewed(item: Omit<RecentlyViewedItem, 'timestamp'>) {
  try {
    const existing = getRecentlyViewed()
    const filtered = existing.filter((i) => i.id !== item.id)
    const updated = [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    /* localStorage not available */
  }
}

export function getRecentlyViewed(): RecentlyViewedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const items: RecentlyViewedItem[] = JSON.parse(raw)
    const cutoff = Date.now() - EXPIRY_MS
    const valid = items.filter((i) => i.timestamp > cutoff)
    if (valid.length !== items.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid))
    }
    return valid
  } catch {
    return []
  }
}
