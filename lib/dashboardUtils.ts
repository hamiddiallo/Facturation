/**
 * Calcule le numéro de semaine (Dimanche-Samedi) et l'année associée.
 */
export function getWeekData(date: Date): { week: number, year: number } {
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const jan1 = new Date(target.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((target.getTime() - jan1.getTime()) / 86400000);
    const week = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);

    return { week, year: target.getFullYear() };
}

/**
 * Initialise une Map avec les labels des 5 dernières semaines.
 */
export function initializeWeeklyMap(now: Date = new Date()): Map<string, { label: string, ca: number }> {
    const weeklyMap = new Map<string, { label: string, ca: number }>();
    for (let i = 4; i >= 0; i--) {
        const d = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
        const { week, year } = getWeekData(d);
        const key = `${year}-W${week}`;
        const label = `Sem ${String(week).padStart(2, '0')}`;
        weeklyMap.set(key, { label, ca: 0 });
    }
    return weeklyMap;
}

/**
 * Agrège les montants des factures par semaine.
 */
export function aggregateInvoicesByWeek(invoices: any[], weeklyMap: Map<string, { label: string, ca: number }>) {
    invoices?.forEach(inv => {
        const dateStr = inv.date || inv.created_at;
        if (!dateStr) return;
        const d = new Date(dateStr);
        const { week, year } = getWeekData(d);
        const key = `${year}-W${week}`;
        if (weeklyMap.has(key)) {
            weeklyMap.get(key)!.ca += Number(inv.total_amount || 0);
        }
    });
    return Array.from(weeklyMap.values());
}

/**
 * Calcule les métriques financières de base.
 */
export function calculateFinancialMetrics(totalCA: number, totalInvoices: number, totalPaid: number) {
    return {
        averageBasket: totalInvoices > 0 ? totalCA / totalInvoices : 0,
        recoveryRate: totalCA > 0 ? (totalPaid / totalCA) * 100 : 0,
        totalOutstanding: totalCA - totalPaid
    };
}
