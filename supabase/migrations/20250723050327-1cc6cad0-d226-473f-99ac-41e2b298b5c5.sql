
-- Add foreign key constraints to goods_damaged_entries table
ALTER TABLE goods_damaged_entries 
ADD CONSTRAINT fk_goods_damaged_entries_category 
FOREIGN KEY (category_id) REFERENCES categories(id);

ALTER TABLE goods_damaged_entries 
ADD CONSTRAINT fk_goods_damaged_entries_size 
FOREIGN KEY (size_id) REFERENCES sizes(id);

ALTER TABLE goods_damaged_entries 
ADD CONSTRAINT fk_goods_damaged_entries_shop 
FOREIGN KEY (shop_id) REFERENCES shops(id);

ALTER TABLE goods_damaged_entries 
ADD CONSTRAINT fk_goods_damaged_entries_profile 
FOREIGN KEY (employee_id) REFERENCES profiles(id);
