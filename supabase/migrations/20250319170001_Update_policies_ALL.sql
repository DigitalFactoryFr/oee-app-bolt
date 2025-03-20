-- 🛠 DÉBUT DE LA TRANSACTION
BEGIN;

-- 1️⃣ SUPPRESSION DES ANCIENNES POLICIES
DO $$ 
DECLARE policy RECORD;
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

-- 2️⃣ POLICIES POUR LES PROJETS 📌

-- ✅ Les membres voient uniquement les projets auxquels ils sont assignés
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
    OR projects.user_id = auth.uid()
);

-- ✅ Le propriétaire du projet a un accès total
CREATE POLICY project_owner_access
ON public.projects
FOR ALL
TO authenticated
USING (projects.user_id = auth.uid())
WITH CHECK (projects.user_id = auth.uid());

-- ✅ Un utilisateur authentifié peut créer un projet
CREATE POLICY project_create_policy
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- ✅ AUTOMATISATION : Ajouter le propriétaire dans `team_members` avec `status='active'`
CREATE OR REPLACE FUNCTION add_project_owner() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.team_members (project_id, email, role, status, invited_at, joined_at)
    VALUES (NEW.id, (SELECT email FROM auth.users WHERE id = NEW.user_id), 'owner', 'active', NOW(), NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_add_project_owner ON public.projects;
CREATE TRIGGER trigger_add_project_owner
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION add_project_owner();

-- 3️⃣ POLICIES POUR TEAM MEMBERS 📌

-- ✅ Voir uniquement les membres du projet auquel on appartient
CREATE POLICY team_members_view_policy
ON public.team_members
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_members t 
        WHERE t.project_id = team_members.project_id 
        AND t.email = auth.email()
    )
);

-- ✅ Modifier un membre (seulement pour les `owner` et `team_manager`)
CREATE POLICY team_members_update_policy
ON public.team_members
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.project_id = team_members.project_id 
        AND (check_user_role(team_members.project_id, 'team_manager') 
        OR check_user_role(team_members.project_id, 'owner'))
    )
);

-- ✅ Ajouter un membre (seulement les managers et propriétaires)
CREATE POLICY team_members_create_policy
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE projects.id = team_members.project_id 
        AND (check_user_role(team_members.project_id, 'team_manager') 
        OR check_user_role(team_members.project_id, 'owner'))
    )
);

-- ✅ Supprimer un membre (seulement les managers et propriétaires)
CREATE POLICY team_members_delete_policy
ON public.team_members
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE projects.id = team_members.project_id 
        AND (check_user_role(team_members.project_id, 'team_manager') 
        OR check_user_role(team_members.project_id, 'owner'))
    )
);

-- 4️⃣ POLICIES POUR GÉRER LES DONNÉES 📌

-- ✅ Voir uniquement les lignes de production du projet
CREATE POLICY production_lines_access_policy
ON public.production_lines
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.project_id = production_lines.project_id 
        AND team_members.email = auth.email()
    )
);

-- ✅ Accès aux produits liés au projet
CREATE POLICY products_access_policy
ON public.products
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.project_id = products.project_id 
        AND team_members.email = auth.email()
    )
);

-- ✅ Voir uniquement les lots liés au projet
CREATE POLICY lots_view_policy
ON public.lots
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.project_id = lots.project_id 
        AND team_members.email = auth.email()
    )
);

-- ✅ Modifier les lots (opérateurs, managers, propriétaires)
CREATE POLICY lots_update_policy
ON public.lots
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.project_id = lots.project_id 
        AND team_members.email = auth.email()
        AND team_members.role IN ('operator', 'team_manager', 'owner')
    )
);

-- ✅ Insérer des lots (opérateurs, managers, propriétaires)
CREATE POLICY lots_insert_policy
ON public.lots
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.project_id = lots.project_id 
        AND team_members.email = auth.email()
        AND team_members.role IN ('operator', 'team_manager', 'owner')
    )
);

-- ✅ Voir les événements d’arrêt
CREATE POLICY stop_events_view_policy
ON public.stop_events
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.project_id = stop_events.project_id 
        AND team_members.email = auth.email()
    )
);

-- ✅ Accès aux abonnements (seuls les `owner`)
CREATE POLICY subscriptions_access
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

-- ✅ Accès aux rôles des équipes (public)
CREATE POLICY team_roles_access
ON public.team_roles
FOR SELECT
TO authenticated
USING (true);

-- 🛠 FIN DE LA TRANSACTION
COMMIT;
