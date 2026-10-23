CREATE OR REPLACE FUNCTION public.update_room_inventory(
  p_room_id uuid,
  p_monthly_rent numeric,
  p_capacity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_bed_count integer;
  v_non_vacant_count integer;
  v_beds_to_remove integer;
  v_index integer;
  v_letter integer;
  v_label text;
  v_preferred_prefix text;
BEGIN
  IF p_monthly_rent IS NULL OR p_monthly_rent <= 0 THEN
    RAISE EXCEPTION 'Monthly rent must be greater than zero';
  END IF;

  IF p_capacity IS NULL OR p_capacity < 1 OR p_capacity > 10 THEN
    RAISE EXCEPTION 'Bed capacity must be between 1 and 10';
  END IF;

  SELECT *
  INTO v_room
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found or access denied';
  END IF;

  PERFORM 1
  FROM public.beds
  WHERE room_id = p_room_id
  FOR UPDATE;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE status <> 'vacant' OR tenant_id IS NOT NULL)::integer
  INTO v_bed_count, v_non_vacant_count
  FROM public.beds
  WHERE room_id = p_room_id;

  IF v_non_vacant_count > p_capacity THEN
    RAISE EXCEPTION 'Capacity cannot be lower than the % occupied or maintenance bed(s)', v_non_vacant_count;
  END IF;

  UPDATE public.rooms
  SET monthly_rent = p_monthly_rent,
      capacity = p_capacity
  WHERE id = p_room_id;

  IF v_bed_count > p_capacity THEN
    v_beds_to_remove := v_bed_count - p_capacity;

    DELETE FROM public.beds
    WHERE id IN (
      SELECT id
      FROM public.beds
      WHERE room_id = p_room_id
        AND status = 'vacant'
        AND tenant_id IS NULL
      ORDER BY created_at DESC, id DESC
      LIMIT v_beds_to_remove
    );

    GET DIAGNOSTICS v_index = ROW_COUNT;
    IF v_index <> v_beds_to_remove THEN
      RAISE EXCEPTION 'Could not remove enough vacant beds to update capacity';
    END IF;
  ELSIF v_bed_count < p_capacity THEN
    IF EXISTS (
      SELECT 1
      FROM public.beds
      WHERE room_id = p_room_id
        AND bed_label LIKE 'Bed %'
    ) THEN
      v_preferred_prefix := 'Bed ';
    ELSE
      v_preferred_prefix := v_room.room_number || '-';
    END IF;

    FOR v_index IN 1..(p_capacity - v_bed_count) LOOP
      v_label := NULL;

      FOR v_letter IN 0..9 LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.beds
          WHERE room_id = p_room_id
            AND bed_label = v_preferred_prefix || chr(65 + v_letter)
        ) THEN
          v_label := v_preferred_prefix || chr(65 + v_letter);
          EXIT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM public.beds
          WHERE room_id = p_room_id
            AND bed_label = 'Bed ' || chr(65 + v_letter)
        ) THEN
          v_label := 'Bed ' || chr(65 + v_letter);
          EXIT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM public.beds
          WHERE room_id = p_room_id
            AND bed_label = v_room.room_number || '-' || chr(65 + v_letter)
        ) THEN
          v_label := v_room.room_number || '-' || chr(65 + v_letter);
          EXIT;
        END IF;
      END LOOP;

      IF v_label IS NULL THEN
        RAISE EXCEPTION 'Could not generate a unique label for the new bed';
      END IF;

      INSERT INTO public.beds (room_id, bed_label, status)
      VALUES (p_room_id, v_label, 'vacant');
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_room_inventory(uuid, numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_room_inventory(uuid, numeric, integer) TO authenticated;