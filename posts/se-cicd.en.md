Version control is the practice of establishing a baseline at a specific point in time for software and tracking changes from that baseline. Branching strategies and CI/CD are the methods used to scale this process across team sizes.

We briefly touched on version control in the [Overview](#/post/cs-sw-engineering) section, covered Git's internal structure in [Understanding Git Properly](#/post/cs-git), and discussed pipelines and deployment strategies in [CI/CD and Deployment Strategies](#/post/cloud-cicd). Here, we focus on concepts prior to tools and criteria for selecting them.

## What is a "version" (configuration) and what do we manage?

A configuration (or "form") represents the entire set of artifacts that make up software. It includes not just source code, but also configuration files, build scripts, dependency library lists, documentation, and test code. Individual items grouped as management targets are referred to as configuration items.

It is a common misconception to say, "We use version control for code, but we directly modify settings on the server." If the same code behaves differently due to varying settings, reproducibility becomes impossible. Therefore, version control aims to include everything that moves alongside the code in a single history.

## Baseline

A baseline is a point in time agreed upon and fixed with the statement, "This state is official." A release is the most typical example. With a baseline established, two things become possible: you can revert exactly to any specific point in time, and you can list what has changed since the last baseline.

Simplifying the concept of a baseline further involves hashing file contents and then hashing that list again to produce a short ID representing the entire state.

```python
import hashlib, json

def snapshot(files):
    items = {name: hashlib.sha256(data.encode()).hexdigest()[:8] for name, data in sorted(files.items())}
    bid = hashlib.sha256(json.dumps(items, sort_keys=True).encode()).hexdigest()[:8]
    return bid, items

v1 = {"app.py": "print('hi')", "config.yml": "debug: false", "README": "v1"}
v2 = dict(v1, **{"config.yml": "debug: true"})

b1, i1 = snapshot(v1)
b1b, _ = snapshot(dict(reversed(list(v1.items()))))
b2, i2 = snapshot(v2)
print(b1, b1b, b1 == b1b)
print(b2, b1 != b2)
print([n for n in i1 if i1[n] != i2[n]])
```

```
443516a5 443516a5 True
7d2092ea True
['config.yml']
```

Even if the order of files is reversed, the ID remains the same; changing just one line of configuration changes the ID, allowing for comparison of what has changed. This principle underlies Git commit hashes. The code above is simplified to illustrate the concept and does not exactly match actual Git implementation.

## Change Control

When a baseline exists, procedures for modifying it are also necessary. When a change request comes in, you must assess its impact scope, determine who approves it, and decide which baseline it should be applied to. In traditional development organizations, this approval process is often handled by a committee. In modern teams, pull request reviews and mandatory status checks frequently replace this role. While the forms differ, the core principle remains the same: "Who changed the baseline and on what grounds must be recorded."

## Version numbers are also part of version control

The name attached to a baseline is its version. Semantic Versioning (SemVer) assigns meaning to the three numbers in `MAJOR.MINOR.PATCH`.

| Component | When to increment | Reset to |
|---|---|---|
| MAJOR | When public APIs change in an incompatible way | MINOR, PATCH to 0 |
| MINOR | When new backward-compatible features are added | PATCH to 0 |
| PATCH | When backward-compatible bug fixes are made | - |

There are additional rules. If a deployed version is modified without creating a new release, a new version must be issued. Pre-release identifiers like `-rc.1` have lower precedence than official versions. Build metadata such as `+build7` is ignored during precedence comparisons. While the major version is 0, it is considered an early development stage where changes can happen at any time.

<details>
<summary>Verify sorting rules with code</summary>

Sorting as strings would place `1.10.0` before `1.9.0`. You must compare using numbers and follow specific rules for pre-release identifiers.

```python
import re

def parse(v):
    m = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?", v)
    major, minor, patch, pre = m.group(1), m.group(2), m.group(3), m.group(4)
    return int(major), int(minor), int(patch), pre.split(".") if pre else None

def pre_key(ident):
    return (0, int(ident), "") if ident.isdigit() else (1, 0, ident)

def sort_key(v):
    major, minor, patch, pre = parse(v)
    if pre is None:
        return (major, minor, patch, 1, ())
    return (major, minor, patch, 0, tuple(pre_key(i) for i in pre))

def bump(v, kind):
    major, minor, patch, _ = parse(v)
    if kind == "major": return f"{major+1}.0.0"
    if kind == "minor": return f"{major}.{minor+1}.0"
    return f"{major}.{minor}.{patch+1}"

versions = ["3.0.0", "3.0.0-rc.1", "3.0.0-beta.11", "3.0.0-beta.2", "1.10.0", "1.9.0", "1.0.0+build7"]
print(sorted(versions, key=sort_key))
print(sort_key("1.0.0+build7") == sort_key("1.0.0+other"))
for k in ("patch", "minor", "major"):
    print(k, bump("1.4.7", k))
```

```
['1.0.0+build7', '1.9.0', '1.10.0', '3.0.0-beta.2', '3.0.0-beta.11', '3.0.0-rc.1', '3.0.0']
True
patch 1.4.8
minor 1.5.0
major 2.0.0
```

This is why `beta.2` comes before `beta.11`: numeric identifiers are compared as numbers.
</details>

## Branching strategies diverge from deployment methods

Branching strategy is a choice regarding "how to evolve the baseline." The most frequently mentioned, git-flow, maintains a `master` branch (production code tagged with each release) and a `develop` branch (integration branch for the next release), dividing features into feature branches, release preparation into release branches, and urgent production fixes into hotfix branches.

| Branch | Source | Merge target |
|---|---|---|
| feature | develop | develop |
| release | develop | master, develop |
| hotfix | master | master, develop |

The author of the article proposing git-flow added a note in 2020 stating that for software like web applications that are continuously deployed, there is no need to maintain multiple versions simultaneously; therefore, a much simpler flow like GitHub Flow is preferable. For software where versions are explicitly tagged and multiple versions must be supported in production, git-flow remains appropriate. Which approach is better depends on the deployment method.

The discussion of merge and rebase in [Understanding Git Properly](#/post/cs-git) focused on how to merge branches, whereas here the debate centers on how many types of branches to have and their lifecycles.

## CI is a habit, not just a tool

Martin Fowler defines CI (Continuous Integration) as follows: team members merge their changes into the shared codebase at least once a day, triggering an automated build with tests each time. Here are the practices highlighted in that article that relate to version control:

- Keep everything on a version-controlled mainline. The repository should be able to be cloned, built, and run immediately.
- Automate builds with a single command, including tests so that a green light indicates no major bugs.
- Trigger a build on the CI server every time you push to the mainline.
- Fix broken builds immediately. Typically, revert the problematic commit to allow the team to continue working, then investigate the root cause separately.
- Keep builds fast. The article cites XP's "10-minute build" as a suitable standard for most projects.
- Hide incomplete features using methods like feature flags.

The last item connects to branching strategies. To merge once a day, you must be able to merge even if a feature isn't finished within a day; therefore, instead of keeping branches alive for long periods, keep incomplete features hidden in the code. The longer a branch lives, the further it strays from CI's premise of "frequent merging."

Since tests are part of the build, the configuration of unit and integration tests in [Testing and Quality](#/post/se-testing) determines CI time. The article recommends a deployment pipeline that runs quick commit builds first, followed by slower tests in later stages.

## Distinguishing CI, Delivery, and Deployment

| Name | Automated Actions | Human Actions |
|---|---|---|
| CI | Merge, build, test | - |
| Continuous Delivery | Up to a deployable state | Deploy button in production |
| Continuous Deployment | Up to production deployment | None (monitoring) |

Examples of step-by-step YAML and deployment strategies like blue-green or canary are found in [CI/CD and Deployment Strategies](#/post/cloud-cicd). Checking the status after deployment is covered in [Monitoring, Logging, and Alerts](#/post/cloud-observability).

## Common Misconceptions

- Having a CI server means you are doing CI: Low merge frequency means integration issues will surface late even with a server.
- More branches mean more safety: The longer a branch lives, the greater the conflict and integration cost when merging.
- Git-flow is the standard: The proposer clarified that it depends on the situation.
- Version numbers are marketing names: In SemVer, they are a promise to indicate the nature of public API changes.

## Reference Links

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Martin Fowler — Continuous Integration](https://martinfowler.com/articles/continuousIntegration.html)
- [nvie — A successful Git branching model](https://nvie.com/posts/a-successful-git-branching-model/)

← [CS Map](#/post/cs-map)

Related articles: [Software Engineering Basics](#/post/cs-sw-engineering) · [Understanding Git Properly](#/post/cs-git) · [CI/CD and Deployment Strategies](#/post/cloud-cicd)