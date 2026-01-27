
export interface Database {
  public: {
    Tables: {
      shops: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
          whatsapp_group_link: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
          whatsapp_group_link?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
          whatsapp_group_link?: string | null;
        };
      };
      app_settings: {
        Row: {
          id: string;
          key: string;
          value: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      sizes: {
        Row: {
          id: string;
          size: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          size: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          size?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      customer_types: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          user_id: string;
          role: 'admin' | 'user' | 'manager';
          shop_id: string | null;
          default_category_id: string | null;
          default_size_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          name: string;
          user_id: string;
          role?: 'admin' | 'user' | 'manager';
          shop_id?: string | null;
          default_category_id?: string | null;
          default_size_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          user_id?: string;
          role?: 'admin' | 'user' | 'manager';
          shop_id?: string | null;
          default_category_id?: string | null;
          default_size_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      goods_damaged_entries: {
        Row: {
          id: string;
          category_id: string;
          size_id: string;
          employee_id: string;
          employee_name: string | null;
          shop_id: string;
          customer_type_id: string | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          size_id: string;
          employee_id: string;
          employee_name?: string | null;
          shop_id: string;
          customer_type_id?: string | null;
          notes: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          size_id?: string;
          employee_id?: string;
          employee_name?: string | null;
          shop_id?: string;
          customer_type_id?: string | null;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
