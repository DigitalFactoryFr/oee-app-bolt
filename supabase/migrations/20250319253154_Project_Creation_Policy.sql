BEGIN;

-------------------------------------------
-- 1. SUPPRIMER LES POLICIES EXISTANTES
-------------------------------------------

-- Pour la table projects
DROP POLICY IF EXISTS project_select_policy ON public.projects;
DROP POLICY IF EXISTS project_owner_all_policy ON public.projects;
DROP POLICY IF EXISTS project_insert_policy ON public.projects;

-- Pour la table team_members
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'public.team_members'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_members;', rec.polname);
  END LOOP;
END $$;

-------------------------------------------
-- 2. CRÉER LA CONTRAINTE UNIQUE SUR (project_id, email, role)
-------------------------------------------
-- Requis pour supporter ON CONFLICT (project_id, email, role) DO NOTHING
ALTER TABLE public.team_members
ADD CONSTRAINT team_members_unique_project_email_role
UNIQUE (project_id, email, role);

-------------------------------------------
-- 3. POLICIES POUR LA TABLE projects
-------------------------------------------

-- Policy SELECT : voir le projet si l'utilisateur est propriétaire
-- OU s'il figure dans team_members (via son email).
CREATE POLICY project_select_policy
ON public.projects
FOR SELECT
TO authenticated
USING (
  projects.user_id = auth.uid()
  OR projects.id IN (
    SELECT tm.project_id
    FROM public.team_members tm
    WHERE tm.email = auth.email()
    -- Optionnel : AND tm.status = 'active'
  )
);

-- Policy OWNER : seul le propriétaire (user_id) peut modifier/supprimer le projet
CREATE POLICY project_owner_policy
ON public.projects
FOR ALL
TO authenticated
USING (
  projects.user_id = auth.uid()
)
WITH CHECK (
  projects.user_id = auth.uid()
);

-- Policy INSERT : tout utilisateur authentifié peut créer un projet
CREATE POLICY project_insert_policy
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-------------------------------------------
-- 4. POLICIES POUR LA TABLE team_members (Minimalistes)
-------------------------------------------
-- Policy SELECT : l'utilisateur ne voit que sa propre ligne.
CREATE POLICY team_members_select_policy
ON public.team_members
FOR SELECT
TO authenticated
USING (
  email = auth.email()
);

-- (Optionnel) Policy UPDATE/DELETE sur team_members, dé-commenter si besoin
/*
CREATE POLICY team_members_update_policy
ON public.team_members
FOR UPDATE
TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

CREATE POLICY team_members_delete_policy
ON public.team_members
FOR DELETE
TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);
*/

-------------------------------------------
-- 5. TRIGGER POUR AJOUTER AUTOMATIQUEMENT L'OWNER
-------------------------------------------
CREATE OR REPLACE FUNCTION create_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Empêcher le doublon dans team_members
  INSERT INTO team_members (
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

  -- Empêcher le doublon dans subscriptions
  INSERT INTO subscriptions (
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

-------------------------------------------
-- 6. ACTIVER ROW LEVEL SECURITY
-------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

COMMIT;
