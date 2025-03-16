-- Activer la RLS si pas déjà active
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

-- Supprimer d’anciennes policies si elles existent
DROP POLICY IF EXISTS lots_create_policy ON public.lots;
DROP POLICY IF EXISTS lots_manage_policy ON public.lots;
DROP POLICY IF EXISTS lots_view_policy ON public.lots;

-- Policy d’INSERT : autorise l’insertion si l’utilisateur a accès au projet
-- ET s’il a un rôle dans { owner, team_manager, operator, quality_technician, maintenance_technician }.
CREATE POLICY lots_create_policy
  ON public.lots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_project_access(project_id)
    AND (
      check_user_role(project_id, 'owner')::text = 'owner'
      OR check_user_role(project_id, 'team_manager')::text = 'team_manager'
      OR check_user_role(project_id, 'operator')::text = 'operator'
      OR check_user_role(project_id, 'quality_technician')::text = 'quality_technician'
      OR check_user_role(project_id, 'maintenance_technician')::text = 'maintenance_technician'
    )
  );

-- Policy d’UPDATE : autorise la mise à jour si l’utilisateur a accès au projet
-- ET s’il a un rôle dans { owner, team_manager, operator, quality_technician, maintenance_technician }.
-- (Ici, tout le monde peut tout mettre à jour, adaptez si vous voulez restreindre certains rôles)
CREATE POLICY lots_manage_policy
  ON public.lots
  FOR UPDATE
  TO authenticated
  USING (
    has_project_access(project_id)
    AND (
      check_user_role(project_id, 'owner')::text = 'owner'
      OR check_user_role(project_id, 'team_manager')::text = 'team_manager'
      OR check_user_role(project_id, 'operator')::text = 'operator'
      OR check_user_role(project_id, 'quality_technician')::text = 'quality_technician'
      OR check_user_role(project_id, 'maintenance_technician')::text = 'maintenance_technician'
    )
  )
  WITH CHECK (
    has_project_access(project_id)
    AND (
      check_user_role(project_id, 'owner')::text = 'owner'
      OR check_user_role(project_id, 'team_manager')::text = 'team_manager'
      OR check_user_role(project_id, 'operator')::text = 'operator'
      OR check_user_role(project_id, 'quality_technician')::text = 'quality_technician'
      OR check_user_role(project_id, 'maintenance_technician')::text = 'maintenance_technician'
    )
  );

-- Policy de SELECT : autorise la lecture si l’utilisateur a accès au projet
-- ET s’il a un rôle dans { owner, team_manager, operator, quality_technician, maintenance_technician }.
CREATE POLICY lots_view_policy
  ON public.lots
  FOR SELECT
  TO authenticated
  USING (
    has_project_access(project_id)
    AND (
      check_user_role(project_id, 'owner')::text = 'owner'
      OR check_user_role(project_id, 'team_manager')::text = 'team_manager'
      OR check_user_role(project_id, 'operator')::text = 'operator'
      OR check_user_role(project_id, 'quality_technician')::text = 'quality_technician'
      OR check_user_role(project_id, 'maintenance_technician')::text = 'maintenance_technician'
    )
  );

-- (Optionnel) Policy de DELETE : autorise la suppression
-- pour tous les rôles listés (même logique).
-- CREATE POLICY lots_delete_policy
--   ON public.lots
--   FOR DELETE
--   TO authenticated
--   USING (
--     has_project_access(project_id)
--     AND (
--       check_user_role(project_id, 'owner')::text = 'owner'
--       OR check_user_role(project_id, 'team_manager')::text = 'team_manager'
--       OR check_user_role(project_id, 'operator')::text = 'operator'
--       OR check_user_role(project_id, 'quality_technician')::text = 'quality_technician'
--       OR check_user_role(project_id, 'maintenance_technician')::text = 'maintenance_technician'
--     )
--   );

