-- Supprimer les anciens index uniques pour éviter les conflits
DROP INDEX IF EXISTS team_members_project_email_role_unique;
DROP INDEX IF EXISTS team_members_project_email_role_machine_unique;
DROP INDEX IF EXISTS team_members_project_email_role_line_unique;

-- 🔹 Ajout de l'unicité pour les OPERATORS (en fonction de machine_id)
CREATE UNIQUE INDEX IF NOT EXISTS team_members_operator_unique_idx
ON team_members (project_id, email, role, machine_id)
WHERE role = 'operator';

-- 🔹 Ajout de l'unicité pour les TEAM MANAGERS (en fonction de line_id)
CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_manager_unique_idx
ON team_members (project_id, email, role, line_id)
WHERE role = 'team_manager';

-- 🔹 Ajout de l'unicité pour les AUTRES ROLES (sans machine_id et line_id)
CREATE UNIQUE INDEX IF NOT EXISTS team_members_others_unique_idx
ON team_members (project_id, email, role)
WHERE role NOT IN ('operator', 'team_manager');
