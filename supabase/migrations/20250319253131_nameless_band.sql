-- 🛠 Démarrer la transaction
BEGIN;

-- 1️⃣ SUPPRESSION DES POLICIES EXISTANTES
DO $$ 
DECLARE 
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 
            policy_record.policyname, 
            policy_record.tablename);
    END LOOP;
END $$;

-- 2️⃣ FONCTIONS UTILITAIRES

-- Fonction pour vérifier l'accès au projet
CREATE OR REPLACE FUNCTION has_project_access(project_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE project_id = project_uuid
    AND email = auth.email()
    AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM projects
    WHERE id = project_uuid
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier le rôle d'un utilisateur
CREATE OR REPLACE FUNCTION check_user_role(project_uuid uuid, required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE project_id = project_uuid
    AND email = auth.email()
    AND role = required_role
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3️⃣ POLICIES POUR PROJECTS

-- SELECT : membres actifs + propriétaires
CREATE POLICY project_select_policy ON projects
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT project_id FROM team_members 
    WHERE email = auth.email() AND status = 'active'
  ) OR user_id = auth.uid()
);

-- INSERT : tout utilisateur authentifié
CREATE POLICY project_insert_policy ON projects
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE/DELETE : propriétaire uniquement
CREATE POLICY project_owner_policy ON projects
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4️⃣ TRIGGER POUR AJOUTER L'OWNER AUTOMATIQUEMENT
CREATE OR REPLACE FUNCTION add_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO team_members (
    project_id,
    email,
    role,
    status,
    invited_at,
    joined_at,
    team_name,
    working_time_minutes
  ) VALUES (
    NEW.id,
    auth.email(),
    'owner',
    'active',
    NOW(),
    NOW(),
    'Management',
    480
  );
  
  -- Créer l'abonnement gratuit
  INSERT INTO subscriptions (
    project_id,
    status,
    machine_limit
  ) VALUES (
    NEW.id,
    'free',
    3
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS add_owner_trigger ON projects;
CREATE TRIGGER add_owner_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION add_project_owner();

-- 5️⃣ POLICIES POUR TEAM_MEMBERS

-- SELECT : voir les membres de ses projets
CREATE POLICY team_members_select ON team_members
FOR SELECT TO authenticated
USING (has_project_access(project_id));

-- INSERT/UPDATE/DELETE : owner ou team_manager uniquement
CREATE POLICY team_members_manage ON team_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE id = team_members.project_id
    AND (
      user_id = auth.uid()
      OR check_user_role(id, 'team_manager')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE id = team_members.project_id
    AND (
      user_id = auth.uid()
      OR check_user_role(id, 'team_manager')
    )
  )
);

-- 6️⃣ POLICIES POUR LES TABLES DE CONFIGURATION

-- Plant Configs
CREATE POLICY plant_configs_policy ON plant_configs
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

-- Production Lines
CREATE POLICY production_lines_policy ON production_lines
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

-- Machines
CREATE POLICY machines_policy ON machines
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

-- Products
CREATE POLICY products_policy ON products
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

-- 7️⃣ POLICIES POUR LES DONNÉES DE PRODUCTION

-- Lots
CREATE POLICY lots_select ON lots
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY lots_insert ON lots
FOR INSERT TO authenticated
WITH CHECK (
  has_project_access(project_id)
  AND (
    check_user_role(project_id, 'operator')
    OR check_user_role(project_id, 'team_manager')
    OR check_user_role(project_id, 'owner')
  )
);

CREATE POLICY lots_update ON lots
FOR UPDATE TO authenticated
USING (
  has_project_access(project_id)
  AND (
    check_user_role(project_id, 'team_manager')
    OR check_user_role(project_id, 'owner')
  )
);

-- Stop Events
CREATE POLICY stop_events_select ON stop_events
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY stop_events_insert ON stop_events
FOR INSERT TO authenticated
WITH CHECK (
  has_project_access(project_id)
  AND (
    check_user_role(project_id, 'operator')
    OR check_user_role(project_id, 'maintenance_technician')
    OR check_user_role(project_id, 'team_manager')
    OR check_user_role(project_id, 'owner')
  )
);

CREATE POLICY stop_events_update ON stop_events
FOR UPDATE TO authenticated
USING (
  has_project_access(project_id)
  AND (
    check_user_role(project_id, 'maintenance_technician')
    OR check_user_role(project_id, 'team_manager')
    OR check_user_role(project_id, 'owner')
  )
);

-- Quality Issues
CREATE POLICY quality_issues_select ON quality_issues
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY quality_issues_insert ON quality_issues
FOR INSERT TO authenticated
WITH CHECK (
  has_project_access(project_id)
  AND (
    check_user_role(project_id, 'operator')
    OR check_user_role(project_id, 'quality_technician')
    OR check_user_role(project_id, 'team_manager')
    OR check_user_role(project_id, 'owner')
  )
);

CREATE POLICY quality_issues_update ON quality_issues
FOR UPDATE TO authenticated
USING (
  has_project_access(project_id)
  AND (
    check_user_role(project_id, 'quality_technician')
    OR check_user_role(project_id, 'team_manager')
    OR check_user_role(project_id, 'owner')
  )
);

-- 8️⃣ POLICIES POUR LES ABONNEMENTS

CREATE POLICY subscriptions_policy ON subscriptions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE id = subscriptions.project_id
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE id = subscriptions.project_id
    AND user_id = auth.uid()
  )
);

-- 9️⃣ POLICIES POUR LES RÔLES (lecture seule)

CREATE POLICY team_roles_select ON team_roles
FOR SELECT TO authenticated
USING (true);

-- 🔟 ACTIVER RLS SUR TOUTES LES TABLES
DO $$ 
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', table_record.tablename);
    END LOOP;
END $$;

COMMIT;