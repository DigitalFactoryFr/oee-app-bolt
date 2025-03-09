/*
  # Demo Manufacturing Data

  1. Creates demo data for testing:
    - Demo manufacturing project
    - Plant configuration
    - Production lines and machines
    - Products and team members
    - Historical production data
    - Current day production data
    - Sample stops and quality issues

  2. Data Structure:
    - 2 production lines
    - 2 machines per line
    - 2 products per machine
    - 2 team members per machine
    - 7 days of historical data
    - Current day active lots
*/

DO $$ 
DECLARE
  test_user_id uuid;
  test_project_id uuid;
  test_plant_id uuid;
  line_a_id uuid;
  line_b_id uuid;
  machine_a1_id uuid;
  machine_a2_id uuid;
  machine_b1_id uuid;
  machine_b2_id uuid;
  product_a1_id uuid;
  product_a2_id uuid;
  product_b1_id uuid;
  product_b2_id uuid;
  member_a1_id uuid;
  member_a2_id uuid;
  member_b1_id uuid;
  member_b2_id uuid;
  lot_id uuid;
BEGIN
  -- Get existing user ID
  SELECT id INTO test_user_id 
  FROM auth.users 
  WHERE email = 'demo@example.com';

  -- Create test project
  INSERT INTO projects (
    name,
    description,
    user_id
  )
  VALUES (
    'Demo Manufacturing Plant',
    'Complete demo project for testing OEE monitoring system',
    test_user_id
  )
  RETURNING id INTO test_project_id;

  -- Insert plant config
  INSERT INTO plant_configs (
    project_id,
    name,
    opening_time_minutes,
    description,
    address,
    status
  )
  VALUES (
    test_project_id,
    'Main Production Facility',
    480,
    'Main manufacturing plant with multiple production lines',
    '123 Industry Way, Manufacturing City',
    'completed'
  )
  RETURNING id INTO test_plant_id;

  -- Insert production lines
  INSERT INTO production_lines (
    project_id,
    plant_config_id,
    name,
    opening_time_minutes,
    status
  )
  VALUES 
    (test_project_id, test_plant_id, 'Assembly Line A', 480, 'completed'),
    (test_project_id, test_plant_id, 'Assembly Line B', 480, 'completed')
  RETURNING id, name INTO line_a_id, line_b_id;

  -- Insert machines
  INSERT INTO machines (
    project_id,
    line_id,
    name,
    opening_time_minutes,
    status
  )
  VALUES 
    (test_project_id, line_a_id, 'Machine A1', 480, 'completed'),
    (test_project_id, line_a_id, 'Machine A2', 480, 'completed'),
    (test_project_id, line_b_id, 'Machine B1', 480, 'completed'),
    (test_project_id, line_b_id, 'Machine B2', 480, 'completed')
  RETURNING id INTO machine_a1_id, machine_a2_id, machine_b1_id, machine_b2_id;

  -- Insert products
  INSERT INTO products (
    project_id,
    machine_id,
    name,
    product_id,
    cycle_time,
    status
  )
  VALUES 
    (test_project_id, machine_a1_id, 'Product A1', 'PRODA1', 60, 'completed'),
    (test_project_id, machine_a2_id, 'Product A2', 'PRODA2', 45, 'completed'),
    (test_project_id, machine_b1_id, 'Product B1', 'PRODB1', 30, 'completed'),
    (test_project_id, machine_b2_id, 'Product B2', 'PRODB2', 40, 'completed')
  RETURNING id INTO product_a1_id, product_a2_id, product_b1_id, product_b2_id;

  -- Insert team members
  INSERT INTO team_members (
    project_id,
    machine_id,
    email,
    role,
    team_name,
    working_time_minutes,
    status
  )
  VALUES 
    (test_project_id, machine_a1_id, 'operator_a1@demo.com', 'operator', 'Team A', 480, 'active'),
    (test_project_id, machine_a2_id, 'operator_a2@demo.com', 'operator', 'Team A', 480, 'active'),
    (test_project_id, machine_b1_id, 'operator_b1@demo.com', 'operator', 'Team B', 480, 'active'),
    (test_project_id, machine_b2_id, 'operator_b2@demo.com', 'operator', 'Team B', 480, 'active')
  RETURNING id INTO member_a1_id, member_a2_id, member_b1_id, member_b2_id;

  -- Insert historical lots and related data
  FOR day IN 1..7 LOOP
    FOR hour IN 8..16 LOOP
      -- Create lots for each machine
      IF random() < 0.8 THEN -- 80% chance of having a lot
        INSERT INTO lots (
          project_id,
          date,
          start_time,
          end_time,
          team_member,
          product,
          machine,
          lot_id,
          lot_size,
          theoretical_lot_size,
          ok_parts_produced,
          status
        )
        VALUES (
          test_project_id,
          CURRENT_DATE - (day || ' days')::interval,
          CURRENT_DATE - (day || ' days')::interval + (hour || ' hours')::interval,
          CURRENT_DATE - (day || ' days')::interval + ((hour + 1) || ' hours')::interval,
          member_a1_id,
          product_a1_id,
          machine_a1_id,
          'LOT-' || TO_CHAR(CURRENT_DATE - (day || ' days')::interval, 'YYYYMMDD') || '-A1',
          60,
          60,
          51, -- 85% efficiency
          'completed'
        )
        RETURNING id INTO lot_id;

        -- Add lot tracking
        INSERT INTO lot_tracking (
          lot_id,
          date,
          start_time,
          end_time,
          parts_produced
        )
        VALUES (
          lot_id,
          CURRENT_DATE - (day || ' days')::interval,
          CURRENT_DATE - (day || ' days')::interval + (hour || ' hours')::interval,
          CURRENT_DATE - (day || ' days')::interval + ((hour + 1) || ' hours')::interval,
          51
        );

        -- Add stop event (20% chance)
        IF random() < 0.2 THEN
          INSERT INTO stop_events (
            project_id,
            date,
            start_time,
            end_time,
            team_member,
            product,
            machine,
            failure_type,
            cause,
            status,
            lot_id
          )
          VALUES (
            test_project_id,
            CURRENT_DATE - (day || ' days')::interval,
            CURRENT_DATE - (day || ' days')::interval + (hour || ' hours')::interval + '15 minutes'::interval,
            CURRENT_DATE - (day || ' days')::interval + (hour || ' hours')::interval + '30 minutes'::interval,
            member_a1_id,
            product_a1_id,
            machine_a1_id,
            (ARRAY['AP', 'PA', 'DO', 'NQ', 'CS'])[floor(random() * 5 + 1)],
            (ARRAY['Planned maintenance', 'Equipment failure', 'Material shortage', 'Quality adjustment', 'Product changeover'])[floor(random() * 5 + 1)],
            'completed',
            lot_id
          );
        END IF;

        -- Add quality issue (10% chance)
        IF random() < 0.1 THEN
          INSERT INTO quality_issues (
            project_id,
            date,
            start_time,
            end_time,
            team_member,
            product,
            machine,
            category,
            quantity,
            cause,
            status,
            lot_id
          )
          VALUES (
            test_project_id,
            CURRENT_DATE - (day || ' days')::interval,
            CURRENT_DATE - (day || ' days')::interval + (hour || ' hours')::interval + '20 minutes'::interval,
            CURRENT_DATE - (day || ' days')::interval + (hour || ' hours')::interval + '35 minutes'::interval,
            member_a1_id,
            product_a1_id,
            machine_a1_id,
            (ARRAY['at_station_rework', 'off_station_rework', 'scrap'])[floor(random() * 3 + 1)],
            floor(random() * 5 + 1),
            (ARRAY['Dimensional error', 'Surface defect', 'Assembly issue', 'Material defect', 'Visual defect'])[floor(random() * 5 + 1)],
            'completed',
            lot_id
          );
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- Create current day lots
  FOR machine_id IN SELECT id FROM machines WHERE project_id = test_project_id LOOP
    IF random() < 0.5 THEN -- 50% chance of active lot
      INSERT INTO lots (
        project_id,
        date,
        start_time,
        team_member,
        product,
        machine,
        lot_id,
        lot_size,
        theoretical_lot_size,
        ok_parts_produced,
        status
      )
      VALUES (
        test_project_id,
        CURRENT_DATE,
        NOW() - interval '4 hours',
        member_a1_id,
        product_a1_id,
        machine_id,
        'LOT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || machine_id,
        60,
        60,
        24, -- 40% progress
        'in_progress'
      )
      RETURNING id INTO lot_id;

      -- Add lot tracking for current lot
      INSERT INTO lot_tracking (
        lot_id,
        date,
        start_time,
        end_time,
        parts_produced
      )
      VALUES (
        lot_id,
        CURRENT_DATE,
        NOW() - interval '4 hours',
        NOW(),
        24
      );

      -- Add ongoing stop (30% chance)
      IF random() < 0.3 THEN
        INSERT INTO stop_events (
          project_id,
          date,
          start_time,
          team_member,
          product,
          machine,
          failure_type,
          cause,
          status,
          lot_id
        )
        VALUES (
          test_project_id,
          CURRENT_DATE,
          NOW() - interval '30 minutes',
          member_a1_id,
          product_a1_id,
          machine_id,
          'PA',
          'Equipment failure',
          'ongoing',
          lot_id
        );
      END IF;

      -- Add ongoing quality issue (20% chance)
      IF random() < 0.2 THEN
        INSERT INTO quality_issues (
          project_id,
          date,
          start_time,
          team_member,
          product,
          machine,
          category,
          quantity,
          cause,
          status,
          lot_id
        )
        VALUES (
          test_project_id,
          CURRENT_DATE,
          NOW() - interval '15 minutes',
          member_a1_id,
          product_a1_id,
          machine_id,
          'at_station_rework',
          1,
          'Dimensional error',
          'ongoing',
          lot_id
        );
      END IF;
    END IF;
  END LOOP;

END $$;