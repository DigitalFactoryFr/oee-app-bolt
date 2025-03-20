BEGIN;

-------------------------------------------------------------------------------
-- 1) SUPPRESSION DES POLICIES EXISTANTES SUR LES PRINCIPALES TABLES
-------------------------------------------------------------------------------

-- plant_configs
DROP POLICY IF EXISTS plant_configs_select ON public.plant_configs;
DROP POLICY IF EXISTS plant_configs_update ON public.plant_configs;

-- machines
DROP POLICY IF EXISTS machines_select ON public.machines;
DROP POLICY IF EXISTS machines_insert ON public.machines;
DROP POLICY IF EXISTS machines_update ON public.machines;
DROP POLICY IF EXISTS machines_delete ON public.machines;

-- production_lines
DROP POLICY IF EXISTS lines_select ON public.production_lines;
DROP POLICY IF EXISTS lines_insert ON public.production_lines;
DROP POLICY IF EXISTS lines_update ON public.production_lines;
DROP POLICY IF EXISTS lines_delete ON public.production_lines;

-- projects
DROP POLICY IF EXISTS projects_select ON public.projects;
DROP POLICY IF EXISTS projects_insert ON public.projects;
DROP POLICY IF EXISTS projects_owner_all ON public.projects;
DROP POLICY IF EXISTS project_select_policy ON public.projects;
DROP POLICY IF EXISTS project_insert_policy ON public.projects;
DROP POLICY IF EXISTS project_owner_policy ON public.projects;

-- team_members
DROP POLICY IF EXISTS team_members_select ON public.team_members;
DROP POLICY IF EXISTS team_members_select_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_insert ON public.team_members;
DROP POLICY IF EXISTS team_members_insert_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_update ON public.team_members;
DROP POLICY IF EXISTS team_members_update_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_delete ON public.team_members;
DROP POLICY IF EXISTS team_members_delete_policy ON public.team_members;

-- products
DROP POLICY IF EXISTS products_select ON public.products;
DROP POLICY IF EXISTS products_insert ON public.products;
DROP POLICY IF EXISTS products_update ON public.products;
DROP POLICY IF EXISTS products_delete ON public.products;

-- lots
DROP POLICY IF EXISTS lots_select ON public.lots;
DROP POLICY IF EXISTS lots_insert ON public.lots;
DROP POLICY IF EXISTS lots_update ON public.lots;
DROP POLICY IF EXISTS lots_delete ON public.lots;

-- stop_events
DROP POLICY IF EXISTS stops_select ON public.stop_events;
DROP POLICY IF EXISTS stops_insert ON public.stop_events;
DROP POLICY IF EXISTS stops_update ON public.stop_events;
DROP POLICY IF EXISTS stops_delete ON public.stop_events;

-- quality_issues
DROP POLICY IF EXISTS quality_select ON public.quality_issues;
DROP POLICY IF EXISTS quality_insert ON public.quality_issues;
DROP POLICY IF EXISTS quality_update ON public.quality_issues;
DROP POLICY IF EXISTS quality_delete ON public.quality_issues;

-- subscriptions
DROP POLICY IF EXISTS subs_select ON public.subscriptions;
DROP POLICY IF EXISTS subs_update ON public.subscriptions;

-- team_roles
DROP POLICY IF EXISTS team_roles_select ON public.team_roles;

-------------------------------------------------------------------------------
-- 2) CRÉATION (OU RE-CRÉATION) DES FONCTIONS UTILITAIRES SECURITY DEFINER
-------------------------------------------------------------------------------
/*
   Ces fonctions désactivent row_security en interne ("SET LOCAL row_security=off")
   pour éviter toute récursion et permettre de vérifier le droit d'accès à un projet
   ou à un rôle de manière "hors RLS".
*/

-- Supprimer la fonction existante pour pouvoir modifier le nom du paramètre
DROP FUNCTION IF EXISTS has_project_access(uuid);

