-- =========================================================================================
-- SQL SCRIPT TO FIX MISSING TABLES AND COLUMNS IN SUPABASE
-- Run this script in the "SQL Editor" of your Supabase Dashboard
-- =========================================================================================

-- 1. Create the `business_relationships` table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.business_relationships (
    id TEXT PRIMARY KEY,
    supplier_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING',
    payment_terms TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for business_relationships and allow public access for simplicity (adjust as needed)
ALTER TABLE public.business_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access to business_relationships" ON public.business_relationships FOR ALL USING (true) WITH CHECK (true);

-- 2. Create the `notifications` table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    message TEXT,
    type TEXT,
    read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access to notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- 3. Add missing columns to `products` table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'barcode') THEN
        ALTER TABLE public.products ADD COLUMN barcode TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'qr_code') THEN
        ALTER TABLE public.products ADD COLUMN qr_code TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'expiration_date') THEN
        ALTER TABLE public.products ADD COLUMN expiration_date TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'quantite_minimum') THEN
        ALTER TABLE public.products ADD COLUMN quantite_minimum NUMERIC DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'prix_gros') THEN
        ALTER TABLE public.products ADD COLUMN prix_gros NUMERIC;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'prix_detail') THEN
        ALTER TABLE public.products ADD COLUMN prix_detail NUMERIC;
    END IF;
END $$;

-- 4. Add missing columns to `inventory` table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'created_at') THEN
        ALTER TABLE public.inventory ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'prix_gros') THEN
        ALTER TABLE public.inventory ADD COLUMN prix_gros NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'prix_detail') THEN
        ALTER TABLE public.inventory ADD COLUMN prix_detail NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'quantite_minimum') THEN
        ALTER TABLE public.inventory ADD COLUMN quantite_minimum NUMERIC DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'expiration_date') THEN
        ALTER TABLE public.inventory ADD COLUMN expiration_date TEXT;
    END IF;
END $$;

-- Enable Realtime for the new tables so that subscriptions work
DO $$
BEGIN
    -- Check if realtime is already configured for these tables to avoid errors
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'business_relationships'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.business_relationships;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;

-- 5. Create the `relations` table if it doesn't exist (to prevent RLS and missing table violations)
CREATE TABLE IF NOT EXISTS public.relations (
    id TEXT PRIMARY KEY,
    grossiste_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    statut TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for relations
ALTER TABLE public.relations ENABLE ROW LEVEL SECURITY;

-- Create ultra-permissive policies for full access in order to let B2B partnerships synch seamlessly
DROP POLICY IF EXISTS "Allow full access to relations" ON public.relations;
CREATE POLICY "Allow full access to relations" ON public.relations FOR ALL USING (true) WITH CHECK (true);

-- Ensure full access to notifications as well
DROP POLICY IF EXISTS "Allow full access to notifications" ON public.notifications;
CREATE POLICY "Allow full access to notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for relations table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'relations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.relations;
    END IF;
END $$;

-- =========================================================================================
-- 6. PARTNER SEARCH DB-LEVEL OPTIMIZATION (INDEXES & STORED PROCEDURE)
-- =========================================================================================

-- Enable trigram extension for efficient fuzzy/partial string matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create index on role for fast filtering
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- Create GIN trigram indexes on text fields for extremely fast ILIKE query matching
CREATE INDEX IF NOT EXISTS idx_profiles_nom_trgm ON public.profiles USING gin (nom gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_prenom_trgm ON public.profiles USING gin (prenom gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm ON public.profiles USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_telephone_trgm ON public.profiles USING gin (telephone gin_trgm_ops);

-- Create database-level stored procedure for highly-efficient combined text and role searches
CREATE OR REPLACE FUNCTION public.search_profiles_optimized(
    search_query text, 
    filter_role text DEFAULT NULL, 
    max_results int DEFAULT 20
)
RETURNS SETOF public.profiles AS $$
DECLARE
    clean_q text;
BEGIN
    -- Trim and clean search query
    clean_q := trim(search_query);
    IF clean_q = '' OR length(clean_q) < 3 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT *
    FROM public.profiles
    WHERE 
        -- Maintain role filtering
        (filter_role IS NULL OR role = filter_role)
        -- Match across name, prenom, email, or telephone
        AND (
            nom ILIKE '%' || clean_q || '%'
            OR prenom ILIKE '%' || clean_q || '%'
            OR email ILIKE '%' || clean_q || '%'
            OR telephone ILIKE '%' || clean_q || '%'
        )
    ORDER BY 
        -- Prioritize matches starting with the search query for better relevance
        CASE 
            WHEN nom ILIKE clean_q || '%' THEN 1
            WHEN prenom ILIKE clean_q || '%' THEN 2
            ELSE 3
        END,
        created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

