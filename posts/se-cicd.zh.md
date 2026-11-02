形版本管理（Configuration Management）是指以软件在某个时间点的状态作为基准线，并追踪该基准线发生变化的过程。分支策略和 CI/CD 是让这一工作在团队规模下得以运转的方式。

在 [概要](#/post/cs-sw-engineering) 中已简要介绍了形版本管理，Git 的内部结构详见 [彻底理解 Git](#/post/cs-git)，而流水线与部署方式则请参阅 [CI/CD 与部署策略](#/post/cloud-cicd)。本文档将探讨这些内容之间的概念以及工具选择前的决策标准。

## 什么是形版本及其管理对象

形版本（configuration）是指构成软件的**所有产出物**。它不仅包括源代码，还包括配置文件、构建脚本、依赖库列表、文档和测试代码等。被归类为管理对象的单个项目被称为“形版本项”。

“对代码进行版本控制，但对配置直接修改服务器”是常见的思维误区。即使是相同的代码，如果配置不同导致行为差异，问题便无法复现。因此，形版本管理的核心是将所有随代码一起变化的内容纳入同一历史记录中。

## 基准线

基准线（baseline）是指团队达成共识并固定的“此状态即为标准”的时刻。发布（Release）是典型的基准线。有了基准线，就能实现两件事：一是可以精确地回退到任意时间点；二是可以列出基准线之后发生了哪些变更。

将基准线的概念极度简化后是这样的：对文件内容计算哈希值，再对该列表计算哈希值，即可得到一个代表整体状态的简短 ID。

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

即使颠倒文件顺序，ID 依然相同；只要修改一行配置，ID 就会改变，从而能够比较出具体发生了哪些变化。Git 的提交（commit）哈希正是基于同样的原理。此处代码仅为演示原理而简化，与实际 Git 的实现方式并不完全相同。

## 变更控制

有了基准线，就需要相应的变更流程。当收到变更请求时，需评估影响范围、确定由谁批准，以及将其合并到哪个基准线。在传统开发组织中，这种批准通常以委员会的形式存在。而在现代团队中，Pull Request 审查和强制状态检查往往取代了这一角色。虽然形式不同，但核心原则一致：“必须记录是谁基于什么理由修改了基准线”。

## 版本号也是形版本管理的一部分

附加在基准线上的名称即为版本号。语义化版本控制（SemVer）为 `MAJOR.MINOR.PATCH` 这三个数字赋予了特定含义：

| 升级位置 | 何时升级 | 下方位置 |
|---|---|---|
| MAJOR | 当公开 API 发生不向后兼容的变更时 | MINOR, PATCH 设为 0 |
| MINOR | 当添加向后兼容的新功能时 | PATCH 设为 0 |
| PATCH | 当进行向后兼容的 bug 修复时 | - |

还有几条补充规则：已发布的版本一旦修改，必须发布新版本；类似 `-rc.1` 的预发布标识符优先级低于正式版本；类似 `+build7` 的构建元数据在版本比较时被忽略；只要 MAJOR 版本为 0，就视为随时可能发生重大变更的早期开发阶段。

<details>
<summary>通过代码查看排序规则</summary>

如果使用字符串排序，`1.10.0` 会排在 `1.9.0` 之前。因此必须使用数字进行比较，并遵循预发布标识符的规则。

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

`beta.2` 排在 `beta.11` 之前，是因为将标识符作为数字进行比较的结果。
</details>

## 分支策略取决于部署方式

分支策略是对“通过何种路径构建基准线”的选择。被提及最多的 git-flow 模式设立了 `master`（每次发布时打标签的运营代码）和 `develop`（用于下一次发布的集成分支），并将功能开发、发布准备和运营紧急修复分别划分为 feature、release 和 hotfix 分支。

| 分支类型 | 来源 | 合并目标 |
|---|---|---|
| feature | develop | develop |
| release | develop | master, develop |
| hotfix | master | master, develop |

提出 git-flow 的作者在 2020 年补充的文章中指出，对于像 Web 应用这样持续部署的软件，无需同时维护多个版本，因此采用 GitHub flow 等更简单的流程更为合适。而对于需要显式标记版本号并在现场支持多个版本的软件，git-flow 仍然适用。究竟哪种更好，取决于具体的部署方式。

[彻底理解 Git](#/post/cs-git) 中关于合并（merge）与变基（rebase）的讨论涉及的是“如何合并分支”，而本文档关注的争议点在于“应设置几种类型的分支及其生命周期”。

## CI 是一种习惯而非工具

Martin Fowler 的文章对 CI（持续集成）是这样定义的：团队成员每天至少将各自修改的代码合并一次到公共代码库中，且每次合并时都会触发包含测试的自动构建。文章中提到的与版本管理相关的实践要点如下：

- 将所有内容置于受版本控制的基准线（mainline）上。接收存储库后应能立即构建并运行。
- 将构建自动化为单一命令，并在构建中加入测试，以便绿灯亮起时表明没有重大缺陷。
- 每次向基准线推送时，CI 服务器都会执行构建。
- 修复失败的构建：通常的做法是回滚有问题的提交以让团队继续工作，然后再单独排查原因。
- 保持快速构建：文章大多将 XP 的"10 分钟构建”视为适合大多数项目的标准。
- 使用功能标志（feature flags）等方法隐藏未完成的功能。

最后一项与分支策略相关联。若要实现每日一次合并，则即使功能未在一日内完成也应能合并；因此，与其长期维持分支，不如在代码内部暂时搁置未完成的功能。分支生命周期越长，就越远离 CI“频繁合并”的前提。

由于测试已纳入构建流程，[测试与质量](#/post/se-testing) 中的单元测试与集成测试配置决定了 CI 时间。文章建议优先运行快速的提交构建，而将耗时的测试安排在后续阶段的部署流水线中执行。

## 区分 CI、传递与部署

| 名称 | 自动执行的任务 | 人工执行的任务 |
|---|---|---|
| CI | 合并、构建、测试 | - |
| 持续传递（Continuous Delivery） | 直至达到可部署状态 | 操作部署按钮 |
| 持续部署（Continuous Deployment） | 直至完成生产部署 | 无（依靠监控） |

分阶段的 YAML 示例以及蓝绿、金丝雀等部署方式，请参阅 [CI/CD 与部署策略](#/post/cloud-cicd)。查看部署后的状态则属于 [监控、日志与告警](#/post/cloud-observability) 的范畴。

## 常见误解

- 拥有 CI 服务器就等于实施了 CI：若合并频率较低，即使有服务器，集成问题也会延迟暴露。
- 分支越多越安全：分支存活时间越长，合并时的冲突与集成成本就越高。
- git-flow 是标准：提案者明确指出应根据实际情况灵活调整。
- 版本号即营销名称：在 SemVer 中，它是用于告知公开 API 变更性质的约定。

## 参考资料链接

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Martin Fowler — Continuous Integration](https://martinfowler.com/articles/continuousIntegration.html)
- [nvie — A successful Git branching model](https://nvie.com/posts/a-successful-git-branching-model/)

← [CS 地图](#/post/cs-map)

相关文章：[软件工程基础](#/post/cs-sw-engineering) · [彻底理解 Git](#/post/cs-git) · [CI/CD 与部署策略](#/post/cloud-cicd)