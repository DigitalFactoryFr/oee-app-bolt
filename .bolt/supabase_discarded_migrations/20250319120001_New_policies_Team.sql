-- 🛠 Démarrer la transaction
BEGIN;

-- ✅ Restaurer la gestion des membres
CREATE POLICY team_members_manage_policy
ON public.team_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = team_members.project_id
    AND (projects.user_id = auth.uid() OR check_user_role(project_id, 'team_manager'::text))
  )
);

-- ✅ Restaurer la lecture des membres d'une équipe
CREATE POLICY team_members_view_policy
ON public.team_members
FOR SELECT
TO authenticated
USING (
  has_project_access(project_id)
);

-- ✅ Restaurer l'accès des membres
CREATE POLICY team_members_member_access
ON public.team_members
FOR SELECT
TO authenticated
USING (
  project_id IN (SELECT projects.id FROM projects WHERE projects.user_id = auth.uid()) 
  OR email = auth.email()
);

-- ✅ Restaurer la gestion des rôles des membres
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

-- ✅ Restaurer la création de membres
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

-- ✅ Restaurer la suppression des membres
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

-- ✅ Restaurer la mise à jour des membres
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

-- 🛠 Terminer la transaction
COMMIT;
