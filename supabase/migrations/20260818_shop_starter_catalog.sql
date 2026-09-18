-- Starter catalog source. Products are copied into each shop's own items table.
-- Existing manual items, prices, stock, price tiers, edits and deletes are untouched.
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS catalog_code TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS icon_key TEXT NOT NULL DEFAULT 'package';
CREATE UNIQUE INDEX IF NOT EXISTS items_shop_catalog_code_unique
  ON public.items(shop_id, catalog_code) WHERE catalog_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.catalog_products (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_marathi TEXT,
  category_name TEXT NOT NULL,
  unit_short_form TEXT NOT NULL,
  icon_key TEXT NOT NULL DEFAULT 'package'
);

INSERT INTO public.catalog_products (code,name,name_marathi,category_name,unit_short_form,icon_key) VALUES
('rice','Rice','तांदूळ','Grocery','kg','grain'),
('wheat-flour','Wheat Flour','गव्हाचे पीठ','Grocery','kg','grain'),
('toor-dal','Toor Dal','तूर डाळ','Grocery','kg','pulse'),
('moong-dal','Moong Dal','मूग डाळ','Grocery','kg','pulse'),
('chana-dal','Chana Dal','चणा डाळ','Grocery','kg','pulse'),
('sugar','Sugar','साखर','Grocery','kg','grain'),
('jaggery','Jaggery','गूळ','Grocery','kg','grain'),
('salt','Iodised Salt','आयोडीनयुक्त मीठ','Grocery','kg','package'),
('groundnut-oil','Groundnut Oil','शेंगदाणा तेल','Grocery','L','bottle'),
('sunflower-oil','Sunflower Oil','सूर्यफूल तेल','Grocery','L','bottle'),
('tea','Tea Powder','चहा पावडर','Grocery','packet','package'),
('turmeric','Turmeric Powder','हळद पावडर','Grocery','g','spice'),
('chilli','Red Chilli Powder','लाल तिखट','Grocery','g','spice'),
('pav-bhaji-masala','Pav Bhaji Masala','पावभाजी मसाला','Grocery','packet','spice'),
('garam-masala','Garam Masala','गरम मसाला','Grocery','packet','spice'),
('biscuits','Biscuits','बिस्किटे','Snacks & Sweets','packet','snack'),
('parle-g','Parle-G Biscuits','पार्ले-जी बिस्किटे','Snacks & Sweets','packet','snack'),
('lays','Lays','लेज','Snacks & Sweets','packet','snack'),
('kurkure','Kurkure','कुरकुरे','Snacks & Sweets','packet','snack'),
('farsan','Farsan','फरसाण','Snacks & Sweets','packet','snack'),
('sev','Sev','शेव','Snacks & Sweets','packet','snack'),
('milk','Milk','दूध','Dairy & Milk','L','bottle'),
('bread','Bread','ब्रेड','Dairy & Milk','pcs','package'),
('eggs','Eggs','अंडी','Dairy & Milk','pcs','package'),
('water','Packaged Water','पॅकेज्ड पाणी','Beverages','bottle','bottle'),
('soft-drink','Soft Drink','शीतपेय','Beverages','bottle','bottle'),
('santoor','Santoor Soap','संतूर साबण','Personal Care','pcs','soap'),
('dettol-soap','Dettol Soap','डेटॉल साबण','Personal Care','pcs','soap'),
('lifebuoy','Lifebuoy Soap','लाइफबॉय साबण','Personal Care','pcs','soap'),
('shampoo-pouch','Shampoo Sachet','शॅम्पू पुडी','Personal Care','sachet','personal'),
('hair-oil','Hair Oil','केसांचे तेल','Personal Care','bottle','bottle'),
('toothpaste','Toothpaste','टूथपेस्ट','Personal Care','pcs','personal'),
('detergent','Detergent Powder','डिटर्जंट पावडर','Household Items','pcs','cleaning'),
('dishwash-bar','Dishwash Bar','भांडी घासण्याचा साबण','Household Items','pcs','cleaning'),
('matchbox','Matchbox','आगपेटी','Household Items','box','package'),
('candle','Candle','मेणबत्ती','Household Items','pcs','package'),
('agarbatti','Agarbatti','अगरबत्ती','Pooja & Festival','packet','pooja'),
('camphor','Camphor','कापूर','Pooja & Festival','packet','pooja'),
('kumkum','Kumkum','कुंकू','Pooja & Festival','packet','pooja'),
('rangoli','Colour Rangoli','रंगीत रांगोळी','Pooja & Festival','packet','pooja')
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, name_marathi=EXCLUDED.name_marathi,
  category_name=EXCLUDED.category_name, unit_short_form=EXCLUDED.unit_short_form,
  icon_key=EXCLUDED.icon_key;

