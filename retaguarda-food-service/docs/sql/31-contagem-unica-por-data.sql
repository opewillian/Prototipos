-- 31: Regra: uma loja não pode ter duas contagens na mesma data (pedido do usuário em 23/11/2026).
-- Contagens canceladas não contam (dá para cancelar e iniciar outra no mesmo dia).
-- Vale para criar a contagem e para mudar a data dela.
-- Conferência antes: lista datas repetidas (se houver, o índice não é criado e a transação volta).
select store_id, count_date, count(*) qtd, string_agg(display_id, ', ') contagens
from public.stock_counts where status <> 'cancelled'
group by store_id, count_date having count(*) > 1;

create unique index if not exists stock_counts_store_date_key
  on public.stock_counts (store_id, count_date)
  where status <> 'cancelled';

select indexname, indexdef from pg_indexes where indexname = 'stock_counts_store_date_key';
