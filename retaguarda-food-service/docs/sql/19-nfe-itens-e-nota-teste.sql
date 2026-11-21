-- 19: Itens da NF-e como vieram do fornecedor + importação de teste de 1 nota (CGH, Sendas/Assaí nº 184284, 21 itens).
-- invoice_nfe_items guarda a linha da nota do jeito que veio (código/descrição/unidade do fornecedor, quantidades, valores, CFOP)
-- e o vínculo que o Everest já tinha (código do item no Everest e quantidade em estoque). item_id = nosso item quando o código do Everest existe em items.
-- invoice_items (linhas que dão entrada no estoque) NÃO é preenchida: a nota entra como PENDENTE e não mexe no estoque.
-- Reversão: delete from public.invoices where store_id='teste' and invoice_number='184284' and origin='everest'; drop table if exists public.invoice_nfe_items;
--           alter table public.invoices drop column if exists series, drop column if exists total_amount, drop column if exists origin;
begin;
alter table public.invoices add column if not exists series text;
alter table public.invoices add column if not exists total_amount numeric(14,2);
alter table public.invoices add column if not exists origin text;

create table if not exists public.invoice_nfe_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  store_id text not null,
  seq integer not null,
  supplier_item_code text,
  description text,
  supplier_unit text,
  package_desc text,
  qty_per_package numeric(14,4),
  quantity numeric(14,4) not null default 0,
  unit_price numeric(14,4) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  cfop text,
  everest_item_code text,
  everest_item_name text,
  everest_stock_qty numeric(14,4),
  item_id uuid references public.items(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, store_id) references public.invoices(id, store_id) on delete cascade,
  unique (invoice_id, seq)
);
create index if not exists invoice_nfe_items_invoice_idx on public.invoice_nfe_items (invoice_id);
alter table public.invoice_nfe_items enable row level security;
drop policy if exists invoice_nfe_items_read on public.invoice_nfe_items;
create policy invoice_nfe_items_read on public.invoice_nfe_items for select to authenticated
  using (mft_private.has_tab_access(store_id,'notes',false) or mft_private.has_tab_access(store_id,'cmv',false));
drop policy if exists invoice_nfe_items_write on public.invoice_nfe_items;
create policy invoice_nfe_items_write on public.invoice_nfe_items for all to authenticated
  using (mft_private.has_tab_access(store_id,'notes',true)) with check (mft_private.has_tab_access(store_id,'notes',true));
grant select, insert, update, delete on public.invoice_nfe_items to authenticated;

-- Nota de teste (não duplica se já existir)
insert into public.invoices (store_id,invoice_number,series,supplier_id,issue_date,entry_date,access_key,status,total_amount,origin,notes)
select 'teste','184284','300',(select id from public.suppliers where code='2339'),date '2026-11-12',date '2026-11-12',
       '35261106057223050942553000001842841587460694','pending',1355.98,'everest','Importada do Everest (Monitor de DANFEs Recebidas) em 20/11/2026 para teste. Itens da NF-e em invoice_nfe_items.'
where not exists (select 1 from public.invoices where store_id='teste' and invoice_number='184284');

