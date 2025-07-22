
export interface Database {
  public: {
    Tables: {
      shops: {
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
      profiles: {
        Row: {
          id: string;
          name: string;
          user_id: string;
          role: 'admin' | 'user';
          shop_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          user_id: string;
          role?: 'admin' | 'user';
          shop_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          user_id?: string;
          role?: 'admin' | 'user';
          shop_id?: string | null;
          created_at?: string;
          updated_at?: string;
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
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
