-- 019_results_checkout_grants.sql
-- The checkout Edge Functions use the service_role key. This project does not grant table
-- access to service_role by default, so give it exactly what the two functions need.
-- Run once in the SQL Editor after 018. Safe to re-run. Browsers (anon/authenticated) get nothing new.

grant select on public.results_members to service_role;
grant select on public.results_codes to service_role;
grant select, insert, update on public.results_orders to service_role;
grant select, insert on public.results_stripe_events to service_role;
