BEGIN;

-------------------------------------------
-- 1. SUPPRESSION DES POLICIES EXISTANTES
-------------------------------------------
-- Pour la table projects
DROP POLICY IF EXISTS project_select_policy ON public.projects;
DROP POLICY IF EXISTS project_owner_policy ON public.projects;
DROP POLICY IF EXISTS project_insert_policy ON public.projects;

-- Pour la table team_members
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'public.team_members'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_members;', pol.polname);
  END LOOP;
END $$;

--------------------------------------------
-- 2. CREATION DES POLICIES POUR LA TABLE projects
--------------------------------------------

-- Policy SELECT sur projects : l'utilisateur voit un projet s'il en est le propriétaire ou s'il est inscrit en team_members.
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
  )
);

-- Policy OWNER sur projects : seul le propriétaire (user_id) peut modifier ou supprimer le projet.
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

-- Policy INSERT sur projects : tout utilisateur authentifié peut créer un projet.
CREATE POLICY project_insert_policy
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

--------------------------------------------
-- 3. CREATION D'UNE POLICY MINIMALISTE POUR LA TABLE team_members
--------------------------------------------
-- Policy SELECT sur team_members : l'utilisateur ne voit que sa propre ligne (pour éviter la récursion).
CREATE POLICY team_members_select_policy
ON public.team_members
FOR SELECT
TO authenticated
USING (
  email = auth.email()
);

--------------------------------------------
-- 4. CREATION DU TRIGGER POUR AJOUTER AUTOMATIQUEMENT L'OWNER
--------------------------------------------
CREATE OR REPLACE FUNCTION add_project_owner() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.team_members(
    project_id,
    email,
    role,
    status,
    invited_at,
    joined_at
  )
  VALUES (
    NEW.id,
    auth.email(),
    'owner',
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (project_id, email) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS add_owner_trigger ON public.projects;
CREATE TRIGGER add_owner_trigger
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION add_project_owner();

--------------------------------------------
-- 5. ACTIVER ROW LEVEL SECURITY SUR LES TABLES concernées
--------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

COMMIT;
