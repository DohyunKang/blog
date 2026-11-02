Configuration management is the process of recording and controlling changes to software, while build and deployment involve turning that managed source into executable deliverables. Since the Information Processing Engineer exam mostly asks questions about term definitions and classifications, this article is organized by those units. Check the official site for exam schedules and fees.

## What is Configuration Management?

Configuration refers to all artifacts that make up software. It includes not just source code but also requirement documents, design specifications, test cases, and configuration files. Among these, items designated as targets for change tracking are called configuration items.

Configuration management (SCM) is the activity of recording who changed what, when, and why, and enabling a return to previous states if necessary. Since changes during development cannot be prevented, the goal is to make the change process orderly. Issues with requirements changing mid-development are also covered in [Details → Requirement Verification and Analysis](#/post/jb-requirements).

Here is a table of terms frequently appearing in the exam:

| Term | Meaning |
|---|---|
| Configuration Item | An artifact designated as a target for change management |
| Baseline | A reference point approved after formal review; subsequent changes must follow established procedures |
| Checkout | Retrieving items from a repository for work purposes |
| Check-in (Commit) | Reflecting modified content into the repository |
| Branch | A separate work lineage diverged from the main flow |
| Merge | Combining diverged lineages back together |

## Four Configuration Management Activities

This is the most common source of exam questions. Memorize the activity names paired with their descriptions.

| Activity | What it does |
|---|---|
| Configuration Identification | Determines what to manage and assigns names/numbers to each item |
| Configuration Control | Receives change requests, reviews and approves them, and reflects only approved changes (judged by a Change Control Board) |
| Configuration Audit | Verifies that items were built according to baselines and that changes followed procedures |
| Configuration Status Accounting (Status Reporting) | Records and reports the current status of items and their change history |

The confusing pair is control vs. audit: control permits changes, while audit verifies whether changes were handled as permitted.

<details>
<summary>Benefits of Configuration Management</summary>

- Incorrectly fixed issues can be reverted to previous versions.
- Conflicts are detected and resolved when multiple people modify the same file.
- The source of a deployed version can be traced.
- Change history remains, making accountability and root cause analysis easier.

</details>

## Three Types of Version Control Systems

Version control systems are categorized by where the repository is stored.

| Approach | Repository Location | Representative Tools (Common in Exams) |
|---|---|---|
| Local/Shared Folder | Files locked and edited in a single shared folder | RCS, SCCS |
| Client-Server | Single central server holds the repository | CVS, SVN (Subversion) |
| Distributed | Each developer has a full copy of the repository | Git, Bazaar |

Centralized systems halt work if the server goes down, whereas distributed systems allow commits and branch creation offline since each user holds the entire history. The internal structure of Git is covered separately in [Details → Understanding Git Properly](#/post/cs-git).

There are two cases for merging based on Pro Git: if the branch to be merged is directly ahead of the current branch, it's a fast-forward merge where only the pointer moves forward and no new commit is created. If both branches have accumulated commits separately, they are merged using three snapshots: the two branch tips and their common ancestor, creating a new merge commit with two parents. If the same part of the same file was modified differently in both branches, a conflict occurs; after manually resolving the conflict markers and running `git add` to mark resolution, a commit must be made to complete the merge.

<details>
<summary>Basic Git Commands</summary>

| Command | What it does |
|---|---|
| `git add` | Stages changes in the staging area |
| `git commit` | Finalizes staged content as a commit |
| `git branch` | Creates or lists branches |
| `git merge` | Merges another branch into the current branch |
| `git status` | Shows current status and conflicted files |

</details>

## Build and Build Tools

Building involves compiling source code, linking libraries, running tests, and bundling everything into an executable form. Doing this manually leads to errors, so tools execute the process in a predefined order.

Tools appearing in the exam include Make, Ant, Maven, and Gradle, distinguished by their declaration styles. Ant explicitly defines task sequences, while Maven configures based on a fixed lifecycle. Downloading and managing dependency libraries is another characteristic shared by Maven and Gradle; memorize this grouping together.

The basic lifecycle stages from Maven documentation are as follows:

| Step | Phase | Meaning |
|---|---|---|
| 1 | validate | Check if the project configuration is correct and required information is present |
| 2 | compile | Compile source code |
| 3 | test | Run unit tests (packaging and deployment must not be necessary) |
| 4 | package | Bundle into a deployable form like a JAR |
| 5 | verify | Check quality criteria such as integration test results |
| 6 | install | Install to the local repository |
| 7 | deploy | Copy to a remote repository for sharing |

Specifying a single phase, such as `mvn verify`, executes all preceding phases in order. The `clean` phase, which removes previous build artifacts, is part of a separate lifecycle and must be prefixed, as in `mvn clean deploy`. The fact that the test phase is included within the build connects to [more details → Software Testing](#/post/jb-testing).

CI refers to automatically running builds and tests every time code is merged. CD extends this by automatically following up with deployment. Pipeline configuration is covered in [more details → CI/CD and Deployment Strategies](#/post/cloud-cicd).

## Releases and Version Numbers

A release involves publishing the built artifacts to users or production environments. Two items are typically addressed before and after publishing:

- Release Notes: A document listing what was added, fixed, and known issues in this version
- Previous Version Archiving: Retain copies of the deployment and source code to allow rollback if issues arise

The most commonly referenced rule for version numbers is Semantic Versioning (SemVer). Based on official documentation, it is summarized as follows:

| Position | When to Increment |
|---|---|
| MAJOR | API changes that break backward compatibility |
| MINOR | Addition of backward-compatible features |
| PATCH | Backward-compatible bug fixes |

When a number is incremented, the digits to its right reset to zero (e.g., incrementing MINOR in 1.4.2 results in 1.5.0). Versions starting with 0.y.z are considered early development stages and can change at any time; from 1.0.0 onward, public APIs are finalized. Items appended after a hyphen, such as `1.0.0-rc.1`, denote pre-releases and have lower precedence than the official `1.0.0`. Metadata appended after a plus sign (`+`) is ignored during version comparison. Once a version is deployed, its contents must not be changed; any changes require a new version number.

Familiarize yourself with the naming conventions for development stages: alpha (internal testing), beta (testing with some external users), and finally official release.

## Code Review

This activity involves having others read code before merging to identify defects. In exams, it is emphasized that this is a static technique where humans review the code without executing it, and the difference in formality should be noted.

| Type | Feel |
|---|---|
| Peer Review | An informal review where the author and peer lightly review each other's work |
| Walkthrough | The author explains the deliverable while participants provide feedback |
| Inspection | The most formal method with defined roles (moderator, recorder, etc.) and procedures |

The order of increasing formality is peer review, walkthrough, then inspection. Verification that involves reviewing code without execution falls under the category of static testing found in [more details → Software Testing](#/post/jb-testing).

## Common Mistakes

- Confusing version control with change audit. Control refers to approval; audit refers to verification.
- Mistaking a baseline for the "latest version." A baseline is an officially approved reference point where changes require procedures.
- Classifying Git as client-server based. It operates on a distributed system.
- Believing that bug fixes in SemVer warrant a MINOR increment. Bug fixes are PATCH level.
- Treating `install` and `deploy` as the same. The former installs to a local repository; the latter deploys to a remote repository.

Concepts related to management, such as schedules and costs, continue in [more details → Project Management](#/post/jb-project-mgmt).

← [Concept Map](#/post/jb-map)

Related articles: [Software Testing](#/post/jb-testing) · [Understanding Git Properly](#/post/cs-git) · [CI/CD and Deployment Strategies](#/post/cloud-cicd)

## Reference Links

- Semantic Versioning: https://semver.org/lang/ko/
- Apache Maven, Introduction to the Build Lifecycle: https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html
- Pro Git, Basic Branching and Merging: https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging