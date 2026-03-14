-- 002_add_farmland_area.sql  新增耕地面积字段
ALTER TABLE tb_plot ADD COLUMN farmland_area REAL;  -- 耕地面积（在监测面积之后、占基本农田面积之前）
