-- Start transaction
BEGIN;

-- Drop all existing policies
DO $$ 
BEGIN
  -- lot_tracking policies
  DROP POLICY IF EXISTS "lot_tracking_access_policy" ON lot_tracking;
  DROP POLICY IF EXISTS "lot_tracking_insert_policy" ON lot_tracking;
  DROP POLICY IF EXISTS "lot_tracking_select_policy" ON lot_tracking;
  DROP POLICY IF EXISTS "Users can create lot tracking entries for their lots" ON lot_tracking;
  DROP POLICY IF EXISTS "Users can create tracking entries for their lots" ON lot_tracking;
  DROP POLICY IF EXISTS "Users can view lot tracking entries for their lots" ON lot_tracking;
  DROP POLICY IF EXISTS "Users can view tracking entries for their lots" ON lot_tracking;

  -- lots policies
  DROP POLICY IF EXISTS "lots_create_policy" ON lots;
  DROP POLICY IF EXISTS "lots_manage_policy" ON lots;
  DROP POLICY IF EXISTS "lots_update_policy" ON lots;
  DROP POLICY IF EXISTS "lots_view_policy" ON lots;
  DROP POLICY IF EXISTS "Users can create lots in their projects" ON lots;
  DROP POLICY IF EXISTS "Users can update lot status" ON lots;
  DROP POLICY IF EXISTS "Users can view lots in their projects" ON lots;

  -- machines policies
  DROP POLICY IF EXISTS "machines_access_policy" ON machines;
  DROP POLICY IF EXISTS "Users can delete their own machines" ON machines;
  DROP POLICY IF EXISTS "Users can view machines in their projects" ON machines;

  -- plant_configs policies
  DROP POLICY IF EXISTS "enable_all_access_for_authenticated_users" ON plant_configs;
  DROP POLICY IF EXISTS "plant_configs_access_policy" ON plant_configs;
  DROP POLICY IF EXISTS "Users can create their own plant configs" ON plant_configs;
  DROP POLICY IF EXISTS "Users can delete their own plant configs" ON plant_configs;
  DROP POLICY IF EXISTS "Users can update their own plant configs" ON plant_configs;
  DROP POLICY IF EXISTS "Users can view their own plant configs" ON plant_configs;

  -- production_lines policies
  DROP POLICY IF EXISTS "enable_all_access_for_authenticated_users" ON production_lines;
  DROP POLICY IF EXISTS "production_lines_access_policy" ON production_lines;
  DROP POLICY IF EXISTS "Users can create their own production lines" ON production_lines;
  DROP POLICY IF EXISTS "Users can delete their own production lines" ON production_lines;
  DROP POLICY IF EXISTS "Users can update their own production lines" ON production_lines;
  DROP POLICY IF EXISTS "Users can view their own production lines" ON production_lines;

  -- products policies
  DROP POLICY IF EXISTS "products_access_policy" ON products;
  DROP POLICY IF EXISTS "Users can delete their own products" ON products;
  DROP POLICY IF EXISTS "Users can view products in their projects" ON products;

  -- quality_issues policies
  DROP POLICY IF EXISTS "quality_issues_create_policy" ON quality_issues;
  DROP POLICY IF EXISTS "quality_issues_manage_policy" ON quality_issues;
  DROP POLICY IF EXISTS "quality_issues_view_policy" ON quality_issues;
  DROP POLICY IF EXISTS "Users can create quality issues in their projects" ON quality_issues;
  DROP POLICY IF EXISTS "Users can view quality issues in their projects" ON quality_issues;

  -- stop_events policies
  DROP POLICY IF EXISTS "stop_events_create_policy" ON stop_events;
  DROP POLICY IF EXISTS "stop_events_manage_policy" ON stop_events;
  DROP POLICY IF EXISTS "stop_events_view_policy" ON stop_events;
  DROP POLICY IF EXISTS "stops_update_policy" ON stop_events;
  DROP POLICY IF EXISTS "Users can create stop events in their projects" ON stop_events;
  DROP POLICY IF EXISTS "Users can view stops in their projects" ON stop_events;
END $$;

-- Create function to check project access
CREATE OR REPLACE FUNCTION has_project_access(project_uuid uuid)
RETURNS boolean AS $$
BEGIN
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

-- Create function to check user role
CREATE OR REPLACE FUNCTION check_user_role(project_uuid uuid, required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE project_id = project_uuid
    AND email = auth.email()
    AND role = required_role
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policies for lot_tracking
CREATE POLICY "lot_tracking_access_policy" ON lot_tracking
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lots
    WHERE lots.id = lot_tracking.lot_id
    AND has_project_access(lots.project_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lots
    WHERE lots.id = lot_tracking.lot_id
    AND has_project_access(lots.project_id)
  )
);

-- Create new policies for lots
CREATE POLICY "lots_view_policy" ON lots
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "lots_create_policy" ON lots
FOR INSERT TO authenticated
WITH CHECK (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'operator') OR
    check_user_role(project_id, 'team_manager')
  )
);

CREATE POLICY "lots_manage_policy" ON lots
FOR UPDATE TO authenticated
USING (
  has_project_access(project_id) AND
  check_user_role(project_id, 'team_manager')
);

-- Create new policies for machines
CREATE POLICY "machines_access_policy" ON machines
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

-- Create new policies for plant_configs
CREATE POLICY "plant_configs_access_policy" ON plant_configs
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

-- Create new policies for production_lines
CREATE POLICY "production_lines_access_policy" ON production_lines
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

-- Create new policies for products
CREATE POLICY "products_access_policy" ON products
FOR ALL TO authenticated
USING (has_project_access(project_id))
WITH CHECK (has_project_access(project_id));

-- Create new policies for quality_issues
CREATE POLICY "quality_issues_view_policy" ON quality_issues
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "quality_issues_create_policy" ON quality_issues
FOR INSERT TO authenticated
WITH CHECK (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'operator') OR
    check_user_role(project_id, 'quality_technician') OR
    check_user_role(project_id, 'team_manager')
  )
);

CREATE POLICY "quality_issues_manage_policy" ON quality_issues
FOR UPDATE TO authenticated
USING (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'quality_technician') OR
    check_user_role(project_id, 'team_manager')
  )
);

-- Create new policies for stop_events
CREATE POLICY "stop_events_view_policy" ON stop_events
FOR SELECT TO authenticated
USING (has_project_access(project_id));

CREATE POLICY "stop_events_create_policy" ON stop_events
FOR INSERT TO authenticated
WITH CHECK (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'operator') OR
    check_user_role(project_id, 'maintenance_technician') OR
    check_user_role(project_id, 'team_manager')
  )
);

CREATE POLICY "stop_events_manage_policy" ON stop_events
FOR UPDATE TO authenticated
USING (
  has_project_access(project_id) AND (
    check_user_role(project_id, 'maintenance_technician') OR
    check_user_role(project_id, 'team_manager')
  )
);

COMMIT;