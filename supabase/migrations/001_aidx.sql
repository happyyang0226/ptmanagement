begin;
create table if not exists public.aidx_teams (
 id text primary key check (id ~ '^(A[1-4]|B[1-5])$'),
 class_name text not null check(class_name in ('A','B')),
 name text not null check(length(name) between 1 and 60), disease text not null default '' check(length(disease)<=100)
);
insert into public.aidx_teams(id,class_name,name) values
 ('A1','A','A반 1조'),('A2','A','A반 2조'),('A3','A','A반 3조'),('A4','A','A반 4조'),
 ('B1','B','B반 1조'),('B2','B','B반 2조'),('B3','B','B반 3조'),('B4','B','B반 4조'),('B5','B','B반 5조') on conflict do nothing;
create table if not exists public.aidx_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('student','professor')),
 team_id text references public.aidx_teams(id), student_id text unique,
 display_name text not null check(length(display_name) between 1 and 60),
 check((role='professor' and team_id is null and student_id is null) or (role='student' and team_id is not null and student_id is not null and student_id ~ '^\d{5,15}$'))
);
create table if not exists public.aidx_weeks (
 number integer primary key check(number between 1 and 15),title text not null check(length(title) between 1 and 150),
 instructions text not null default '' check(length(instructions)<=10000),deadline timestamptz
);
insert into public.aidx_weeks(number,title,instructions)
 select n, (array['팀 구성과 프로젝트 계획','근골격계 질환 선정','관련 해부학 정리','질환의 발생 기전','증상과 기능 문제 탐색','근거 자료 검색','AI 활용 과정 점검','중간 결과 정리','평가와 측정 이해','중재 근거 탐색','환자 교육 자료 기획','교육 자료 제작','동료 검토와 개선','최종 발표 준비','최종 결과와 성찰'])[n],
 '이번 주 진행 내용, 확인한 근거, AI 활용 방법과 검증 과정, 팀원별 기여를 정리해 제출하세요. 이 안내는 교수님이 수정할 수 있습니다.'
 from generate_series(1,15) n on conflict do nothing;
create table if not exists public.aidx_submissions (
 id uuid primary key default gen_random_uuid(), team_id text not null references public.aidx_teams(id),
 week integer not null references public.aidx_weeks(number), title text not null check(length(title) between 1 and 200),
 summary text not null check(length(summary) between 1 and 20000),reflection text not null default '' check(length(reflection)<=10000),
 link text not null default '' check(link='' or (length(link)<=2000 and link ~ '^https?://')),
 attachments jsonb not null default '[]' check(jsonb_typeof(attachments)='array' and jsonb_array_length(attachments)<=5),
 submitted_by uuid not null references auth.users(id), revision integer not null default 1,
 created_at timestamptz not null default now(),submitted_at timestamptz not null default now(),is_late boolean not null default false,
 unique(team_id,week)
);
create table if not exists public.aidx_submission_versions (
 submission_id uuid not null references public.aidx_submissions(id), revision integer not null,
 team_id text not null references public.aidx_teams(id),week integer not null references public.aidx_weeks(number),
 snapshot jsonb not null,created_at timestamptz not null default now(),primary key(submission_id,revision)
);
create table if not exists public.aidx_feedback (
 id uuid primary key default gen_random_uuid(),submission_id uuid not null references public.aidx_submissions(id),
 submission_revision integer not null,professor_id uuid not null references auth.users(id),
 strengths text not null default '' check(length(strengths)<=10000),improvements text not null check(length(improvements) between 1 and 10000),
 next_steps text not null default '' check(length(next_steps)<=10000),created_at timestamptz not null default now(),
 foreign key(submission_id,submission_revision) references public.aidx_submission_versions(submission_id,revision)
);
create or replace function public.aidx_role() returns text language sql stable security definer set search_path=public,pg_temp as $$ select role from public.aidx_profiles where id=auth.uid() $$;
create or replace function public.aidx_team() returns text language sql stable security definer set search_path=public,pg_temp as $$ select team_id from public.aidx_profiles where id=auth.uid() $$;
revoke all on function public.aidx_role(),public.aidx_team() from public,anon;
grant execute on function public.aidx_role(),public.aidx_team() to authenticated;
create or replace function public.aidx_limit_members() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.role='student' then
  perform 1 from public.aidx_teams where id=new.team_id for update;
  if (select count(*) from public.aidx_profiles where team_id=new.team_id and role='student' and id<>new.id)>=3 then raise exception 'TEAM_FULL'; end if;
 end if;return new;
