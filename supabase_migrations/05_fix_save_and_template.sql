-- ======================================================
-- PHASE 80 : ROBUSTESSE ET INTÉGRITÉ DES DONNÉES
-- ======================================================

-- 1. Ajout de la colonne template_id à la table invoices
-- Cela permet de figer le modèle utilisé au moment de la création
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'template_standard';

-- 2. Mise à jour de la fonction RPC upsert_full_invoice
-- On ajoute l'argument p_template_id et on l'inclut dans l'INSERT et l'UPDATE
CREATE OR REPLACE FUNCTION public.upsert_full_invoice(
    p_user_id UUID,
    p_company_id UUID,
    p_id UUID,
    p_number TEXT,
    p_type TEXT,
    p_date DATE,
    p_client_name TEXT,
    p_client_address TEXT,
    p_amount_paid NUMERIC,
    p_total_amount NUMERIC,
    p_articles JSONB,
    p_counter_name TEXT DEFAULT NULL,
    p_new_sequence INTEGER DEFAULT NULL,
    p_template_id TEXT DEFAULT 'template_standard' -- Nouvel argument
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
            total_amount = p_total_amount,
            template_id = p_template_id -- Mise à jour du template
        WHERE id = p_id AND user_id = p_user_id;
        
        v_invoice_id := p_id;
        
        -- Nettoyage des anciens articles
        DELETE FROM public.invoice_items WHERE invoice_id = v_invoice_id;
    ELSE
        -- Sinon, on insère une nouvelle facture
        INSERT INTO public.invoices (
            user_id, company_id, number, type, date, client_name, client_address, 
            amount_paid, total_amount, template_id -- Colonne template_id incluse
        ) VALUES (
            p_user_id, p_company_id, p_number, p_type, p_date, p_client_name, p_client_address, 
            p_amount_paid, p_total_amount, p_template_id
        ) RETURNING id INTO v_invoice_id;

        -- MISE À JOUR DU COMPTEUR (Seulement lors d'une création)
        IF p_counter_name IS NOT NULL AND p_new_sequence IS NOT NULL THEN
            INSERT INTO public.counters (name, last_sequence)
            VALUES (p_counter_name, p_new_sequence)
            ON CONFLICT (name) DO UPDATE
            SET last_sequence = GREATEST(public.counters.last_sequence, EXCLUDED.last_sequence);
        END IF;

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
