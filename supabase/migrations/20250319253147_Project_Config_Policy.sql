BEGIN;

---------------------------------------------------
-- 1) SUPPRESSION DES POLICIES EXISTANTES (TABLE PAR TABLE)
---------------------------------------------------

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

-- products
DROP POLICY IF EXISTS products_select ON public.products;
DROP POLICY IF EXISTS products_insert ON public.products;
DROP POLICY IF EXISTS products_update ON public.products;
DROP POLICY IF EXISTS products_delete ON public.products;

-- Team
DROP POLICY IF EXISTS team_members_select_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_insert_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_update_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_delete_policy ON public.team_members;

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

-- team_roles (si vous la rendez publique en lecture, par ex.)
DROP POLICY IF EXISTS team_roles_select ON public.team_roles;

---------------------------------------------------
-- 2) CRÉATION (OU RE-CRÉATION) DES FONCTIONS UTILITAIRES
---------------------------------------------------

-- ❗️ ICI on aligne le paramètre du corps avec la signature "project_uuid"
CREATE OR REPLACE FUNCTION has_project_access(project_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN 
    -- Propriétaire
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_uuid
        AND user_id = auth.uid()
    )
    OR
    -- Membre actif
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE project_id = project_uuid
        AND email = auth.email()
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_user_role(project_uuid uuid, required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE project_id = project_uuid
      AND email = auth.email()
      AND role = required_role
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

---------------------------------------------------
-- 3) POLICIES POUR plant_configs
---------------------------------------------------

-- SELECT : tout membre du projet peut lire
CREATE POLICY plant_configs_select
ON public.plant_configs
FOR SELECT
TO authenticated
USING (
  has_project_access(plant_configs.project_id)
);

-- UPDATE : owner ou team_manager
CREATE POLICY plant_configs_update
ON public.plant_configs
FOR UPDATE
TO authenticated
USING (
  check_user_role(plant_configs.project_id, 'team_manager')
  OR check_user_role(plant_configs.project_id, 'owner')
);

---------------------------------------------------
-- 4) POLICIES POUR machines
---------------------------------------------------

-- SELECT : tout membre du projet
CREATE POLICY machines_select
ON public.machines
FOR SELECT
TO authenticated
USING (
  has_project_access(machines.project_id)
);

-- INSERT : maintenance_technician, team_manager, owner
CREATE POLICY machines_insert
ON public.machines
FOR INSERT
TO authenticated
WITH CHECK (
  check_user_role(project_id, 'maintenance_technician')
  OR check_user_role(project_id, 'team_manager')
  OR check_user_role(project_id, 'owner')
);

-- UPDATE
CREATE POLICY machines_update
ON public.machines
FOR UPDATE
TO authenticated
USING (
  check_user_role(machines.project_id, 'maintenance_technician')
  OR check_user_role(machines.project_id, 'team_manager')
  OR check_user_role(machines.project_id, 'owner')
);

-- DELETE
CREATE POLICY machines_delete
ON public.machines
FOR DELETE
TO authenticated
USING (
  check_user_role(machines.project_id, 'maintenance_technician')
  OR check_user_role(machines.project_id, 'team_manager')
  OR check_user_role(machines.project_id, 'owner')
);

---------------------------------------------------
-- 5) POLICIES POUR production_lines
---------------------------------------------------

-- SELECT : tout membre
CREATE POLICY lines_select
ON public.production_lines
FOR SELECT
TO authenticated
USING (
  has_project_access(production_lines.project_id)
);

-- INSERT : team_manager, owner
CREATE POLICY lines_insert
ON public.production_lines
FOR INSERT
TO authenticated
WITH CHECK (
  check_user_role(project_id, 'team_manager')
  OR check_user_role(project_id, 'owner')
);

-- UPDATE
CREATE POLICY lines_update
ON public.production_lines
FOR UPDATE
TO authenticated
USING (
  check_user_role(production_lines.project_id, 'team_manager')
  OR check_user_role(production_lines.project_id, 'owner')
);

-- DELETE
CREATE POLICY lines_delete
ON public.production_lines
FOR DELETE
TO authenticated
USING (
  check_user_role(production_lines.project_id, 'team_manager')
  OR check_user_role(production_lines.project_id, 'owner')
);

---------------------------------------------------
-- 6) POLICIES POUR products
---------------------------------------------------

-- SELECT
CREATE POLICY products_select
ON public.products
FOR SELECT
TO authenticated
USING (
  has_project_access(products.project_id)
);

-- INSERT : operator, team_manager, owner
CREATE POLICY products_insert
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  check_user_role(project_id, 'operator')
  OR check_user_role(project_id, 'team_manager')
  OR check_user_role(project_id, 'owner')
);

-- UPDATE
CREATE POLICY products_update
ON public.products
FOR UPDATE
TO authenticated
USING (
  check_user_role(products.project_id, 'operator')
  OR check_user_role(products.project_id, 'team_manager')
  OR check_user_role(products.project_id, 'owner')
);

-- DELETE
CREATE POLICY products_delete
ON public.products
FOR DELETE
TO authenticated
USING (
  check_user_role(products.project_id, 'operator')
  OR check_user_role(products.project_id, 'team_manager')
  OR check_user_role(products.project_id, 'owner')
);

---------------------------------------------------
-- 7) POLICIES POUR lots
---------------------------------------------------

-- SELECT : tout membre
CREATE POLICY lots_select
ON public.lots
FOR SELECT
TO authenticated
USING (
  has_project_access(lots.project_id)
);

