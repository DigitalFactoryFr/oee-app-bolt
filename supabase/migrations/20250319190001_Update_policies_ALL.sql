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

-- ✅ Restaurer les policies exactement comme dans ton JSON

-- 🔹 Accès au suivi des lots
CREATE POLICY lot_tracking_access_policy
ON public.lot_tracking
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM lots WHERE lots.id = lot_tracking.lot_id AND has_project_access(lots.project_id))
);

-- 🔹 Accès aux lots
CREATE POLICY lots_create_policy
ON public.lots
FOR INSERT
TO authenticated
WITH CHECK (
  has_project_access(project_id)
  AND (check_user_role(project_id, 'operator') OR check_user_role(project_id, 'team_manager') OR check_user_role(project_id, 'owner'))
);

CREATE POLICY lots_manage_policy
ON public.lots
FOR UPDATE
TO authenticated
USING (
  has_project_access(project_id)
  AND (check_user_role(project_id, 'team_manager') OR check_user_role(project_id, 'owner'))
);

CREATE POLICY lots_view_policy
ON public.lots
FOR SELECT
TO authenticated
USING (
  has_project_access(project_id)
);

-- 🔹 Accès aux machines
CREATE POLICY machines_access_policy
ON public.machines
FOR SELECT
TO authenticated
USING (
  has_project_access(project_id)
);

-- 🔹 Accès aux configurations d’usine
CREATE POLICY plant_configs_access
ON public.plant_configs
FOR SELECT, UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = plant_configs.project_id AND projects.user_id = auth.uid())
);

-- 🔹 Accès aux lignes de production
CREATE POLICY production_lines_access_policy
ON public.production_lines
FOR SELECT
TO authenticated
USING (
  has_project_access(project_id)
);

-- 🔹 Accès aux produits
CREATE POLICY products_access_policy
ON public.products
FOR SELECT
TO authenticated
USING (
  has_project_access(project_id)
);

-- 🔹 Accès aux projets
CREATE POLICY project_access
ON public.projects
FOR SELECT
TO authenticated
USING (
  id IN (SELECT project_id FROM public.team_members WHERE email = auth.email())
);

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

-- 🔹 Gestion des problèmes qualité
CREATE POLICY quality_issues_create_policy
ON public.quality_issues
FOR INSERT
TO authenticated
WITH CHECK (
  has_project_access(project_id)
  AND (check_user_role(project_id, 'operator') OR check_user_role(project_id, 'maintenance_technician') OR check_user_role(project_id, 'quality_technician') OR check_user_role(project_id, 'team_manager') OR check_user_role(project_id, 'owner'))
);

CREATE POLICY quality_issues_manage_policy
ON public.quality_issues
FOR UPDATE, DELETE
TO authenticated
USING (
  has_project_access(project_id)
  AND (check_user_role(project_id, 'quality_technician') OR check_user_role(project_id, 'team_manager') OR check_user_role(project_id, 'owner'))
);

CREATE POLICY quality_issues_view_policy
ON public.quality_issues
FOR SELECT
TO authenticated
USING (
  has_project_access(project_id)
);

-- 🔹 Gestion des arrêts de production
CREATE POLICY stop_events_create_policy
ON public.stop_events
FOR INSERT
TO authenticated
WITH CHECK (
  has_project_access(project_id)
  AND (check_user_role(project_id, 'operator') OR check_user_role(project_id, 'maintenance_technician') OR check_user_role(project_id, 'team_manager') OR check_user_role(project_id, 'owner'))
);

CREATE POLICY stop_events_manage_policy
ON public.stop_events
FOR UPDATE, DELETE
TO authenticated
USING (
  has_project_access(project_id)
  AND (check_user_role(project_id, 'team_manager') OR check_user_role(project_id, 'owner'))
);

CREATE POLICY stop_events_view_policy
ON public.stop_events
FOR SELECT
TO authenticated
USING (
  has_project_access(project_id)
);

-- 🔹 Accès aux abonnements
CREATE POLICY subscriptions_access
ON public.subscriptions
FOR SELECT, UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = subscriptions.project_id AND projects.user_id = auth.uid())
);

-- 🔹 Gestion des membres de l’équipe
CREATE POLICY "Users can create team members in their projects"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = team_members.project_id AND projects.user_id = auth.uid())
);

CREATE POLICY "Users can delete team members in their projects"
ON public.team_members
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = team_members.project_id AND projects.user_id = auth.uid())
);

CREATE POLICY "Users can update team members in their projects"
ON public.team_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = team_members.project_id AND projects.user_id = auth.uid())
);

CREATE POLICY team_members_view_policy
ON public.team_members
FOR SELECT
TO authenticated
USING (
  has_project_access(project_id)
);

CREATE POLICY "Anyone can view roles"
ON public.team_roles
FOR SELECT
TO authenticated
USING (
  true
);

-- ✅ Appliquer les changements
COMMIT;
