-- Keep auth.users and application profiles in sync for email, Google, and phone signups.
-- Public signup metadata may select ordinary account roles, but never super_admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
BEGIN
  v_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'caretaker' THEN 'caretaker'::user_role
    ELSE 'hostel_owner'::user_role
  END;

  INSERT INTO public.profiles (id, email, full_name, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'New User'),
    v_role,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), NEW.phone)
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        phone = COALESCE(profiles.phone, EXCLUDED.phone),
        full_name = CASE
          WHEN profiles.full_name = 'New User' THEN EXCLUDED.full_name
          ELSE profiles.full_name
        END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- User profile records and privileged roles are provisioned only by trusted code.
REVOKE INSERT ON public.profiles FROM anon, authenticated;

-- Repair profiles missing from accounts created before the trigger was installed.
-- Metadata is deliberately not allowed to grant super_admin or tenant privileges.
INSERT INTO public.profiles (id, email, full_name, role, phone)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), 'New User'),
  CASE
    WHEN u.raw_user_meta_data->>'role' = 'caretaker' THEN 'caretaker'::user_role
    ELSE 'hostel_owner'::user_role
  END,
  COALESCE(NULLIF(u.raw_user_meta_data->>'phone', ''), u.phone)
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Repair a missing profile-to-hostel link when workspace setup is retried.
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

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND role = 'hostel_owner' AND active = true) THEN
    RAISE EXCEPTION 'Only active hostel owners can create a workspace';
  END IF;

  SELECT id INTO v_hostel_id FROM public.hostels WHERE owner_id = v_user ORDER BY created_at LIMIT 1;
  IF v_hostel_id IS NOT NULL THEN
    UPDATE public.profiles SET hostel_id = v_hostel_id WHERE id = v_user;
    RETURN v_hostel_id;
  END IF;

  INSERT INTO public.hostels (name, owner_id, total_floors, total_rooms)
  VALUES (COALESCE(NULLIF(trim(p_name), ''), 'My Hostel'), v_user, 3, 12)
  RETURNING id INTO v_hostel_id;

  UPDATE public.profiles SET hostel_id = v_hostel_id WHERE id = v_user;

  FOR v_floor IN 1..3 LOOP
    INSERT INTO public.floors (hostel_id, floor_number, name)
    VALUES (v_hostel_id, v_floor, 'Floor ' || v_floor)
    RETURNING id INTO v_floor_id;

    FOR v_room IN 1..4 LOOP
      INSERT INTO public.rooms (hostel_id, floor_id, room_number, room_type, capacity, monthly_rent, status)
      VALUES (
        v_hostel_id,
        v_floor_id,
        v_floor || LPAD(v_room::text, 2, '0'),
        CASE WHEN v_room % 3 = 1 THEN 'single'::public.room_type WHEN v_room % 3 = 2 THEN 'double'::public.room_type ELSE 'triple'::public.room_type END,
        CASE WHEN v_room % 3 = 1 THEN 1 WHEN v_room % 3 = 2 THEN 2 ELSE 3 END,
        CASE WHEN v_room % 3 = 1 THEN 9000 ELSE 7500 END,
        'vacant'
      )
      RETURNING id INTO v_room_id;

      FOR v_bed IN 1..2 LOOP
        INSERT INTO public.beds (room_id, bed_label, status)
        VALUES (v_room_id, 'Bed ' || v_bed, 'vacant');
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_hostel_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_owner_workspace(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_owner_workspace(text) TO authenticated;
