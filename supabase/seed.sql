-- Seed the three group companies + starter catalog. Run after schema.sql.

insert into companies (key,name,reg_no,tin_no,formerly_known_as,address_lines,tel,email,banks,invoice_format,invoice_prefix,show_logo,logo_text,show_qr,show_lhdn_link,show_rounding_row,show_authorised_signature) values
('prim','PRIM PAPER TRADING SDN BHD','202501032538 (1633949-T)',null,null,
  array['NO 4554 TAMAN RAWANG 48000 RAWANG SELANGOR'],'014 334 9588','primpaper4554@gmail.com',
  '[{"bank":"AMBANK","account":"888 1068 754 788"}]','ym','I-',false,null,false,false,false,true),
('3c','3C INDUSTRIES SDN BHD','201501001966 (Co.1127298-U)','C23707931030','Formerly known as Tag Paper Roll (M) Sdn Bhd',
  array['NO.19, JALAN PP 16/5, PERDANA INDUSTRY PARK','TAMAN PUTRA PERDANA 47130 PUCHONG SELANGOR'],
  '03-8322 3188 / 014 334 9588','3cindsb@gmail.com',
  '[{"bank":"UOB BANK","account":"258 303 3086"},{"bank":"RHB BANK","account":"2643 7500 0108 84"}]',
  'ym','INV-',true,'3C',true,true,true,true),
('tien_ngai','TIEN NGAI MACHINERY SDN BHD','201101023373 (951509-H)','C21874792060',null,
  array['NO.19, JALAN PP 16/5, PERDANA INDUSTRY PARK','TAMAN PUTRA PERDANA 47130 PUCHONG SELANGOR'],
  '03 8322 3188 / 014 334 9588','tienngaim328@gmail.com',
  '[{"bank":"Alliance Bank","account":"6409 600 100 28643"},{"bank":"OCBC Bank","account":"190 100 2966"},{"bank":"UOB Bank","account":"223 303 0726"}]',
  'running','INV-',false,null,true,false,false,false)
on conflict (key) do nothing;

insert into invoice_counters (company, seq) values
('tien_ngai',187880),('3c',7),('prim',4)
on conflict (company) do nothing;

insert into customers (id,name,address_lines,tel) values
('kf-advisor','KF ADVISOR',array['A-07-11 MENARA PRIMA','JALAN PJU 1/39 DATARAN PRIMA','47301 PETALING JAYA SELANGOR'],'012 621 9399'),
('goodwill','GOODWILL MARKETING',array['NO 11 JLN BUNGA KEMBOJA 7D','TAMAN MUDA 56100 KUALA LUMPUR'],'016 891 1682')
on conflict (id) do nothing;

insert into products (id,name,spec_lines,uom) values
('tp-48-225','THERMAL PAPER 48GSM 225MM',array['59.5KG-1ROLL','58.5KG-1ROLL'],'KGS'),
('coreless-57-38-12','CORELESS THERMAL PAPER BLANK ROLL',array['57MMX38MMX12MM','10IN1 PACK','200R/CTN'],'BOXES')
on conflict (id) do nothing;

-- Chain: Tien Ngai (origin) -> Prim -> 3C (customer-facing). Margins taken by 3C and Prim.
insert into margin_rules (product_id,tier,type,value) values
('tp-48-225','3c','rm_per_unit',0.40),
('tp-48-225','prim','rm_per_unit',0.40),
('coreless-57-38-12','3c','rm_per_unit',3.00),
('coreless-57-38-12','prim','rm_per_unit',3.00)
on conflict (product_id,tier) do nothing;
