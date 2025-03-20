-- 🛠 Début de la transaction
BEGIN;

-- 🛠 Étape 1 : Supprimer toutes les policies existantes
DO $$ 
DECLARE policy_record RECORD;
BEGIN
    FOR policy_record IN (SELECT polname, polrelid FROM pg_policy) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_record.polname, policy_record.polrelid);
    END LOOP;
END $$;

-- ================================
-- ✅ Recréer les policies propres
-- ================================

-- 🔹 1. Accès aux projets (Seulement les projets auxquels l’utilisateur est membre)
CREATE POLICY project_access
ON public.projects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_members.project_id = projects.id
    AND team_members.email = auth.email()
  )
);

-- 🔹 2. Gestion des membres d’une équipe (accès à ses propres infos)
CREATE POLICY team_members_member_access
ON public.team_members
FOR SELECT
TO authenticated
USING (
  email = auth.email()
);

-- 🔹 3. Gestion avancée des membres par le propriétaire ou le manager d’équipe
CREATE POLICY team_members_manage_policy
ON public.team_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = team_members.project_id
    AND (projects.user_id = auth.uid() OR check_user_role(projects.id, 'team_manager'))
  )
);

-- 🔹 4. Accès aux rôles d’équipe (visible par tout le monde)
CREATE POLICY "Anyone can view roles"
ON public.team_roles
FOR SELECT
TO authenticated
USING (true);

-- 🔹 5. Accès aux autres données du projet (lot_tracking, machines, etc.)
DO $$ 
DECLARE table_name TEXT;
BEGIN
  FOR table_name IN 
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  LOOP
    EXECUTE format(
      'CREATE POLICY general_project_access
      ON public.%I
      FOR SELECT
      TO authenticated
      USING (has_project_access(project_id));',
      table_name
    );
  END LOOP;
END $$;

-- 🛠 Fin de la transaction
COMMIT;