-- Repair the old malformed Marathi label only when it is blank or mojibake.
-- A shopkeeper's valid custom translation is never overwritten.
UPDATE public.categories
SET name_marathi = 'पेय पदार्थ', updated_at = NOW()
WHERE lower(trim(name)) = 'beverages'
  AND (name_marathi IS NULL OR position('à' IN name_marathi) > 0);

CREATE OR REPLACE FUNCTION public.seed_shop_starter_catalog(p_shop_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  -- Ensure every catalog dependency exists in this shop before resolving IDs.
  INSERT INTO categories (shop_id,name,name_marathi,color)
  SELECT p_shop_id,v.name,v.name_marathi,v.color FROM (VALUES
    ('Grocery','किराणा','#3b82f6'), ('Dairy & Milk','दुग्ध','#f59e0b'),
    ('Beverages','पेय पदार्थ','#ef4444'), ('Snacks & Sweets','स्नॅक्स व मिठाई','#8b5cf6'),
    ('Household Items','घरगुती वस्तू','#06b6d4'), ('Personal Care','वैयक्तिक स्वच्छता','#ec4899'),
    ('Pooja & Festival','पूजा व सणासुदीचे साहित्य','#f97316')
  ) AS v(name,name_marathi,color)
  WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.shop_id=p_shop_id AND lower(trim(c.name))=lower(trim(v.name)));

  INSERT INTO units (shop_id,name,name_marathi,short_form)
  SELECT p_shop_id,v.name,v.name_marathi,v.short_form FROM (VALUES
    ('Kilogram','किलोग्रॅम','kg'), ('Gram','ग्रॅम','g'), ('Liter','लिटर','L'),
    ('Piece','नग','pcs'), ('Box','बॉक्स','box'), ('Packet','पॅकेट','packet'),
    ('Bottle','बाटली','bottle'), ('Sachet','पुडी','sachet')
  ) AS v(name,name_marathi,short_form)
  WHERE NOT EXISTS (SELECT 1 FROM units u WHERE u.shop_id=p_shop_id AND lower(trim(u.short_form))=lower(trim(v.short_form)));

  INSERT INTO items (shop_id,catalog_code,icon_key,name,name_marathi,category_id,unit_id,quantity,buy_price,sell_price,low_stock_limit)
  SELECT p_shop_id,p.code,p.icon_key,p.name,p.name_marathi,c.id,u.id,0,0,0,0
  FROM catalog_products p
  JOIN LATERAL (SELECT id FROM categories c WHERE c.shop_id=p_shop_id AND lower(trim(c.name))=lower(trim(p.category_name)) ORDER BY id LIMIT 1) c ON TRUE
  JOIN LATERAL (SELECT id FROM units u WHERE u.shop_id=p_shop_id AND lower(trim(u.short_form))=lower(trim(p.unit_short_form)) ORDER BY id LIMIT 1) u ON TRUE
  WHERE NOT EXISTS (
    SELECT 1 FROM items i
    WHERE i.shop_id=p_shop_id
      AND (
        i.catalog_code=p.code
        OR lower(trim(coalesce(i.name,'')))=lower(trim(p.name))
        OR lower(trim(coalesce(i.name_marathi,'')))=lower(trim(coalesce(p.name_marathi,'')))
      )
  );
END; $$;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.catalog_products FROM anon, authenticated;
GRANT SELECT ON TABLE public.catalog_products TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_shop_starter_catalog(BIGINT) TO anon, authenticated;

-- One-time, idempotent seed for existing shops. It only inserts missing catalog products.
SELECT public.seed_shop_starter_catalog(id) FROM public.shops;
