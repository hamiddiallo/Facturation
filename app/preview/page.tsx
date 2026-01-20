'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InvoiceData, InvoiceType, Company } from '@/lib/types';
import { getInvoiceData } from '@/lib/storage';
import { getCompanies } from '@/lib/supabaseServices';
import { adaptInvoiceNumber } from '@/lib/counter';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import Skeleton from '@/components/Skeleton';
import styles from './page.module.css';

const FactureProforma = dynamic(() => import('@/components/templates/FactureProforma'), { ssr: false });
const FactureDefinitive = dynamic(() => import('@/components/templates/FactureDefinitive'), { ssr: false });
const BonLivraison = dynamic(() => import('@/components/templates/BonLivraison'), { ssr: false });
const FactureSimple = dynamic(() => import('@/components/templates/FactureSimple'), { ssr: false });
const FactureModerneBlue = dynamic(() => import('@/components/templates/FactureModerneBlue'), { ssr: false });

export default function PreviewPage() {
    const router = useRouter();
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const [selectedType, setSelectedType] = useState<InvoiceType>(InvoiceType.PROFORMA);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]); // Added this state

    useEffect(() => {
        const loadInitialData = async () => {
            const dbCompanies = await getCompanies();
            setCompanies(dbCompanies);

            const data = getInvoiceData();
            if (!data) {
                toast.error('Facture non trouvée', {
                    description: 'Aucune donnée de facture trouvée. Veuillez créer une facture.'
                });
                router.push('/');
                return;
            }

            // Re-hydrate company to ensure we have the latest definition (styles, fields)
            let freshCompany = dbCompanies.find((c: Company) => c.id === data.selectedCompany.id);
            if (!freshCompany && dbCompanies.length > 0) {
                freshCompany = dbCompanies.find((c: Company) => c.isDefault) || dbCompanies[0];
            }

            if (freshCompany) {
                data.selectedCompany = freshCompany;
            }

            setInvoiceData(data);
            setSelectedCompany(data.selectedCompany);
            if (data.type) {
                setSelectedType(data.type);
            }
        };

        loadInitialData();
    }, [router]);

    const handleTypeChange = (type: InvoiceType) => {
        setSelectedType(type);
    };

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
    const [showDelivered, setShowDelivered] = useState(true);

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
        return (
            <div className={styles.page}>
                <div className={styles.controls} style={{ opacity: 0.5, pointerEvents: 'none' }}>
                    <button className={styles.backButton}>Chargement...</button>
                </div>
                <div className={styles.previewContainer}>
                    <Skeleton width="210mm" height="297mm" borderRadius="0" className={styles.pageSkeleton} />
                </div>
            </div>
        );
    }

    // Adapt the invoice number dynamically for display
    const adaptedData: InvoiceData = {
        ...invoiceData,
        selectedCompany: selectedCompany,
        type: selectedType,
        numeroFacture: adaptInvoiceNumber(invoiceData.numeroFacture, selectedCompany, selectedType)
    };

    const getTemplateLabel = (templateId?: string) => {
        switch (templateId) {
            case 'template_standard': return 'Modèle 1';
            case 'template_modern': return 'Modèle 2';
            case 'template_classic': return 'Modèle 3';
            case 'template_moderne_blue': return 'Modèle 4';
            default: return 'Modèle 1';
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.controls}>
                <button onClick={handleBack} className={styles.backButton}>
                    ← Retour au formulaire
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px' }}>
                    <input
                        type="checkbox"
                        id="showDelivered"
                        checked={showDelivered}
                        onChange={(e) => setShowDelivered(e.target.checked)}
                        style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                    />
                    <label htmlFor="showDelivered" style={{ fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}>
                        Afficher colonne Livré
                    </label>
                </div>

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
                                {company.displayName} ({getTemplateLabel(company.templateId)})
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.typeSelector}>
                    <button
                        className={`${styles.typeButton} ${selectedType === InvoiceType.PROFORMA ? styles.active : ''}`}
                        onClick={() => handleTypeChange(InvoiceType.PROFORMA)}
                    >
                        Facture Proforma
                    </button>
                    <button
                        className={`${styles.typeButton} ${selectedType === InvoiceType.DEFINITIVE ? styles.active : ''}`}
                        onClick={() => handleTypeChange(InvoiceType.DEFINITIVE)}
                    >
                        Facture Définitive
                    </button>
                    <button
                        className={`${styles.typeButton} ${selectedType === InvoiceType.BON_LIVRAISON ? styles.active : ''}`}
                        onClick={() => handleTypeChange(InvoiceType.BON_LIVRAISON)}
                    >
                        Bon de Livraison
                    </button>
                    <button
                        className={`${styles.typeButton} ${selectedType === InvoiceType.SIMPLE ? styles.active : ''}`}
                        onClick={() => handleTypeChange(InvoiceType.SIMPLE)}
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
                        const filename = `Facture-${adaptedData.numeroFacture}.pdf`;
                        const file = new File([pdfBlob], filename, { type: 'application/pdf' });

                        // Share or download
                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({
                                files: [file],
                                title: 'Facture',
                                text: `Voici la facture N° ${adaptedData.numeroFacture}`,
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
                            return;
                        }
                        console.error('Error sharing/downloading:', err);
                        toast.error('Échec de l\'opération', {
                            description: 'Erreur lors du partage ou du téléchargement du PDF. Veuillez réessayer.'
                        });
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
                    {/* Render based on template ID */}
                    {selectedCompany.templateId === 'template_moderne_blue' && <FactureModerneBlue data={adaptedData} showDelivered={showDelivered} />}
                    {selectedCompany.templateId === 'template_standard' && (
                        <>
                            {selectedType === InvoiceType.PROFORMA && <FactureProforma data={adaptedData} showDelivered={showDelivered} />}
                            {selectedType === InvoiceType.DEFINITIVE && <FactureDefinitive data={adaptedData} showDelivered={showDelivered} />}
                            {selectedType === InvoiceType.BON_LIVRAISON && <BonLivraison data={adaptedData} />}
                            {selectedType === InvoiceType.SIMPLE && <FactureSimple data={adaptedData} showDelivered={showDelivered} />}
                        </>
                    )}
                    {selectedCompany.templateId === 'template_modern' && (
                        <>
                            {selectedType === InvoiceType.PROFORMA && <FactureProforma data={adaptedData} showDelivered={showDelivered} />}
                            {selectedType === InvoiceType.DEFINITIVE && <FactureDefinitive data={adaptedData} showDelivered={showDelivered} />}
                            {selectedType === InvoiceType.BON_LIVRAISON && <BonLivraison data={adaptedData} />}
                            {selectedType === InvoiceType.SIMPLE && <FactureSimple data={adaptedData} showDelivered={showDelivered} />}
                        </>
                    )}
                    {selectedCompany.templateId === 'template_classic' && (
                        <>
                            {selectedType === InvoiceType.PROFORMA && <FactureProforma data={adaptedData} showDelivered={showDelivered} />}
                            {selectedType === InvoiceType.DEFINITIVE && <FactureDefinitive data={adaptedData} showDelivered={showDelivered} />}
                            {selectedType === InvoiceType.BON_LIVRAISON && <BonLivraison data={adaptedData} />}
                            {selectedType === InvoiceType.SIMPLE && <FactureSimple data={adaptedData} showDelivered={showDelivered} />}
                        </>
                    )}
                    {!selectedCompany.templateId && (
                        <>
                            {selectedType === InvoiceType.PROFORMA && <FactureProforma data={adaptedData} showDelivered={showDelivered} />}
                            {selectedType === InvoiceType.DEFINITIVE && <FactureDefinitive data={adaptedData} showDelivered={showDelivered} />}
                            {selectedType === InvoiceType.BON_LIVRAISON && <BonLivraison data={adaptedData} />}
                            {selectedType === InvoiceType.SIMPLE && <FactureSimple data={adaptedData} showDelivered={showDelivered} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
