-- Retaguarda MFT · cadastro de todas as unidades do Everest (lista de 20/11/2026, 109 empresas).
-- Pedido do Willian em 20/11/2026: nome no padrão do Everest, CNPJ, código da empresa no Everest e status.
-- Só acrescenta colunas e lojas; nada é apagado. Lojas já existentes não são duplicadas (casam pelo código do Everest).
--   * Congonhas (id 'teste') vira DEL-CGH-PUB / empresa 57. A Matriz (id 'matriz') recebe a empresa 1 (MFT-OLI-ADM) e o CNPJ, sem mudar o nome.
--   * Nome = Fantasia do Everest. Código = Fantasia; quando a Fantasia se repete no Everest, Código = Fantasia-<empresa>.
--   * Marca pelo prefixo: DEL DeltaExpresso, SAL Salch&Pão, BOL Boleria das Marias, BIT Bitte Burger, CPQ Casa do Pão de Queijo, AVI Aviador.
--     ACB e MFT ficam sem marca (a definir).
--   * Status = coluna active (todas entram ativas). Nenhuma loja nova recebe módulos liberados (store_feature_flags) nem usuários.
-- Reversão: delete from public.stores where id not in ('matriz','teste') and everest_code is not null;
--           update public.stores set name='Congonhas', code='CGH' where id='teste';
--           alter table public.stores drop column if exists everest_code, drop column if exists cnpj, drop column if exists city, drop column if exists uf;
begin;
alter table public.stores add column if not exists everest_code integer;
alter table public.stores add column if not exists cnpj text;
alter table public.stores add column if not exists city text;
alter table public.stores add column if not exists uf text;
create unique index if not exists stores_everest_code_key on public.stores (everest_code) where everest_code is not null;

insert into public.brands (name) values ('Salch&Pão'),('Boleria das Marias'),('Bitte Burger'),('Casa do Pão de Queijo'),('Aviador')
on conflict ((lower(btrim(name)))) do nothing;

