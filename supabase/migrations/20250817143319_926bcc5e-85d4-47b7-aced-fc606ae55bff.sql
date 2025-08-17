
-- Add missing foreign key constraints to fix the relationship embedding issue
ALTER TABLE goods_damaged_entries 
ADD CONSTRAINT fk_goods_damaged_entries_category 
FOREIGN KEY (category_id) REFERENCES categories(id);

ALTER TABLE goods_damaged_entries 
ADD CONSTRAINT fk_goods_damaged_entries_size 
FOREIGN KEY (size_id) REFERENCES sizes(id);

ALTER TABLE goods_damaged_entries 
ADD CONSTRAINT fk_goods_damaged_entries_shop 
FOREIGN KEY (shop_id) REFERENCES shops(id);

-- Add foreign key constraints for profiles table references
ALTER TABLE profiles 
ADD CONSTRAINT fk_profiles_shop 
FOREIGN KEY (shop_id) REFERENCES shops(id);

ALTER TABLE profiles 
ADD CONSTRAINT fk_profiles_default_category 
FOREIGN KEY (default_category_id) REFERENCES categories(id);

ALTER TABLE profiles 
ADD CONSTRAINT fk_profiles_default_size 
FOREIGN KEY (default_size_id) REFERENCES sizes(id);
