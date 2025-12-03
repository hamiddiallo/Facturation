// Convert numbers to French words for invoice amounts
export function numberToWords(number: number): string {
    if (number === 0) {
        return "zéro";
    }

    const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
    const teens = ["", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
    const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingts", "quatre-vingt-dix"];

    function convertThreeDigitNumber(num: number): string {
        let result = "";
        const hundreds = Math.floor(num / 100);
        const remainder = num % 100;

        if (hundreds > 0) {
            if (hundreds > 1) {
                result += units[hundreds] + " cent";
            } else {
                result += " cent";
            }
            if (remainder > 0) {
                result += " ";
            }
        }

        if (remainder === 0) {
            return result;
        }
        if (remainder < 10) {
            result += units[remainder];
        } else if (remainder < 20) {
            if (remainder === 10) {
                result += " dix ";
            } else {
                result += teens[remainder - 10];
            }
        } else if (Math.floor(remainder / 10) === 7 || Math.floor(remainder / 10) === 9) {
            if (remainder % 10 === 0) {
                result += tens[Math.floor(remainder / 10) - 1] + "-dix";
            } else {
                result += tens[Math.floor(remainder / 10) - 1] + " " + teens[Math.floor(remainder % 10)];
            }
        } else {
            const ten = Math.floor(remainder / 10);
            const unit = remainder % 10;
            result += tens[ten];
            if (unit > 0) {
                result += "-" + units[unit];
            }
        }

        return result;
    }

    function convertNumberToWordsRecursive(num: number): string {
        if (num === 0) {
            return "";
        }

        const billions = Math.floor(num / 1000000000);
        const millions = Math.floor((num % 1000000000) / 1000000);
        const thousands = Math.floor((num % 1000000) / 1000);
        const remainder = num % 1000;

        let result = "";

        if (billions > 0) {
            if (billions === 10) {
                result += "dix-milliard ";
            } else {
                result += convertThreeDigitNumber(billions) + " milliard";
                if (billions > 1) {
                    result += "s";
                }
                if (millions > 0 || thousands > 0 || remainder > 0) {
                    result += " ";
                }
            }
        }

        if (millions > 0) {
            if (millions === 10) {
                result += "dix-millions ";
            } else {
                result += convertThreeDigitNumber(millions) + " million";
                if (millions > 1) {
                    result += "s";
                }
                if (thousands > 0 || remainder > 0) {
                    result += " ";
                }
            }
        }

        if (thousands > 0) {
            if (thousands === 1) {
                result += "";
            } else if (thousands === 10) {
                result += "dix-";
            } else {
                result += convertThreeDigitNumber(thousands);
            }
            if (thousands > 1) {
                result += " milles";
            } else {
                result += " mille";
            }
            if (remainder > 0) {
                result += " ";
            }
        }

        if (remainder > 0) {
            if (thousands > 0 && remainder < 100) {
                result += " ";
            }
            result += convertThreeDigitNumber(remainder);
        }

        return result;
    }

    return convertNumberToWordsRecursive(number);
}
