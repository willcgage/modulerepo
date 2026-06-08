-- =============================================================================
-- Migration 010: Storage RLS policies for the `module-images` bucket
-- Module Repository — Milestone 4
--
-- The `module-images` bucket already exists on the project but carries no
-- RLS policies on storage.objects, so it is fully locked down by default.
-- These policies mirror the shape of the module_images table policies
-- (see migration 006): owners manage objects under modules they own, admins
-- manage everything, and the public can read images of active modules.
--
-- Path convention: {module_id}/{filename} — the leading path segment is the
-- numeric freemon_modules.id, used here to derive ownership/visibility.
-- =============================================================================

CREATE POLICY "owner_manage_own_module_images"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
        bucket_id = 'module-images'
        AND EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id::text = (storage.foldername(name))[1]
              AND m.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        bucket_id = 'module-images'
        AND EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id::text = (storage.foldername(name))[1]
              AND m.owner_id = auth.uid()
        )
    );

CREATE POLICY "admin_manage_all_module_images"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'module-images' AND fn_is_admin())
    WITH CHECK (bucket_id = 'module-images' AND fn_is_admin());

CREATE POLICY "public_read_active_module_images"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (
        bucket_id = 'module-images'
        AND EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id::text = (storage.foldername(name))[1]
              AND m.status = 'active'
        )
    );
