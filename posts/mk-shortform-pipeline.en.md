# Pipeline for Semi-Automated Creation and Deployment of Short-Form Videos Using AI

**One-sentence summary:** Automating short-form video creation is less about the production itself and more about deciding "where a human needs to look once." Surprisingly, upload APIs are quite easy to work with.

This is a study note; I didn't run it myself but organized information based on official documentation and resources. This is general theory unrelated to daily company work.

## Overall Flow

```
[주제 발굴] → [대본] → [음성(TTS)] → [영상 합성] → [자막] → [검수] → [업로드 예약] → [성과 분석]
 트렌드·댓글   LLM     TTS API      템플릿 렌더    음성 인식     사람     각 플랫폼 API    조회·시청유지
      ▲                                                                              │
      └──────────────────────── 잘 된 주제를 다시 주제 목록으로 ─────────────────────────┘
```

I called this "semi-automated" because of the review step. If you remove that step, it becomes fully automated, but as mentioned in the limitations section below, removing it isn't easy.

## Step-by-Step

**Topic Discovery.** This is the most ambiguous stage for automation. There are mainly two approaches: extracting what performs well from your channel's comments and view data, or scraping trends from other channels and search terms. Tools typically include the YouTube Data API, Google Trends, and various keyword tools. In practice, it seemed realistic to ask an LLM to generate 20 candidates for a human to select the top 3.

**Script.** This is where LLMs excel best. Short-form videos are short, typically 15–45 seconds, which translates to roughly 150–400 characters in Korean. If you fix the structure (Hook in the first 2 seconds → Main content → Conclusion) in the prompt, variance decreases. Costs are negligible. However, since factual accuracy can be wrong, topics involving numbers or proper nouns should still be reviewed by a human.

**Voice.** Text-to-Speech (TTS) APIs are the standard here. ElevenLabs charges per character; their official pricing page lists Flash/Turbo at $0.05 per 1,000 characters and Multilingual v2/v3 at $0.10. Some third-party articles mention Flash at $0.04, so numbers vary. Always check the pricing page directly before using it. A 300-character script comes out to a few tens of won per video. There are many reports that Korean intonation sounds unnatural.

**Video Composition.** There are two approaches:
- **Template-based:** Using Remotion (coding videos with React) or FFmpeg to assemble background video, audio, and text. Since you just swap data into the same template, results are consistent. You can run scripts via `npx remotion render` or `renderMedia()`. While Remotion is free for individuals and small-scale use, companies reportedly need a paid license. Statements about version changes exist, so check the LICENSE file directly.
- **Generative:** Creating scenes using image/video generation models. Costs are applied per clip, and results can be inconsistent, so I think this should only be used as an auxiliary component in semi-automated pipelines. Specific unit prices change frequently depending on the service.

**Subtitles.** Subtitles are almost essential for Shorts and Reels since many people watch without sound. If you're using TTS-generated audio, you can use the script text directly and extract timing via speech recognition. The `openai-whisper` library provides word-level start and end times with the `word_timestamps` option. There were forum posts stating that hosted APIs don't provide this output as well as local libraries, though complementary projects like WhisperX exist. Running locally costs zero if you have a GPU.

**Scheduled Upload.** This stage was more organized than expected.
- **YouTube:** Upload via the Data API's `videos.insert`. The default allocation is 10,000 units per day, and older sources state 1,600 units per upload. However, a third-party article from December 2025 suggests it dropped to about 100, and a summary of official documentation lists `videos.insert` as a separate daily bucket of 100 requests. Numbers vary across sources, so recheck official docs for accurate figures. Either way, uploading a few videos per day poses no issue for individual-scale operations.
- **Instagram Reels:** Use Instagram Graph API's Content Publishing. Create a container (`media_type=REELS`, `video_url`) and publish with `media_publish`. Official documentation (updated 2026-06-30) states up to 100 posts per 24 hours via API, whereas older docs said 50. Uploading videos requires them to be hosted at a public URL, which is cumbersome. Business or Creator accounts are required.
- **Scheduling:** Use each platform's native scheduling feature, or configure your own scheduler (cron, queue) to trigger the API at set times.