-- INSERT : operator, team_manager, owner
CREATE POLICY lots_insert
ON public.lots
FOR INSERT
TO authenticated
WITH CHECK (
  check_user_role(project_id, 'operator')
  OR check_user_role(project_id, 'team_manager')
  OR check_user_role(project_id, 'owner')
);

-- UPDATE
CREATE POLICY lots_update
ON public.lots
FOR UPDATE
TO authenticated
USING (
  check_user_role(lots.project_id, 'operator')
  OR check_user_role(lots.project_id, 'team_manager')
  OR check_user_role(lots.project_id, 'owner')
);

-- DELETE
CREATE POLICY lots_delete
ON public.lots
FOR DELETE
TO authenticated
USING (
  check_user_role(lots.project_id, 'operator')
  OR check_user_role(lots.project_id, 'team_manager')
  OR check_user_role(lots.project_id, 'owner')
);

---------------------------------------------------
-- 8) POLICIES POUR stop_events
---------------------------------------------------

-- SELECT
CREATE POLICY stops_select
ON public.stop_events
FOR SELECT
TO authenticated
USING (
  has_project_access(stop_events.project_id)
);

-- INSERT : operator, maintenance_technician, team_manager, owner
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

-- UPDATE
CREATE POLICY stops_update
ON public.stop_events
FOR UPDATE
TO authenticated
USING (
  check_user_role(stop_events.project_id, 'maintenance_technician')
  OR check_user_role(stop_events.project_id, 'team_manager')
  OR check_user_role(stop_events.project_id, 'owner')
);

-- DELETE
CREATE POLICY stops_delete
ON public.stop_events
FOR DELETE
TO authenticated
USING (
  check_user_role(stop_events.project_id, 'team_manager')
  OR check_user_role(stop_events.project_id, 'owner')
);

---------------------------------------------------
-- 9) POLICIES POUR quality_issues
---------------------------------------------------

-- SELECT
CREATE POLICY quality_select
ON public.quality_issues
FOR SELECT
TO authenticated
USING (
  has_project_access(quality_issues.project_id)
);

-- INSERT : operator, quality_technician, team_manager, owner
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

-- UPDATE
CREATE POLICY quality_update
ON public.quality_issues
FOR UPDATE
TO authenticated
USING (
  check_user_role(quality_issues.project_id, 'quality_technician')
  OR check_user_role(quality_issues.project_id, 'team_manager')
  OR check_user_role(quality_issues.project_id, 'owner')
);

-- DELETE
CREATE POLICY quality_delete
ON public.quality_issues
FOR DELETE
TO authenticated
USING (
  check_user_role(quality_issues.project_id, 'team_manager')
  OR check_user_role(quality_issues.project_id, 'owner')
);

---------------------------------------------------
-- 10) POLICIES POUR subscriptions
---------------------------------------------------

-- SELECT : seul le propriétaire peut voir/mettre à jour l’abonnement, par exemple
CREATE POLICY subs_select
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
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
    SELECT 1 FROM public.projects
    WHERE projects.id = subscriptions.project_id
      AND projects.user_id = auth.uid()
  )
);

---------------------------------------------------
-- 11) POLICIES POUR team_roles
---------------------------------------------------


--------------------------------------------------------
-- 2) POLICY SELECT : lire tous les membres d'un projet
--------------------------------------------------------
CREATE POLICY team_members_select
ON public.team_members
FOR SELECT
TO authenticated
USING (
  (
    -- Cas 1 : l'utilisateur est propriétaire du projet
    project_id IN (
      SELECT id
      FROM public.projects
      WHERE user_id = auth.uid()
    )
  )
  OR
  (
    -- Cas 2 : l'utilisateur est membre actif du projet
    project_id IN (
      SELECT project_id
      FROM public.team_members
      WHERE email = auth.email()
        AND status = 'active'
    )
  )
);

--------------------------------------------------------
-- 3) POLICY INSERT : ajouter un membre au projet
--------------------------------------------------------
-- Seul le propriétaire ou un team_manager peut créer un nouveau membre
CREATE POLICY team_members_insert
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  (
    -- L'utilisateur est propriétaire du projet
    project_id IN (
      SELECT id
      FROM public.projects
      WHERE user_id = auth.uid()
    )
  )
  OR
  (
    -- Ou il a le rôle team_manager sur ce projet
    check_user_role(project_id, 'team_manager')
  )
);

--------------------------------------------------------
-- 4) POLICY UPDATE (OPTIONNEL) : modifier un membre
--------------------------------------------------------
CREATE POLICY team_members_update
ON public.team_members
FOR UPDATE
TO authenticated
USING (
  (
    -- L'utilisateur est propriétaire
    project_id IN (
      SELECT id
      FROM public.projects
      WHERE user_id = auth.uid()
    )
  )
  OR
  (
    -- Ou team_manager
    check_user_role(project_id, 'team_manager')
  )
);

--------------------------------------------------------
-- 5) POLICY DELETE (OPTIONNEL) : retirer un membre
--------------------------------------------------------
CREATE POLICY team_members_delete
ON public.team_members
FOR DELETE
TO authenticated
USING (
  (
    project_id IN (
      SELECT id
      FROM public.projects
      WHERE user_id = auth.uid()
    )
  )
  OR
  (
    check_user_role(project_id, 'team_manager')
  )
);


---------------------------------------------------
-- 12) ACTIVER ROW LEVEL SECURITY SUR TOUTES CES TABLES
---------------------------------------------------



ALTER TABLE public.plant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;

COMMIT;
