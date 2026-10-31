-- Disposable test records exist only inside this transaction; always rolled back.
begin;
insert into auth.users(id) select ('eade0000-0000-4000-8000-00000000000'||n)::uuid from generate_series(1,6)n;
insert into public.aidx_profiles(id,role,team_id,student_id,display_name) values
 ('eade0000-0000-4000-8000-000000000001','student','A1','99999001','권한시험1'),
 ('eade0000-0000-4000-8000-000000000002','student','B1','99999002','권한시험2'),
 ('eade0000-0000-4000-8000-000000000003','professor',null,null,'권한시험교수'),
 ('eade0000-0000-4000-8000-000000000004','student','A1','99999004','권한시험4'),
 ('eade0000-0000-4000-8000-000000000005','student','A1','99999005','권한시험5');
do $$begin
 begin
  insert into public.aidx_profiles values('eade0000-0000-4000-8000-000000000006','student','A1','99999006','정원초과');
  raise exception 'TEST: fourth member accepted';
 exception when others then if sqlerrm not like '%TEAM_FULL%' then raise;end if;end;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','eade0000-0000-4000-8000-000000000001',true);
select public.aidx_submit(1,'시험','초기 결과','','','[]',0);
do $$begin
 if (select count(*) from public.aidx_teams)<>1 then raise exception 'TEST: team leak';end if;
 if (select count(*) from public.aidx_submission_versions)<>1 then raise exception 'TEST: snapshot missing';end if;
 begin
  perform public.aidx_submit(1,'덮어쓰기','오래된 버전','','','[]',0);
  raise exception 'TEST: stale write accepted';
 exception when serialization_failure then null;end;
 begin
  update public.aidx_profiles set role='professor' where id=auth.uid();
  raise exception 'TEST: role escalation';
 exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','eade0000-0000-4000-8000-000000000002',true);
do $$begin
 if exists(select 1 from public.aidx_submissions) or exists(select 1 from public.aidx_submission_versions) then raise exception 'TEST: cross-team leak';end if;
 begin
  insert into public.aidx_submissions(team_id,week,title,summary,submitted_by) values('A1',2,'타 조','차단',auth.uid());
  raise exception 'TEST: cross-team write';
 exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','eade0000-0000-4000-8000-000000000003',true);
do $$begin if (select count(*) from public.aidx_teams)<>9 then raise exception 'TEST: professor access';end if;end$$;
insert into public.aidx_feedback(submission_id,submission_revision,professor_id,improvements) select id,revision,auth.uid(),'검토 시험' from public.aidx_submissions;
select set_config('request.jwt.claim.sub','eade0000-0000-4000-8000-000000000001',true);
select public.aidx_submit(1,'시험 수정','새 결과','','','[]',1);
do $$begin
 if (select count(*) from public.aidx_submission_versions)<>2 then raise exception 'TEST: revisions missing';end if;
 if (select submission_revision from public.aidx_feedback limit 1)<>1 then raise exception 'TEST: feedback lost its revision';end if;
end$$;
set local role anon;
do $$begin
 begin perform 1 from public.aidx_submissions;raise exception 'TEST: anonymous access';exception when insufficient_privilege then null;end;
end$$;
rollback;
select 'RLS, team isolation, member limits, revision conflict and feedback history passed' as test_result;

