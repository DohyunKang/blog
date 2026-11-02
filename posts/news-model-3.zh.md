每当新模型发布，发布会材料中总会附带评分表。SWE-bench、HLE、OSWorld 等名字接连出现，人们比较各个模型的得分。然而今年秋天，新闻焦点却从分数转向了评分表本身。Epoch AI 推出了对基准测试本身进行审查的"Benchmark Reviews"，许多已广泛使用的测试集已被判定为“有缺陷（Flawed）”。以下内容是于 2026 年 11 月 2 日访问 Epoch 页面所确认的信息。

## 这是什么项目？

Benchmark Reviews 是一个对每个基准测试逐一进行审查并给出判定的列表。判定结果分为三类：

| 判定 | 含义 |
|---|---|
| Verified | 已审查且未发现重大问题 |
| Flawed | 存在足以影响分数的错误 |
| Not enough info | 公开信息不足，无法做出判断 |

“有缺陷（Flawed）”的标准是：评分错误对分数影响达到 20% 及以上。Epoch 注明，由其自行开发的基准测试因理解冲突而未纳入审查范围。审查优先级基于三个因素：影响程度、被引用频率、以及是否涉及尚未评估的能力。

## 截至目前的列表

截至确认时间（2026-11-02），共有 24 个项目列入清单，首次审查日期为 8 月 10 日。其中仅列出广为人知的名称如下：

| 基准测试 | 判定 | 审查日期 |
|---|---|---|
| Humanity's Last Exam | Flawed | 8 月 11 日 |
| SWE-bench Verified | Flawed | 9 月 3 日 |
| SWE-Bench Pro | Flawed | 9 月 1 日 |
| Terminal-Bench 4.0.0 | Flawed | 9 月 4 日 |
| Berkeley Function Calling Leaderboard v4 | Flawed | 9 月 10 日 |
| SimpleQA Verified | Verified | 9 月 10 日 |
| OSWorld 2.1 | Flawed | 9 月 28 日 |
| GraphWalks | Verified | 9 月 29 日 |

总体而言，“有缺陷（Flawed）”的项目居多，“已验证（Verified）”的为数较少，其余则因信息不足。信息不足是指因公开资料不全而暂缓判断的情况。

## “测试卷出错”长什么样？

我们检查了其中三项，由于错误类型各不相同，合并查看更易理解。

HLE 随机抽取了 48 道题目由人工复核，发现 22 题（46%）存在可改变分数的错误。其中 12 题题目本身不成立，例如要求计算"4-point DFT"但提供的序列长度为 8；其余题目则是答案键错误，导致正确答案被判定为错误或错误答案被判定为正确。由于样本量为 48 题，审查报告未推测任何模型排名是否因此改变。

SWE-bench Verified 并非由 Epoch 自行抽样，而是基于 OpenAI 于 2 月发布的审计报告。该审计检查了整体中 27.6% 的样本，其中 59.4% 的案例存在抑制功能正确解法的测试问题。两者相乘，意味着至少 16.4% 的整体数据已失效。此外还存在污染问题：截至 9 月 3 日，题目与答案已 100% 公开，OpenAI 得出结论称，其测试的最前沿模型在训练过程中已接触过部分题目和解法。因此，Epoch 将其判定为“无法再测量原本试图评估的能力”。

OSWorld 2.1 从 108 个计算机操作任务中选取了 50 个进行审查，发现其中 36 个任务存在 40 处错误。错误类型分为三类：

- 不可能完成的任务：设置界面中未配置 6 个月订阅期限，但评分器却期望该条件存在；
- 假阳性（false positive）：提交全部 130 份文档即可在不经过选择过程的情况下直接获得满分；
- 假阴性（false negative）：正确答案为"Salesforce License renewal"，但答案键仅为"Salesforce License"，导致得分为 0。

审查范围以满分基准计算，影响程度最高可达 50.4%，并特别强调此为损失上限而非实际测量值。在此基准测试中，GPT-6 Astra 模型因评分错误，在受影响的任务中损失了约 20.8% 的分数。

<details>
<summary>假阳性和假阴性一次性总结</summary>

评分器的任务是判断“此答案是否正确”，因此出错方向有两种：

- 假阴性（false negative）：将正确答案判定为错误，导致模型得分低于实际水平。SWE-bench 的严苛测试、OSWorld 中的字符串不匹配属于此类；
- 假阳性（false positive）：将错误或投机性答案判定为正确，导致模型得分高于实际水平。OSWorld 中提交全部文档、SWE-bench 报告中提到的满分作弊行为属于此类；
- 不可能任务：条件自相矛盾或缺失，无人能够答对，导致分数上限低于 100%。

如果双向错误相互抵消，结果可能看起来不错，但由于不同模型对某一类错误的敏感度存在差异，排名仍可能出现波动。

</details>

## 审查方式中的显著特点

HLE 和 OSWorld 的审查流程均采用先由 AI 筛选可疑问题、再由人工逐一确认并定性的顺序。OSWorld 的记录中提到，针对每个任务会附加一个子代理进行遍历。这种“代理提出候选项、人工最终确认”的结构，与 [子代理](#/post/ai-subagent) 文章中总结的并行作业方式相似。不过，若未能满足证据标准的相关指摘会被直接舍弃。

另一个显著特点是审查仅针对部分内容：一旦超出"Flawed"判定标准，审查即告停止。因此，被判定为 Flawed 的基准测试中，后续项目（如评估环境偏差等）将保持未评估状态。HLE 和 SWE-bench 页面目前仍未链接开发者的回应内容。

## 查看评分表时的变化

在对比模型发布数据时，现在会注意到基准测试名称旁是否标注了 Epoch 判定结果。即使被标记为 Flawed，分数也并非毫无意义。20% 这一阈值是由 Epoch 设定的标准；若同类错误对所有模型的影响程度相近，排名大体可维持稳定。然而，当“得分提升”的差距较小时，可能仍处于试卷误差范围内。

这与 [LLM 应用评估](#/post/app-eval) 中讨论的“黄金集”和评分器校验属于同一类问题：随着对公开基准测试的信任度下降，在自身应用中运行的自定义小型评估集将更具实用价值。模型选择本身可在 [AI 模型图谱](#/post/ai-models) 中按系列进行查看。

## 参考资料链接

- Epoch AI, Benchmark Reviews 列表与文档：https://epoch.ai/data/benchmark-reviews-documentation/included-benchmarks
- Epoch AI, Humanity's Last Exam 审查报告：https://epoch.ai/benchmarks/hle/review
- Epoch AI, SWE-bench Verified 审查报告：https://epoch.ai/benchmarks/swe-bench-verified/review
- Epoch AI, OSWorld 2.1 审查报告：https://epoch.ai/benchmarks/osworld-2-1/review
- Epoch AI, FrontierMath Tiers 1-3 (v2)：https://epoch.ai/benchmarks/frontiermath-tiers-1-3-v2

← 概念图谱 (#/post/ai-map)

相关文章：[AI 模型图谱](#/post/ai-models) · [LLM 应用评估](#/post/app-eval) · [幻觉](#/post/ai-hallucination)