insert into public.invoice_nfe_items (invoice_id,store_id,seq,supplier_item_code,description,supplier_unit,package_desc,qty_per_package,quantity,unit_price,discount,total,cfop,everest_item_code,everest_item_name,everest_stock_qty,item_id)
select i.id,'teste',v.seq,v.c,v.d,v.u,v.p,v.qe,v.q,v.vu,coalesce(v.vd,0),v.vt,v.cfop,v.ec,v.en,v.es,(select it.id from public.items it where it.code=v.ec)
from public.invoices i cross join (values
  (1,'91926','ACUCAR UNIAO PREMIUM SACHET 400X5G','CX1','CX 400 UND',400.0000,3.0000,20.2900,0.00,60.87,'5102','1000018','MP - ACUCAR SACHE',1200.0000),
  (2,'1136450','AGUA SANITARIA AGIFACIL 2L','UN1',null,null,2.0000,4.2900,0.00,8.58,'5102',null,null,null),
  (3,'1127933','ALCOOL LIQ BALCAO 1L BACTERICIDA','UN1','UNIDADE',1.0000,2.0000,5.9000,0.00,11.80,'5102','7000537','ALCOOL LIQ BACTERICIDA',2.0000),
  (4,'1202455','BATATA PALHA MEGA 100G','UN1','QUILOGRAMA',1.0000,2.0000,5.2900,0.00,10.58,'5102','1000196','BATATA PALHA',2.0000),
  (5,'1187310','BOBINA PANO BOMPACK S LIMPEZA LEVE 28X180M AZUL','UN1','UNIDADE',1.0000,1.0000,82.9000,0.00,82.90,'5102','7000007','PANO MULTIUSO',1.0000),
  (6,'1045807','CERVEJA HEINEKEN LN 330ML','UN1',null,null,6.0000,7.2500,0.00,43.50,'5405',null,null,null),
  (7,'1020128','COLHER STRAWPLAST SOBREMESA CRISTAL C/50','PC1','PCT 50 UND',50.0000,4.0000,3.8900,0.00,15.56,'5102','2000038','COLHER SOBREMESA',200.0000),
  (8,'85232','CR LEITE PAULISTA TP 200G','UN1','QUILOGRAMA',1.0000,54.0000,2.7900,0.00,150.66,'5405','1000044','MP - CREME DE LEITE',54.0000),
  (9,'1136498','DESINF AGIFACIL 5L EUCALIPTO','UN1',null,null,1.0000,10.9900,0.00,10.99,'5102',null,null,null),
  (10,'1013','DET LIQ YPE 5L NEUTRO','UN1','UNIDADE',1.0000,1.0000,20.9000,0.00,20.90,'5102','7000003','DETERGENTE NEUTRO 5 LITROS',1.0000),
  (11,'1058131','DOCE CREMOSO OLIVEIRA 900G LEITE E SORO','UN1',null,null,1.0000,13.9900,0.00,13.99,'5102',null,null,null),
  (12,'92471','ESPONJA BETTANIN ESF M USO C/12','UN1',null,null,1.0000,18.9000,0.00,18.90,'5102',null,null,null),
  (13,'1276117','LEITE PO BATAVO SACHE 400G INT INST','UN1',null,null,50.0000,14.9900,0.00,749.50,'5405',null,null,null),
  (14,'54459','LUVA DESC EXTRUSA PACK PLAST C/100','PC1',null,null,5.0000,3.1500,0.00,15.75,'5102',null,null,null),
  (15,'84695','MOLHO PIM ASTECA 200ML','FR1','UNIDADE',1.0000,1.0000,4.7900,0.00,4.79,'5405','1000173','MP - PIMENTA',1.0000),
  (16,'1101656','OVOMALTINE EXTRA CROCANTE 750G FLOC','PC1','QUILOGRAMA',1.0000,2.0000,42.9000,0.00,85.80,'5102','1000164','OVOMALTINE FLOCOS CROCANTES 750G',2.0000),
  (17,'1206067','PACOCA DADINHO ROLHA PT 750G','PT1',null,null,1.0000,29.8900,0.00,29.89,'5102',null,null,null),
  (18,'1226954','PANOS MICROFRIBRA PROAUTO 35X35 C/4','UN1',null,null,1.0000,7.4900,0.00,7.49,'5102',null,null,null),
  (19,'12224','PAPEL SULFITE REPORT PREMIUM210X297 C/500FLS A4','PC1','UNIDADE',1.0000,2.0000,23.4900,0.00,46.98,'5102','7000189','PAPEL SULFITE A4 500FLS',2.0000),
  (20,'1036768','TACA NADIR BARONE VINHO 385ML','UN1','UNIDADE',1.0000,2.0000,11.4900,0.00,22.98,'5102','7001155','TACA DE VINHO',2.0000),
  (21,'59297','VASSOURA C/ CABO NOVICA REF BT1672','UN1',null,null,1.0000,13.8900,0.00,13.89,'5102',null,null,null)
) as v(seq,c,d,u,p,qe,q,vu,vd,vt,cfop,ec,en,es)
where i.store_id='teste' and i.invoice_number='184284'
on conflict (invoice_id,seq) do nothing;

select i.invoice_number, i.status, s.name fornecedor, (select count(*) from public.invoice_nfe_items x where x.invoice_id=i.id) itens,
       (select count(*) from public.invoice_nfe_items x where x.invoice_id=i.id and x.item_id is not null) com_item_nosso,
       (select sum(total) from public.invoice_nfe_items x where x.invoice_id=i.id) soma, i.total_amount
from public.invoices i left join public.suppliers s on s.id=i.supplier_id where i.store_id='teste' and i.invoice_number='184284';
commit;
