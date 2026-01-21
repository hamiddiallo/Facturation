-- ======================================================
-- SÉCURISATION DES TRANSACTIONS ET UNICITÉ
-- ======================================================

-- 1. Ajout d'une contrainte d'unicité par utilisateur
-- Empêche d'avoir deux factures avec le même numéro pour un même compte
ALTER TABLE public.invoices 
ADD CONSTRAINT unique_user_invoice_number UNIQUE (user_id, number);

-- 2. Fonction RPC pour sauvegarde atomique (Facture + Articles)
-- Cette fonction gère le Create et le Update en une seule transaction SQL
CREATE OR REPLACE FUNCTION public.upsert_full_invoice(
    p_user_id UUID,
    p_company_id UUID,
    p_id UUID,              -- NULL si création, UUID si modification
    p_number TEXT,
    p_type TEXT,
    p_date DATE,
    p_client_name TEXT,
    p_client_address TEXT,
    p_amount_paid NUMERIC,
    p_total_amount NUMERIC,
    p_articles JSONB        -- Liste des articles au format JSON
) RETURNS UUID AS $$
DECLARE
    v_invoice_id UUID;
    v_item RECORD;
BEGIN
    -- Si p_id est fourni, on tente l'update
    IF p_id IS NOT NULL THEN
        UPDATE public.invoices SET
            company_id = p_company_id,
            number = p_number,
            type = p_type,
            date = p_date,
            client_name = p_client_name,
            client_address = p_client_address,
            amount_paid = p_amount_paid,
            total_amount = p_total_amount
        WHERE id = p_id AND user_id = p_user_id;
        
        v_invoice_id := p_id;
        
        -- Nettoyage des anciens articles
        DELETE FROM public.invoice_items WHERE invoice_id = v_invoice_id;
    ELSE
        -- Sinon, on insère une nouvelle facture
        INSERT INTO public.invoices (
            user_id, company_id, number, type, date, client_name, client_address, amount_paid, total_amount
        ) VALUES (
            p_user_id, p_company_id, p_number, p_type, p_date, p_client_name, p_client_address, p_amount_paid, p_total_amount
        ) RETURNING id INTO v_invoice_id;
    END IF;

    -- Insertion des nouveaux articles depuis le JSON
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_articles) AS x(
        designation TEXT, quantity NUMERIC, unit TEXT, price NUMERIC, total_price NUMERIC
    ) LOOP
        INSERT INTO public.invoice_items (
            invoice_id, designation, quantity, unit, price, total_price
        ) VALUES (
            v_invoice_id, v_item.designation, v_item.quantity, v_item.unit, v_item.price, v_item.total_price
        );
    END LOOP;

    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;
