// 댓글 서버(Supabase) 연결값. 비워 두면 댓글은 "미리보기"(내 브라우저에만 저장)로 동작.
// anon key는 공개돼도 되는 값입니다(권한은 comments.sql의 규칙으로 제한).
window.BLOG_CFG = {
  supabaseUrl: "",
  anonKey: ""
};
