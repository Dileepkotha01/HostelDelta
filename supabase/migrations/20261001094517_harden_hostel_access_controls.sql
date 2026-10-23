/*
# Harden HostelHub access controls

## Overview
Tightens the existing multi-tenant authorization model without deleting or renaming user data.

## Modified database functions
- Locks the search path for all public helper and trigger functions.
- Removes anonymous execution from authorization helpers.
- Keeps authenticated execution only where policies need it.

## Modified permissions
- Profiles can no longer be edited wholesale by an account owner.
- Authenticated users may update only their own editable name and phone fields.
- Role, hostel assignment, active status, email, and timestamps remain protected.

## Storage security
- KYC uploads must be stored below the authenticated user's folder.
- KYC documents remain private and readable only by their owner.

## Important notes
1. No tables, columns, or existing rows are removed.
2. Existing hostel operations continue to use the same authenticated policies.
3. KYC object paths now follow `user-id/...` ownership boundaries.
*/

ALTER FUNCTION public.get_user_role() SET search_path = public;
ALTER FUNCTION public.get_user_hostel_id() SET search_path = public;
ALTER FUNCTION public.is_hostel_staff(uuid) SET search_path = public;
ALTER FUNCTION public.owns_hostel(uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;

REVOKE ALL ON FUNCTION public.get_user_role() FROM anon;
REVOKE ALL ON FUNCTION public.get_user_hostel_id() FROM anon;
REVOKE ALL ON FUNCTION public.is_hostel_staff(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.owns_hostel(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_hostel_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hostel_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_hostel(uuid) TO authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "kyc_upload" ON storage.objects;
CREATE POLICY "kyc_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_read_own" ON storage.objects;
CREATE POLICY "kyc_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_update_own" ON storage.objects;
CREATE POLICY "kyc_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_delete_own" ON storage.objects;
CREATE POLICY "kyc_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
