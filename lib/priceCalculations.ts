// Price calculation utilities for invoices

/**
 * Apply 15% markup to price for THIERNODJO & FRERES company
 * and round up to nearest multiple of 500
 * @param price - Original unit price
 * @param companyId - Company identifier
 * @returns Adjusted price (original or with markup)
 */
export function calculateAdjustedPrice(price: number, companyId: string): number {
    // Only apply markup for THIERNODJO company
    if (companyId !== 'thiernodjo') {
        return price;
    }

    // Apply 15% markup
    const markedUpPrice = price * 1.15;

    // Round up to nearest multiple of 500
    const roundedPrice = Math.ceil(markedUpPrice / 500) * 500;

    return roundedPrice;
}

/**
 * Calculate total price for an article with markup applied
 * @param unitPrice - Original unit price
 * @param quantity - Quantity
 * @param companyId - Company identifier
 * @returns Total price (quantity * adjusted unit price)
 */
export function calculateArticleTotal(unitPrice: number, quantity: number, companyId: string): number {
    const adjustedPrice = calculateAdjustedPrice(unitPrice, companyId);
    return adjustedPrice * quantity;
}
