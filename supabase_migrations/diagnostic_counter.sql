-- Script de Diagnostic et Correction pour la Numérotation

-- 1. Vérifier que la fonction existe
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'get_next_invoice_sequence';
-- Si vide, la fonction n'a pas été créée correctement

-- 2. Vérifier l'état actuel de la table counters
SELECT * FROM counters ORDER BY name;
-- Devrait être vide si jamais utilisé

-- 3. Vérifier les factures existantes pour aujourd'hui (20 janvier 2026)
SELECT number, created_at 
FROM invoices 
WHERE number LIKE 'FAC-260120%' 
ORDER BY number;
-- Cela montre les numéros déjà utilisés

-- 4. INITIALISER le compteur basé sur les factures existantes
-- Cette requête trouve le numéro le plus élevé et initialise le compteur
DO $$
DECLARE
    max_seq INTEGER := 0;
    counter_name TEXT := 'invoice_260120';
    invoice_num TEXT;
BEGIN
    -- Trouver le numéro de facture le plus élevé pour aujourd'hui
    SELECT number INTO invoice_num
    FROM invoices 
    WHERE number LIKE 'FAC-260120%'
    ORDER BY number DESC
    LIMIT 1;
    
    -- Extraire la séquence (les 4 derniers chiffres)
    IF invoice_num IS NOT NULL THEN
        max_seq := CAST(RIGHT(invoice_num, 4) AS INTEGER);
        RAISE NOTICE 'Séquence maximale trouvée: %', max_seq;
    ELSE
        RAISE NOTICE 'Aucune facture trouvée pour aujourd''hui';
    END IF;
    
    -- Initialiser ou mettre à jour le compteur
    INSERT INTO counters (name, last_sequence, updated_at)
    VALUES (counter_name, max_seq, NOW())
    ON CONFLICT (name) 
    DO UPDATE SET 
        last_sequence = GREATEST(counters.last_sequence, max_seq),
        updated_at = NOW();
        
    RAISE NOTICE 'Compteur initialisé à: %', max_seq;
END $$;

-- 5. Vérifier que le compteur a été initialisé
SELECT * FROM counters WHERE name = 'invoice_260120';
-- Devrait afficher last_sequence = 1 (ou plus si plusieurs factures existent)

-- 6. Tester la fonction atomique
SELECT get_next_invoice_sequence('invoice_260120');
-- Devrait retourner 2 (si max_seq était 1)

-- 7. Vérifier à nouveau le compteur
SELECT * FROM counters WHERE name = 'invoice_260120';
-- Devrait afficher last_sequence = 2 maintenant
