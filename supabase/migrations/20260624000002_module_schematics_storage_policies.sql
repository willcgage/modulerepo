-- =============================================================================
-- Migration: Storage RLS policies for the `module-schematics` bucket
-- Module Repository — schematic / CAD drawing attachments
--
-- Mirrors the module-images storage policies (migration 010): owners manage
-- objects under modules they own, admins manage everything, and the public can
-- read schematics of active modules.
--
-- Path convention: {module_id}/{filename} — the leading path segment is the
-- numeric freemon_modules.id, used here to derive ownership/visibility.
-- =============================================================================

CREATE POLICY "owner_manage_own_module_schematics"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
        bucket_id = 'module-schematics'
        AND EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id::text = (storage.foldername(name))[1]
              AND m.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        bucket_id = 'module-schematics'
        AND EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id::text = (storage.foldername(name))[1]
              AND m.owner_id = auth.uid()
        )
    );

CREATE POLICY "admin_manage_all_module_schematics"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'module-schematics' AND fn_is_admin())
    WITH CHECK (bucket_id = 'module-schematics' AND fn_is_admin());

CREATE POLICY "public_read_active_module_schematics"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (
        bucket_id = 'module-schematics'
        AND EXISTS (
            SELECT 1 FROM freemon_modules m
            WHERE m.id::text = (storage.foldername(name))[1]
              AND m.status = 'active'
        )
    );
