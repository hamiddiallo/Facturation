/**
 * Nettoie et normalise une chaîne de caractères :
 * 1. Supprime les espaces blancs au début et à la fin.
 * 2. Remplace les espaces multiples par un seul espace.
 * 3. Met en majuscule la première lettre de chaque mot et le reste en minuscule (Proper Case).
 * 
 * Exemple : "  aBdouL   HamId  " -> "Abdoul Hamid"
 */
export function normalizeText(text: string): string {
    if (!text) return '';

    return text
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Nettoie un email (minuscule et sans espaces).
 */
export function normalizeEmail(email: string): string {
    if (!email) return '';
    return email.trim().toLowerCase();
}
