-- Fonction atomique pour générer le prochain numéro de facture
-- Cette fonction garantit qu'il n'y aura jamais de numéros dupliqués
-- même en cas d'accès concurrent

CREATE OR REPLACE FUNCTION get_next_invoice_sequence(counter_name TEXT)
RETURNS INTEGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    -- Utilise INSERT ... ON CONFLICT pour gérer l'initialisation et l'incrémentation atomiquement
    INSERT INTO counters (name, last_sequence, updated_at)
    VALUES (counter_name, 1, NOW())
    ON CONFLICT (name) 
    DO UPDATE SET 
        last_sequence = counters.last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO next_num;
    
    RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Exemple d'utilisation:
-- SELECT get_next_invoice_sequence('invoice_250120');
-- Retourne: 1 (première fois), puis 2, 3, 4...

-- Note: Cette fonction est ATOMIQUE grâce à PostgreSQL
-- Même si deux requêtes arrivent simultanément, elles seront sérialisées
-- et retourneront des numéros différents (ex: 5 et 6, jamais 5 et 5)
