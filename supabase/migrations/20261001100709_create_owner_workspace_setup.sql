/*
# Create owner starter workspace

## Overview
Adds a safe first-run setup function so a newly registered hostel owner can immediately inspect the product UI.

## New function
- `create_owner_workspace(p_name text)` creates one hostel for the authenticated owner.
- Creates three floors, twelve rooms, and two beds per room.
- Links the new hostel to the caller's profile.
- Returns the created hostel ID.

## Security
- Function runs with a fixed public search path.
- Caller is always taken from `auth.uid()`; no owner ID is accepted from the browser.
- Only authenticated hostel owners may call it.
- A second hostel cannot be created through this first-run function.

## Important notes
1. No existing tables, columns, or data are removed.
2. This creates starter structure only; it does not create fake tenants or financial records.
3. Owners can later replace the starter name and manage the structure from the app.
*/

CREATE OR REPLACE FUNCTION public.create_owner_workspace(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_hostel_id uuid;
  v_floor_id uuid;
  v_room_id uuid;
  v_floor int;
  v_room int;
  v_bed int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user AND role = 'hostel_owner' AND active = true) THEN
    RAISE EXCEPTION 'Only hostel owners can create a workspace';
  END IF;

  SELECT id INTO v_hostel_id FROM hostels WHERE owner_id = v_user ORDER BY created_at LIMIT 1;
  IF v_hostel_id IS NOT NULL THEN
    UPDATE profiles SET hostel_id = v_hostel_id WHERE id = v_user;
    RETURN v_hostel_id;
  END IF;

  INSERT INTO hostels (name, owner_id, total_floors, total_rooms)
  VALUES (COALESCE(NULLIF(trim(p_name), ''), 'My Hostel'), v_user, 3, 12)
  RETURNING id INTO v_hostel_id;

  UPDATE profiles SET hostel_id = v_hostel_id WHERE id = v_user;

  FOR v_floor IN 1..3 LOOP
    INSERT INTO floors (hostel_id, floor_number, name)
    VALUES (v_hostel_id, v_floor, 'Floor ' || v_floor)
    RETURNING id INTO v_floor_id;

    FOR v_room IN 1..4 LOOP
      INSERT INTO rooms (hostel_id, floor_id, room_number, room_type, capacity, monthly_rent, status)
      VALUES (
        v_hostel_id,
        v_floor_id,
        v_floor || LPAD(v_room::text, 2, '0'),
        CASE WHEN v_room % 3 = 1 THEN 'single'::room_type WHEN v_room % 3 = 2 THEN 'double'::room_type ELSE 'triple'::room_type END,
        CASE WHEN v_room % 3 = 1 THEN 1 WHEN v_room % 3 = 2 THEN 2 ELSE 3 END,
        CASE WHEN v_room % 3 = 1 THEN 9000 ELSE 7500 END,
        'vacant'
      )
      RETURNING id INTO v_room_id;

      FOR v_bed IN 1..2 LOOP
        INSERT INTO beds (room_id, bed_label, status)
        VALUES (v_room_id, 'Bed ' || v_bed, 'vacant');
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_hostel_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_owner_workspace(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_owner_workspace(text) TO authenticated;
