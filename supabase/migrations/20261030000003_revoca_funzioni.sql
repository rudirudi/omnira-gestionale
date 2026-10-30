-- Le funzioni dei trigger non devono essere richiamabili via API (/rest/v1/rpc).
revoke execute on function
  public.audit_row(), public.handle_new_user(), public.protect_profile_fields(),
  public.notify_comment(), public.notify_task_assigned(), public.projects_default_phases(),
  public.set_updated_at(), public.leads_set_closed_at(), public.projects_before_write(), public.tasks_before_write()
from public, anon, authenticated;

-- Le funzioni di autorizzazione servono alle policy RLS degli utenti autenticati: niente accesso anonimo.
revoke execute on function public.current_app_role(), public.is_staff(), public.has_role(public.app_role[]) from public, anon;
grant execute on function public.current_app_role(), public.is_staff(), public.has_role(public.app_role[]) to authenticated;
