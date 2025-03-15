-- ✅ Début de la transaction
BEGIN;

-- ✅ Supprimer l'ancien trigger s'il existe déjà
DROP TRIGGER IF EXISTS create_projsect_owner_trigger ON projects;

-- ✅ Supprimer la fonction associée si elle existe déjà
DROP FUNCTION IF EXISTS create_project_owner() CASCADE;

-- ✅ Créer la fonction pour ajouter automatiquement un owner à chaque projet
CREATE OR REPLACE FUNCTION create_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier si cet utilisateur est déjà owner sur ce projet spécifique
  INSERT INTO team_members (
    project_id,
    email,
    role,
    status,
    team_name,
    working_time_minutes
  ) VALUES (
    NEW.id,
    auth.email(),
    'owner',
    'active',
    'Management',
    480
  )
  ON CONFLICT (project_id, email, role) DO NOTHING;

  -- ✅ Création automatique d'un abonnement au projet
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

-- ✅ Ajout du trigger pour créer automatiquement un owner à la création d’un projet
CREATE TRIGGER create_project_owner_trigger
AFTER INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION create_project_owner();

-- ✅ Validation des changements
COMMIT;
