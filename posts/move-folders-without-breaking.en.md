Today I tried to clean up my folders and learned that moving files is a kind of deployment too.

## I thought I'd just move them

My files were scattered everywhere, so I wanted to sort them by category and date. I assumed moving them would be the end of it. But when I first checked who was actually using each folder, there were more than I expected. Some code had the path written right into it, and some AI session settings said "save here." Writing a path straight into code is called **hardcoding**. Move the folder and the program either looks in a place that no longer exists, or quietly recreates the old folder and makes a mess again.

So I flipped the order. First find every place that writes files and put it in a table, fix all of them, then move. If code reads the path from one config instead of having it written inline, next time I only change that one line.

## When the path is the name tag

The other surprise: some programs use the folder path as the label for their records. AI sessions keep their chat history and memory per working folder. Move the folder and a new session can't find its old memory. Folders with the same name can even get their memories mixed. In the end I left the outer folders where sessions work untouched and only tidied what's inside. Wanting less made the risk drop a lot.

## Preview by default

The move script runs as a **dry run** by default. It just shows the list of what it would move and touches nothing. To actually move, you have to add a separate apply option. No pressing Enter once and moving everything by accident. Each move also leaves an undo record of where things were.

While moving, the sessions that write to that folder take a short break. Same idea as a database getting tangled if someone writes during a migration. Stop the writers, move, reopen.

## A guard has to let things through, too

Writing the rules into instructions didn't feel safe enough, so I'm also building a guard that blocks dangerous commands before they run. But switch it on blindly and it might block normal work too. Blocking something fine is a **false positive**; letting through something it should block is a false negative. So instead of turning it on, I asked the session that actually does the work to run the tests and give feedback first.

1. A **hardcoded path** is a folder location written directly in code. You have to fix it whenever the folder moves, so it's better to read paths from one config.
2. **Path-keyed state** is when a program uses the folder path as the label for its records. Change the path and the records go missing.
3. A **dry run** shows what would change without changing anything. The real run needs an extra option.
4. **Stop writes, then move** means pausing whatever writes to a place while you move it, so a write in the middle doesn't land somewhere odd.
5. **False positives and false negatives** are a check blocking something fine and missing a real problem. Check both before turning a guard on.

Didn't expect moving one folder to need a plan document.
