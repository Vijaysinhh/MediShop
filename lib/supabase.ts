'use client';

import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from './db-supabase-types';

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
  );

