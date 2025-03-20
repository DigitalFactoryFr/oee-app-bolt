-- 🛠 Démarrer la transaction
BEGIN;

-- 🔥 Supprimer toutes les policies existantes sur la table team_members
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_members') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_members;', r.policyname);
    END LOOP;
END $$;

-- 🛠 Valider les changements
COMMIT;
