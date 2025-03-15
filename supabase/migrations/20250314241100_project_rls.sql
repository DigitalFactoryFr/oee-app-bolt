-- Démarrer la transaction
BEGIN;

-- ✅ Activer RLS sur la table `projects`
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ✅ Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS project_owner_access ON projects;
DROP POLICY IF EXISTS project_team_access ON projects;

-- ✅ Policy 1 : l'owner peut TOUT faire (FOR ALL)
CREATE POLICY project_owner_access
  ON projects
  FOR ALL
  TO authenticated
  USING (
    -- Condition pour lire : user_id doit correspondre
    user_id = auth.uid()
  )
  WITH CHECK (
    -- Condition pour insérer/modifier/supprimer
    user_id = auth.uid()
  );

-- ✅ Policy 2 : les membres actifs du projet peuvent LIRE (FOR SELECT)
CREATE POLICY project_team_access
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    -- Condition : soit c'est l'owner,
    user_id = auth.uid()
    OR
    -- Soit l'utilisateur est dans team_members (statut actif)
    EXISTS (
      SELECT 1
      FROM team_members
      WHERE team_members.project_id = projects.id
        AND team_members.email = auth.email()
        AND team_members.status = 'active'
    )
  );

-- Valider la transaction
COMMIT;
