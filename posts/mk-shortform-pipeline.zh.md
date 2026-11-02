# 使用 AI 半自动制作与部署短视频的管道整理

一句话总结：短视频自动化中，“人眼审核”的工作量比“制作”本身更大，而上传 API 意外地简单。

这是学习笔记，并未亲自运行测试，而是查阅官方文档和资料整理而成。所述内容为通用理论，与公司日常工作无关。

## 整体流程

```
[주제 발굴] → [대본] → [음성(TTS)] → [영상 합성] → [자막] → [검수] → [업로드 예약] → [성과 분석]
 트렌드·댓글   LLM     TTS API      템플릿 렌더    음성 인식     사람     각 플랫폼 API    조회·시청유지
      ▲                                                                              │
      └──────────────────────── 잘 된 주제를 다시 주제 목록으로 ─────────────────────────┘
```

之所以说是“半自动”，是因为存在“审核”环节。若去掉该环节则可实现全自动，但正如下文“局限”部分所述，去除它并不容易。

## 分步详解

**选题挖掘。** 这是最难自动化的环节。方法主要有两种：从自身频道的评论与浏览数据中筛选表现好的内容，或抓取他人频道及搜索趋势数据。可用工具包括 YouTube Data API、Google Trends 及各种关键词工具。现实中看来，让 LLM 生成 20 个候选主题供人工挑选 3 个较为可行。

**剧本。** 这是 LLM 最擅长的部分。短视频时长较短（15~45 秒），韩语剧本约 150~400 字。若在提示词中固定结构（前 2 秒钩子→正文→结尾），可减少偏差。成本几乎可忽略不计。但需注意事实准确性，涉及具体数据或专有名词的主题仍需人工复核。

**语音。** 典型方案是使用 TTS API。ElevenLabs 按字符计费；其官方价格页面显示 Flash/Turbo 版本为每 1,000 字 $0.05，Multilingual v2/v3 为 $0.10。第三方文章中也有将 Flash 标价为 $0.04 的情况，数据存在出入。使用前务必查阅官方价格页面。按 300 字剧本计算，单条成本仅几十韩元。不过有不少反馈称韩语语调不够自然。

**视频合成。** 分为两类：
- **模板型**：使用 Remotion（用 React 代码生成视频）或 FFmpeg 将背景视频、语音和文本进行组装。只需替换数据即可套用同一模板，结果稳定。可通过 `npx remotion render` 或 `renderMedia()` 在脚本中执行。Remotion 对个人和小规模用户免费，但企业需购买付费许可证。版本可能影响许可条款，建议直接查看 LICENSE 文件。
- **生成型**：利用图像/视频生成模型构建场景。成本按片段累加，且结果波动较大，因此在半自动管道中仅适合作为辅助手段。具体单价各服务商频繁变动。

**字幕。** Shorts 和 Reels 有大量静音观看用户，因此字幕几乎是必需的。若使用 TTS 生成的语音，可直接复用剧本文本，仅需通过语音识别提取时间戳即可。OpenAI Whisper 库提供 `word_timestamps` 选项以获取每个单词的起止时间。有论坛帖子指出托管 API 的输出不如本地库完整，并提及 WhisperX 等改进项目。若在本地运行，只要有 GPU 即可实现零成本。

**上传与预约。** 此环节整理得相当完善：
- **YouTube**：通过 Data API 的 `videos.insert` 接口上传。基础配额为每日 10,000 单位；旧资料显示每次上传消耗 1,600 单位，但 2025 年 12 月有第三方文章称降至约 100 单位。官方文档摘要则将 `videos.insert` 列为独立的每日 100 次配额桶。因资料说法不一，准确数字仍需查阅最新官方文档。无论哪种情况，对个人用户而言每日上传几篇视频均无问题。
- **Instagram Reels**：使用 Instagram Graph API 的 Content Publishing 功能。创建容器（设置 `media_type=REELS`、`video_url`），再通过 `media_publish` 发布帖子。官方文档（更新至 2026-06-30）指出 API 发布上限为每日 100 条，旧版文档则为 50 条。需将视频托管于公开 URL，较为繁琐；且必须使用商业或创作者账号。
- **预约**：可利用各平台自带功能，或在本地通过调度器（cron、消息队列）在指定时间触发 API 调用。

**成效分析。** 通过 YouTube Analytics API 和 Instagram Insights 获取浏览量、平均观看时长和留存率等指标。短视频领域普遍认为“完播率”比单纯浏览量更具参考价值，可用于下一选题决策，但这属于经验之谈，暂无确凿数据支持（故未附参考链接）。图中箭头表示将该指标反馈至主题列表。

