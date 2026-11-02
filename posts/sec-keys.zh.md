密钥（Secrets）如 API 密钥或密码等，管理的核心不在于将其完美地隐藏起来，而在于一旦泄露能立即作废并重新颁发。

## 什么是密钥

密钥是“知道它的人会被认可”的值。API 密钥、访问令牌、数据库密码、私钥（SSH/TLS）、Webhook 签名值都属于此类。与登录密码不同之处在于，密钥是由程序而非人类使用的。它们不是靠人记忆后手动输入，而是放置在代码或配置文件中的某个位置，因此泄露的途径也更多。

一旦密钥泄露，他人即可冒充我的账户发起请求。如果是云服务的密钥，攻击者可以随意启动服务器并产生费用；如果是 AI API 密钥，调用成本将直接从我的信用卡扣除。因此，密钥管理不仅是安全问题，也是成本控制问题。

## 常见的泄露途径

汇总常见的泄露路径后，情况大多相似：

| 路径 | 如何泄露 |
|---|---|
| Git 仓库 | 将 `.env` 或配置文件直接提交，或在代码中硬编码密钥 |
| Git 历史记录 | 即使后来删除，之前的提交记录中仍保留着密钥 |
| 日志 | 输出请求头或完整配置时，密钥一同被打印出来 |
| 聊天/文档 | 在 Slack、Issue 或 Wiki 中直接粘贴“请使用这个”并分享 |
| 客户端代码 | 将密钥打包进前端构建物或应用程序中发布后，任何人都可查看 |
| CI/CD | 流水线变量暴露于日志中，或将长期有效的高权限密钥保留在流水线里 |

Git 尤其需要警惕。GitHub 的 secret scanning 会扫描所有分支的全部历史记录、Issue 和 PR 正文以及 Wiki 内容，正如文档所述。换句话说，这意味着在这些范围内都可能残留密钥。此外，人们常听说公开仓库中的密钥会被自动抓取工具在被人查看之前就已窃取，

## 四大原则

以下核心要点摘自 OWASP Secrets Management Cheat Sheet：

1. **集中管理**。如果各团队采用不同方式，一旦发生事故将难以定位问题所在。应在单一地点统一存储、认证和审计日志的标准。
2. **最小权限原则**。精细划分每个密钥的读取和修改权限。不能让所有工程师都能看到全部信息。
3. **定期轮换（Rotation）**。这是缩短被盗密钥有效期的方法。尽可能实现自动化。用户密码除外，仅在怀疑遭受入侵时重点更换。
4. **尽量使用短寿命并一次性使用的值（动态密钥）**。为每个会话或部署重新颁发，并设置较短的租赁时间。应用程序重启并不会使已被窃取的密钥失效，取消操作只能通过过期或显式作废来实现。

