BEGIN;

-------------------------------------------
-- 1) SUPPRIMER LES POLICIES EXISTANTES --
-------------------------------------------

-- Supprimer les policies sur la table projects
DROP POLICY IF EXISTS project_select_policy ON public.projects;
DROP POLICY IF EXISTS project_owner_policy ON public.projects;
DROP POLICY IF EXISTS project_insert_policy ON public.projects;

-- Supprimer les policies sur la table team_members
-- (Nous n'en recréons pas ici, donc on les supprime pour éviter tout conflit)
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
-- 2) CRÉER LES POLICIES POUR LA TABLE projects
--------------------------------------------

-- Policy SELECT : l’utilisateur voit un projet si :
--   - il en est le propriétaire (projects.user_id = auth.uid())
--   - ou il figure dans team_members (via email = auth.email())
CREATE POLICY project_select_policy
ON public.projects
FOR SELECT
TO authenticated
USING (
  -- Condition : propriétaire OU membre
  projects.user_id = auth.uid()
  OR projects.id IN (
    SELECT tm.project_id
    FROM public.team_members tm
    WHERE tm.email = auth.email()
  )
);

-- Policy OWNER : autorise le propriétaire à effectuer toutes les actions (ALL)
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

-- Policy INSERT : permet à tout utilisateur authentifié de créer un projet
CREATE POLICY project_insert_policy
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

------------------------------------------------
-- 3) CRÉER UN TRIGGER POUR AJOUTER L'OWNER DANS team_members
------------------------------------------------

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
FOR EACH ROW
EXECUTE FUNCTION add_project_owner();

-------------------------------------------
-- 4) ACTIVER ROW LEVEL SECURITY sur projects
-------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- (Optionnel : si vous souhaitez désactiver RLS sur team_members
--  pour l’instant, vous pouvez faire :)
-- ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;

COMMIT;
