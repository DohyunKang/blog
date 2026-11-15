Spent a long time today on the structure of the automation app. I thought it would be a day of adding one more feature. It turned into a day of deciding what stays in code and what moves into settings.

## No separate code per account

The automation app got one more account to manage. The easy path is to drop a branch for it into the code, something like `if it's the new account, do this`. But then the code grows every time an account is added, and so do the places to fix.

So we kept one engine and moved everything that differs per account into settings in the DB. The topic, the reference material, even the greeting at the start and end. Adding an account becomes registering it in the app and filling in values, not editing code. Feels like the same idea as a multi-tenant service that doesn't fork its code per customer.

## Wrapping the outside in adapters

Each account also pulls material from a different place. Some topics fit code repositories, some fit paper search. If you write code around the first example, you rewrite it the moment the next topic shows up.

So we defined only a common shape, "fetch material," and attach one adapter per source that fits that shape. The engine doesn't know what's inside an adapter. It just looks at the topic and picks which one to use. Trying the official API first and falling back to reading the page also stays inside the adapter.

## Not hardcoding numbers

Thresholds like length used to sit in the code as constants. What changed is that only one cap, the one policy really requires, stays a constant. The rest gets measured from each account's own reference material and stored. If you pool several accounts and average them, you get a value that fits none of them.

Hardcoded values are convenient at first, then later nobody remembers why the number is what it is. A measured value keeps its source.

## Not switching until it's ready

This work happens on a separate branch. The running app switches over to it in one go once it's judged ready, and the original branch stays untouched. Mixing something half done into what's running makes it hard to tell what's actually broken.

I think I drew more boundaries than code today.
