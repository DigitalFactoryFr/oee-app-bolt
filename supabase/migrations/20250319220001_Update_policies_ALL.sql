BEGIN;

-- Supprimer strictement les policies existantes sur projects
DROP POLICY IF EXISTS project_access ON public.projects;
DROP POLICY IF EXISTS project_owner_access ON public.projects;

-- Policy d’origine : SELECT uniquement pour les membres
CREATE POLICY project_access
ON public.projects
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT project_id 
    FROM public.team_members 
    WHERE team_members.email = auth.email()
  )
);

-- Policy d’origine : owner a tous les droits
CREATE POLICY project_owner_access
ON public.projects
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- Trigger d’origine pour ajouter automatiquement l’owner actif
CREATE OR REPLACE FUNCTION add_project_owner() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.team_members(project_id, email, role, status, invited_at, joined_at)
  VALUES (NEW.id, auth.email(), 'owner', 'active', NOW(), NOW())
  ON CONFLICT(project_id, email) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS add_owner_trigger ON public.projects;
CREATE TRIGGER add_owner_trigger
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION add_project_owner();

COMMIT;
