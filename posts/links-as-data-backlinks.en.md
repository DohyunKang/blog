Today I was making posts link to each other in a personal project, and learned it's better to keep links as separate data.

## Linking by hand never ends

When you write, other concepts keep showing up mid-explanation. If there's a post that explains one of them, you want to click through. At first I thought I'd just add links by hand in each post. But then every new post means digging through old ones to update them. Miss one and it stays missing.

So I changed the approach. One list in one place says "this term is explained in this post," and when a post is drawn on screen, the page finds those terms in the body and links them automatically. The post files stay as they are; only the connection info lives separately. Add one line for a new explainer post and the old posts get the link right away. It feels like the same idea as a **single source of truth**: don't write the same information in several places.

It needed a few rules. Linking every occurrence turns the page blue. So each post only links the first occurrence, and skips code, headings, text that's already a link, and the post that explains the term itself. Some groups of posts use the same word with a different meaning, so there's an option to skip those too.

## Links going backwards

There's the other direction too: under a concept post, show a list of "posts that mention this concept." That's called a **backlink**. The thing you see in wikis and note apps.

You can't build backlinks from one post. You have to scan every post to know who mentions you. Doing that on every visit is slow, so a script computes it once before publishing and saves the result to a file. Compute ahead, and the page just reads. The script also checks things: if the list points to a post that doesn't exist, or one alias belongs to two terms, it fails with an error. A machine filters it instead of a person eyeballing it.

## Fixed it, but the page looks the same

One more thing from tweaking the styles. Once a browser downloads a stylesheet or script, it keeps it and reuses it. So even after you upload a fix, people who already visited see the old page. The fix is to put a version value at the end of the file's address and change it on every update. A different address looks like a different file, so the browser fetches it fresh. This is called cache invalidation, or cache busting.

## When the official door closes

Last, something that came up while talking about moving to another writing platform. That platform apparently shut down its public API for posting. To automate posting there, you'd have to open a browser, log in like a person, and type into the fields. It breaks when the page layout changes even a little, and sometimes a human has to do the login. For automation, whether there's an official API matters more than whether the page looks nice. I also heard you can keep the original where it's easy to pile up automatically, and copy over picked posts when needed.

1. **Links as data** means keeping term-to-post pairs in one place and adding links automatically when the page renders.
2. **Backlinks** are a list of "posts that mention me." You have to scan everything, so they're usually precomputed.
3. **Cache busting** means changing a version in a file's address so the browser downloads the new file.
4. **Whether there's an official API** is the first thing to check for automation. Without one you're stuck with screen automation, and that breaks easily.

Even adding one link turned out to be a structure problem.