create temp table _emp (emp int, fantasia text, code text, cnpj text, city text, uf text, marca text) on commit drop;
insert into _emp values
(1,'MFT-OLI-ADM','MFT-OLI-ADM','19.859.870/0001-49','OLINDA','PE',null),
(2,'DEL-REC-CHE','DEL-REC-CHE','19.859.870/0017-06','RECIFE','PE','DeltaExpresso'),
(3,'DEL-REC-PRA','DEL-REC-PRA','19.859.870/0018-97','RECIFE','PE','DeltaExpresso'),
(4,'DEL-REC-DOM','DEL-REC-DOM','19.859.870/0019-78','RECIFE','PE','DeltaExpresso'),
(5,'ACB-REC-PRA','ACB-REC-PRA','19.859.870/0020-01','RECIFE','PE',null),
(6,'DEL-MCZ-DOM','DEL-MCZ-DOM','19.859.870/0022-73','RIO LARGO','AL','DeltaExpresso'),
(7,'DEL-MCZ-DES','DEL-MCZ-DES','19.859.870/0023-54','RIO LARGO','AL','DeltaExpresso'),
(8,'DEL-JPA-DOM','DEL-JPA-DOM','19.859.870/0025-16','BAYEUX','PB','DeltaExpresso'),
(9,'DEL-AJU-CHE','DEL-AJU-CHE','19.859.870/0026-05','ARACAJU','SE','DeltaExpresso'),
(10,'SAL-MCZ-PRA','SAL-MCZ-PRA','19.859.870/0027-88','RIO LARGO','AL','Salch&Pão'),
(11,'DEL-CPV-CHE','DEL-CPV-CHE','19.859.870/0028-69','CAMPINA GRANDE','PB','DeltaExpresso'),
(12,'DEL-CPV-DOM','DEL-CPV-DOM','19.859.870/0029-40','CAMPINA GRANDE','PB','DeltaExpresso'),
(13,'SAL-JDO-CHE','SAL-JDO-CHE','19.859.870/0030-83','JUAZEIRO DO NORTE','CE','Salch&Pão'),
(14,'ACB-JDO-CHE','ACB-JDO-CHE','19.859.870/0031-64','JUAZEIRO DO NORTE','CE',null),
(15,'DEL-JDO-CHE','DEL-JDO-CHE','19.859.870/0032-45','JUAZEIRO DO NORTE','CE','DeltaExpresso'),
(16,'SAL-MCZ-DES','SAL-MCZ-DES','19.859.870/0033-26','RIO LARGO','AL','Salch&Pão'),
(17,'ACB-MCZ-PRA','ACB-MCZ-PRA','19.859.870/0034-07','RIO LARGO','AL',null),
(18,'DEL-JDO-DOM','DEL-JDO-DOM','19.859.870/0035-98','JUAZEIRO DO NORTE','CE','DeltaExpresso'),
(19,'DEL-JPA-CHE','DEL-JPA-CHE','19.859.870/0036-79','BAYEUX','PB','DeltaExpresso'),
(20,'BOL-JPA-EXT','BOL-JPA-EXT','19.859.870/0037-50','BAYEUX','PB','Boleria das Marias'),
(21,'SAL-JPA-EXT','SAL-JPA-EXT','19.859.870/0038-30','BAYEUX','PB','Salch&Pão'),
(22,'BOL-JPA-DOM','BOL-JPA-DOM','19.859.870/0040-55','BAYEUX','PB','Boleria das Marias'),
(23,'SAL-JPA-DOM','SAL-JPA-DOM','19.859.870/0041-36','BAYEUX','PB','Salch&Pão'),
(24,'SAL-JPA-PRA','SAL-JPA-PRA','19.859.870/0042-17','BAYEUX','PB','Salch&Pão'),
(25,'DEL-JPA-PRA','DEL-JPA-PRA','19.859.870/0043-06','BAYEUX','PB','DeltaExpresso'),
(26,'ACB-JPA-PRA','ACB-JPA-PRA','19.859.870/0044-89','BAYEUX','PB',null),
(27,'BIT-JPA-PRA','BIT-JPA-PRA','19.859.870/0045-60','BAYEUX','PB','Bitte Burger'),
(28,'ACB-AJU-DES','ACB-AJU-DES','19.859.870/0046-40','ARACAJU','SE',null),
(29,'SAL-AJU-CHE','SAL-AJU-CHE','19.859.870/0047-21','ARACAJU','SE','Salch&Pão'),
(30,'BIT-AJU-DOM','BIT-AJU-DOM','19.859.870/0049-93','ARACAJU','SE','Bitte Burger'),
(31,'BOL-AJU-DOM','BOL-AJU-DOM','19.859.870/0050-27','ARACAJU','SE','Boleria das Marias'),
(32,'SAL-AJU-DOM','SAL-AJU-DOM','19.859.870/0051-08','ARACAJU','SE','Salch&Pão'),
(33,'DEL-AJU-DOM','DEL-AJU-DOM','19.859.870/0052-99','ARACAJU','SE','DeltaExpresso'),
(34,'ACB-REC-DOM','ACB-REC-DOM','19.859.870/0053-70','RECIFE','PE',null),
(35,'BIT-REC-PRA','BIT-REC-PRA','19.859.870/0054-50','RECIFE','PE','Bitte Burger'),
(36,'DEL-VCP-C15','DEL-VCP-C15','19.859.870/0055-31','CAMPINAS','SP','DeltaExpresso'),
(37,'DEL-VCP-MAL','DEL-VCP-MAL','19.859.870/0056-12','CAMPINAS','SP','DeltaExpresso'),
(38,'ACB-FOR-PRA','ACB-FOR-PRA','19.859.870/0057-01','FORTALEZA','CE',null),
(39,'AVI-FOR-PRA','AVI-FOR-PRA','19.859.870/0058-84','FORTALEZA','CE','Aviador'),
(40,'DEL-POA-DES','DEL-POA-DES','19.859.870/0059-65','PORTO ALEGRE','RS','DeltaExpresso'),
(41,'DEL-POA-CHE','DEL-POA-CHE','19.859.870/0060-07','PORTO ALEGRE','RS','DeltaExpresso'),
(42,'DEL-GIG-DEP','DEL-GIG-DEP','19.859.870/0061-80','RIO DE JANEIRO','RJ','DeltaExpresso'),
(43,'CPQ-GIG-DOM','CPQ-GIG-DOM','19.859.870/0062-60','RIO DE JANEIRO','RJ','Casa do Pão de Queijo'),
(44,'SAL-GIG-PIA','SAL-GIG-PIA','19.859.870/0063-41','RIO DE JANEIRO','RJ','Salch&Pão'),
(45,'CPQ-GIG-DES','CPQ-GIG-DES','19.859.870/0064-22','RIO DE JANEIRO','RJ','Casa do Pão de Queijo'),
(46,'CPQ-GIG-TP1','CPQ-GIG-TP1','19.859.870/0065-03','RIO DE JANEIRO','RJ','Casa do Pão de Queijo'),
(47,'DEL-GIG-DOM','DEL-GIG-DOM','19.859.870/0066-94','RIO DE JANEIRO','RJ','DeltaExpresso'),
(48,'DEL-GIG-PIA','DEL-GIG-PIA','19.859.870/0067-75','RIO DE JANEIRO','RJ','DeltaExpresso'),
(49,'DEL-GIG-PIB','DEL-GIG-PIB','19.859.870/0068-56','RIO DE JANEIRO','RJ','DeltaExpresso'),
(50,'DEL-GIG-DES','DEL-GIG-DES','19.859.870/0069-37','RIO DE JANEIRO','RJ','DeltaExpresso'),
(51,'DEL-FOR-PRA','DEL-FOR-PRA','19.859.870/0070-70','FORTALEZA','CE','DeltaExpresso'),
(52,'DEL-FOR-P08','DEL-FOR-P08','19.859.870/0071-51','FORTALEZA','CE','DeltaExpresso'),
(53,'DEL-FOR-P20','DEL-FOR-P20','19.859.870/0072-32','FORTALEZA','CE','DeltaExpresso'),
(54,'SAL-GRU-DES','SAL-GRU-DES','19.859.870/0073-13','GUARULHOS','SP','Salch&Pão'),
(55,'DEL-VCP-B26','DEL-VCP-B26','19.859.870/0074-02','CAMPINAS','SP','DeltaExpresso'),
(56,'BIT-VCP-P05','BIT-VCP-P05','19.859.870/0075-85','CAMPINAS','SP','Bitte Burger'),
(57,'DEL-CGH-PUB','DEL-CGH-PUB','19.859.870/0076-66','SAO PAULO','SP','DeltaExpresso'),
(58,'DEL-NAT-CHE','DEL-NAT-CHE-58','19.859.870/0077-47','SAO GONCALO DO AMARANTE','RN','DeltaExpresso'),
(59,'DEL-NAT-DOM','DEL-NAT-DOM-59','19.859.870/0078-28','SAO GONCALO DO AMARANTE','RN','DeltaExpresso'),
(60,'DEL-NAT-DES','DEL-NAT-DES-60','19.859.870/0079-09','SAO GONCALO DO AMARANTE','RN','DeltaExpresso'),
(61,'BIT-NAT-CHE','BIT-NAT-CHE-61','19.859.870/0080-42','SAO GONCALO DO AMARANTE','RN','Bitte Burger'),
(62,'ACB-NAT-CHE','ACB-NAT-CHE-62','19.859.870/0081-23','SAO GONCALO DO AMARANTE','RN',null),
(63,'DEL-NAT-INT','DEL-NAT-INT-63','19.859.870/0082-04','SAO GONCALO DO AMARANTE','RN','DeltaExpresso'),
(64,'DEL-SSA-DOM','DEL-SSA-DOM','19.859.870/0083-95','SALVADOR','BA','DeltaExpresso'),
(65,'DEL-SSA-PUB','DEL-SSA-PUB','19.859.870/0084-76','SALVADOR','BA','DeltaExpresso'),
(66,'DEL-SSA-INT','DEL-SSA-INT','19.859.870/0085-57','SALVADOR','BA','DeltaExpresso'),
(67,'DEL-VIX-DOM','DEL-VIX-DOM','19.859.870/0086-38','VITORIA','ES','DeltaExpresso'),
(68,'ACB-FLN-PRA','ACB-FLN-PRA','19.859.870/0087-19','FLORIANOPOLIS','SC',null),
(69,'DEL-BSB-NOR','DEL-BSB-NOR-69','37.154.511/0002-59','BRASILIA','DF','DeltaExpresso'),
(70,'DEL-BSB-CEN','DEL-BSB-CEN-70','37.154.511/0003-30','BRASILIA','DF','DeltaExpresso'),
(71,'DEL-BSB-DES','DEL-BSB-DES-71','37.154.511/0004-10','BRASILIA','DF','DeltaExpresso'),
(72,'DEL-BSB-CHE','DEL-BSB-CHE-72','37.154.511/0005-00','BRASILIA','DF','DeltaExpresso'),
(74,'DEL-CWB-DES','DEL-CWB-DES-74','37.154.511/0014-92','SAO JOSE DOS PINHAIS','PR','DeltaExpresso'),
(75,'DEL-SLZ-DES','DEL-SLZ-DES-75','37.154.511/0016-54','SAO LUIS','MA','DeltaExpresso'),
(76,'DEL-CWB-DOM','DEL-CWB-DOM','37.154.511/0021-11','SAO JOSE DOS PINHAIS','PR','DeltaExpresso'),
(77,'DEL-NAT-INT','DEL-NAT-INT-77','37.154.511/0026-26','SAO GONCALO DO AMARANTE','RN','DeltaExpresso'),
(78,'DEL-NAT-DOM','DEL-NAT-DOM-78','37.154.511/0028-98','SAO GONCALO DO AMARANTE','RN','DeltaExpresso'),
(79,'DEL-NAT-DES','DEL-NAT-DES-79','37.154.511/0029-79','SAO GONCALO DO AMARANTE','RN','DeltaExpresso'),
(80,'DEL-NAT-CHE','DEL-NAT-CHE-80','37.154.511/0032-74','SAO GONCALO DO AMARANTE','RN','DeltaExpresso'),
(81,'BIT-BSB-NOR','BIT-BSB-NOR-81','37.154.511/0017-35','BRASILIA','DF','Bitte Burger'),
(82,'BIT-CWB-DOM','BIT-CWB-DOM-82','37.154.511/0022-00','SAO JOSE DOS PINHAIS','PR','Bitte Burger'),
(83,'BIT-NAT-CHE','BIT-NAT-CHE-83','37.154.511/0027-07','SAO GONCALO DO AMARANTE','RN','Bitte Burger'),
(84,'ACB-SLZ-DES','ACB-SLZ-DES-84','37.154.511/0019-05','SAO LUIS','MA',null),
(85,'ACB-PNZ-CHE','ACB-PNZ-CHE-85','37.154.511/0024-64','PETROLINA','PE',null),
(86,'ACB-NAT-CHE','ACB-NAT-CHE-86','37.154.511/0031-93','SAO GONCALO DO AMARANTE','RN',null),
(87,'SAL-GIG-PIB','SAL-GIG-PIB','19.859.870/0088-08','RIO DE JANEIRO','RJ','Salch&Pão'),
(88,'SAL-GIG-PRA','SAL-GIG-PRA','19.859.870/0089-80','RIO DE JANEIRO','RJ','Salch&Pão'),
(98,'DEL-BSB-CHE','DEL-BSB-CHE-98','19.859.870/0091-03','BRASILIA','DF','DeltaExpresso'),
(99,'DEL-BSB-CEN','DEL-BSB-CEN-99','19.859.870/0092-86','BRASILIA','DF','DeltaExpresso'),
(100,'DEL-BSB-SUL','DEL-BSB-SUL-100','19.859.870/0094-48','BRASILIA','DF','DeltaExpresso'),
(101,'BIT-BSB-NOR','BIT-BSB-NOR-101','19.859.870/0095-29','BRASILIA','DF','Bitte Burger'),
(102,'ACB-BSB-PRA','ACB-BSB-PRA','19.859.870/0096-00','BRASILIA','DF',null),
(108,'SAL-PNZ-CHE','SAL-PNZ-CHE-108','19.859.870/0100-20','PETROLINA','PE','Salch&Pão'),
(118,'DEL-PMW-CHE','DEL-PMW-CHE-118','19.859.870/0098-71','PALMAS','TO','DeltaExpresso'),
(119,'ACB-PMW-CHE','ACB-PMW-CHE-119','19.859.870/0099-52','PALMAS','TO',null),
(120,'ACB-PNZ-CHE','ACB-PNZ-CHE-120','19.859.870/0101-01','PETROLINA','PE',null),
(121,'DEL-THE-CHE','DEL-THE-CHE-121','19.859.870/0102-92','TERESINA','PI','DeltaExpresso'),
(122,'ACB-SLZ-DES','ACB-SLZ-DES-122','19.859.870/0103-73','SAO LUIS','MA',null),
(123,'DEL-SLZ-DES','DEL-SLZ-DES-123','19.859.870/0104-54','SAO LUIS','MA','DeltaExpresso'),
(124,'DEL-CWB-DES','DEL-CWB-DES-124','19.859.870/0105-35','SAO JOSE DOS PINHAIS','PR','DeltaExpresso'),
(125,'BIT-CWB-DOM','BIT-CWB-DOM-125','19.859.870/0106-16','SAO JOSE DOS PINHAIS','PR','Bitte Burger'),
(1017,'DEL-THE-CHE','DEL-THE-CHE-1017','37.154.511/0013-01','TERESINA','PI','DeltaExpresso'),
(1018,'SAL-PNZ-CHE','SAL-PNZ-CHE-1018','37.154.511/0023-83','PETROLINA','PE','Salch&Pão'),
(1019,'DEL-BSB-SUL','DEL-BSB-SUL-1019','37.154.511/0001-78','BRASILIA','DF','DeltaExpresso'),
(1021,'DEL-PMW-CHE','DEL-PMW-CHE-1021','37.154.511/0020-30','PALMAS','TO','DeltaExpresso'),
(1145,'ACB-PMW-CHE','ACB-PMW-CHE-1145','37.154.511/0018-16','PALMAS','TO',null),
(3278,'DEL-BSB-NOR','DEL-BSB-NOR-3278','19.859.870/0090-14','BRASILIA','DF','DeltaExpresso'),
(3279,'DEL-BSB-DES','DEL-BSB-DES-3279','19.859.870/0093-67','BRASILIA','DF','DeltaExpresso'),
(4876,'MFT-CVD-EST','MFT-CVD-EST','19.859.870/0097-90','SAO PAULO','SP',null);