## 成本与局限

以单条视频为基准估算如下：假设剧本 300 字、调用 LLM 一次。

| 项目 | 方式 | 单集成本估算 |
|---|---|---|
| 脚本 | LLM 调用 | 数韩元以下 |
| 语音 | 云端 TTS | 数十韩元（基于上述单价） |
| 视频 | Remotion·FFmpeg 本地运行 | 0 韩元（仅 PC 电费） |
| 字幕 | Whisper 本地运行 | 0 韩元 |
| 上传 | 官方 API | 0 韩元 |

单集成本在 100 韩元左右，即使每月制作 100 集，总成本也在 1 万韩元左右。比起金钱，时间和质量才是关键问题。

我感受到的局限性：
- YouTube 可能将大规模生产或重复性内容视为"inauthentic content"（不真实内容），从而排除在收益之外。据报道，相关名称已于 2025 年 7 月 15 日更改，这并非新规则，而是对措辞的澄清。不过，这些信息大多来自第三方文章。
- 看起来像真实的 AI 生成或变形内容，需要在 YouTube Studio 中开启“变形或合成内容”公开设置。官方帮助文档指出，开启该设置并不会减少曝光度。
- 若持续使用相同模板批量制作，视频会变得千篇一律。这与上述政策相关，因此难以跳过审核环节。
- API 的数字限制（配额、发布上限）因文档而异，在实现前必须直接查阅当前文档。

## 如果自行构建

我会降低欲望，按以下方式起步：

1. 主题列表只需一个电子表格或 JSON 文件。由 LLM 填充候选项，我进行批准标记。
2. 仅对已批准的主题生成脚本 → TTS → Whisper 进行单词级时间戳对齐 → 使用 Remotion 模板渲染，至此可用单个脚本串联完成。
3. 将生成的 mp4 视频和脚本文件存入文件夹，经我审阅通过后，仅将合格内容移至 `approved/` 目录。这是唯一需要人工干预的环节。
4. 调度器监控 `approved/` 目录，在预定时间通过 YouTube API (`videos.insert`) 进行上传。Instagram 因存在视频公开 URL 问题，需分两步处理，故暂缓实施。
5. 每周汇总一次成果，将观众留存率添加到主题列表旁。

初期建议以每周约 3 集的速度试运行，先评估审核所需的时间。若耗时过长，自动化的意义便会大打折扣。

<details>
<summary>详细解析：上传阶段实现笔记</summary>

- YouTube 上传需要用户通过 OAuth 2.0 同意屏幕进行身份验证。在服务器上运行时，可一次性获取并存储刷新令牌。切勿将令牌或密钥存入代码仓库，而应仅作为环境变量保存。
- Instagram Reels 发布流程：(1) 向 `POST /{ig-id}/media` 发送请求，包含 `media_type=REELS`、`video_url` 和 `caption`；(2) 轮询容器状态直至完成；(3) 向 `POST /{ig-id}/media_publish` 发送 `creation_id`。文档指出容器将在 24 小时后过期，同时 24 小时内的容器创建上限为 400 个也一并注明。
- 剩余发布配额可通过 `GET /{ig-id}/content_publishing_limit` 接口查询。
- 使用 Whisper 进行单词级字幕对齐时，许多反馈建议每行 2~4 个单词，最多分两行，这样在竖屏视频中更易阅读。对于韩语，则按词组进行切分。
- 若本地渲染速度较慢，虽可使用 Remotion Lambda 等云端渲染服务，但会产生额外费用；因此若制作集数较少，本地渲染已足够。

</details>

## 参考资料链接

- YouTube Data API 配额费用计算：https://developers.google.com/youtube/v3/determine_quota_cost
- Blotato, YouTube API 定价整理（声称配额变更，第三方）：https://www.blotato.com/blog/youtube-api-pricing
- Meta, Instagram 平台内容发布：https://developers.facebook.com/documentation/instagram-platform/content-publishing
- ElevenLabs API 价格：https://elevenlabs.io/pricing/api
- ElevenLabs API 价格整理（第三方，2026-06）：https://developer.puter.com/tutorials/elevenlabs-api-pricing/
- OpenAI 社区，关于 word timestamp 的提问：https://community.openai.com/t/how-can-i-get-word-timestamp/333939
- 使用 Remotion 制作视频介绍（第三方）：https://yuv.ai/blog/remotion
- YouTube 帮助中心，关于变形与合成内容的公开说明：https://support.google.com/youtube/answer/14328491
- 非真实内容政策说明（第三方）：https://ppc.land/youtube-clarifies-inauthentic-content-policy-changes/