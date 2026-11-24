-- 48: Outras franquias no Degust (mesma API/usuário Linx, muda o código da franquia). Pedido do usuário em 24/11/2026:
--     SAL = 2168, ACB = 2642, BIT = 2202 ("vamos fazer estes por enquanto"). Os códigos de loja podem repetir entre franquias.
-- stores.degust_franqueador: franquia Degust da loja; vazio = a franquia padrão dos segredos (DEL).
-- integration_tokens guarda um token por franquia: provider "degust" (padrão) ou "degust:<franquia>".
begin;
alter table public.stores add column if not exists degust_franqueador integer;
comment on column public.stores.degust_franqueador is 'Código da franquia no Degust (Linx). Vazio = franquia padrão (DEL, segredo DEGUST_FRANQUEADOR).';
select count(*) filter (where degust_code is not null) lojas_com_degust, count(*) filter (where degust_franqueador is not null) com_franquia from public.stores;
commit;
