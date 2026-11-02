Git is not so much a tool for accumulating file changes as it is a way of chaining snapshots called commits, where branches are merely labels pointing to one of those commits. Once you understand this, merge, rebase, and conflicts become clear in a single picture.

## What are commits and branches?

A commit is a snapshot of the entire project at that moment and holds a link to the immediately preceding commit (the parent). Each commit has a hash (a long hexadecimal string) attached to it. A branch is a pointer to one of these commits. Creating a new branch is not about copying files, but simply attaching another label, which happens instantly. `HEAD` is a pointer indicating which branch (commit) you are currently on.

There are three areas in the workflow:

| Area | Meaning | Command to move |
|---|---|---|
| Working Directory | Where you edit files now | |
| Staging (Index) | Where changes intended for the next commit are collected | `git add` |
| Repository | Confirmed records as commits | `git commit` |

The reason `git add` is separate is to allow selecting only some of the edited items to be committed.

This type of tool is called version control. It records who changed what and when, allowing you to revert changes. [Learn more → Introduction to Software Engineering](#/post/cs-sw-engineering)

## Merge

Merging two branches is a merge operation. There are two cases, based on the Pro Git explanation:

- **fast-forward**: If the branch being merged lies directly on the extension line of the current branch, there is nothing to merge; only the pointer moves forward. No new commit is created.
- **3-way merge**: If the two branches diverged from a common ancestor and each has its own commits, a new snapshot is created using the two endpoints and the common ancestor (three snapshots), resulting in a merge commit with two parents.

## Conflict

If both branches modify the same part of the same file differently, Git cannot decide and stops. The merge commit is not yet created, and `git status` shows `both modified`. Markers are inserted into the file.

```
<<<<<<< HEAD
main line
=======
feature line
>>>>>>> feature
```

The top section (`<<<<<<<`~`=======`) represents the current branch, and the bottom section represents the incoming branch. Resolution involves four steps:

1. Open the file, choose one side, mix them, or rewrite entirely, then remove the three marker lines.
2. Inform Git that the conflict is resolved using `git add <file>`.
3. Verify with `git status`.
4. Complete the merge with `git commit`.

Initially, it seemed easy to make the mistake of committing without removing the markers. The fear of conflicts stems more from not knowing where to look rather than difficulty; once you know what the markers look like, you've solved half the problem.

## Rebase

Rebase places your branch's commits on top of another branch's tip. According to Pro Git, it finds the common ancestor, saves the changes (diff) for each of your commits, moves your branch to the target branch's end, and reapplies the changes sequentially. The resulting file content is identical to a merge, but the commit history looks different. It becomes a single line without merge commits.

I tested both methods directly in small repositories where `main` and `feature` edited the same line. Merge resulted in this branching and merging shape:

```
*   a53bebb merge
|\
| * d6ac9dc feat
* | ffb502f main change
|/
* f1a4288 init
```

Doing the same situation with rebase, resolving conflicts, and running `git rebase --continue` resulted in a single line like this:

```
* 84091ca feat
* ffb502f main change
* f1a4288 init
```

Notice that the `feat` hash changed from `d6ac9dc` to `84091ca`. Rebase does not move commits; it creates new commits with the same content and discards the old ones. This fact leads to the rule below.

<details>
<summary>Detailed explanation: commands in the above exercise</summary>

I created a scenario by running `git init` in a temporary folder, committing one line to `a.txt`, adding one more line from the `feature` branch, and adding another different line to the same file from `main`. Running `git merge feature` stopped with `CONFLICT (content): Merge conflict in a.txt`. I fixed the file, ran `git add`, and committed. Then I removed the merge commit using `git reset --hard HEAD~1` and ran `git rebase main` from `feature`, which resulted in the same error: `Could not apply ... feat`. After fixing it, running `git add` and then `git rebase --continue` completed the process. The environment was git 2.55.0 (Windows). In other words, if a conflict occurs during rebase, resolve it in the same way, but use `rebase --continue` instead of `merge --continue`.

</details>

## Merge vs Rebase

Pro Git introduces two philosophies without declaring a winner. One side argues that history is what actually happened and should not be changed (merge), while the other contends that history represents the story of a project's creation and should be tidied up before public release (rebase). A compromise approach is: "Rebase your local work before pushing, but never rebase commits that have already been pushed."

| | Merge | Rebase |
|---|---|---|
| History shape | Split and joined | Single line |
| Commit hash | Preserved | Newly created |
| Merge commit | Appears | Does not appear |
| Already shared commits | Safe | Risky |

The core rule is written in Pro Git as follows: Do not rebase commits that exist outside the repository and on which others may have based their work. If you rebase and force push, you will diverge from your colleagues' history; when they pull, duplicate commits with the same author, date, and message can occur.

## Team Workflows

The workflow used in teams is almost standardized. There are two widely known approaches:

- **Feature branch**: Create a branch for each feature off `main`, review it via a pull request once finished, and merge it back to `main`. Keep `main` always in a deployable state.
- **Gitflow**: Maintain branches such as `develop`, `feature`, `release`, and `hotfix` in addition to `main`, organized by role. This fits projects with fixed release cycles but is considered heavy for small teams.

Commit messages should be written so that a one-line summary shows what changed and why; this benefits anyone reading `git log` later (usually future you).

## Common Misconceptions

- **Branches are folder copies**: Branches are simply pointers to commits, so creating and deleting them is cheap.
- **Deleting a commit makes it disappear forever**: Commits hidden by rebase or `reset --hard` remain in `git reflog` for a while. As seen in the previous exercise, `rebase (start)` and `rebase (finish)` were recorded in the reflog. However, they may eventually be purged after the default retention period, so this is not permanent storage.
- **Conflicts mean something went wrong**: Conflicts simply signal that two people modified the same area; they are common in team work.
- **Git is GitHub**: Git is a version control tool, whereas GitHub is a service for hosting Git repositories and enabling collaboration via pull requests.

<details>
<summary>Detailed explanation: Summary of frequently used commands</summary>

| What you want to do | Command |
|---|---|
| View status | `git status` |
| View history (graph) | `git log --oneline --graph --all` |
| Create and switch to a branch | `git switch -c <name>` |
| Merge | `git merge <branch>` |
| Rebase on top of another branch | `git rebase <branch>` |
| Abort merge/rebase | `git merge --abort`, `git rebase --abort` |
| Find lost commits | `git reflog` |
| Tidy up local only before push | `git rebase -i <base>` (interactive mode not executed this time) |

`git pull` is a command that fetches and merges in one go, while `git pull --rebase` uses rebase instead of merging. Pro Git introduces `git pull --rebase` as a method to avoid complications after a force push.

</details>

← [Concept map](#/post/cs-map)

Related posts: [Software Engineering Basics](#/post/cs-sw-engineering), [SOLID Principles](#/post/cs-solid), [Key & Secret Management](#/post/sec-keys)

## Reference Links

- Pro Git, Basic Branching and Merging: https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging
- Pro Git, Rebasing: https://git-scm.com/book/en/v2/Git-Branching-Rebasing
- (Run directly) git 2.55.0 local exercise: Check merge, conflicts, rebase, and reflog in a temporary repository
- Atlassian Git Tutorial, Comparing Workflows: https://www.atlassian.com/git/tutorials/comparing-workflows