Secrets should be passed from the execution environment, not embedded in code; even if they are leaked, the system should be structured so that the damage is contained and can be mitigated quickly. This approach forms the core of management.

## Configuration and Secrets

For an app to run, there are values needed beyond just code: database addresses, external service API keys, server hostnames, and more. The 12-Factor App methodology refers to these as "config" (configuration) and defines them as anything that may vary between deployments. Settings like routing configuration that connect internal app structures do not change with each deployment and thus are not considered config in this context.

Secrets are a subset of configuration where leaking them would be problematic. Passwords, API keys, tokens, and private keys for certificates fall into this category. While database addresses are configuration, database passwords are secrets. Treating both the same way leads to incidents.

The criterion proposed by the documentation is simple: If you were to publish this code at any moment, would credentials be exposed? If they would be, then configuration has not been properly separated from code.

## Why Environment Variables Are Preferred

12-Factor advocates storing configuration in environment variables. Three reasons are given:

- Values can be changed per deployment without touching the code.
- Unlike config files, there is a low risk of accidentally committing them to version control.
- They are language- and OS-agnostic.

The alternatives are constants embedded in code or config files that are not committed (such as Rails' `database.yml`). Constants violate the separation principle, while config files are better but still prone to accidental commits and often have inconsistent formats across frameworks.

Reading configuration from code is straightforward:

```python
import os

def need(name):
    v = os.environ.get(name)
    if not v:
        raise SystemExit(f"{name} 없음")
    return v

db_url = need("DB_URL")      # 없으면 시작 단계에서 바로 멈춘다
```

If the application halts at startup when a value is missing rather than silently falling back to a default, it reduces incidents that might surface long after deployment. The above code demonstrates both cases—with and without values—to verify behavior.

Another approach 12-Factor advises against is embedding grouped configurations named like `development`, `test`, or `production` directly in the code. The documentation states this method "does not scale cleanly." As staging environments or personal setups increase, the number of combinations grows exponentially, making deployments fragile. Instead of grouping by environment name, each variable should be managed independently per deployment.

## .env Files

In local development, typing environment variables into the terminal repeatedly is cumbersome, so developers often write `KEY=value` lines in a `.env` file and have tools read it at startup to load them as environment variables. It's just a single file—not magic.

Two rules must be followed: First, add `.env` to your `.gitignore`. Second, commit only an empty `.env.example` to the repository to indicate which variables are required.

As seen in [CI/CD and Deployment Strategies →](#/post/cloud-cicd), on production servers or CI systems, it is more common for the platform itself to inject environment variables rather than using `.env` files. Uploading a file to the server turns that file into yet another management target.

## Where Environment Variables Fall Short

OWASP's Secrets Management Cheat Sheet treats environment variables as a "last resort" because they can leak alongside logs or crash dumps. The documentation advises against embedding secrets in code, Dockerfiles, or config files; instead, use an orchestrator to inject them or fetch them at runtime. You can continue reading [Docker →](#/post/cloud-docker) to see why baking secrets into images is dangerous.

The weaknesses of relying solely on environment variables are summarized below:

| Concern | When Using Only Environment Variables |
|---|---|
| Who read it? | No audit trail exists |
| Changing values | Requires app restart to take effect |
| Access control | Visible to all processes within the same context |
| Leakage | Easily mixed into logs, dumps, or debug output |

Therefore, as scale increases, dedicated secret storage is used.

## Secret Managers

The AWS Secrets Manager documentation introduces this service as a tool for managing secrets—including database credentials, application credentials, OAuth tokens, and API keys—throughout their entire lifecycle, including retrieval and rotation. The core idea is to replace hardcoded credentials in code with runtime calls. When the app needs a value, it queries the service to retrieve it.

This approach offers several benefits:

- Values are not stored alongside the app, so someone who can inspect the app cannot immediately obtain secrets.
- Automatic rotation schedules can be set, and since values aren't baked into the app, redeployment is unnecessary when rotating them.
- Audit logs record who retrieved what and when. The documentation notes that enabling CloudTrail provides API call logs.

The documentation also highlights caveats: this service charges based on usage, and additional fees apply if you use your own KMS keys for encryption or Lambda functions for rotation. Furthermore, AWS offers specialized services for different secret types—IAM for credentials, KMS for encryption keys, ACM for certificates—and Secrets Manager is not a universal vault for all secrets.

Other clouds and tools (such as Google Secret Manager, HashiCorp Vault, etc.) can serve the same purpose, but I did not review their documentation this time.

## Rotation and Least Privilege

The core recommendations from the OWASP cheat sheet are roughly as follows:

- **Centralization**: Manage secrets in a dedicated system rather than scattering them across code, configuration files, or tools.
- **Rotation**: Rotate regularly and automate whenever possible to shorten the lifespan of stolen credentials.
- **Least Privilege**: Restrict the subjects that can read and modify each secret.
- **Dynamic Secrets**: Issue short-lived, expiring credentials per session. The document notes that even if an app is restarted, stolen credentials do not remain valid.
- **Auditing**: Log who requested and approved access, when it was used, and ensure logs themselves are tamper-proof.

Initially, I viewed rotation as a tedious periodic task, but the documentation suggests the opposite: the goal isn't just to stop leaks, but to reduce the window of opportunity for stolen credentials. A key set once established remains risky from the moment of compromise onward, whereas short-lived keys expire quickly even if stolen.

## When Leaks Occur

Based on GitHub's documentation, secret scanning scans the entire Git history—including all branches, issues, pull requests, discussions, and wikis—to detect exposed keys. If a key is found, a warning is created in the repository's security tab. Public repositories are free to scan, while scanning private repositories within an organization requires a separate product (GitHub Secret Protection).

The response procedures for leaks are nearly identical across both documents:

1. Immediately revoke and reissue the compromised credentials.
2. Remove them from exposed locations such as code and logs.
3. Document when and how the leak occurred and what was used.

GitHub's documentation states that removing entries from Git history is time-consuming and often unnecessary once revocation has occurred. Killing the key takes precedence over deleting commits, since someone may have already copied the leaked data.

## Common Misconceptions

- **Adding `.env` to `.gitignore` makes it safe**: This prevents future commits but does not remove already committed history. Additionally, leaks can still occur via logs or images.
- **Private repositories are safe for storing keys**: The Twelve-Factor App standard asks whether something *should* be exposed publicly; being private only limits current access rights.
- **Environment variables are encrypted**: They are not. Any process with sufficient privileges can read them.
- **Using a secret manager is enough**: If the secret manager itself has overly broad access, it's like leaving the vault door open. Least privilege and auditing must accompany its use.
- **Deleting removes everything**: Deletion does not undo prior replication; revocation must happen first.

<details>
<summary>Detailed explanation: How far should you go step-by-step?</summary>

Since the documents do not explicitly break down steps, the following is a sequential summary based on what I read:

1. Remove all hardcoded values from code and replace them with environment variables. This alone satisfies open-source code standards.
2. For local development, use `.env` + `.gitignore` + `.env.example`.
3. For deployment environments, let the platform inject secrets (e.g., CI secrets, container orchestrator secrets).
4. If there are many values or a large team, migrate to a secret manager and fetch secrets at app startup time.
5. Document rotation schedules and leak response procedures (who revokes and who is notified).

For small personal projects, steps 1–3 may suffice depending on service nature and cost considerations. For larger setups, step 4 becomes necessary. Since secret managers are billed per usage, evaluate cost-effectiveness if the number of secrets is low.

</details>

## Reference Links

- The Twelve-Factor App, III. Config: https://12factor.net/config
- AWS Documentation, What is AWS Secrets Manager?: https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html
- GitHub Documentation, About secret scanning: https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning
- OWASP, Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html

← Concept map (#/post/cloud-map)

Related posts: [More details → Keys and Secret Security](#/post/sec-keys) · [More details → Cloud Basics](#/post/cloud-basics) · [More details → Serverless](#/post/cloud-serverless)