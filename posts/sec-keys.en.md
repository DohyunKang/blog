Secrets like API keys or passwords are best managed not by trying to hide them perfectly, but by creating a structure where they can be immediately revoked and reissued the moment they leak; this is the core of effective management.

## What is a Secret?

A secret is a value for which "knowing it grants you recognition." API keys, access tokens, database passwords, private keys (SSH/TLS), and webhook signature values all fall into this category. The difference from a login password is that secrets are used by programs, not people. They aren't typed in from memory but are placed somewhere in code or configuration files, creating many potential leak paths.

If a key leaks, others can send requests to your account. With cloud keys, someone could spin up servers at will and incur charges on your bill. With AI API keys, call costs would be charged to your card. Therefore, key management is not just a security issue but also a financial one.

## Where Do Leaks Happen?

Common leak paths generally follow similar patterns.

| Path | How it leaks |
|---|---|
| Git repository | Committing `.env` or config files as-is; hardcoding keys directly into code |
| Git history | Even if deleted later, the key remains in previous commits |
| Logs | Keys are printed alongside full request headers or settings output |
| Chat/Documentation | Pasting "use this" into Slack, issues, or wikis |
| Client code | Anyone can inspect deployed front-end bundles or apps containing keys |
| CI/CD | Pipeline variables exposed in logs, or long-lived high-privilege keys stored in pipelines |

Git requires special attention. GitHub's secret scanning scans the entire history of all branches, including issues, PR bodies, and wikis, as documented. Conversely, this means keys could remain within this scope. While it's commonly heard that tools automatically scrape keys from public repositories before humans even see them,

## Four Principles

These are the core points distilled from the OWASP Secrets Management Cheat Sheet.

1. **Manage centrally.** If each team uses different methods, it becomes difficult to locate what is where in case of an incident. Store, authenticate, and audit logs should be standardized in one place.
2. **Grant least privilege.** Define precisely who can read or change each secret. Not all engineers should have access to everything.
3. **Rotate periodically (rotation).** This shortens the lifespan of stolen keys. Automation is preferred whenever possible. User passwords are an exception; they are primarily changed when compromise is suspected.
4. **Use short-lived, disposable values (dynamic secrets) whenever possible.** Issue new ones for each session or deployment with short lease times. Restarting an app does not invalidate a stolen key; revocation only occurs via expiration or explicit cancellation.

