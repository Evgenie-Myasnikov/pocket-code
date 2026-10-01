/** Share read-only work; failures never stick and retained metadata expires quickly. */
export function coalesceReads<K, V>(ttlMs = 0, capacity = 32) {
  const entries = new Map<K, { promise: Promise<V>; expires: number }>();
  return (key: K, read: () => Promise<V>): Promise<V> => {
    const now = Date.now(), existing = entries.get(key);
    if (existing && existing.expires > now) return existing.promise;
    for (const [oldKey, entry] of entries) if (entry.expires <= now) entries.delete(oldKey);
    // Bound retained work without evicting another caller's pending request.
    if (entries.size >= capacity) return Promise.resolve().then(read);
    const entry = { promise: Promise.resolve().then(read), expires: Infinity };
    entries.set(key, entry);
    void entry.promise.then(() => {
      if (entries.get(key) !== entry) return;
      if (ttlMs > 0) entry.expires = Date.now() + ttlMs;
      else entries.delete(key);
    }, () => { if (entries.get(key) === entry) entries.delete(key); });
    return entry.promise;
  };
}
