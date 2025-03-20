-- 🛠 DÉBUT DE LA TRANSACTION
BEGIN;

-- 🛠 1️⃣ SUPPRESSION DES ANCIENNES POLICIES
DO $$ 
DECLARE 
    policy RECORD;
BEGIN
    FOR policy IN 
        SELECT polname AS policy_name, relname AS table_name 
        FROM pg_policy 
        JOIN pg_class ON pg_policy.polrelid = pg_class.oid
        JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
        WHERE pg_namespace.nspname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy.policy_name, policy.table_name);
    END LOOP;
END $$;

-- ✅ 2️⃣ RECRÉATION DES POLICIES AVEC ACCÈS PROPRE

-- ✅ Autoriser l’accès aux projets uniquement aux membres
CREATE POLICY project_access
ON public.projects
FOR SELECT
TO authenticated
USING (
  id IN (SELECT project_id FROM public.team_members WHERE email = auth.email())
);

-- ✅ Autoriser le propriétaire du projet à gérer les projets
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

-- ✅ Accès aux lignes de production pour les membres du projet
CREATE POLICY production_lines_access_policy
ON public.production_lines
FOR ALL
TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

-- ✅ Accès aux produits liés au projet
CREATE POLICY products_access_policy
ON public.products
FOR ALL
TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

-- ✅ Gestion des lots de production
CREATE POLICY lots_view_policy
ON public.lots
FOR SELECT
TO authenticated
USING (has_project_access(project_id));

CREATE POLICY lots_create_policy
ON public.lots
FOR INSERT
TO authenticated
WITH CHECK (
  has_project_access(project_id) AND 
  (check_user_role(project_id, 'operator') OR check_user_role(project_id, 'team_manager') OR check_user_role(project_id, 'owner'))
);

CREATE POLICY lots_manage_policy
ON public.lots
FOR UPDATE
TO authenticated
USING (
  has_project_access(project_id) AND 
  (check_user_role(project_id, 'team_manager') OR check_user_role(project_id, 'owner'))
);

-- ✅ Accès et gestion des événements d’arrêt
CREATE POLICY stop_events_view_policy
ON public.stop_events
FOR SELECT
TO authenticated
USING (has_project_access(project_id));

CREATE POLICY stop_events_create_policy
ON public.stop_events
FOR INSERT
TO authenticated
WITH CHECK (
  has_project_access(project_id) AND 
  (check_user_role(project_id, 'operator') OR check_user_role(project_id, 'maintenance_technician') OR check_user_role(project_id, 'team_manager') OR check_user_role(project_id, 'owner'))
);

CREATE POLICY stop_events_manage_policy
ON public.stop_events
FOR UPDATE
TO authenticated
USING (
  has_project_access(project_id) AND 
  (check_user_role(project_id, 'team_manager') OR check_user_role(project_id, 'owner'))
);

-- ✅ Accès et gestion des problèmes qualité
CREATE POLICY quality_issues_view_policy
ON public.quality_issues
FOR SELECT
TO authenticated
USING (has_project_access(project_id));

CREATE POLICY quality_issues_create_policy
ON public.quality_issues
FOR INSERT
TO authenticated
WITH CHECK (
  has_project_access(project_id) AND 
  (check_user_role(project_id, 'operator') OR check_user_role(project_id, 'maintenance_technician') OR check_user_role(project_id, 'quality_technician') OR check_user_role(project_id, 'team_manager') OR check_user_role(project_id, 'owner'))
);

CREATE POLICY quality_issues_manage_policy
ON public.quality_issues
FOR UPDATE
TO authenticated
USING (
  has_project_access(project_id) AND 
  (check_user_role(project_id, 'quality_technician') OR check_user_role(project_id, 'team_manager') OR check_user_role(project_id, 'owner'))
);

-- ✅ Gestion des membres de l’équipe
CREATE POLICY team_members_view_policy
ON public.team_members
FOR SELECT
TO authenticated
USING (has_project_access(project_id));

CREATE POLICY team_members_manage_policy
ON public.team_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND (projects.user_id = auth.uid() OR check_user_role(project_id, 'team_manager'))
  )
);

CREATE POLICY team_members_member_access
ON public.team_members
FOR SELECT
TO authenticated
USING (
  project_id IN (SELECT projects.id FROM projects WHERE projects.user_id = auth.uid()) 
  OR email = auth.email()
);

CREATE POLICY team_members_owner_access
ON public.team_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create team members in their projects"
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

CREATE POLICY "Users can delete team members in their projects"
ON public.team_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update team members in their projects"
ON public.team_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND projects.user_id = auth.uid()
  )
);

-- ✅ Accès aux abonnements
CREATE POLICY subscriptions_access
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = subscriptions.project_id
    AND projects.user_id = auth.uid()
  )
);

-- ✅ Accès aux rôles des équipes (public)
CREATE POLICY "Anyone can view roles"
ON public.team_roles
FOR SELECT
TO authenticated
USING (true);

-- ✅ Accès au suivi des lots
CREATE POLICY lot_tracking_access_policy
ON public.lot_tracking
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lots
    WHERE lots.id = lot_tracking.lot_id
    AND has_project_access(lots.project_id)
  )
);

-- ✅ Accès aux configurations d’usine pour les propriétaires
CREATE POLICY plant_configs_access
ON public.plant_configs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = plant_configs.project_id
    AND projects.user_id = auth.uid()
  )
);

-- ✅ FIN DE LA TRANSACTION
COMMIT;
