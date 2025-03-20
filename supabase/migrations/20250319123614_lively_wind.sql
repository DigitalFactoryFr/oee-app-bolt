-- 🛠 Start transaction
BEGIN;

-- 1️⃣ Drop ALL existing policies to start fresh
DO $$ 
DECLARE 
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 
            policy_record.policyname, 
            policy_record.tablename);
    END LOOP;
END $$;

-- 2️⃣ Create base helper functions
CREATE OR REPLACE FUNCTION is_valid_uuid(str text)
RETURNS boolean AS $$
BEGIN
  RETURN str IS NOT NULL 
    AND str != 'default'
    AND str::uuid IS NOT NULL;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- 3️⃣ Create non-recursive project access check
CREATE OR REPLACE FUNCTION has_project_access(project_uuid uuid)
RETURNS boolean AS $$
BEGIN
  IF NOT is_valid_uuid(project_uuid::text) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM projects 
    WHERE id = project_uuid 
    AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM team_members
    WHERE project_id = project_uuid
    AND email = auth.email()
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4️⃣ Create non-recursive role check
CREATE OR REPLACE FUNCTION check_user_role(project_uuid uuid, required_role text)
RETURNS boolean AS $$
BEGIN
  IF NOT is_valid_uuid(project_uuid::text) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE project_id = project_uuid
    AND email = auth.email()
    AND role = required_role
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5️⃣ Projects policies
CREATE POLICY "projects_select" ON projects
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR
  id IN (
    SELECT project_id 
    FROM team_members 
    WHERE email = auth.email() 
    AND status = 'active'
  )
);

CREATE POLICY "projects_insert" ON projects
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "projects_manage" ON projects
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 6️⃣ Team members policies (non-recursive)
CREATE POLICY "team_members_select" ON team_members
FOR SELECT TO authenticated
USING (
  email = auth.email() OR
  project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  )
);

CREATE POLICY "team_members_manage" ON team_members
FOR ALL TO authenticated
USING (
  project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  )
);

-- 7️⃣ Project creation trigger
CREATE OR REPLACE FUNCTION create_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Create owner team member
  INSERT INTO team_members (
    project_id,
    email,
    role,
    status,
    team_name,
    working_time_minutes,
    invited_at,
    joined_at
  ) VALUES (
    NEW.id,
    auth.email(),
    'owner',
    'active',
    'Management',
    480,
    NOW(),
    NOW()
  );

  -- Create free subscription
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

-- 8️⃣ Create project owner trigger
DROP TRIGGER IF EXISTS create_project_owner_trigger ON projects;
CREATE TRIGGER create_project_owner_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_owner();

-- 9️⃣ Add performance indexes
CREATE INDEX IF NOT EXISTS idx_team_members_email_status 
ON team_members(email, status);

CREATE INDEX IF NOT EXISTS idx_team_members_project_role 
ON team_members(project_id, role);

CREATE INDEX IF NOT EXISTS idx_projects_user_id 
ON projects(user_id);

-- 🔟 Enable RLS on all tables
DO $$ 
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', table_record.tablename);
    END LOOP;
END $$;

COMMIT;