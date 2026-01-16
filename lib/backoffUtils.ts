/**
 * Utility to execute a function with exponential backoff
 */
export async function withBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<T> {
    let delay = initialDelay;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;

            console.warn(`Tentative ${i + 1} échouée. Re-tentative dans ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Backoff exponentiel
        }
    }

    throw new Error("Échec après plusieurs tentatives");
}
