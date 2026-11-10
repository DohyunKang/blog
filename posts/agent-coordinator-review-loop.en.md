Today I was running several AI work sessions at once, and spent most of it sorting out who manages whom and where a human actually needs to step in.

## One more in the middle

I'd split work on an automation app and a messenger app across several AI sessions, but every session reported straight to me, so I ended up directing traffic all day. So I made one session the coordinator. The working sessions report to it, it hands out the next task, and there's a manager above that. It looks like an org chart. The real point was that no session should report and then just sit there. When a job is done, the next one comes from above right away.

## Only ask what needs asking

If everything comes back to me for a decision, there's no point automating it. So I split work into three levels. Things that really need approval get collected in one place, and once approved they go straight back to the session. Things that don't need approval just go ahead. Things that shouldn't happen are blocked outright. It's keeping the human-in-the-loop part deliberately narrow. If the rule is vague, everything ends up as a question, so writing the rule down was the most important part.

## Someone else should review

Code review runs automatically too, but a session reviewing its own code knows why it wrote it that way and misses things. So each task gets a fresh session that reviews against the same fixed review guide. Like showing it to a coworker with no context. And if the same task fails a few times in a row, it stops there. Retrying forever and "fixing" the wrong places is scarier.

## Keep auto-merge narrow

We also decided which changes can be merged without a human once they pass review: copy, colors, spacing, docs. Things that are easy to undo if wrong. Database, login, payments, external APIs, shared components and new libraries always get a human look. The scope of automation depends on risk. Start narrow, widen it once trust builds. Widening is on hold for now.

It's a little funny how rules from human teams work almost unchanged on AI sessions.
