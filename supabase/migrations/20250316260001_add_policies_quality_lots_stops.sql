-- Démarrer la transaction
BEGIN;

-- =====================================================
-- ✅ 1. TABLE `quality_issues`
-- =====================================================
ALTER TABLE public.quality_issues ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS quality_issues_create_policy ON public.quality_issues;
DROP POLICY IF EXISTS quality_issues_manage_policy ON public.quality_issues;
DROP POLICY IF EXISTS quality_issues_view_policy ON public.quality_issues;

-- INSERT policy
CREATE POLICY quality_issues_create_policy
  ON public.quality_issues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_project_access(project_id) AND (
      check_user_role(project_id, 'operator'::text)
      OR check_user_role(project_id, 'maintenance_technician'::text)
      OR check_user_role(project_id, 'quality_technician'::text)
      OR check_user_role(project_id, 'team_manager'::text)
      OR check_user_role(project_id, 'owner'::text)  -- ✅ Ajout du rôle "owner"
    )
  );

-- UPDATE policy
CREATE POLICY quality_issues_manage_policy
  ON public.quality_issues
  FOR UPDATE
  TO authenticated
  USING (
    has_project_access(project_id) AND (
      check_user_role(project_id, 'quality_technician'::text)
      OR check_user_role(project_id, 'team_manager'::text)
      OR check_user_role(project_id, 'owner'::text)  -- ✅ Ajout du rôle "owner"
    )
  );

-- SELECT policy
CREATE POLICY quality_issues_view_policy
  ON public.quality_issues
  FOR SELECT
  TO authenticated
  USING (
    has_project_access(project_id)
  );

-- =====================================================
-- ✅ 2. TABLE `lots`
-- =====================================================
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS lots_create_policy ON public.lots;
DROP POLICY IF EXISTS lots_manage_policy ON public.lots;
DROP POLICY IF EXISTS lots_view_policy ON public.lots;

-- INSERT policy
CREATE POLICY lots_create_policy
  ON public.lots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_project_access(project_id) AND (
      check_user_role(project_id, 'operator'::text)
      OR check_user_role(project_id, 'team_manager'::text)
      OR check_user_role(project_id, 'owner'::text)  -- ✅ Ajout du rôle "owner"
    )
  );

-- UPDATE policy
CREATE POLICY lots_manage_policy
  ON public.lots
  FOR UPDATE
  TO authenticated
  USING (
    has_project_access(project_id) AND (
      check_user_role(project_id, 'team_manager'::text)
      OR check_user_role(project_id, 'owner'::text)  -- ✅ Ajout du rôle "owner"
    )
  );

-- SELECT policy
CREATE POLICY lots_view_policy
  ON public.lots
  FOR SELECT
  TO authenticated
  USING (
    has_project_access(project_id)
  );

-- =====================================================
-- ✅ 3. TABLE `stop_events`
-- =====================================================
ALTER TABLE public.stop_events ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS stop_events_create_policy ON public.stop_events;
DROP POLICY IF EXISTS stop_events_manage_policy ON public.stop_events;
DROP POLICY IF EXISTS stop_events_view_policy ON public.stop_events;

-- INSERT policy
CREATE POLICY stop_events_create_policy
  ON public.stop_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_project_access(project_id) AND (
      check_user_role(project_id, 'operator'::text)
      OR check_user_role(project_id, 'maintenance_technician'::text)
      OR check_user_role(project_id, 'team_manager'::text)
      OR check_user_role(project_id, 'owner'::text)  -- ✅ Ajout du rôle "owner"
    )
  );

-- UPDATE policy
CREATE POLICY stop_events_manage_policy
  ON public.stop_events
  FOR UPDATE
  TO authenticated
  USING (
    has_project_access(project_id) AND (
      check_user_role(project_id, 'team_manager'::text)
      OR check_user_role(project_id, 'owner'::text)  -- ✅ Ajout du rôle "owner"
    )
  );

-- SELECT policy
CREATE POLICY stop_events_view_policy
  ON public.stop_events
  FOR SELECT
  TO authenticated
  USING (
    has_project_access(project_id)
  );

-- Valider la transaction
COMMIT;
