'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InvoiceData, InvoiceType, Company } from '@/lib/types';
import { getInvoiceData } from '@/lib/storage';
import { companies } from '@/lib/companies';
import FactureProforma from '@/components/templates/FactureProforma';
import FactureDefinitive from '@/components/templates/FactureDefinitive';
import BonLivraison from '@/components/templates/BonLivraison';
import FactureSimple from '@/components/templates/FactureSimple';
import styles from './page.module.css';

export default function PreviewPage() {
    const router = useRouter();
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const [selectedType, setSelectedType] = useState<InvoiceType>(InvoiceType.PROFORMA);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

    useEffect(() => {
        const data = getInvoiceData();
        if (!data) {
            alert('Aucune donnée de facture trouvée. Veuillez créer une facture.');
            router.push('/');
        } else {
            setInvoiceData(data);
            setSelectedCompany(data.selectedCompany);
        }
    }, [router]);

    const handlePrint = () => {
        window.print();
    };

    const handleBack = () => {
        router.push('/');
    };

    const handleCompanyChange = (company: Company) => {
        setSelectedCompany(company);
        if (invoiceData) {
            setInvoiceData({
                ...invoiceData,
                selectedCompany: company,
            });
        }
    };

    const [scale, setScale] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 850) {
                // 210mm is approx 794px. We add some padding.
                // Calculate scale to fit width with some margin (e.g. 32px total padding)
                const newScale = (window.innerWidth - 32) / 800;
                setScale(newScale);
            } else {
                setScale(1);
            }
        };

        // Initial calculation
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!invoiceData || !selectedCompany) {
        return <div className={styles.loading}>Chargement...</div>;
    }

    return (
        <div className={styles.page}>
            <div className={styles.controls}>
                <button onClick={handleBack} className={styles.backButton}>
                    ← Retour au formulaire
                </button>

                <div className={styles.companySelector}>
                    <label className={styles.companySelectorLabel}>Entreprise:</label>
                    <select
                        value={selectedCompany.id}
                        onChange={(e) => {
                            const company = companies.find(c => c.id === e.target.value);
                            if (company) handleCompanyChange(company);
                        }}
                        className={styles.companySelect}
                    >
                        {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                                {company.displayName}
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.typeSelector}>
                    <button
                        className={`${styles.typeButton} ${selectedType === InvoiceType.PROFORMA ? styles.active : ''}`}
                        onClick={() => setSelectedType(InvoiceType.PROFORMA)}
                    >
                        Facture Proforma
                    </button>
                    <button
                        className={`${styles.typeButton} ${selectedType === InvoiceType.DEFINITIVE ? styles.active : ''}`}
                        onClick={() => setSelectedType(InvoiceType.DEFINITIVE)}
                    >
                        Facture Définitive
                    </button>
                    <button
                        className={`${styles.typeButton} ${selectedType === InvoiceType.BON_LIVRAISON ? styles.active : ''}`}
                        onClick={() => setSelectedType(InvoiceType.BON_LIVRAISON)}
                    >
                        Bon de Livraison
                    </button>
                    <button
                        className={`${styles.typeButton} ${selectedType === InvoiceType.SIMPLE ? styles.active : ''}`}
                        onClick={() => setSelectedType(InvoiceType.SIMPLE)}
                    >
                        Facture Simple
                    </button>
                </div>

                <button onClick={handlePrint} className={styles.printButton}>
                    🖨️ Imprimer
                </button>

                <button onClick={async () => {
                    const element = document.querySelector(`.${styles.previewContainer} > div`) as HTMLElement;
                    if (!element) return;

                    // Save original styles
                    const originalTransform = element.style.transform;
                    const originalMargin = element.style.margin;
                    const originalHeight = element.style.height;
                    const originalWidth = element.style.width;
                    const originalPosition = element.style.position;
                    const originalLeft = element.style.left;
                    const originalTop = element.style.top;

                    try {
                        // Temporarily reset styles for capture
                        element.style.transform = 'none';
                        element.style.margin = '0';
                        element.style.height = 'auto';
                        element.style.width = '210mm';
                        element.style.position = 'relative';
                        element.style.left = '0';
                        element.style.top = '0';

                        // Wait for repaint
                        await new Promise(resolve => setTimeout(resolve, 100));

                        // Dynamic imports
                        const html2canvas = (await import('html2canvas')).default;
                        const { jsPDF } = await import('jspdf');

                        // Capture element as canvas
                        const canvas = await html2canvas(element, {
                            scale: 2,
                            useCORS: true,
                            logging: false,
                            windowWidth: 794, // A4 width in pixels at 96dpi
                        });

                        // Calculate dimensions for A4
                        const imgWidth = 210; // A4 width in mm
                        let imgHeight = (canvas.height * imgWidth) / canvas.width;

                        // If image is taller than A4, scale it down to fit
                        const maxHeight = 297; // A4 height in mm
                        if (imgHeight > maxHeight) {
                            const ratio = maxHeight / imgHeight;
                            imgHeight = maxHeight;
                            // We'll scale the width too to maintain aspect ratio
                        }

                        // Create PDF - always single page A4
                        const pdf = new jsPDF({
                            orientation: 'portrait',
                            unit: 'mm',
                            format: 'a4',
                            compress: true,
                            putOnlyUsedFonts: true
                        });

                        // Add image to PDF - fit exactly to one page
                        const imgData = canvas.toDataURL('image/jpeg', 0.98);

                        // Center the image if it's smaller than A4 height
                        const yOffset = imgHeight < maxHeight ? (maxHeight - imgHeight) / 2 : 0;

                        // Add image WITHOUT auto-paging (prevents blank pages)
                        pdf.addImage(imgData, 'JPEG', 0, yOffset, imgWidth, imgHeight, undefined, 'FAST');

                        // Generate blob
                        const pdfBlob = pdf.output('blob');
                        const filename = `Facture-${invoiceData?.numeroFacture || 'new'}.pdf`;
                        const file = new File([pdfBlob], filename, { type: 'application/pdf' });

                        // Share or download
                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({
                                files: [file],
                                title: 'Facture',
                                text: `Voici la facture N° ${invoiceData?.numeroFacture}`,
                            });
                        } else {
                            // Fallback: download
                            const url = URL.createObjectURL(pdfBlob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            a.click();
                            URL.revokeObjectURL(url);
                        }
                    } catch (err: any) {
                        // Ignore share cancellation
                        if (err.name === 'AbortError' || err.message?.includes('Share canceled')) {
                            console.log('Partage annulé par l\'utilisateur');
                            return;
                        }
                        console.error('Error sharing/downloading:', err);
                        alert('Erreur lors du partage/téléchargement. Veuillez réessayer.');
                    } finally {
                        // Restore original styles
                        element.style.transform = originalTransform;
                        element.style.margin = originalMargin;
                        element.style.height = originalHeight;
                        element.style.width = originalWidth;
                        element.style.position = originalPosition;
                        element.style.left = originalLeft;
                        element.style.top = originalTop;
                    }
                }} className={styles.shareButton}>
                    📤 Partager PDF
                </button>
            </div>

            <div className={styles.previewContainer}>
                <div
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left', // Align to left edge to avoid shifting
                        height: scale < 1 ? `${(297 * 3.78) * scale}px` : 'auto',
                        marginBottom: scale < 1 ? `-${(297 * 3.78) * (1 - scale)}px` : '0',
                        // Center the scaled element horizontally if there's extra space
                        marginLeft: scale < 1 ? `${(window.innerWidth - (210 * 3.78 * scale)) / 2}px` : '0'
                    }}
                >
                    {selectedType === InvoiceType.PROFORMA && <FactureProforma data={invoiceData} />}
                    {selectedType === InvoiceType.DEFINITIVE && <FactureDefinitive data={invoiceData} />}
                    {selectedType === InvoiceType.BON_LIVRAISON && <BonLivraison data={invoiceData} />}
                    {selectedType === InvoiceType.SIMPLE && <FactureSimple data={invoiceData} />}
                </div>
            </div>
        </div>
    );
}
