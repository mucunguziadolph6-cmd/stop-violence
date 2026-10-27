import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { sharedReport } from './report-privacy';

export const listSharedReports = createServerFn({ method: 'GET' })
  .inputValidator((data: { page: number }) => ({ page: Math.max(0, Math.floor(data.page || 0)) }))
  .handler(async ({ data }) => {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) throw new Error('Report service unavailable');
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
        headers.set('apikey', key);
        return fetch(input, { ...init, headers });
      } },
    });
    const result = await client.rpc('list_shared_reports', { page_number: data.page });
    if (result.error) throw new Error('Could not load community reports');
    return (result.data || []).map(sharedReport);
  });

const submitSchema = z.object({
  description: z.string().trim().min(10).max(2000),
  location: z.string().trim().max(200).default(''),
  category: z.string().trim().max(100).default(''),
  summary: z.string().trim().max(300).default(''),
  photoPath: z.string().trim().max(500).optional(),
});

export type MyReport = {
  id: string;
  description: string;
  location: string;
  category: string;
  summary: string;
  created_at: string;
  photoUrl: string | null;
};

export const submitReport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Photos must live in the caller's own storage folder.
    if (data.photoPath && !data.photoPath.startsWith(`${context.userId}/`)) {
      throw new Error('Invalid photo path');
    }
    const { data: row, error } = await context.supabase
      .from('reports')
      .insert({
        description: data.description,
        location: data.location,
        category: data.category,
        summary: data.summary,
        photo_path: data.photoPath ?? null,
        owner_id: context.userId,
      })
      .select('id')
      .single();
    if (error) throw new Error('Could not save the report online');
    return { id: row.id };
  });

export const listMyReports = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyReport[]> => {
    const { data, error } = await context.supabase
      .from('reports')
      .select('id, description, location, category, summary, created_at, photo_path')
      .order('created_at', { ascending: false });
    if (error) throw new Error('Could not load your reports');
    const rows = data || [];
    const withPhotos: MyReport[] = [];
    for (const row of rows) {
      let photoUrl: string | null = null;
      if (row.photo_path) {
        const { data: signed } = await context.supabase.storage
          .from('report-photos')
          .createSignedUrl(row.photo_path, 60 * 60);
        photoUrl = signed?.signedUrl ?? null;
      }
      withPhotos.push({
        id: row.id,
        description: row.description,
        location: row.location,
        category: row.category,
        summary: row.summary,
        created_at: row.created_at,
        photoUrl,
      });
    }
    return withPhotos;
  });

export const deleteMyReport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: z.string().uuid().parse(data.id) }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('reports')
      .delete()
      .eq('id', data.id)
      .select('photo_path')
      .single();
    if (error) throw new Error('Could not delete the report');
    if (row?.photo_path) {
      await context.supabase.storage.from('report-photos').remove([row.photo_path]);
    }
    return { ok: true };
  });

// Signed-in feed: only reports made after the viewer created their account.
export const listFeedReports = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { page: number }) => ({ page: Math.max(0, Math.floor(data.page || 0)) }))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc('list_reports_since_signup', { page_number: data.page });
    if (result.error) throw new Error('Could not load community reports');
    return (result.data || []).map(sharedReport);
  });
