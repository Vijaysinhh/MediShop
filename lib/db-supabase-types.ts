type MedicineDetails = {
  generic_name: string | null; strength: string | null; dosage_form: string | null;
  pack_type: string | null; shelf_location: string | null; batch_number: string | null;
  gst_rate: number | null; requires_prescription: boolean; cold_storage: boolean;
  supplier_name: string | null; supplier_phone: string | null;
};
type RefillSchedule = { repeat_medicine: string | null; repeat_every_days: number | null; last_purchase_date: string | null };
type ReceiptDetails = { receipt_phone: string | null };
type MedicineSaleSnapshot = { generic_name: string | null; strength: string | null; dosage_form: string | null; gst_rate: number | null };

// Type definitions for Supabase tables

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      shops: {
        Row: {
          id: number;
          owner_name: string;
          shop_name: string;
          address: string | null;
          phone_number: string;
          password: string;
          is_paused: boolean;
          subscription_end_date: string | null;
          last_payment_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          owner_name: string;
          shop_name: string;
          address?: string | null;
          phone_number: string;
          password: string;
          is_paused?: boolean;
          subscription_end_date?: string | null;
          last_payment_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          owner_name?: string;
          shop_name?: string;
          address?: string | null;
          phone_number?: string;
          password?: string;
          is_paused?: boolean;
          subscription_end_date?: string | null;
          last_payment_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: number;
          shop_id: number | null;
          username: string;
          password: string;
          role: 'super_admin' | 'owner' | 'worker';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          shop_id?: number | null;
          username: string;
          password: string;
          role: 'super_admin' | 'owner' | 'worker';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number | null;
          username?: string;
          password?: string;
          role?: 'super_admin' | 'owner' | 'worker';
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: number;
          shop_id: number;
          name: string;
          name_marathi: string | null;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          shop_id: number;
          name: string;
          name_marathi?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number;
          name?: string;
          name_marathi?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      units: {
        Row: {
          id: number;
          shop_id: number;
          name: string;
          name_marathi: string | null;
          short_form: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          shop_id: number;
          name: string;
          name_marathi?: string | null;
          short_form: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number;
          name?: string;
          name_marathi?: string | null;
          short_form?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      items: {
        Row: MedicineDetails & {
          id: number;
          shop_id: number;
          name: string | null;
          name_marathi: string | null;
          brand: string | null;
          brand_marathi: string | null;
          catalog_code: string | null;
          icon_key: string;
          category_id: number | null;
          unit_id: number | null;
          quantity: number;
          expiry_date: string | null;
          buy_price: number;
          sell_price: number;
          margin_amount: number | null;
          margin_percent: number | null;
          low_stock_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<MedicineDetails> & {
          id?: number;
          shop_id: number;
          name?: string | null;
          name_marathi?: string | null;
          brand?: string | null;
          brand_marathi?: string | null;
          catalog_code?: string | null;
          icon_key?: string;
          category_id?: number | null;
          unit_id?: number | null;
          quantity?: number;
          expiry_date?: string | null;
          buy_price: number;
          sell_price: number;
          margin_amount?: number | null;
          margin_percent?: number | null;
          low_stock_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<MedicineDetails> & {
          id?: number;
          shop_id?: number;
          name?: string | null;
          name_marathi?: string | null;
          brand?: string | null;
          brand_marathi?: string | null;
          catalog_code?: string | null;
          icon_key?: string;
          category_id?: number | null;
          unit_id?: number | null;
          quantity?: number;
          expiry_date?: string | null;
          buy_price?: number;
          sell_price?: number;
          margin_amount?: number | null;
          margin_percent?: number | null;
          low_stock_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      price_tiers: {
        Row: {
          id: number;
          shop_id: number;
          item_id: number;
          quantity: number;
          unit_id: number | null;
          price: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          shop_id: number;
          item_id: number;
          quantity: number;
          unit_id?: number | null;
          price: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number;
          item_id?: number;
          quantity?: number;
          unit_id?: number | null;
          price?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      sales: {
        Row: ReceiptDetails & {
          id: number;
          shop_id: number;
          date: string;
          timestamp: string;
          total_quantity_items: number | null;
          subtotal: number;
          total_cost: number;
          total_profit: number;
          profit_margin_percent: number | null;
          payment_method: 'cash' | 'card' | 'partial' | 'udhar';
          paid_amount: number;
          due_amount: number;
          paid_via: 'cash' | 'card' | null;
          credit_customer_id: number | null;
          credit_customer_name: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<ReceiptDetails> & {
          id?: number;
          shop_id: number;
          date: string;
          timestamp: string;
          total_quantity_items?: number | null;
          subtotal: number;
          total_cost: number;
          total_profit: number;
          profit_margin_percent?: number | null;
          payment_method: 'cash' | 'card' | 'partial' | 'udhar';
          paid_amount?: number;
          due_amount?: number;
          paid_via?: 'cash' | 'card' | null;
          credit_customer_id?: number | null;
          credit_customer_name?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ReceiptDetails> & {
          id?: number;
          shop_id?: number;
          date?: string;
          timestamp?: string;
          total_quantity_items?: number | null;
          subtotal?: number;
          total_cost?: number;
          total_profit?: number;
          profit_margin_percent?: number | null;
          payment_method?: 'cash' | 'card' | 'partial' | 'udhar';
          paid_amount?: number;
          due_amount?: number;
          paid_via?: 'cash' | 'card' | null;
          credit_customer_id?: number | null;
          credit_customer_name?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      sale_items: {
        Row: MedicineSaleSnapshot & {
          id: number;
          shop_id: number;
          sale_id: number;
          item_id: number | null;
          item_name: string;
          quantity: number;
          unit_id: number | null;
          unit_short_form: string | null;
          price_tier_id: number | null;
          price_per_unit: number;
          total_price: number;
          cost_per_unit: number;
          total_cost: number;
          profit: number;
          created_at: string;
        };
        Insert: Partial<MedicineSaleSnapshot> & {
          id?: number;
          shop_id: number;
          sale_id: number;
          item_id?: number | null;
          item_name: string;
          quantity: number;
          unit_id?: number | null;
          unit_short_form?: string | null;
          price_tier_id?: number | null;
          price_per_unit: number;
          total_price: number;
          cost_per_unit: number;
          total_cost: number;
          profit: number;
          created_at?: string;
        };
        Update: Partial<MedicineSaleSnapshot> & {
          id?: number;
          shop_id?: number;
          sale_id?: number;
          item_id?: number | null;
          item_name?: string;
          quantity?: number;
          unit_id?: number | null;
          unit_short_form?: string | null;
          price_tier_id?: number | null;
          price_per_unit?: number;
          total_price?: number;
          cost_per_unit?: number;
          total_cost?: number;
          profit?: number;
          created_at?: string;
        };
      };
      stock_history: {
        Row: {
          id: number;
          shop_id: number;
          item_id: number;
          item_name: string;
          type: 'purchase' | 'sale' | 'adjustment' | 'damage' | 'expiry';
          quantity_changed: number;
          quantity_before: number;
          quantity_after: number;
          reason: string | null;
          cost_per_unit: number | null;
          reference: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          shop_id: number;
          item_id: number;
          item_name: string;
          type: 'purchase' | 'sale' | 'adjustment' | 'damage' | 'expiry';
          quantity_changed: number;
          quantity_before: number;
          quantity_after: number;
          reason?: string | null;
          cost_per_unit?: number | null;
          reference?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number;
          item_id?: number;
          item_name?: string;
          type?: 'purchase' | 'sale' | 'adjustment' | 'damage' | 'expiry';
          quantity_changed?: number;
          quantity_before?: number;
          quantity_after?: number;
          reason?: string | null;
          cost_per_unit?: number | null;
          reference?: string | null;
          created_at?: string;
        };
      };
      batches: {
        Row: {
          id: number;
          shop_id: number;
          item_id: number;
          item_name: string;
          batch_number: string | null;
          purchase_date: string;
          expiry_date: string | null;
          quantity_received: number;
          quantity_sold: number;
          quantity_available: number;
          cost_per_unit: number;
          supplier_id: string | null;
          status: 'active' | 'expiring' | 'expired';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          shop_id: number;
          item_id: number;
          item_name: string;
          batch_number?: string | null;
          purchase_date: string;
          expiry_date?: string | null;
          quantity_received: number;
          quantity_sold?: number;
          quantity_available: number;
          cost_per_unit: number;
          supplier_id?: string | null;
          status: 'active' | 'expiring' | 'expired';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number;
          item_id?: number;
          item_name?: string;
          batch_number?: string | null;
          purchase_date?: string;
          expiry_date?: string | null;
          quantity_received?: number;
          quantity_sold?: number;
          quantity_available?: number;
          cost_per_unit?: number;
          supplier_id?: string | null;
          status?: 'active' | 'expiring' | 'expired';
          created_at?: string;
          updated_at?: string;
        };
      };
      alerts: {
        Row: {
          id: number;
          shop_id: number;
          item_id: number;
          item_name: string;
          alert_type: 'low_stock' | 'expiring' | 'slow_moving' | 'expired';
          message: string;
          severity: 'info' | 'warning' | 'critical';
          data: Json;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          shop_id: number;
          item_id: number;
          item_name: string;
          alert_type: 'low_stock' | 'expiring' | 'slow_moving' | 'expired';
          message: string;
          severity: 'info' | 'warning' | 'critical';
          data?: Json;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number;
          item_id?: number;
          item_name?: string;
          alert_type?: 'low_stock' | 'expiring' | 'slow_moving' | 'expired';
          message?: string;
          severity?: 'info' | 'warning' | 'critical';
          data?: Json;
          read?: boolean;
          created_at?: string;
        };
      };
      credit_customers: {
        Row: RefillSchedule & {
          id: number;
          shop_id: number;
          name: string;
          phone: string | null;
          balance: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<RefillSchedule> & {
          id?: number;
          shop_id: number;
          name: string;
          phone?: string | null;
          balance?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<RefillSchedule> & {
          id?: number;
          shop_id?: number;
          name?: string;
          phone?: string | null;
          balance?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      credit_entries: {
        Row: {
          id: number;
          shop_id: number;
          customer_id: number;
          customer_name: string;
          type: 'credit' | 'payment';
          amount: number;
          note: string | null;
          sale_id: number | null;
          bill_items: Json;
          date: string;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          shop_id: number;
          customer_id: number;
          customer_name: string;
          type: 'credit' | 'payment';
          amount: number;
          note?: string | null;
          sale_id?: number | null;
          bill_items?: Json;
          date: string;
          timestamp: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number;
          customer_id?: number;
          customer_name?: string;
          type?: 'credit' | 'payment';
          amount?: number;
          note?: string | null;
          sale_id?: number | null;
          bill_items?: Json;
          date?: string;
          timestamp?: string;
          created_at?: string;
        };
      };
      app_settings: {
        Row: {
          id: number;
          shop_id: number;
          language: 'en' | 'mr';
          theme: 'light' | 'dark' | 'system';
          setup_complete: boolean;
          last_backup: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          shop_id: number;
          language?: 'en' | 'mr';
          theme?: 'light' | 'dark' | 'system';
          setup_complete?: boolean;
          last_backup?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number;
          language?: 'en' | 'mr';
          theme?: 'light' | 'dark' | 'system';
          setup_complete?: boolean;
          last_backup?: string | null;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: number;
          shop_id: number;
          amount: number;
          start_date: string;
          end_date: string;
          payment_method: string;
          transaction_id: string | null;
          status: 'active' | 'pending' | 'failed' | 'cancelled';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          shop_id: number;
          amount: number;
          start_date: string;
          end_date: string;
          payment_method: string;
          transaction_id?: string | null;
          status?: 'active' | 'pending' | 'failed' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number;
          amount?: number;
          start_date?: string;
          end_date?: string;
          payment_method?: string;
          transaction_id?: string | null;
          status?: 'active' | 'pending' | 'failed' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
      };
      shop_payment_info: {
        Row: {
          id: number;
          shop_id: number;
          upi_id: string | null;
          qr_code_url: string | null;
          phone_pe: string | null;
          g_pay: string | null;
          paytm: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          shop_id: number;
          upi_id?: string | null;
          qr_code_url?: string | null;
          phone_pe?: string | null;
          g_pay?: string | null;
          paytm?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number;
          upi_id?: string | null;
          qr_code_url?: string | null;
          phone_pe?: string | null;
          g_pay?: string | null;
          paytm?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: number;
          shop_id: number;
          user_id: number | null;
          action: 'create' | 'update' | 'delete';
          table_name: string;
          record_id: string;
          old_data: Json | null;
          new_data: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          shop_id: number;
          user_id?: number | null;
          action: 'create' | 'update' | 'delete';
          table_name: string;
          record_id: string;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number;
          user_id?: number | null;
          action?: 'create' | 'update' | 'delete';
          table_name?: string;
          record_id?: string;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: number;
          user_id: number;
          shop_id: number;
          role: 'super_admin' | 'owner' | 'manager' | 'cashier' | 'worker';
          permissions: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: number;
          shop_id: number;
          role: 'super_admin' | 'owner' | 'manager' | 'cashier' | 'worker';
          permissions: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: number;
          shop_id?: number;
          role?: 'super_admin' | 'owner' | 'manager' | 'cashier' | 'worker';
          permissions?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      system_health_checks: {
        Row: {
          id: number;
          shop_id: number;
          check_type: 'database' | 'api' | 'storage' | 'auth';
          status: 'healthy' | 'degraded' | 'unhealthy';
          response_time_ms: number | null;
          error_message: string | null;
          details: Json | null;
          checked_at: string;
        };
        Insert: {
          id?: number;
          shop_id: number;
          check_type: 'database' | 'api' | 'storage' | 'auth';
          status: 'healthy' | 'degraded' | 'unhealthy';
          response_time_ms?: number | null;
          error_message?: string | null;
          details?: Json | null;
          checked_at?: string;
        };
        Update: {
          id?: number;
          shop_id?: number;
          check_type?: 'database' | 'api' | 'storage' | 'auth';
          status?: 'healthy' | 'degraded' | 'unhealthy';
          response_time_ms?: number | null;
          error_message?: string | null;
          details?: Json | null;
          checked_at?: string;
        };
      };
    };
  };
}
