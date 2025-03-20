BEGIN;

---------------------------------------------------
-- 1) SUPPRIMER TOUTES LES POLICIES SUR team_members
---------------------------------------------------
DROP POLICY IF EXISTS team_members_select ON public.team_members;
DROP POLICY IF EXISTS team_members_select_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_insert ON public.team_members;
DROP POLICY IF EXISTS team_members_insert_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_update ON public.team_members;
DROP POLICY IF EXISTS team_members_update_policy ON public.team_members;
DROP POLICY IF EXISTS team_members_delete ON public.team_members;
DROP POLICY IF EXISTS team_members_delete_policy ON public.team_members;

---------------------------------------------------
-- 2) CRÉER DES FONCTIONS "SECURITY DEFINER" POUR ÉVITER LA RECURSION
---------------------------------------------------
/*
   - can_see_any_member(_project_id) : renvoie TRUE si l'utilisateur 
     a un row {role='owner'} (ou 'team_manager' si tu veux) 
     pour ce project_id, hors RLS => pas de boucle.
   - can_manage_team(_project_id) : renvoie TRUE si l'utilisateur 
     a un row {role IN('owner','team_manager')} pour ce project_id, hors RLS => pas de boucle.
*/

CREATE OR REPLACE FUNCTION can_see_any_member(_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Désactiver la RLS localement
  EXECUTE 'SET LOCAL row_security = off';

  -- Ici, on vérifie s'il existe un row team_members = 'owner'
  RETURN EXISTS (
    SELECT 1
    FROM team_members
    WHERE project_id = _project_id
      AND email = auth.email()
      AND role = 'owner'
      AND status = 'active'
  );
END;
$$;


CREATE OR REPLACE FUNCTION can_manage_team(_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE 'SET LOCAL row_security = off';

  -- On vérifie s'il existe un row = 'owner' OU 'team_manager'
  RETURN EXISTS (
    SELECT 1
    FROM team_members
    WHERE project_id = _project_id
      AND email = auth.email()
      AND role IN ('owner','team_manager')
      AND status = 'active'
  );
END;
$$;


---------------------------------------------------
-- 3) POLICIES POUR team_members
---------------------------------------------------
/*
   - SELECT :
       * l'utilisateur voit TOUTES les lignes s'il "can_see_any_member(project_id)" 
         => c'est-à-dire s'il est owner
       * SINON il voit juste sa propre ligne "email=auth.email()".
   - INSERT : "WITH CHECK ( can_manage_team(project_id) )"
       => Seul owner/team_manager peut insérer
   - UPDATE : "USING ( can_manage_team(project_id) )"
       => Seul owner/team_manager
   - DELETE : idem
*/

/* SELECT */
CREATE POLICY team_members_select
ON public.team_members
FOR SELECT
TO authenticated
USING (
  -- Soit le user a le droit "voir tous" => can_see_any_member(project_id)
  can_see_any_member(project_id)
  OR
  -- Soit il voit juste sa propre ligne
  (email = auth.email())
);

/* INSERT */
CREATE POLICY team_members_insert
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  can_manage_team(project_id)
);

/* UPDATE */
CREATE POLICY team_members_update
ON public.team_members
FOR UPDATE
TO authenticated
USING (
  can_manage_team(project_id)
);

/* DELETE */
CREATE POLICY team_members_delete
ON public.team_members
FOR DELETE
TO authenticated
USING (
  can_manage_team(project_id)
);

---------------------------------------------------
-- 4) ACTIVER RLS sur team_members
---------------------------------------------------
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

COMMIT;
