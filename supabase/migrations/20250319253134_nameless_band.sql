BEGIN;

-- 1. SUPPRESSION DES POLICIES EXISTANTES SUR projects et team_members

-- Pour la table projects
DROP POLICY IF EXISTS project_access ON public.projects;
DROP POLICY IF EXISTS project_owner_access ON public.projects;
DROP POLICY IF EXISTS project_create_policy ON public.projects;

-- Pour la table team_members
DROP POLICY IF EXISTS team_members_select_policy ON public.team_members;
-- (Si d’autres policies spécifiques sur team_members existent, vous pouvez les supprimer ici)
DROP POLICY IF EXISTS team_members_manage_policy ON public.team_members;

-- 2. CREATION DES POLICIES MINIMALES

-- Pour la table projects
-- Cette policy permet de sélectionner uniquement les projets où l'utilisateur est membre (via team_members) ou est le propriétaire.
CREATE POLICY project_access
ON public.projects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.team_members 
    WHERE team_members.project_id = projects.id 
      AND team_members.email = auth.email()
  )
  OR projects.user_id = auth.uid()
);

-- Policy pour que le propriétaire ait tous les droits sur son projet
CREATE POLICY project_owner_access
ON public.projects
FOR ALL
TO authenticated
USING (
  projects.user_id = auth.uid()
)
WITH CHECK (
  projects.user_id = auth.uid()
);

-- Policy pour permettre à tout utilisateur authentifié de créer un projet
CREATE POLICY project_create_policy
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Pour la table team_members
-- Cette policy limite la lecture des membres aux projets dont l'utilisateur fait partie
CREATE POLICY team_members_select_policy
ON public.team_members
FOR SELECT
TO authenticated
USING (
  team_members.project_id IN (
    SELECT project_id 
    FROM public.team_members 
    WHERE email = auth.email()
  )
);

-- (Optionnel : Vous pouvez ajouter d'autres policies de gestion sur team_members pour UPDATE/DELETE si nécessaire.)

-- 3. CREATION DU TRIGGER POUR L'AJOUT AUTOMATIQUE DE L'OWNER

CREATE OR REPLACE FUNCTION add_project_owner() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.team_members (
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

COMMIT;
