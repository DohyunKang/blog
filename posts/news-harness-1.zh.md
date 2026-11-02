# Claude Code 2.1.314 现已支持阻止写入操作超出工作文件夹范围

确认时间点为 2026-11-02。官方文档的变更日志（changelog）顶部显示版本为 2.1.316（10 月 31 日），随后向下浏览了几天记录。大部分是微小修正，但其中一项 2.1.314（10 月 30 日）的内容引人注目：新增了一项设置，使写入工具拒绝访问工作文件夹之外的路径。

## 变更日志中的内容

2.1.314 项的记录如下：

> Added `permissions.blockWritesOutsideWorkingDirectories`: Write, Edit and NotebookEdit refuse paths outside the working directories in every permission mode

展开来说，Write、Edit 和 NotebookEdit 这三个工具将拒绝工作文件夹之外的路径。并且该规则适用于任何权限模式。同一天发布的另一项内容提到，修复了当组织管理员为模型设置了 effort 上限时，每次请求都会返回 "Invalid effort level" 错误的问题。

此外，还记录了周边版本中值得注意的内容：

| 版本 | 日期 | 内容 |
| --- | --- | --- |
| 2.1.316 | 10 月 31 日 | 新增 `CLAUDE_CODE_DISABLE_ULTRATHINK`。Opus 4.8 的 fast mode 已于 10 月 30 日被弃用，计划于 11 月 30 日移除 |
| 2.1.314 | 10 月 30 日 | 新增 `permissions.blockWritesOutsideWorkingDirectories` |
| 2.1.312 | 10 月 27 日 | 修复了下级文件夹中巨大的 CLAUDE.md 文件仅读取部分内容即被覆盖的问题。Write 工具现在会要求完全读取或就地编辑 |
| 2.1.309 | 10 月 22 日 | `sed -i` 不再直接执行，而是通过普通 Bash 检查窗口进行预览而非直接运行。修复了沙箱 Bash 在沙箱外部启动 shell 初始化文件的问题 |

[来源：Claude Code 变更日志](https://code.claude.com/docs/en/changelog)

## 什么是工作文件夹

要理解“围栏”机制，首先需要了解工作文件夹的概念。权限文档中是这样描述的：默认情况下，Claude 可以访问运行所在的目录中的文件，该目录即为该会话的基本工作目录。在通过 `/cd` 切换之前一直如此。

扩大范围的方法有三种：

| 时机 | 方法 |
| --- | --- |
| 启动时 | `--add-dir <路径>` |
| 会话中 | `/add-dir` |
| 持续保持 | 设置文件中的 `additionalDirectories` |

添加的文件夹中的文件也遵循与工作文件夹相同的权限规则。读取无需确认，编辑则遵循当前的权限模式。在 Windows 上，像 `\\server\share` 这样的网络路径通常无法直接作为工作文件夹添加，建议将其挂载为驱动器字母后通过 `--add-dir` 传入。

[来源：权限设置文档](https://code.claude.com/docs/en/permissions)

## 读取方面的设置早已存在

写入方面新增设置意味着读取方面的对应设置早已存在。那就是 `permissions.blockReadsOutsideWorkingDirectories`，其设置文档中的描述为“使文件工具在所有权限模式下拒绝访问工作文件夹之外的文件”。设置文档的例外说明表中指出，该键值在 v2.1.257 及以上版本中，无论在任何范围内设置为 `true` 均会被尊重。即使管理员设置为 `false` 也同样有效。

权限文档中还提到，在 auto 模式下，Claude 首次读取工作文件夹之外的内容时建议启用此设置。

此次写入方面以相同方式新增后，现在可以分别锁定读取和写入了。

## 为什么需要这样的围栏

[Harness](#/post/ai-harness) 的功能之一是对模型请求的 [工具调用](#/post/ai-tool-use) 是否实际执行进行判断。当代理运行 [循环](#/post/ai-agent-loop) 时，会出现人类无法逐一检查的环节，权限模式越宽松，这些环节就越长。此时，如果存在“写入仅限此文件夹内”的限制，那么由于失误或 [提示注入](#/post/sec-prompt-injection) 导致文件被写入错误路径的情况，至少在文件工具层面会被阻止。

关键在于这与权限模式无关。即使为了减少确认窗口而放宽模式，这条界限依然存在。

<details>
<summary>设置文件优先级笔记</summary>

根据设置文档，当同一键出现在多个位置时，优先级较高的配置生效。顺序为：管理员设置、命令行 `--settings`、项目本地（`.claude/settings.local.json`）、共享项目（`.claude/settings.json`）以及用户（`~/.claude/settings.json`）。对于 `permissions.allow` 等列表项，不会进行覆盖而是合并。

设置文件必须是严格的 JSON 格式，若包含 `//` 注释或末尾逗号将导致错误。可通过 `/status` 的 `Setting sources` 行查看已加载的文件。若想使用此设置，个人配置应写入用户文件；若需应用于整个团队，则候选方案为仓库中的 `.claude/settings.json`。

```json
{
  "permissions": {
    "blockWritesOutsideWorkingDirectories": true
  }
}
```

</details>

## 其他值得注意的内容

2.1.309 版本中 `sed -i` 的变更也属于同一范畴。此前 `sed -i` 会像文件编辑一样显示预览，现在则直接通过常规的 Bash 确认窗口执行写入操作。根据变更记录，它也不会像其他 Bash 编辑那样被 `/rewind` 撤销。即使为文件工具设置了围栏，Bash 进行的编辑仍被视为另一条路径。因此，写入围栏是专为文件工具设计的安全机制，而 Bash 则需要单独处理权限规则和沙箱环境。

2.1.312 版本的修改也很有趣。过去曾出现过仅读取 `CLAUDE.md` 或规则文件的前部分内容就直接覆盖的情况，现在 Write 会要求 Claude 先完整读取文件或原地编辑后再写入。这展示了即使在作业文件夹内，写入操作也可能存在风险。

fast mode 模式仅适用于 Opus 4.8 用户。变更记录中注明，若迁移至 Opus 5.5，仍可保持速度优势。

## 总结

现在可以分别通过单行设置禁止在作业文件夹之外进行读取和写入操作。对于习惯使用宽松模式的用户来说，拥有这样一条明确的界限会更方便。关于应授予 Agent 何种权限的讨论，将在 [护栏] (#/post/app-guardrails) 文章中继续展开。

## 参考链接

- [Claude Code 变更记录](https://code.claude.com/docs/en/changelog)
- [权限设置文档](https://code.claude.com/docs/en/permissions)
- [设置文件与优先级文档](https://code.claude.com/docs/en/settings)
- [设置参考](https://code.claude.com/docs/en/settings-reference)