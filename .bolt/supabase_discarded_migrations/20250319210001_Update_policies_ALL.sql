BEGIN;

-- Supprimer uniquement les policies sur projects (sans toucher aux autres)
DROP POLICY IF EXISTS project_access ON public.projects;
DROP POLICY IF EXISTS project_owner_access ON public.projects;

-- Policy : un utilisateur voit uniquement ses propres projets
CREATE POLICY project_access
ON public.projects
FOR SELECT
TO authenticated
USING (projects.user_id = auth.uid());

-- Policy : le propriétaire a tous les droits
CREATE POLICY project_owner_access
ON public.projects
FOR ALL
TO authenticated
USING (projects.user_id = auth.uid())
WITH CHECK (projects.user_id = auth.uid());

-- Policy : tout utilisateur connecté peut créer un projet
CREATE POLICY project_create
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger automatique pour ajouter le créateur comme owner actif
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
