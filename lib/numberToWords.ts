// Convert numbers to French words for invoice amounts (Robust version)
export function numberToWords(num: number): string {
    if (num === 0) return "zéro";

    const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
    const teens = ["", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
    const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingts", "quatre-vingt-dix"];

    function convertLessThanThousand(n: number): string {
        if (n === 0) return "";
        if (n < 10) return units[n];
        if (n < 20) {
            if (n === 10) return "dix";
            return teens[n - 10];
        }
        if (n < 100) {
            const ten = Math.floor(n / 10);
            const unit = n % 10;
            if (ten === 7 || ten === 9) {
                return tens[ten - 1] + (unit === 1 ? " et " : "-") + (unit === 0 ? "dix" : teens[unit]);
            }
            if (unit === 1 && ten < 8) return tens[ten] + " et un";
            return tens[ten] + (unit ? "-" + units[unit] : "");
        }

        const hundred = Math.floor(n / 100);
        const rest = n % 100;
        let result = hundred === 1 ? "cent" : units[hundred] + " cent";
        if (hundred > 1 && rest === 0) result += "s"; // cents
        if (rest) result += " " + convertLessThanThousand(rest);
        return result;
    }

    const billion = Math.floor(num / 1000000000);
    const million = Math.floor((num % 1000000000) / 1000000);
    const thousand = Math.floor((num % 1000000) / 1000);
    const remainder = num % 1000;

    let parts = [];

    if (billion > 0) {
        parts.push(billion === 1 ? "un milliard" : convertLessThanThousand(billion) + " milliards");
    }

    if (million > 0) {
        parts.push(million === 1 ? "un million" : convertLessThanThousand(million) + " millions");
    }

    if (thousand > 0) {
        if (thousand === 1) {
            parts.push("mille");
        } else {
            parts.push(convertLessThanThousand(thousand) + " mille");
        }
    }

    if (remainder > 0) {
        parts.push(convertLessThanThousand(remainder));
    }

    return parts.join(" ").toUpperCase();
}
