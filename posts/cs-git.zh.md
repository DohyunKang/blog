Git 不仅仅是一个积累文件变更的工具，更准确地说，它是将“提交（commit）”这一系列快照串联起来，而分支（branch）只是指向其中某个快照的标签。一旦理解了这一点，合并（merge）、变基（rebase）和冲突（conflict）就能在同一个框架下理清了。

## 提交与分支是什么

提交是项目在该时间点的整体快照，它拥有一个指向直接前一个提交（父节点）的链接。每个提交都附带一个哈希值（长十六进制字符串）。分支是指向这些提交中某一个的指针。创建新分支并不是复制文件，而是多贴上一个标签，因此瞬间即可完成。`HEAD` 是一个指针，指示当前位于哪个分支（即哪个提交）。

工作流中有三个区域：

| 区域 | 含义 | 移动命令 |
|---|---|---|
| 工作目录 | 当前修改文件的地方 | |
| 暂存区（索引） | 收集准备放入下一个提交的更改 | `git add` |
| 仓库 | 已作为提交确定的记录 | `git commit` |

单独设置 `git add` 的原因是为了允许只选择部分修改进行提交。

这种工具所做的工作称为版本控制。它记录了谁在何时做了什么更改，并允许回退到之前的状态。[详情 → 软件工程基础](#/post/cs-sw-engineering)

## 合并（Merge）

将两个分支合二为一称为合并。这里以 Pro Git 的解释为准，主要有两种情况：

- **快进式合并 (fast-forward)**：如果待合并的分支位于当前分支的直接延伸线上，则无需创建新提交，只需将指针向前移动即可。不会产生新的提交。
- **三路合并 (3-way merge)**：如果两个分支从共同祖先分叉后各自产生了提交，则会利用两个端点和共同祖先这三个快照生成一个新的快照，并创建一个拥有两个父节点的合并提交。

## 冲突

如果双方对同一文件的同一部分进行了不同的修改，Git 无法判断该选择哪一个而会停止处理。此时尚未创建合并提交，`git status` 会显示 `both modified`，文件中会出现冲突标记。

```
<<<<<<< HEAD
main line
=======
feature line
>>>>>>> feature
```

上方（`<<<<<<<` ~ `=======`）代表当前分支，下方代表被引入的分支。解决冲突分为四个步骤：

1. 打开文件，选择保留其中一方、混合两者内容或重新编写，然后删除冲突标记的三行。
2. 执行 `git add <文件>` 告知 Git 冲突已解决。
3. 使用 `git status` 进行确认。
4. 使用 `git commit` 完成合并。

起初看起来似乎很容易忘记删除标记就直接提交，但令人畏惧的并非冲突本身有多难，而是不知道该如何查看和处理。一旦明白标记长什么样，就已经解决了一半了。

## 变基（Rebase）

变基是将当前分支的提交重新放置到另一个分支末尾之上。根据 Pro Git 的解释，其过程是：找到共同祖先，保存每个提交的更改差异（diff），将当前分支移动到目标分支末尾，然后依次重新应用这些差异。最终的文件内容与合并相同，但历史记录的形式不同。它不会产生合并提交，而是一条直线。

我在小型仓库中直接测试了这两种方式。main 和 feature 分支修改了同一行内容的情况如下：合并后形成了分叉再汇合的形态。

```
*   a53bebb merge
|\
| * d6ac9dc feat
* | ffb502f main change
|/
* f1a4288 init
```

对同样的情况使用变基解决冲突并执行 `git rebase --continue` 后，历史记录变成了一条直线。

```
* 84091ca feat
* ffb502f main change
* f1a4288 init
```

可以明显看到 `feat` 的哈希值从 `d6ac9dc` 变成了 `84091ca`。变基并不是移动提交，而是创建具有相同内容的新提交并丢弃旧提交。这一事实引出了以下规则：

<details>
<summary>详细解析：上述练习命令</summary>

在临时文件夹中依次执行了 `git init`、对 a.txt 进行一行提交、在 `feature` 分支中添加一行、以及在 `main` 中对同一文件添加另一行。执行 `git merge feature` 时因 `CONFLICT (content): Merge conflict in a.txt` 而停止，修复文件后执行 `git add` 并提交。随后使用 `git reset --hard HEAD~1` 删除了合并提交，接着在 `feature` 上执行 `git rebase main`，再次出现 `Could not apply ... feat` 的相同冲突。修复后执行 `git add` 并通过 `git rebase --continue` 完成。环境为 git 2.55.0 (Windows)。也就是说，变基也会产生冲突，解决方式与合并相同，只是解决时使用 `rebase --continue` 而非 `merge --continue`。

</details>

## 合并 vs 变基

Pro Git 介绍了两种哲学，并不教导哪一方是赢家。一种是“记录即历史，不应更改”（合并/Merge），另一种是“记录是项目构建的故事，应在公开前整理”（变基/Rebase）。折衷方案是：“在推送之前用变基整理本地工作，对于已经推送的内容绝对不要进行变基。”

| | 合并 (Merge) | 变基 (Rebase) |
|---|---|---|
| 记录形态 | 分叉后合并 | 单一线条 |
| 提交哈希值 | 保持不变 | 重新生成 |
| 合并提交 | 存在 | 不存在 |
| 已共享的提交 | 安全 | 危险 |

核心规则在 Pro Git 中是这样写的：不要对位于仓库外部、且他人可能基于其进行工作的提交执行变基。如果执行变基并强制推送（force push），会导致与同事的记录分叉；当同事拉取代码时，可能会出现相同作者、日期和消息的重复提交。

## 团队工作流

团队中使用的流程几乎已固定下来，主要有两种广为人知的方式：

- **分支方式 (Feature Branch)**：从 `main` 分支分出新分支用于每个功能，完成后通过 pull request 进行审查并合并回 `main`。`main` 分支始终保持在可部署状态。
- **Gitflow**：除了 `main` 外，还设有 `develop`、`feature`、`release`、`hotfix` 等按角色划分的分支。这种方式适合发布周期固定的项目，但对于小团队来说显得过于繁重。

提交消息应简洁地概括“做了什么”以及“为什么做”，这样在将来阅读 `git log` 的人（通常是未来的自己）会受益良多。

## 常见误解

- **分支是文件夹的复制**：实际上，分支只是一个指向提交的指针。因此创建和删除分支非常便宜。
- **删除提交后永久消失**：通过变基或 `reset --hard` 隐藏掉的提交，在一段时间内仍保留在 `git reflog` 中。上述练习中也记录了 `rebase (start)` 和 `rebase (finish)`。不过，一旦超过默认的清理周期，这些记录就会消失，因此不能永久保存。
- **冲突意味着做错了什么**：冲突仅仅表示两个人修改了同一位置，这在团队协作中很常见。
- **Git 就是 GitHub**：Git 是版本控制工具，而 GitHub 是一个托管 Git 仓库并通过 pull request 进行协作的服务。

<details>
<summary>详细解析：常用命令整理</summary>

| 想要做的事 | 命令 |
|---|---|
| 查看状态 | `git status` |
| 查看记录（图形） | `git log --oneline --graph --all` |
| 创建并切换分支 | `git switch -c <名称>` |
| 合并 | `git merge <分支>` |
| 变基（叠在上方） | `git rebase <分支>` |
| 中止合并/变基 | `git merge --abort`, `git rebase --abort` |
| 找回丢失的提交 | `git reflog` |
| 推送前仅整理本地 | `git rebase -i <基准>`（本次交互模式不执行） |

`git pull` 是同时执行获取（fetch）和合并（merge）的命令，而 `git pull --rebase` 则使用变基代替合并。Pro Git 介绍了在强制推送后避免混乱的方法：使用 `git pull --rebase`。

</details>

← [概念图](#/post/cs-map)

相关文章：[软件工程基础](#/post/cs-sw-engineering)、[SOLID 原则](#/post/cs-solid)、[密钥管理](#/post/sec-keys)

## 参考链接

- Pro Git, Basic Branching and Merging: https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging
- Pro Git, Rebasing: https://git-scm.com/book/en/v2/Git-Branching-Rebasing
- (直接运行) git 2.55.0 本地练习：在临时仓库中检查合并、冲突、变基和 reflog
- Atlassian Git Tutorial, Comparing Workflows: https://www.atlassian.com/git/tutorials/comparing-workflows