These four principles interconnect. Rotation is easier when keys are used in a single location, and narrower privileges mean less damage if a leak occurs. How environment variables, `.env` files, and secret managers connect is detailed separately in [Environment Variables and Secret Management](#/post/cloud-secrets).

## Where to Store

The progression looks roughly like this:

| Stage | Method | Notes |
|---|---|---|
| 0 | Hardcode directly in code | Never do this |
| 1 | `.env` file + `.gitignore` | Minimum standard for personal development or small projects |
| 2 | Environment variables/platform secrets in deployment environment | Separated from code |
| 3 | Secret manager (cloud-provided services like Vault) | Handles permissions, auditing, and rotation together |

`.env` files are convenient for local development, but since the file itself is a secret, upload only an `.env.example` containing placeholder names to your repository without real values. Also, `.gitignore` only works on untracked files; adding already committed files to `.gitignore` does not stop them from being tracked—a common mistake addressed again in the misconceptions section below.

OWASP advises applying the same principles to CI/CD pipelines: treat them with as much caution as production environments. Avoid storing long-lived high-privilege keys in pipelines; instead, have the application fetch secrets directly from a secret manager so the pipeline never touches the values. The deployment flow is covered in detail in [CI/CD](#/post/cloud-cicd).

## If You've Already Leaked

Order matters. The first step is not "deletion" but "revocation."

OWASP outlines the response sequence as follows: immediately revoke the exposed secret, rotate to a new value (preferably automatically), remove it from exposure points like code and logs, and record who accessed it and when. GitHub documentation aligns with this: rotate the key first; removing records is optional. After revoking a key, remaining values in history are already unusable, so there's often no need to scrub the history.

However, if you must remove them from history, GitHub's documentation offers several caveats.

- Rewriting history changes the hash of that commit and all subsequent commits.
- Others' local clones or forks remain unchanged, so pushing again from their side can restore the correct values.
- GitHub's cached views or PRs may continue to display the old commit hashes; in such cases, you must request assistance from GitHub Support.

In short, "it's fine since it's deleted" is incorrect. Key revocation comes first, followed by record cleanup.

<details>
<summary>Detailed explanation: Removing secrets from history using git-filter-repo</summary>

This is the recommended order based on GitHub documentation.

1. Revoke and rotate your keys first.
2. Merge or close any open PRs early. Note that the diff view of a closed PR may disappear after you modify the history.
3. Use the `--sensitive-data-removal` option with `git-filter-repo` version 2.47 or higher.
4. To delete an entire file, use `--invert-paths --path <path>`; to replace only specific strings, use `--replace-text <file>`. If a file has been moved or renamed, include its old path as well.
5. Check the number of affected PRs using the `changed-refs` file generated by the tool. Once you pass this step, the action cannot be undone.
6. Push with `git push --force --mirror origin`. Note that pushing to `refs/pull/` will fail; GitHub Support must handle that part.
7. Collaborators should reclone or rebase branches created from the old history instead of merging them, as merging would reintroduce the polluted history.

If branch protection rules block force pushes, you may need to temporarily disable them. Also, commit signatures will become invalid.

</details>

## Preventive Measures

There are not just reactive steps after an incident; there are also preventive controls before pushing.

- **Push protection**: At the moment of pushing, GitHub checks for hardcoded secrets and blocks the push before it reaches the repository. It detects patterns from partner services, common patterns like personal keys or database connection strings, custom regular expressions, and unstructured values such as passwords using AI detection (currently in public preview). However, users with write access can still bypass these checks, and such attempts are logged in audit logs. According to documentation, this feature is disabled by default at the repository level.
- **Secret scanning**: Scans the entire history for already-pushed secrets and sends notifications. Keys from partner services are immediately reported to the respective service, which may then revoke them automatically.
- **Pre-commit local checks**: While tools vary, the principle is similar: they scan patterns right before committing. The code below is a toy example demonstrating only the underlying principle.

<details>
<summary>Code: Finding key-like patterns using regular expressions (tested and verified)</summary>

The keys below are dummy strings matching examples from AWS documentation; they are not real keys.

```python
import re

PATTERNS = {
    "AWS 액세스 키 ID": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "개인 키 헤더": re.compile(r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----"),
    "대입문 속 비밀값": re.compile(
        r"""(?i)(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"\s]{12,}['"]"""
    ),
}

def scan(text):
    hits = []
    for no, line in enumerate(text.splitlines(), 1):
        for name, pat in PATTERNS.items():
            if pat.search(line):
                hits.append((no, name))
    return hits

FAKE_AWS = "AKIA" + "IOSFODNN7EXAMPLE"  # AWS 문서의 공개 예시값(실제 키 아님)
sample = '''import boto3
AWS_KEY = "{FAKE_AWS}"
api_key = "dummy-not-a-real-key-123456"
url = os.environ["DB_URL"]
timeout = "30"
'''.replace("{FAKE_AWS}", FAKE_AWS)
for no, name in scan(sample):
    print(no, name)
```

Running this captures only line 2 (AWS key format) and line 3 (secret value inside an assignment), but misses line 4 (read from environment variables) and line 5 (a short value). Because this regex only checks format, it often misses arbitrary passwords without a recognizable pattern and may produce false positives by catching unrelated strings. Real tools use many more patterns and also verify whether a key is still valid.

</details>

## Common Misconceptions

- "It's safe because I added it to `.gitignore`": This only affects untracked files; already committed files continue to be tracked.
- "Deleting the commit means it's over": Secrets can remain in history, forks, others' clones, and caches. Revocation must come first.
- "Private repositories are safe": If access permissions expand or the repository becomes public, secrets are immediately exposed. The habit of writing keys directly in code is the real problem.
- "Environment variables are safe": They're just kept outside the codebase. Logging them or leaking via process information is a separate issue. Secret managers add authentication, auditing, and rotation capabilities.
- "Obfuscating client-side code is enough": Values sent to clients can be viewed by anyone; you must route them through your server.
- "I'll just use keys once and reuse them because rotation is annoying": The longer you use a key, the longer the window of damage after a leak. If automation is difficult, at least establish a revocation procedure in advance.

## Reference Links

- OWASP, Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- GitHub Docs, About secret scanning: https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning
- GitHub Docs, About push protection: https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection
- GitHub Docs, Removing sensitive data from a repository: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository

← Concept map (#/post/sec-map)

Related posts: [Environment Variables and Secrets Management](#/post/cloud-secrets) · [Authentication and Cryptography Basics](#/post/sec-authn-crypto) · [Web Vulnerabilities and OWASP](#/post/sec-owasp)