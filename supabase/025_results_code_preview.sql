-- 025 (applied Nov 23, 2026): lets a signed-in buyer check a code before checkout.
-- Returns only whether it is valid/used and, for discount codes, the amount off.
create or replace function public.results_code_preview(p_code text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when c.code is null then jsonb_build_object('ok', false, 'reason', 'invalid')
    when c.kind = 'discount' and c.max_uses is not null and c.use_count >= c.max_uses then jsonb_build_object('ok', false, 'reason', 'used')
    else jsonb_build_object('ok', true, 'kind', c.kind, 'off_cents', coalesce(c.discount_cents, 0))
  end
  from (select 1) x
  left join public.results_codes c on c.code = upper(trim(p_code)) and c.active;
$$;
revoke all on function public.results_code_preview(text) from public, anon;
grant execute on function public.results_code_preview(text) to authenticated;