这四项原则相互关联：若要便于轮换，密钥的使用点应集中在少数位置；权限越窄，泄露造成的损害就越小。环境变量与 `.env`、密钥管理器之间的衔接关系已在 [详细 → 环境变量与密钥管理](#/post/cloud-secrets) 中另行整理。

## 存储于何处

按阶段划分，大致如下：

| 阶段 | 方式 | 备注 |
|---|---|---|
| 0 | 直接在代码中编写 | 禁止使用 |
| 1 | `.env` 文件 + `.gitignore` | 个人开发或小项目的最低标准 |
| 2 | 部署环境的环境变量或平台密钥 | 与代码分离 |
| 3 | 密钥管理器（如 Vault 等云服务） | 同时解决权限、审计和轮换问题 |

`.env` 虽便于本地开发，但文件本身即包含秘密，因此应仅上传名为 `.env.example` 的示例文件，而将真实值排除在外。此外，`.gitignore` 仅对尚未被跟踪的文件生效；对于已提交的文件，即使将其加入 `.gitignore`，Git 仍会继续跟踪它们。这是一个常见错误，已在下方的误解部分再次说明。

OWASP 建议同样将这些原则应用于 CI/CD 流程：对待流水线应如同生产环境般谨慎；避免在流水线中保留长期有效的高权限密钥；最好让使用密钥的一方直接从密钥管理器获取，使流水线完全不接触密钥值。关于部署流程的详细信息请参阅 [详细 → CI/CD](#/post/cloud-cicd)。

## 如果已经泄露

顺序至关重要。首要行动并非“删除”，而是“作废”。

OWASP 提出的应对步骤如下：立即作废已泄露的密钥，并尽可能自动轮换为新值；从代码、日志等暴露位置清除相关痕迹；记录谁在何时进行了访问。GitHub 文档也持相同观点：首先轮换密钥，而从记录中删除则是可选操作。作废密钥后，历史记录中残留的值已无法使用，因此通常无需刻意修改历史记录。

尽管如此，若仍需从记录中清除，GitHub 文档提供了诸多注意事项。

- 如果重新写入记录，该提交及其之后所有提交的哈希值都会发生改变。
- 其他人的本地副本或 Fork 分支保持不变，因此从他们那边再次推送时，数据可能会恢复。
- GitHub 的缓存界面或 PR 可能仍显示旧的提交哈希，这种情况下需要向 GitHub Support 申请处理。

也就是说，“删除了就没事了”是不对的。正确的顺序是先废弃密钥，再清理记录。

<details>
<summary>详细解析：使用 git-filter-repo 从历史记录中删除时</summary>

以下顺序是根据 GitHub 文档整理的步骤。

1. 首先废弃并轮换密钥。
2. 先合并或关闭已打开的 PR。关闭后，PR 的 diff 界面在记录修改后可能会消失。
3. 使用 `git-filter-repo` 2.47 及以上版本中的 `--sensitive-data-removal` 选项。
4. 若要删除整个文件，请使用 `--invert-paths --path <路径>`；若仅替换字符串，请使用 `--replace-text <文件>`。如果文件曾移动或重命名，也需一并列出旧路径。
5. 检查受影响的 PR 数量：通过工具生成的 `changed-refs` 文件确认。一旦完成此步骤，操作将无法撤销。
6. 使用 `git push --force --mirror origin` 进行推送。注意 `refs/pull/` 部分会失败，这需由 GitHub Support 处理。
7. 协作人员需要重新克隆仓库，或将基于旧记录创建的分支通过 rebase 迁移，而不能直接合并，否则会导致受污染的历史记录回退。

如果启用了分支保护规则阻止强制推送，需暂时解除；同时提交签名将失效。

</details>

## 预防机制

除了事故发生后的应对措施外，在推送前也有预防机制。

- **push protection**：在 GitHub 执行推送的瞬间，检查是否包含硬编码的密钥，并在数据到达仓库之前进行拦截。系统会检测合作伙伴服务模式、个人密钥或数据库连接字符串等通用模式、自定义正则表达式，以及利用 AI 探测上下文中的非结构化值（如密码）（目前为公开预览功能）。但若有写入权限，仍可绕过这些检查，且绕过行为会记录在审计日志中。文档指出，仓库级别默认是关闭的。
- **secret scanning**：扫描整个历史记录以查找已泄露的内容并发送通知。对于合作伙伴服务的密钥，系统会立即通知该服务，由其自行处理废弃。
- **本地提交前检查**：各工具原理相似，均在提交前扫描模式。以下代码仅为演示其原理的玩具示例。

<details>
<summary>代码：使用正则表达式查找密钥样式（已直接运行验证）</summary>

下方的密钥是 AWS 文档中的示例格式和任意虚构字符串，并非真实密钥。

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

执行后仅匹配第 2 行（AWS 密钥样式）和第 3 行（赋值语句中的秘密值），而不会匹配从环境变量读取的第 4 行或较短的第 5 行。由于该正则表达式仅基于格式判断，容易遗漏无特定格式的任意密码，也可能产生误报。实际工具支持更多模式，并具备验证密钥是否仍有效的功能。

</details>

## 常见误解

- **已加入 `.gitignore` 就安全了**：仅对尚未被跟踪的文件有效；已提交的文件仍会被持续跟踪。
- **删除了提交就结束了**：记录、Fork、他人的副本以及缓存中可能仍保留。废弃密钥才是首要步骤。
- **因为是私有仓库所以没问题**：一旦增加具有访问权限的人员或将仓库转为公开，内容即刻暴露。在代码中硬编码密钥的习惯本身就是问题所在。
- **环境变量就安全了**：这仅仅意味着将密钥放在代码之外。日志记录或进程信息泄露是独立的问题。密钥管理器能提供额外的权限控制、审计和轮换能力。
- **前端代码中加入并混淆即可**：客户端接收到的值理论上任何人都可查看，应通过服务器层进行处理。
- **轮换太麻烦，一次性生成长期使用**：使用时间越长，一旦泄露造成的损害窗口期就越长。若自动化困难，至少应提前制定废弃流程。

## 参考资料链接

- OWASP, Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- GitHub Docs, About secret scanning: https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning
- GitHub Docs, About push protection: https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection
- GitHub Docs, Removing sensitive data from a repository: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository

← 概念图 (#/post/sec-map)

相关文章：[环境变量与密钥管理](#/post/cloud-secrets) · [认证与加密基础](#/post/sec-authn-crypto) · [Web 漏洞与 OWASP](#/post/sec-owasp)