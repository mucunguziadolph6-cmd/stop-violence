import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
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