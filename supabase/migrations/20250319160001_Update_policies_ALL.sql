-- 🛠 DÉBUT DE LA TRANSACTION
BEGIN;

-- 1️⃣ SUPPRESSION DES POLICIES EXISTANTES
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

-- 2️⃣ POLICIES POUR LES PROJETS 📌

-- ✅ Accès aux projets uniquement pour les membres assignés
CREATE POLICY project_access
ON public.projects
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.team_members WHERE team_members.project_id = projects.id AND team_members.email = auth.email())
    OR projects.user_id = auth.uid()
);

-- ✅ Propriétaires gèrent totalement leurs projets
CREATE POLICY project_owner_full_access
ON public.projects
FOR ALL
TO authenticated
USING (projects.user_id = auth.uid())
WITH CHECK (projects.user_id = auth.uid());

-- ✅ Création de projet autorisée pour tous les utilisateurs authentifiés
CREATE POLICY project_create_policy
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- ✅ ⚡ AUTOMATISATION : Ajouter l'owner dans team_members avec statut 'active'
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

-- ✅ Voir les membres uniquement si on appartient au projet
CREATE POLICY team_members_view_policy
ON public.team_members
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = team_members.project_id AND projects.user_id = auth.uid())
    OR team_members.email = auth.email()
);

-- ✅ Modifier un membre (pour les managers et propriétaires)
CREATE POLICY team_members_update_policy
ON public.team_members
FOR UPDATE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = team_members.project_id AND projects.user_id = auth.uid())
    OR check_user_role(team_members.project_id, 'team_manager')
);

-- ✅ Ajouter un membre (seulement les managers et propriétaires)
CREATE POLICY team_members_create_policy
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = team_members.project_id AND projects.user_id = auth.uid())
    OR check_user_role(team_members.project_id, 'team_manager')
);

-- ✅ Supprimer un membre (seulement les managers et propriétaires)
CREATE POLICY team_members_delete_policy
ON public.team_members
FOR DELETE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = team_members.project_id AND projects.user_id = auth.uid())
    OR check_user_role(team_members.project_id, 'team_manager')
);

-- 4️⃣ POLICIES POUR LA GESTION DES DONNÉES 📌

-- ✅ Accès aux lignes de production pour les membres du projet
CREATE POLICY production_lines_access_policy
ON public.production_lines
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.team_members WHERE team_members.project_id = production_lines.project_id AND team_members.email = auth.email()));

-- ✅ Accès aux produits liés au projet
CREATE POLICY products_access_policy
ON public.products
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.team_members WHERE team_members.project_id = products.project_id AND team_members.email = auth.email()));

-- ✅ Voir les lots de production
CREATE POLICY lots_view_policy
ON public.lots
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.team_members WHERE team_members.project_id = lots.project_id AND team_members.email = auth.email()));

-- ✅ Modifier les lots (opérateurs, managers, propriétaires)
CREATE POLICY lots_update_policy
ON public.lots
FOR UPDATE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.team_members WHERE team_members.project_id = lots.project_id AND team_members.email = auth.email() AND team_members.role IN ('operator', 'team_manager', 'owner'))
);

-- ✅ Ajouter des lots (opérateurs, managers, propriétaires)
CREATE POLICY lots_insert_policy
ON public.lots
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.team_members WHERE team_members.project_id = lots.project_id AND team_members.email = auth.email() AND team_members.role IN ('operator', 'team_manager', 'owner'))
);

-- ✅ Accès et gestion des événements d’arrêt
CREATE POLICY stop_events_view_policy
ON public.stop_events
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.team_members WHERE team_members.project_id = stop_events.project_id AND team_members.email = auth.email())
);

CREATE POLICY stop_events_insert_policy
ON public.stop_events
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.team_members WHERE team_members.project_id = stop_events.project_id AND team_members.email = auth.email())
);

-- ✅ Accès aux problèmes qualité
CREATE POLICY quality_issues_view_policy
ON public.quality_issues
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.team_members WHERE team_members.project_id = quality_issues.project_id AND team_members.email = auth.email())
);

CREATE POLICY quality_issues_insert_policy
ON public.quality_issues
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.team_members WHERE team_members.project_id = quality_issues.project_id AND team_members.email = auth.email())
);

-- ✅ Accès aux abonnements pour les propriétaires
CREATE POLICY subscriptions_access
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = subscriptions.project_id AND projects.user_id = auth.uid())
);

-- ✅ Accès aux rôles des équipes (public)
CREATE POLICY team_roles_access
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
    EXISTS (SELECT 1 FROM public.lots WHERE lots.id = lot_tracking.lot_id AND EXISTS (SELECT 1 FROM public.team_members WHERE team_members.project_id = lots.project_id AND team_members.email = auth.email()))
);

-- ✅ Accès aux configurations d’usine pour les propriétaires
CREATE POLICY plant_configs_access
ON public.plant_configs
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = plant_configs.project_id AND projects.user_id = auth.uid())
);

-- 🛠 FIN DE LA TRANSACTION
COMMIT;
