-- project_tech non ha una colonna id: l'audit generico non si applica (la tabella ha updated_by/updated_at)
drop trigger if exists project_tech_audit on public.project_tech;
