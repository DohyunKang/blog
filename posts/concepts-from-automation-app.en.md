While I was building an automation app, I kept leaving a concept or two at the end of conversations. I'd already made a series for them, but the only post in it was the one about [running several sessions](#/post/agent-coordinator-review-loop), so I'm gathering the rest here in short lines. I'm leaving them close to the wording I used at the time, not spelling everything out like a glossary.

## Backend, config, safety

1. **Graceful degradation** is finishing the work with a fallback when some of the resources are missing. If one image doesn't get made, you fill that spot with a CSS background and still finish the video.
2. **Idempotency** means doing the same job more than once leaves you with the same result as doing it once. Failures that need a judgment come out the same no matter how many times you rerun them, so automatic retries don't help. Those should go to a human. It's close to the problem of seeing the same message more than once in a queue, which I wrote a bit more about in [async jobs and queues](#/post/be-async-queue).
3. **Allowlist enforcement** is the gap between having a list and actually blocking what's not on it. If you don't enforce it, things outside the list still get through. "The setting exists" and "the setting is applied" have to be checked separately.
4. **OAuth scopes and least privilege** mean putting only the permissions you need on a login token. If you ask for write access up front for something that only needs to read, a mistake or an incident gets a wider reach. Write access is safer when you request it only for the feature that actually needs it.
5. **Reloading environment variables** has a catch. You can change the config file, and still see the old value if the app reads it only once at startup. The same thing happens when the place you edit and the place the running process reads are not the same.
6. **Defense in depth** means not trusting a single layer of limits. Even if a budget shows up on the screen, the server should still cap the count and the amount.
7. **Budget guard** is a name for that server-side cap.
8. **Dry-run** is walking the same path once without actually running it or charging anything.
9. **YAML** is a config format that's easy for people to read, with indentation holding groups of fields together.
10. **JSON schema** is a shape you fix in advance for a program's answer, so missing or wrong fields get caught automatically. Receiving answers against a schema is also in [structured output](#/post/ai-structured-output).

## Front end, realtime, input

1. **Accessibility tree** is the list an operating system keeps of UI elements — buttons, fields, and so on — for screen readers. Reading that list instead of looking at the screen as an image makes it faster and more accurate to find an element. I wrote the basics of web accessibility in [frontend accessibility](#/post/fe-accessibility).
2. **Ghost-text autocomplete** is when a faint suggestion appears in an input. Tab fills it in, the arrows cycle, Esc hides it. Submitting should still happen only when a person hits Enter.
3. **SSE (Server-Sent Events)** is the server pushing changes to the client.
4. **Polling** is the client asking "how's it going?" on a timer. Screens that change often, like a progress bar, usually feel smoother with a push. If the connection drops, polling is a decent safety net.

## Scheduling and monitoring

1. **Critical path** is the longest chain among the tasks that have to wait on each other. That chain sets when the whole thing finishes. Speeding up work off to the side doesn't shorten the total; you have to shorten work on the chain.
2. **Heartbeat monitoring** is a regular check for "are you still alive?". If there's no response, you treat it as stalled, then push the same job again or tell a person. The overnight loop in [when an agent stalls, retry or hand it to a human](#/post/agent-overnight-retry-loop) leans on this a lot.
3. **Gate** is a checkpoint you have to pass before the next stage.
4. **Rubric** is a scoring sheet with a pass or fail for each item, so anyone looking uses the same standard.

## Sound and video craft

1. **Fundamental frequency (F0)** is the basic pitch of a voice, measured in hertz. If two voices are far apart, they probably won't sound like the same person.
2. **Easing** is the curve that says how a motion speeds up at the start and slows down at the end. The same one-second move feels more natural if it eases to a stop.
3. **Cubic Bézier** is writing that curve as four numbers.
4. **Kinetic typography** is moving type so the motion itself carries meaning and rhythm.
5. **Effect spec** is a table that turns a feeling like "a bit more staccato" into numbers — frame counts, easing names. If you don't turn the feeling into numbers, it's hard to do the same thing again later.
6. **"Style only"** means you take color, timing, and camera numbers from a reference, and you don't put the reference's pictures, footage, or music into your own work.
7. **Technical checks** are the ones you can measure, like a cut-off sound or loudness.
8. **Aesthetic checks** use a rubric: is it flat, can you read the type. If you mix both into one score, it's hard to see what actually failed.
9. **BPM** is how many beats a piece of music has in a minute, and the gap between beats in seconds is 60 divided by the BPM.
10. **Sync** is lining up type or cuts to that gap.
11. **Offset** is how you nudge the music forward or back. You usually can't move the speech, so you use this value to line up the beat.
12. **Stayed to watch** is the share of people who watch past the first few seconds of a short-form video.
13. **Swipe-away** is the share who swipe away. Together they tell you how well the opening holds.
14. **Average percentage viewed (APV)** is how much of the runtime people watch on average.
15. **A/B test** is how you compare two versions.
16. **ABBA order** is alternating the versions so a day-of-week effect doesn't pile onto one side.
17. **Blind comparison** is hiding which one is new. Expectations leak less into the score.
18. **Safe zone** is the inner rectangle where you keep important type, because buttons and titles on a short-form screen cover the edges.
19. **Motif** is a visual element that keeps showing up when the scene changes. With one, the scenes feel like they belong together; without one, it can feel like flipping slides.
20. **Frame** is one still in the stack that makes a second of video. Writing time as whole frames makes it easier to lock cuts to the beat.
21. **Camera drift** is the camera still creeping very slowly after a cut has ended. If it stops completely, the shot can look like a freeze-frame.

Looking at them together, they sound like app stories, but most of them were just CS and video basics I already knew, showing up again in real work.