-- has_project_access(project_uuid)
-- Retourne TRUE si l'utilisateur est propriétaire (projects.user_id = auth.uid())
-- OU s'il est membre actif (team_members.email = auth.email() et status = 'active').
CREATE OR REPLACE FUNCTION has_project_access(project_uuid uuid)
RETURNS boolean AS $$
BEGIN
  EXECUTE 'SET LOCAL row_security=off';
  RETURN 
    EXISTS (
      SELECT 1 
      FROM public.projects
      WHERE id = project_uuid
        AND user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 
      FROM public.team_members
      WHERE project_id = project_uuid
        AND email = auth.email()
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS check_user_role(uuid, text);
CREATE OR REPLACE FUNCTION check_user_role(_proj_id uuid, required_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE 'SET LOCAL row_security=off';
  RETURN EXISTS (
    SELECT 1 
    FROM public.team_members
    WHERE project_id = _proj_id
      AND email = auth.email()
      AND role = required_role
      AND status = 'active'
  );
END;
$$;

DROP FUNCTION IF EXISTS can_view_project_members(uuid);
CREATE OR REPLACE FUNCTION can_view_project_members(_proj_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE 'SET LOCAL row_security=off';
  RETURN EXISTS (
    SELECT 1 
    FROM public.team_members
    WHERE project_id = _proj_id
      AND email = auth.email()
      AND status = 'active'
  );
END;
$$;

DROP FUNCTION IF EXISTS can_manage_team(uuid);
CREATE OR REPLACE FUNCTION can_manage_team(_proj_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE 'SET LOCAL row_security=off';
  RETURN EXISTS (
    SELECT 1 
    FROM public.team_members
    WHERE project_id = _proj_id
      AND email = auth.email()
      AND role IN ('owner','team_manager')
      AND status = 'active'
  );
END;
$$;

-------------------------------------------------------------------------------
-- 3) POLICIES POUR projects
-------------------------------------------------------------------------------
/*
   - SELECT : via has_project_access(projects.id)
   - INSERT : tout utilisateur authentifié (auth.uid() IS NOT NULL)
   - UPDATE/DELETE : seulement le propriétaire (projects.user_id = auth.uid())
*/

CREATE POLICY projects_select
ON public.projects
FOR SELECT
TO authenticated
USING (
  has_project_access(projects.id)
);

CREATE POLICY projects_insert
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

CREATE POLICY projects_owner_all
ON public.projects
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-------------------------------------------------------------------------------
-- 4) POLICIES POUR team_members
-------------------------------------------------------------------------------
/*
   - SELECT : un membre actif du projet peut voir TOUS les membres (via can_view_project_members)
   - INSERT/UPDATE/DELETE : autorisé uniquement si l'utilisateur peut gérer l'équipe (via can_manage_team)
*/

CREATE POLICY team_members_select
ON public.team_members
FOR SELECT
TO authenticated
USING (
  can_view_project_members(team_members.project_id)
);

CREATE POLICY team_members_insert
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  can_manage_team(project_id)
);

CREATE POLICY team_members_update
ON public.team_members
FOR UPDATE
TO authenticated
USING (
  can_manage_team(team_members.project_id)
);

CREATE POLICY team_members_delete
ON public.team_members
FOR DELETE
TO authenticated
USING (
  can_manage_team(team_members.project_id)
);

-------------------------------------------------------------------------------
-- 5) POLICIES POUR plant_configs
-------------------------------------------------------------------------------
/*
   - SELECT : accès via has_project_access
   - UPDATE : autorisé pour 'team_manager' ou 'owner'
   - INSERT : autorisé pour 'owner'
*/

CREATE POLICY plant_configs_select
ON public.plant_configs
FOR SELECT
TO authenticated
USING (
  has_project_access(plant_configs.project_id)
);

CREATE POLICY plant_configs_update
ON public.plant_configs
FOR UPDATE
TO authenticated
USING (
  check_user_role(plant_configs.project_id, 'team_manager')
  OR check_user_role(plant_configs.project_id, 'owner')
);

CREATE POLICY plant_configs_insert
ON public.plant_configs
FOR INSERT
TO authenticated
WITH CHECK (
  check_user_role(plant_configs.project_id, 'owner')
);

-------------------------------------------------------------------------------
-- 6) POLICIES POUR machines
-------------------------------------------------------------------------------
/*
   - SELECT : accès via has_project_access
   - INSERT : autorisé pour 'owner'
   - UPDATE/DELETE : mêmes règles
*/

CREATE POLICY machines_select
ON public.machines
FOR SELECT
TO authenticated
USING (
  has_project_access(machines.project_id)
);

CREATE POLICY machines_insert
ON public.machines
FOR INSERT
TO authenticated
WITH CHECK (
  check_user_role(machines.project_id, 'owner')
  OR machines.project_id IN (
    SELECT id FROM public.projects
    WHERE user_id = auth.uid()
  )
);


CREATE POLICY machines_update
ON public.machines
FOR UPDATE
TO authenticated
USING (
  check_user_role(machines.project_id, 'owner')
);

CREATE POLICY machines_delete
ON public.machines
FOR DELETE
TO authenticated
USING (
  check_user_role(machines.project_id, 'owner')
);