**Performance Analysis.** Fetch views, average watch time, and retention rates using YouTube Analytics API and Instagram Insights. While many say "completion rate" is more valuable than raw views for choosing the next topic in short-form video, this is anecdotal; I couldn't attach supporting links. The arrow in the diagram above represents returning this value to the topic list.

## Costs and Limitations

Rough calculations per video are as follows (assuming a 300-character script and one LLM call).

| Item | Method | Estimated Cost per Episode |
|---|---|---|
| Script | LLM Call | Under 10 won |
| Voice | Cloud TTS | Several dozen won (based on the listed rate) |
| Video | Remotion/FFmpeg locally | 0 won (PC electricity only) |
| Subtitles | Whisper locally | 0 won |
| Upload | Official API | 0 won |

At around 100 won per episode, even producing 100 episodes a month would cost less than 10,000 won. The real issues are time and quality, not money.

Limitations I've noticed:
- YouTube may exclude mass-produced or repetitive content as "inauthentic content" from monetization. There are reports that the name changed on July 15, 2025, and this was a clarification of existing text rather than a new rule. However, most of this information comes from third-party articles.
- AI-generated or altered content that looks realistic must have "Altered or synthetic content" disclosure enabled in YouTube Studio. Official help documentation summarizes that enabling this does not necessarily reduce exposure.
- Continuously generating videos using the same template makes them all look similar, which aligns with the aforementioned policy and makes it difficult to bypass the review step.
- API limits (quotas and posting caps) vary by document, so you must check the current documentation directly before implementation.

## If I Build It Myself

I plan to start by reducing my ambitions as follows:

1. Maintain a topic list in a single spreadsheet or JSON file. The LLM fills in candidates, and I mark approvals.
2. For approved topics only: generate script → TTS → Whisper for word timing → render using a Remotion template. All of this can be bundled into one script.
3. Save the resulting MP4 and script to a folder, then manually move only the ones I review and approve into an `approved/` directory. This is the only manual step.
4. A scheduler monitors the `approved/` folder and uploads to YouTube (`videos.insert`) at scheduled times. Instagram is deferred to a second phase due to issues with posting video URLs.
5. Once a week, pull performance metrics and add retention rates next to the topic list.

I'll start by running about three episodes per week and first assess how much time the review process takes. If that time is too long, the value of automation diminishes.

<details>
<summary>Detailed breakdown: Implementation notes for the upload stage</summary>

- YouTube uploads require user authentication via an OAuth 2.0 consent screen. When running on a server, you obtain and store a refresh token once. Tokens and keys must not be stored in repositories; keep them as environment variables only.
- Instagram Reels posting sequence: (1) `POST /{ig-id}/media` with `media_type=REELS`, `video_url`, and `caption`; (2) poll until the container status is complete; (3) `POST /{ig-id}/media_publish` with `creation_id`. The documentation states that containers expire after 24 hours, and there's also a limit of 400 container creations per day.
- Remaining posting limits can be checked via `GET /{ig-id}/content_publishing_limit`.
- When creating subtitles using Whisper word timing, many reviews suggest breaking lines into 2–4 words per line, with a maximum of two lines, for better readability on vertical videos. For Korean, breaks are made based on phrases.
- If rendering is slow, cloud rendering options like Remotion Lambda exist, but they incur additional fees. For a small number of episodes, local rendering appears sufficient.

</details>

## Reference Links

- YouTube Data API quota cost calculation: https://developers.google.com/youtube/v3/determine_quota_cost
- Blotato, YouTube API pricing summary (quota change claims, third-party): https://www.blotato.com/blog/youtube-api-pricing
- Meta, Instagram Platform Content Publishing: https://developers.facebook.com/documentation/instagram-platform/content-publishing
- ElevenLabs API pricing: https://elevenlabs.io/pricing/api
- ElevenLabs API pricing summary (third-party, 2026-06): https://developer.puter.com/tutorials/elevenlabs-api-pricing/
- OpenAI Community, word timestamp question: https://community.openai.com/t/how-can-i-get-word-timestamp/333939
- Introduction to creating videos with Remotion (third-party): https://yuv.ai/blog/remotion
- YouTube Help, disclosure of altered and synthetic content: https://support.google.com/youtube/answer/14328491
- Inauthentic content policy explanation (third-party): https://ppc.land/youtube-clarifies-inauthentic-content-policy-changes/