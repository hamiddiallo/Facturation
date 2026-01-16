import { LRUCache } from 'lru-cache';

interface RateLimitConfig {
    max: number;
    windowMs: number;
}

const cache = new LRUCache<string, number>({
    max: 500, // Nombre max de clés suivies
    ttl: 1000 * 60 * 15, // Durée de rétention par défaut (15 min)
});

/**
 * Utility to limit rate of actions
 * @param key Unique identifier (IP, email, etc.)
 * @param config Max attempts and window duration
 * @returns boolean true if allowed, false if limited
 */
export function rateLimit(key: string, config: RateLimitConfig): boolean {
    const current = cache.get(key) || 0;

    if (current >= config.max) {
        return false;
    }

    cache.set(key, current + 1, { ttl: config.windowMs });
    return true;
}
