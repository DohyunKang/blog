-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 한 번.
-- 로그인 없는 익명 댓글(디시 방식): 닉네임 + 비밀번호 + 내용. 비밀번호는 해시로만 저장, 삭제는 비밀번호가 맞아야 가능.

create extension if not exists pgcrypto;

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  slug text not null check (char_length(slug) between 1 and 80),
  nick text not null check (char_length(nick) between 1 and 20),
  body text not null check (char_length(body) between 1 and 1000),
  pw_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_slug_idx on public.comments (slug, created_at);

alter table public.comments enable row level security;
revoke all on public.comments from anon, authenticated;   -- 테이블 직접 접근 금지(비밀번호 해시 보호)

-- 읽기 전용 공개 뷰(해시 제외)
create or replace view public.comments_public as
  select id, slug, nick, body, created_at from public.comments;
grant select on public.comments_public to anon, authenticated;

-- 댓글 쓰기: 길이 검사 + 도배 방지(같은 글에 1분에 8개까지)
create or replace function public.add_comment(p_slug text, p_nick text, p_pw text, p_body text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if char_length(trim(p_nick)) not between 1 and 20 or char_length(trim(p_body)) not between 1 and 1000
     or char_length(p_pw) not between 2 and 40 then
    raise exception 'invalid input';
  end if;
  if (select count(*) from comments where slug = p_slug and created_at > now() - interval '1 minute') >= 8 then
    raise exception 'too many comments';
  end if;
  insert into comments (slug, nick, body, pw_hash)
  values (p_slug, trim(p_nick), trim(p_body), crypt(p_pw, gen_salt('bf')));
end $$;

-- 댓글 삭제: 비밀번호가 맞을 때만 (성공 true / 실패 false)
create or replace function public.delete_comment(p_id bigint, p_pw text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  delete from comments where id = p_id and pw_hash = crypt(p_pw, pw_hash);
  get diagnostics n = row_count;
  return n > 0;
end $$;

grant execute on function public.add_comment(text,text,text,text) to anon, authenticated;
grant execute on function public.delete_comment(bigint,text) to anon, authenticated;
