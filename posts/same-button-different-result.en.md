I worked on the automation app again today. Nothing broke badly, but three small things didn't line up, and each one turned out to have a name.

## Same button, different result

There was a flow where you get a judgment first, then start the next step from it. But pressing the button a second time didn't move on. It just judged again. The cause was the cache key. The app checked "have I already judged this input?" with a key built by joining a few input values, and the text in the input box had drifted slightly from what it was at judgment time. Same topic to a person, a different request to the key.

With caching or memoization, what goes into the key seems to be almost the whole game. Put in too much and you redo the same work every time. Put in too little and you hand back an old result for a different request. This time we added a separate "continue with what's on screen" path that skips the key check.

## Which one goes first

The speech-to-text step could use either a local model or an external API. I thought local was the default, but the code was actually calling the API first and falling back to local on failure. The docs and the code were saying different things.

With a fallback, the order is the policy. Local first costs nothing and keeps data in-house, but can be slow. API first is fast, but costs money. Which is right depends on the situation, and once you decide, you have to actually check that the code matches what's written down. This is exactly where a single source of truth quietly becomes two.

## Once a day, by what

We also changed the automatic run cycle. At first it was "every day, counted from the first run." That ties the anchor to the first run, so if one run is late, everything after it slides. We switched to "once a day after a fixed time," hooked to the calendar like cron.

Interval-based and calendar-based schedules look alike, but they handle drift differently. Calendar-based also needs a time zone. If the server clock and mine disagree, "midnight" lands somewhere strange.

Each fix was a few lines of code. Finding them took longer.
