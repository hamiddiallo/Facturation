// Price calculation utilities for invoices

/**
 * Apply dynamic markup to price and round to nearest multiple of 500
 * @param price - Original unit price
 * @param markupPercentage - Markup percentage (e.g., 15 for 15%)
 * @returns Adjusted price (original or with markup, rounded to nearest 500)
 */
export function calculateAdjustedPrice(price: number, markupPercentage: number = 0): number {
    // If no markup, return original price
    if (markupPercentage === 0) {
        return price;
    }

    // Apply markup percentage
    const markedUpPrice = price * (1 + markupPercentage / 100);

    // Round to nearest multiple of 500
    const roundedPrice = Math.round(markedUpPrice / 500) * 500;

    return roundedPrice;
}

/**
 * Calculate total price for an article with markup applied
 * @param unitPrice - Original unit price
 * @param quantity - Quantity
 * @param markupPercentage - Markup percentage (e.g., 15 for 15%)
 * @returns Total price (quantity * adjusted unit price)
 */
export function calculateArticleTotal(unitPrice: number, quantity: number, markupPercentage: number = 0): number {
    const adjustedPrice = calculateAdjustedPrice(unitPrice, markupPercentage);
    return adjustedPrice * quantity;
}