-- Matriz e Congonhas: só completam os dados.
update public.stores s set everest_code=1, cnpj=e.cnpj, city=e.city, uf=e.uf from _emp e where s.id='matriz' and e.emp=1;
update public.stores s set name=e.fantasia, code=e.code, everest_code=57, cnpj=e.cnpj, city=e.city, uf=e.uf from _emp e where s.id='teste' and e.emp=57;

insert into public.stores (id, code, name, store_type, active, everest_code, cnpj, city, uf, brand_id)
select lower(e.code), e.code, e.fantasia, 'operational', true, e.emp, e.cnpj, e.city, e.uf,
       (select b.id from public.brands b where b.name = e.marca)
  from _emp e
 where e.emp not in (1,57)
   and not exists (select 1 from public.stores s where s.everest_code = e.emp);

select count(*) filter (where store_type='operational') lojas, count(*) filter (where everest_code is not null) com_everest,
       count(*) filter (where brand_id is null and store_type='operational') sem_marca,
       (select string_agg(b.name||'='||n, ', ' order by b.name) from (select brand_id, count(*) n from public.stores group by 1) t join public.brands b on b.id=t.brand_id) por_marca,
       (select name||' / '||code||' / '||everest_code from public.stores where id='teste') cgh
  from public.stores;
commit;
