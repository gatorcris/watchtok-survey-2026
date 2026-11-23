-- 024 (applied Nov 23, 2026): email footers show the business PO Box instead of
-- just the town. Same change made by hand in the Supabase Auth "Confirm sign up"
-- and "Reset password" templates (copies in supabase/email-templates/).
do $do$
declare d text; f text;
begin
  foreach f in array array['public.wt_email_html(text,text,text,text,text,text,boolean)','public.contact_optin_send_confirm()'] loop
    d := pg_get_functiondef(f::regprocedure);
    d := replace(d, 'Westford, Massachusetts', 'PO Box 1004, Westford, MA 01886');
    execute d;
  end loop;
end $do$;