-------------------------------------------------------------------------------
-- 7) POLICIES POUR production_lines
-------------------------------------------------------------------------------
CREATE POLICY lines_select
ON public.production_lines
FOR SELECT
TO authenticated
USING (
  has_project_access(production_lines.project_id)
);

CREATE POLICY lines_insert
ON public.production_lines
FOR INSERT
TO authenticated
WITH CHECK (
  check_user_role(production_lines.project_id, 'owner')
);

CREATE POLICY lines_update
ON public.production_lines
FOR UPDATE
TO authenticated
USING (
  check_user_role(production_lines.project_id, 'owner')
);

CREATE POLICY lines_delete
ON public.production_lines
FOR DELETE
TO authenticated
USING (
  check_user_role(production_lines.project_id, 'owner')
);

-------------------------------------------------------------------------------
-- 8) POLICIES POUR products
-------------------------------------------------------------------------------
CREATE POLICY products_select
ON public.products
FOR SELECT
TO authenticated
USING (
  has_project_access(products.project_id)
);

CREATE POLICY products_insert
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  check_user_role(products.project_id, 'owner')
);

CREATE POLICY products_update
ON public.products
FOR UPDATE
TO authenticated
USING (
  check_user_role(products.project_id, 'owner')
);

CREATE POLICY products_delete
ON public.products
FOR DELETE
TO authenticated
USING (
  check_user_role(products.project_id, 'owner')
);

-------------------------------------------------------------------------------
-- 9) POLICIES POUR lots
-------------------------------------------------------------------------------
CREATE POLICY lots_select
ON public.lots
FOR SELECT
TO authenticated
USING (
  has_project_access(lots.project_id)
);

CREATE POLICY lots_insert
ON public.lots
FOR INSERT
TO authenticated
WITH CHECK (
  check_user_role(project_id, 'operator')
  OR check_user_role(project_id, 'team_manager')
  OR check_user_role(project_id, 'owner')
);

CREATE POLICY lots_update
ON public.lots
FOR UPDATE
TO authenticated
USING (
  check_user_role(lots.project_id, 'operator')
  OR check_user_role(lots.project_id, 'team_manager')
  OR check_user_role(lots.project_id, 'owner')
);

CREATE POLICY lots_delete
ON public.lots
FOR DELETE
TO authenticated
USING (
  check_user_role(lots.project_id, 'operator')
  OR check_user_role(lots.project_id, 'team_manager')
  OR check_user_role(lots.project_id, 'owner')
);

-------------------------------------------------------------------------------
-- POLICIES POUR lot_tracking
-------------------------------------------------------------------------------
/*
   D’après l’erreur, la table lot_tracking n’a pas de project_id direct.
   Elle possède probablement un champ lot_id -> lots.id -> lots.project_id.
   Pour vérifier l’accès, on fait donc un sous-select dans lots pour récupérer project_id.
*/

-- SELECT : seulement si l'utilisateur a accès au projet du lot
CREATE POLICY lot_tracking_select
ON public.lot_tracking
FOR SELECT
TO authenticated
USING (
  has_project_access(
    (
      SELECT l.project_id
      FROM public.lots l
      WHERE l.id = lot_tracking.lot_id
    )
  )
);

-- INSERT : 'operator', 'team_manager' ou 'owner' du projet auquel appartient le lot
CREATE POLICY lot_tracking_insert
ON public.lot_tracking
FOR INSERT
TO authenticated
WITH CHECK (
  check_user_role(
    (SELECT l.project_id FROM public.lots l WHERE l.id = lot_tracking.lot_id),
    'operator'
  )
  OR check_user_role(
    (SELECT l.project_id FROM public.lots l WHERE l.id = lot_tracking.lot_id),
    'team_manager'
  )
  OR check_user_role(
    (SELECT l.project_id FROM public.lots l WHERE l.id = lot_tracking.lot_id),
    'owner'
  )
);

-- UPDATE
CREATE POLICY lot_tracking_update
ON public.lot_tracking
FOR UPDATE
TO authenticated
USING (
  check_user_role(
    (SELECT l.project_id FROM public.lots l WHERE l.id = lot_tracking.lot_id),
    'operator'
  )
  OR check_user_role(
    (SELECT l.project_id FROM public.lots l WHERE l.id = lot_tracking.lot_id),
    'team_manager'
  )
  OR check_user_role(
    (SELECT l.project_id FROM public.lots l WHERE l.id = lot_tracking.lot_id),
    'owner'
  )
);

