-- 🛠 Démarrer la transaction
BEGIN;

-- 🛠 Supprimer les policies actuelles pour éviter les conflits
DROP POLICY IF EXISTS lot_tracking_access_policy ON public.lot_tracking;
DROP POLICY IF EXISTS lots_create_policy ON public.lots;
DROP POLICY IF EXISTS lots_manage_policy ON public.lots;
DROP POLICY IF EXISTS lots_view_policy ON public.lots;
DROP POLICY IF EXISTS machines_access_policy ON public.machines;
DROP POLICY IF EXISTS plant_configs_access ON public.plant_configs;
DROP POLICY IF EXISTS production_lines_access_policy ON public.production_lines;
DROP POLICY IF EXISTS products_access_policy ON public.products;
DROP POLICY IF EXISTS project_access ON public.projects;
DROP POLICY IF EXISTS project_owner_access ON public.projects;
DROP POLICY IF EXISTS quality_issues_create_policy ON public.quality_issues;
DROP POLICY IF EXISTS quality_issues_manage_policy ON public.quality_issues;
DROP POLICY IF EXISTS quality_issues_view_policy ON public.quality_issues;
DROP POLICY IF EXISTS stop_events_create_policy ON public.stop_events;
DROP POLICY IF EXISTS stop_events_manage_policy ON public.stop_events;
DROP POLICY IF EXISTS stop_events_view_policy ON public.stop_events;
DROP POLICY IF EXISTS subscriptions_access ON public.subscriptions;
DROP POLICY IF EXISTS team_members_create_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_delete_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_manage_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_member_access ON public.team_members;
DROP POLICY IF EXISTS team_members_owner_access ON public.team_members;
DROP POLICY IF EXISTS team_members_update_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_view_policy ON public.team_members;
DROP POLICY IF EXISTS "Users can create team members in their projects" ON public.team_members;
DROP POLICY IF EXISTS "Users can delete team members in their projects" ON public.team_members;
DROP POLICY IF EXISTS "Users can update team members in their projects" ON public.team_members;
DROP POLICY IF EXISTS "Anyone can view roles" ON public.team_roles;


-- ✅ Policy : un utilisateur ne voit que ses propres projets
CREATE POLICY project_access
ON public.projects
FOR SELECT
TO authenticated
USING (projects.user_id = auth.uid());

-- ✅ Policy : le propriétaire a tous les droits
CREATE POLICY project_owner_access
ON public.projects
FOR ALL
TO authenticated
USING (projects.user_id = auth.uid())
WITH CHECK (projects.user_id = auth.uid());

-- ✅ Autoriser tout utilisateur authentifié à créer un projet
CREATE POLICY project_create
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- ✅ Trigger : ajouter automatiquement le propriétaire dans team_members
CREATE OR REPLACE FUNCTION add_project_owner() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.team_members (project_id, email, role, status, invited_at, joined_at)
  VALUES (NEW.id, auth.email(), 'owner', 'active', NOW(), NOW())
  ON CONFLICT (project_id, email) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS add_owner_trigger ON public.projects;
CREATE TRIGGER add_owner_trigger
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION add_project_owner();

COMMIT;
