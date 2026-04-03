-- ============================================================
-- StonkJournal — Migration 003: Backfill executions for existing trades
--
-- For each trade that has no executions yet:
--   1. Insert entry execution (buy for long, sell for short)
--   2. If closed/partial and exit_price exists, insert closing execution
--   3. Mark trade as has_executions = true
--
-- Safe to re-run: skips trades that already have executions.
-- ============================================================

do $$
declare
  t record;
  open_action  text;
  close_action text;
begin
  for t in
    select tr.*
    from public.trades tr
    where tr.has_executions is distinct from true
      and not exists (
        select 1 from public.trade_executions e where e.trade_id = tr.id
      )
  loop
    open_action  := case when t.direction = 'long' then 'buy'  else 'sell' end;
    close_action := case when t.direction = 'long' then 'sell' else 'buy'  end;

    -- Entry execution
    insert into public.trade_executions
      (trade_id, user_id, action, datetime, quantity, price, fee)
    values
      (t.id, t.user_id, open_action, t.entry_date, t.quantity, t.entry_price, coalesce(t.fees, 0));

    -- Closing execution (only when exit price and date are present and trade is not open)
    if t.exit_price is not null
       and t.exit_date is not null
       and t.status in ('closed', 'partial')
    then
      insert into public.trade_executions
        (trade_id, user_id, action, datetime, quantity, price, fee)
      values
        (t.id, t.user_id, close_action, t.exit_date, t.quantity, t.exit_price, 0);
    end if;

    -- Mark trade as execution-driven
    update public.trades
    set has_executions = true
    where id = t.id;

  end loop;
end;
$$;
