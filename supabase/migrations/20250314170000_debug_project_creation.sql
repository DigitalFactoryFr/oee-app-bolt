-- Start transaction
BEGIN;

-- ✅ Supprimer les contraintes uniques existantes pour éviter les conflits
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_project_member;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_machine_operator;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_line_manager;

-- ✅ Ajouter des nouvelles contraintes uniques
ALTER TABLE team_members 
ADD CONSTRAINT unique_project_member UNIQUE (project_id, email, role);

ALTER TABLE team_members 
ADD CONSTRAINT unique_machine_operator UNIQUE (project_id, email, machine_id, role);

ALTER TABLE team_members 
ADD CONSTRAINT unique_line_manager UNIQUE (project_id, email, line_id, role);

-- ✅ Supprimer l'ancien trigger et fonction
DROP TRIGGER IF EXISTS create_project_owner_trigger ON projects;
DROP FUNCTION IF EXISTS create_project_owner() CASCADE;

-- ✅ Création d'une nouvelle fonction `create_project_owner` AVEC LOGGING pour déboguer
CREATE OR REPLACE FUNCTION create_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- 🚀 LOG DEBUG (enregistre les insertions dans une table temporaire)
  INSERT INTO logs (message, created_at) VALUES ('Trigger fired for project: ' || NEW.id, NOW());

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

  -- ✅ LOGGING pour vérifier l'insertion du owner
  INSERT INTO logs (message, created_at) VALUES ('Owner inserted for project: ' || NEW.id, NOW());

  -- ✅ Création automatique d'un abonnement au projet
  INSERT INTO subscriptions (
    project_id,
    status,
    machine_limit
  ) VALUES (
    NEW.id,
    'free',
    3
  ) ON CONFLICT (project_id) DO NOTHING;

  -- ✅ LOGGING pour vérifier l'insertion de l'abonnement
  INSERT INTO logs (message, created_at) VALUES ('Subscription created for project: ' || NEW.id, NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ Suppression et recréation du trigger
CREATE TRIGGER create_project_owner_trigger
AFTER INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION create_project_owner();

-- ✅ Ajouter une table `logs` pour stocker les erreurs et voir ce qui se passe
DROP TABLE IF EXISTS logs;

CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ✅ Validation des changements
COMMIT;
