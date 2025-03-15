-- Start transaction
BEGIN;

-- 1) TEAM_MEMBERS TABLE
--------------------------------------
-- Drop partial indexes
DROP INDEX IF EXISTS idx_unique_project_member;
DROP INDEX IF EXISTS idx_unique_machine_operator;
DROP INDEX IF EXISTS idx_unique_line_manager;

-- Drop any leftover unique constraints
ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS unique_project_member,
  DROP CONSTRAINT IF EXISTS unique_machine_operator,
  DROP CONSTRAINT IF EXISTS unique_line_manager;

-- Create a single UNIQUE constraint for (project_id, email, role)
-- This aligns perfectly with "ON CONFLICT (project_id, email, role) DO NOTHING"
ALTER TABLE team_members
  ADD CONSTRAINT team_members_project_email_role_unique
  UNIQUE (project_id, email, role);

-- 2) SUBSCRIPTIONS TABLE
--------------------------------------
-- If you do ON CONFLICT (project_id) in create_project_owner()
-- then you need a UNIQUE constraint on (project_id)
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_project_id_unique;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_project_id_unique
  UNIQUE (project_id);

-- 3) PROJECTS TABLE
--------------------------------------
-- If you do ON CONFLICT (id) or if you want to ensure projects.id is unique
-- (Usually 'id' is a primary key, but let's be sure)
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_id_unique;

ALTER TABLE projects
  ADD CONSTRAINT projects_id_unique
  UNIQUE (id);

-- Commit the transaction
COMMIT;
