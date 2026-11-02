# Claude Code 2.1.314: Write operations are now blocked from paths outside the working directory

Checked on 2026-11-02. The top of the official changelog was version 2.1.316 (October 31), and I scrolled down a few days' worth of entries. Most were minor tweaks, but one entry for 2.1.314 (October 30) caught my attention: a new setting has been added to prevent write tools from accessing paths outside the working directory.

## What the changelog says

The 2.1.314 entry reads as follows:

> Added `permissions.blockWritesOutsideWorkingDirectories`: Write, Edit and NotebookEdit refuse paths outside the working directories in every permission mode

In plain terms, the Write, Edit, and NotebookEdit tools will now reject paths outside the working directory. This applies regardless of the permission mode. On the same day, another entry notes that a bug where "Invalid effort level" errors occurred on every turn when an organization admin had set an upper limit on the model's effort has been fixed.

I've also noted other notable changes in surrounding versions:

| Version | Date | Description |
| --- | --- | --- |
| 2.1.316 | October 31 | Added `CLAUDE_CODE_DISABLE_ULTRATHINK`. Opus 4.8's fast mode was deprecated on October 30 and scheduled for removal on November 30. |
| 2.1.314 | October 30 | Added `permissions.blockWritesOutsideWorkingDirectories` |
| 2.1.312 | October 27 | Fixed an issue where a very large CLAUDE.md file in a subfolder was being overwritten by reading only the beginning. Write now requests to read everything or edit in place. |
| 2.1.309 | October 22 | `sed -i` now executes directly via a standard Bash prompt instead of a file edit preview. Fixed an issue where sandboxed Bash was executing shell startup files outside the sandbox. |

[Source: Claude Code Changelog](https://code.claude.com/docs/en/changelog)

## What is the working directory?

To understand the fence, you must first understand the working directory. The permissions documentation states: By default, Claude can access files in the directory where it was launched, and that directory serves as the session's default working directory. This remains true until you switch directories using `/cd`.

There are three ways to expand this scope:

| Timing | Method |
| --- | --- |
| At startup | `--add-dir <path>` |
| During session | `/add-dir` |
| Persistently | `additionalDirectories` in the settings file |

Files in added folders follow the same permission rules as the original working directory. Reads are allowed without restriction, while edits adhere to the current permission mode. On Windows, network paths like `\\server\share` generally cannot be added as a working directory; instead, you should mount them as drive letters and pass them via `--add-dir`.

[Source: Permissions Settings Documentation](https://code.claude.com/docs/en/permissions)

## Read-side settings already existed

The fact that a write-side setting is new implies that its read-side counterpart already existed. That setting is `permissions.blockReadsOutsideWorkingDirectories`, described in the settings documentation as "File tools refuse to read outside the working directory in all permission modes." The exception table in the settings documentation notes that this key, when set to `true` anywhere from v2.1.257 onward, will be respected regardless of whether the admin setting is `false`.

The permissions documentation also suggests enabling this setting when Claude first reads outside the working directory in auto mode.

With the addition of the write-side setting, you can now separately lock down reads and writes.

## Why are these fences necessary?

One of the things [Harness](#/post/ai-harness) does is determine whether to actually execute a [tool call](#/post/ai-tool-use) requested by the model. As an agent loops through its [agent loop](#/post/ai-agent-loop), there are segments that humans do not review individually, and these segments grow longer as permission modes become more lenient. Having a boundary stating "writes must stay within this folder" prevents files from being written to unintended paths due to mistakes or [prompt injection](#/post/sec-prompt-injection), at least on the file tool side.

The key point is that this fence is independent of the permission mode. Even if you loosen the mode to reduce confirmation prompts, this boundary remains in place.

<details>
<summary>Settings file priority note</summary>

According to the settings documentation, higher-priority values take precedence when the same key appears in multiple locations. The order of priority is: Admin Settings, Command-line `--settings`, Project Local (`.claude/settings.local.json`), Shared Project (`.claude/settings.json`), and User (`~/.claude/settings.json`). Lists such as `permissions.allow` are merged rather than overwritten.

Settings files must be strict JSON; comments like `//` or trailing commas will cause errors. Loaded settings can be verified in the `Setting sources` line of `/status`. If you want to use this setting, place it in your personal settings for user-specific configuration, or use the repository's `.claude/settings.json` if you intend to apply it across an entire team.

```json
{
  "permissions": {
    "blockWritesOutsideWorkingDirectories": true
  }
}
```

</details>

## Other Notable Changes

The `sed -i` change in 2.1.309 falls within the same context. Previously, `sed -i` would show a preview like a file editor; now, it executes exactly as written after passing through the standard Bash confirmation prompt. According to the changelog, edits made this way are not reverted via `/rewind` like other Bash edits. Even if you sandbox file tools, Bash-based editing is interpreted as occurring on a different path. Therefore, write sandboxes serve as safety mechanisms for file tools, while Bash must be handled with separate permission rules and sandboxing.

The fix in 2.1.312 is also interesting. Previously, very large CLAUDE.md or rule files would sometimes be overwritten after only reading the beginning; now, Write instructs Claude to read everything entirely or edit in place. This demonstrates that writing within the working folder can still be risky.

The fast mode applies only to Opus 4.8 users. The changelog notes that moving to Opus 5.5 allows you to maintain the speed advantage.

## Summary

We can now control read and write operations outside the working folder with individual setting lines. Users who prefer looser modes might find it reassuring to have such a fixed boundary. Determining how much authority to grant an agent will be discussed further in the [Guardrails](#/post/app-guardrails) post.

## Reference Links

- [Claude Code Changelog](https://code.claude.com/docs/en/changelog)
- [Permissions Documentation](https://code.claude.com/docs/en/permissions)
- [Settings Files and Priority Documentation](https://code.claude.com/docs/en/settings)
- [Settings Reference](https://code.claude.com/docs/en/settings-reference)