end $$;
drop trigger if exists aidx_member_limit on public.aidx_profiles;
create trigger aidx_member_limit before insert or update on public.aidx_profiles for each row execute function public.aidx_limit_members();
create or replace function public.aidx_before_submission() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare due timestamptz; entry jsonb;
begin
 if public.aidx_role() is distinct from 'student' or new.team_id is distinct from public.aidx_team() then raise exception 'Not authorized' using errcode='42501'; end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.team_id<>old.team_id or new.week<>old.week then raise exception 'Immutable submission identity'; end if;
  new.revision=old.revision+1;new.created_at=old.created_at;
 else new.revision=1;new.created_at=now();end if;
 new.submitted_by=auth.uid();new.submitted_at=now();
 select deadline into due from public.aidx_weeks where number=new.week;
 new.is_late=due is not null and new.submitted_at>due;
 for entry in select * from jsonb_array_elements(new.attachments) loop
  if coalesce(entry->>'path','') !~ ('^'||new.team_id||'/'||new.week||'/[a-f0-9-]{36}\.(pdf|docx|pptx|xlsx|png|jpg|jpeg|hwp|hwpx|zip|txt)$') or coalesce(length(entry->>'name'),0) not between 1 and 200 or coalesce((entry->>'size')::bigint,0) not between 1 and 10485760 then raise exception 'Invalid attachment';end if;
 end loop;return new;
end $$;
drop trigger if exists aidx_submission_check on public.aidx_submissions;
create trigger aidx_submission_check before insert or update on public.aidx_submissions for each row execute function public.aidx_before_submission();
create or replace function public.aidx_snapshot() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin insert into public.aidx_submission_versions(submission_id,revision,team_id,week,snapshot) values(new.id,new.revision,new.team_id,new.week,to_jsonb(new));return new;end $$;
drop trigger if exists aidx_submission_snapshot on public.aidx_submissions;
create trigger aidx_submission_snapshot after insert or update on public.aidx_submissions for each row execute function public.aidx_snapshot();
create or replace function public.aidx_feedback_check() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare current_revision integer;
begin
 if public.aidx_role() is distinct from 'professor' then raise exception 'Not authorized' using errcode='42501';end if;
 select revision into current_revision from public.aidx_submissions where id=new.submission_id for update;
 if current_revision is distinct from new.submission_revision then raise exception 'STALE_REVISION' using errcode='40001';end if;
 new.professor_id=auth.uid();new.created_at=now();return new;
end $$;
drop trigger if exists aidx_feedback_guard on public.aidx_feedback;
create trigger aidx_feedback_guard before insert on public.aidx_feedback for each row execute function public.aidx_feedback_check();