-- DELETE
CREATE POLICY lot_tracking_delete
ON public.lot_tracking
FOR DELETE
TO authenticated
USING (
  check_user_role(
    (SELECT l.project_id FROM public.lots l WHERE l.id = lot_tracking.lot_id),
    'operator'
  )
  OR check_user_role(
    (SELECT l.project_id FROM public.lots l WHERE l.id = lot_tracking.lot_id),
    'team_manager'
  )
  OR check_user_role(
    (SELECT l.project_id FROM public.lots l WHERE l.id = lot_tracking.lot_id),
    'owner'
  )
);

-------------------------------------------------------------------------------
-- 10) POLICIES POUR stop_events
-------------------------------------------------------------------------------
CREATE POLICY stops_select
ON public.stop_events
FOR SELECT
TO authenticated
USING (
  has_project_access(stop_events.project_id)
);

CREATE POLICY stops_insert
ON public.stop_events
FOR INSERT
TO authenticated
WITH CHECK (
  check_user_role(project_id, 'operator')
  OR check_user_role(project_id, 'maintenance_technician')
  OR check_user_role(project_id, 'team_manager')
  OR check_user_role(project_id, 'owner')
);

CREATE POLICY stops_update
ON public.stop_events
FOR UPDATE
TO authenticated
USING (
  check_user_role(project_id, 'operator')
  OR check_user_role(project_id, 'maintenance_technician')
  OR check_user_role(project_id, 'team_manager')
  OR check_user_role(project_id, 'owner')
);

CREATE POLICY stops_delete
ON public.stop_events
FOR DELETE
TO authenticated
USING (
  check_user_role(stop_events.project_id, 'team_manager')
  OR check_user_role(stop_events.project_id, 'owner')
);

-------------------------------------------------------------------------------
-- 11) POLICIES POUR quality_issues
-------------------------------------------------------------------------------
CREATE POLICY quality_select
ON public.quality_issues
FOR SELECT
TO authenticated
USING (
  has_project_access(quality_issues.project_id)
);

CREATE POLICY quality_insert
ON public.quality_issues
FOR INSERT
TO authenticated
WITH CHECK (
  check_user_role(project_id, 'operator')
  OR check_user_role(project_id, 'quality_technician')
  OR check_user_role(project_id, 'team_manager')
  OR check_user_role(project_id, 'owner')
);

CREATE POLICY quality_update
ON public.quality_issues
FOR UPDATE
TO authenticated
USING (
  check_user_role(project_id, 'operator')
  OR check_user_role(project_id, 'quality_technician')
  OR check_user_role(project_id, 'team_manager')
  OR check_user_role(project_id, 'owner')
);

CREATE POLICY quality_delete
ON public.quality_issues
FOR DELETE
TO authenticated
USING (
  check_user_role(quality_issues.project_id, 'team_manager')
  OR check_user_role(quality_issues.project_id, 'owner')
);

-------------------------------------------------------------------------------
-- 12) POLICIES POUR subscriptions
-------------------------------------------------------------------------------
CREATE POLICY subs_select
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.projects
    WHERE projects.id = subscriptions.project_id
      AND projects.user_id = auth.uid()
  )
);

CREATE POLICY subs_update
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.projects
    WHERE projects.id = subscriptions.project_id
      AND projects.user_id = auth.uid()
  )
);

-------------------------------------------------------------------------------
-- 13) POLICIES POUR team_roles
-------------------------------------------------------------------------------
CREATE POLICY team_roles_select
ON public.team_roles
FOR SELECT
TO authenticated
USING (true);

-------------------------------------------------------------------------------
-- 14) TRIGGER POUR AJOUTER AUTOMATIQUEMENT L'OWNER DANS team_members
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.team_members (
    project_id,
    email,
    role,
    status,
    team_name,
    working_time_minutes
  )
  VALUES (
    NEW.id,
    auth.email(),
    'owner',
    'active',
    'Management',
    480
  )
  ON CONFLICT (project_id, email, role) DO NOTHING;

  INSERT INTO public.subscriptions (
    project_id,
    status,
    machine_limit
  )
  VALUES (
    NEW.id,
    'free',
    3
  )
  ON CONFLICT (project_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS add_owner_trigger ON public.projects;
CREATE TRIGGER add_owner_trigger
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION add_project_owner();

-------------------------------------------------------------------------------
-- 15) ACTIVER ROW LEVEL SECURITY SUR TOUTES LES TABLES
-------------------------------------------------------------------------------
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_tracking ENABLE ROW LEVEL SECURITY;

COMMIT;
