-- Démarrer la transaction pour assurer une exécution sécurisée
BEGIN;

-- 🛠 Supprimer les policies problématiques pour éviter la récursion infinie
DROP POLICY IF EXISTS project_access ON public.projects;
DROP POLICY IF EXISTS team_members_create_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_update_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_delete_policy ON public.team_members;

-- ✅ Restaurer l'accès aux projets sans récursion infinie
CREATE POLICY project_access
ON public.projects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_members.project_id = projects.id 
    AND team_members.email = auth.email()
  )
);

-- ✅ Rendre la gestion des membres plus claire sans boucle avec `projects`
CREATE POLICY team_members_create_policy
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY team_members_update_policy
ON public.team_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND (projects.user_id = auth.uid() OR check_user_role(projects.id, 'team_manager'))
  )
);

CREATE POLICY team_members_delete_policy
ON public.team_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND (projects.user_id = auth.uid() OR check_user_role(projects.id, 'owner'))
  )
);

-- ✅ Ajouter automatiquement l'owner comme `team_member` avec statut `active`
CREATE OR REPLACE FUNCTION add_project_owner() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO team_members (project_id, email, role, status)
  VALUES (NEW.id, (SELECT email FROM auth.users WHERE id = NEW.user_id), 'owner', 'active')
  ON CONFLICT (project_id, email) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ Lier cette fonction à l'insertion d'un projet
DROP TRIGGER IF EXISTS add_owner_trigger ON projects;
CREATE TRIGGER add_owner_trigger
AFTER INSERT ON projects
FOR EACH ROW EXECUTE FUNCTION add_project_owner();

-- ✅ Appliquer la migration proprement
COMMIT;
