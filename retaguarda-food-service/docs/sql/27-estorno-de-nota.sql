-- 27: Estorno de nota fiscal recebida (só administrador da Matriz).
-- Estornar = tirar do estoque a entrada da nota e devolver a nota para PENDENTE, para ser corrigida e receber de novo.
-- * public.reverse_invoice(p_invoice_id, p_reason): confere is_matrix_admin, exige status 'received' e motivo,
--   bloqueia se a entrada já está dentro de um fechamento de CMV salvo (cmv_closings), guarda os movimentos
--   apagados em invoice_reversals (histórico com quem, quando, motivo e cópia dos movimentos) e reabre a nota.
-- * post_invoice_receipt passa a aceitar received -> pending SOMENTE quando chamado por essa função
--   (flag de transação mft.invoice_reversal). Fora dela, a regra continua: nota recebida não reabre.
-- Reversão: drop function public.reverse_invoice(uuid,text); drop table public.invoice_reversals;
--           recriar mft_private.post_invoice_receipt sem o bloco do estorno (versão anterior abaixo, comentada).
begin;

create table if not exists public.invoice_reversals (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  store_id text not null,
  invoice_number text,
  reason text not null check (length(btrim(reason)) >= 3),
  reversed_by uuid,
  reversed_at timestamptz not null default now(),
  received_at_before timestamptz,
  received_by_before uuid,
  movements jsonb not null default '[]'::jsonb,
  total_value numeric(14,2)
);
create index if not exists invoice_reversals_invoice_idx on public.invoice_reversals (invoice_id);
create index if not exists invoice_reversals_store_idx on public.invoice_reversals (store_id, reversed_at desc);
alter table public.invoice_reversals enable row level security;
drop policy if exists invoice_reversals_read on public.invoice_reversals;
create policy invoice_reversals_read on public.invoice_reversals for select to authenticated
  using (mft_private.is_matrix_admin() or mft_private.has_tab_access(store_id,'notes',false));
grant select on public.invoice_reversals to authenticated;
-- sem policy de insert/update/delete: só a função (security definer) grava.

-- Antes: if old.status = 'received' and new.status <> 'received' then raise exception 'Received invoices cannot be reopened'; end if;
create or replace function mft_private.post_invoice_receipt() returns trigger
language plpgsql security definer set search_path to '' as $function$
declare line record;
begin
  if old.status = 'received' and new.status = 'pending'
     and coalesce(current_setting('mft.invoice_reversal', true), '') = new.id::text then
    return new; -- estorno autorizado por public.reverse_invoice
  end if;
  if old.status <> 'pending' and new.status <> old.status then raise exception 'Only pending invoices can change status'; end if;
  if old.status = 'received' and new.status <> 'received' then raise exception 'Received invoices cannot be reopened'; end if;
  if old.status = 'pending' and new.status = 'received' then
    if not mft_private.has_tab_access(new.store_id,'notes',true) then raise exception 'Not authorized to receive invoices'; end if;
    for line in select id,item_id,quantity,unit_cost from public.invoice_items where invoice_id = new.id loop
      insert into public.stock_movements(store_id,item_id,quantity_delta,unit_cost,movement_type,source_type,source_id,source_line_id,occurred_at)
      values(new.store_id,line.item_id,line.quantity,line.unit_cost,'invoice_receipt','invoice',new.id,line.id,now())
      on conflict (store_id,source_type,source_line_id,movement_type) do nothing;
    end loop;
    new.received_at := now(); new.received_by := (select auth.uid());
  end if;
  return new;
end; $function$;

create or replace function public.reverse_invoice(p_invoice_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare inv public.invoices; mv jsonb; n int; val numeric; cl record;
begin
  if not mft_private.is_matrix_admin() then raise exception 'Somente administradores da Matriz podem estornar notas.'; end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'Informe o motivo do estorno.'; end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Nota não encontrada.'; end if;
  if inv.status <> 'received' then raise exception 'Só é possível estornar nota recebida (situação atual: %).', inv.status; end if;

  -- Não estorna entrada que já compõe um fechamento de CMV salvo.
  select c.id, c.start_date, c.end_date into cl
    from public.cmv_closings c
    join public.stock_counts s on s.id = c.start_count_id
    join public.stock_counts e on e.id = c.end_count_id
   where c.store_id = inv.store_id and inv.received_at > s.finalized_at and inv.received_at <= e.finalized_at
   limit 1;
  if found then
    raise exception 'A entrada desta nota está no fechamento de CMV de % a %. Exclua o fechamento antes de estornar.', cl.start_date, cl.end_date;
  end if;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb), count(*), coalesce(sum(m.quantity_delta*m.unit_cost),0)
    into mv, n, val
    from public.stock_movements m where m.source_type = 'invoice' and m.source_id = inv.id;

  insert into public.invoice_reversals (invoice_id, store_id, invoice_number, reason, reversed_by, received_at_before, received_by_before, movements, total_value)
  values (inv.id, inv.store_id, inv.invoice_number, btrim(p_reason), auth.uid(), inv.received_at, inv.received_by, mv, round(val,2));

  delete from public.stock_movements where source_type = 'invoice' and source_id = inv.id;

  perform set_config('mft.invoice_reversal', inv.id::text, true);
  update public.invoices set status = 'pending', received_at = null, received_by = null where id = inv.id;
  perform set_config('mft.invoice_reversal', '', true);

  begin -- log geral; se o formato do audit_events recusar, o histórico em invoice_reversals já basta
    insert into public.audit_events (store_id, user_id, action, entity_type, entity_id, details)
    values (inv.store_id, auth.uid(), 'reverse', 'invoices', inv.id,
            jsonb_build_object('numero', inv.invoice_number, 'motivo', btrim(p_reason), 'movimentos', n, 'valor', round(val,2)));
  exception when others then null;
  end;

  return jsonb_build_object('invoice_id', inv.id, 'movimentos', n, 'valor', round(val,2));
end; $function$;

revoke all on function public.reverse_invoice(uuid, text) from public, anon;
grant execute on function public.reverse_invoice(uuid, text) to authenticated;

select (select count(*) from information_schema.tables where table_name='invoice_reversals') tabela,
       (select count(*) from pg_proc where proname='reverse_invoice') funcao,
       position('mft.invoice_reversal' in pg_get_functiondef('mft_private.post_invoice_receipt()'::regprocedure)) > 0 gatilho_ok;
commit;
