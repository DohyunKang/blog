Today, while logging a terminal tool back in for a personal project, I found out logging in has more layers than I thought.

## Logging in with a code you type into the browser

I wanted to add one more AI tool for reviews, but it wasn't logged in, so it couldn't do anything. A terminal program can't pop up a login window. That's what the device code flow is for. The terminal shows a short code, and I enter it in a browser and approve. Meanwhile the terminal keeps asking the server "approved yet?", and once it is, it picks up a token. Same thing as logging into a TV app by typing a code on your phone. Apparently it's one of the flows inside OAuth.

The password never touches the terminal. It only gets a token. That seems like the nice part.

## It attached to the wrong account

After logging in, it turned out to be attached to a different account, not mine. The reason was simple. The browser where I typed the code was already logged in as someone else. In the device code flow, whoever is logged into the browser right now does the approving, so the browser's account comes along with it. On a shared PC this happens easily.

The fix went like this. First log out to delete the saved token. A token you've received is saved to a file and reused, so if you don't delete it, the old account can stick around even after logging in again. Then switch the browser to my account, and only then enter the code. Finally, run the command that shows which account it's attached to.

## Because of one colon

When I typed the logout command, I added a colon and an email after it. It didn't log out; a new chat screen of the program opened instead. A terminal program only recognizes a subcommand (login, logout and so on) when the first word matches exactly. If even one character is attached, it treats the whole thing as "a first question to send". Command-line arguments are read more literally than you'd think.

1. **Device code flow** is a login where the terminal shows a code and you approve it in a browser. The terminal only gets a token.
2. **Which account it attaches to** is decided by the browser where you enter the code. On a shared PC, check it first.
3. **Logging out** means deleting the saved token. To switch accounts, start there.
4. **Subcommands** have to match exactly. Anything attached changes the meaning.

One login, three places to check.