alter table public.aidx_teams enable row level security;
alter table public.aidx_profiles enable row level security;
alter table public.aidx_weeks enable row level security;
alter table public.aidx_submissions enable row level security;
alter table public.aidx_submission_versions enable row level security;
alter table public.aidx_feedback enable row level security;
revoke all on public.aidx_teams,public.aidx_profiles,public.aidx_weeks,public.aidx_submissions,public.aidx_submission_versions,public.aidx_feedback from anon,authenticated;
grant select on public.aidx_teams,public.aidx_profiles,public.aidx_weeks,public.aidx_submissions,public.aidx_submission_versions,public.aidx_feedback to authenticated;
grant update on public.aidx_teams,public.aidx_weeks to authenticated;
grant insert,update on public.aidx_submissions to authenticated;
grant insert on public.aidx_feedback to authenticated;
grant all on public.aidx_teams,public.aidx_profiles,public.aidx_weeks,public.aidx_submissions,public.aidx_submission_versions,public.aidx_feedback to service_role;
create policy aidx_teams_read on public.aidx_teams for select to authenticated using(public.aidx_role()='professor' or id=public.aidx_team());
create policy aidx_teams_update on public.aidx_teams for update to authenticated using(public.aidx_role()='professor') with check(public.aidx_role()='professor');
create policy aidx_profiles_read on public.aidx_profiles for select to authenticated using(id=auth.uid() or public.aidx_role()='professor' or team_id=public.aidx_team());
create policy aidx_weeks_read on public.aidx_weeks for select to authenticated using(public.aidx_role() in ('professor','student'));
create policy aidx_weeks_update on public.aidx_weeks for update to authenticated using(public.aidx_role()='professor') with check(public.aidx_role()='professor');
create policy aidx_submissions_read on public.aidx_submissions for select to authenticated using(public.aidx_role()='professor' or team_id=public.aidx_team());
create policy aidx_submissions_insert on public.aidx_submissions for insert to authenticated with check(public.aidx_role()='student' and team_id=public.aidx_team() and submitted_by=auth.uid());
create policy aidx_submissions_update on public.aidx_submissions for update to authenticated using(public.aidx_role()='student' and team_id=public.aidx_team()) with check(team_id=public.aidx_team() and submitted_by=auth.uid());
create policy aidx_versions_read on public.aidx_submission_versions for select to authenticated using(public.aidx_role()='professor' or team_id=public.aidx_team());
create policy aidx_feedback_read on public.aidx_feedback for select to authenticated using(public.aidx_role()='professor' or exists(select 1 from public.aidx_submissions s where s.id=submission_id and s.team_id=public.aidx_team()));
create policy aidx_feedback_insert on public.aidx_feedback for insert to authenticated with check(public.aidx_role()='professor' and professor_id=auth.uid());

create or replace function public.aidx_submit(p_week integer,p_title text,p_summary text,p_reflection text,p_link text,p_attachments jsonb,p_expected_revision integer)
returns public.aidx_submissions language plpgsql security invoker set search_path=public,pg_temp as $$
declare existing public.aidx_submissions;result public.aidx_submissions;
begin
 if public.aidx_role() is distinct from 'student' then raise exception 'Not authorized' using errcode='42501';end if;
 select * into existing from public.aidx_submissions where team_id=public.aidx_team() and week=p_week for update;
 if (existing.id is null and p_expected_revision<>0) or (existing.id is not null and existing.revision<>p_expected_revision) then raise exception 'STALE_REVISION' using errcode='40001';end if;
 if existing.id is null then
  insert into public.aidx_submissions(team_id,week,title,summary,reflection,link,attachments,submitted_by) values(public.aidx_team(),p_week,p_title,p_summary,p_reflection,p_link,p_attachments,auth.uid()) returning * into result;
 else
  update public.aidx_submissions set title=p_title,summary=p_summary,reflection=p_reflection,link=p_link,attachments=p_attachments,submitted_by=auth.uid() where id=existing.id returning * into result;
 end if;return result;
end $$;
revoke all on function public.aidx_submit(integer,text,text,text,text,jsonb,integer) from public,anon;
grant execute on function public.aidx_submit(integer,text,text,text,text,jsonb,integer) to authenticated;
revoke all on function public.aidx_limit_members(),public.aidx_before_submission(),public.aidx_snapshot(),public.aidx_feedback_check() from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit) values('aidx-submissions','aidx-submissions',false,10485760) on conflict(id) do nothing;
create policy aidx_files_read on storage.objects for select to authenticated using(bucket_id='aidx-submissions' and (public.aidx_role()='professor' or (storage.foldername(name))[1]=public.aidx_team()));
create policy aidx_files_insert on storage.objects for insert to authenticated with check(bucket_id='aidx-submissions' and public.aidx_role()='student' and (storage.foldername(name))[1]=public.aidx_team() and name ~ '^(A[1-4]|B[1-5])/(1[0-5]|[1-9])/[a-f0-9-]{36}\.(pdf|docx|pptx|xlsx|png|jpg|jpeg|hwp|hwpx|zip|txt)$');
commit;

