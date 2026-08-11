/**
 * EtsyFlow (Supabase) veri tipleri.
 * EtsyFlow'un supabase/migration.sql şemasıyla eşleşir.
 */

export interface EtsyStore {
  id: string;
  user_id: string;
  name: string;
  store_number: string | null;
  category: string | null;
  sub_category: string | null;
  currency: string;
  status: string; // active | inactive | paused
  /** Chrome eklentisine girilen eşleştirme kodu (varsa) */
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EtsyProduct {
  id: string;
  user_id: string;
  store_id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  currency: string;
  price: number | null;
  category: string | null;
  sub_category: string | null;
  images: string[] | null;
  status: string; // active | pending | error | draft
  /** Eklenti yükleme kuyruğu durumu: waiting | processing | uploading | uploaded | cancelled */
  upload_status: string | null;
  etsy_listing_id: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EtsyOrder {
  id: string;
  user_id: string;
  store_id: string;
  product_id: string | null;
  etsy_order_id: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  currency: string;
  total: number | null;
  status: string; // new | preparing | shipped | delivered | cancelled
  shipping_info: unknown;
  created_at: string;
  updated_at: string;
}

export interface EtsyOverview {
  /** Lean Automation e-postası EtsyFlow'da bir profile eşleşti mi? */
  linked: boolean;
  stores: EtsyStore[];
  products: EtsyProduct[];
  orders: EtsyOrder[];
}
