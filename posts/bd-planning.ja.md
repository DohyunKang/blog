Big Data Analysis Engineer Written Exam Outline: The "Data Analysis Planning" section consists of two main parts. The first is **Analysis Strategy Formulation** (Setting the Analysis Roadmap, Defining Analysis Problems, and Analytical Approaches), and the second is **Analysis Execution Planning** (Data Acquisition Plan and Analysis Procedure/Work Plan). Since this stage involves deciding what problems to solve before starting the analysis, in what order to proceed, and how to handle data and risks, questions tend to focus on terminology and sequence rather than calculations. Exam schedules and fees can be checked on the official website. This article summarizes key concepts by section, common pitfalls in multiple-choice questions, and solution methods.

If you have already read ADsP (Analysis Design), there will be significant overlap. Task identification and prioritization are detailed in [Details → Analysis Tasks and Masterplan](#/post/adsp-task-masterplan), while the overall methodology is covered separately in [Details → Analysis Methodology](#/post/adsp-methodology). This article reorganizes the content according to the Big Data Analysis Engineer exam outline.

## Overview at a Glance

| Section | What is Asked | Keywords |
|---|---|---|
| Defining Analysis Problems | What task should be solved? | Top-down, Bottom-up, Use Case |
| Analysis Roadmap | In what order should it be done? | Urgency, Difficulty, 3-Stage Implementation |
| Analysis Procedure | What stages are involved? | 5-Step Methodology, Tasks, Deliverables |
| Data Acquisition Plan | How to obtain necessary data? | Defining Required Data, Collection, Consistency |
| Risk Plan | What if problems arise? | Identification, Avoidance/Transfer/Mitigation/Acceptance |

## Defining Analysis Problems

There are two main ways to identify tasks.

| | Top-down | Bottom-up |
|---|---|---|
| Starting Point | The problem to be solved already exists | Start with data without knowing the problem |
| Application | When the analysis target is clear | When seeking new insights |
| Process | Problem Exploration → Problem Definition → Solution Search → Feasibility Review | Hypothesis Generation → Experimentation → Real-world Testing → Hypothesis Verification |

Top-down approaches are divided into business model-based and external reference model-based problem exploration.

Three factors should be considered in advance during the planning phase: available data, appropriate use cases, and obstacles. Obstacles include cost, accuracy, organizational capability, and change management.

<details>
<summary>Four Solution Approaches: Combination of Existing Systems and Analytical Capabilities</summary>

The method to solve a task depends on whether an existing system is available and whether analytical capabilities exist.

| Existing System | Analytical Capability | Direction |
|---|---|---|
| Exists | Exists | Leverage existing system and personnel |
| Exists | Does not exist | Train or hire |
| Does not exist | Exists | Upgrade the system |
| Does not exist | Does not exist | Outsource to a specialized vendor |

</details>

## Analysis Roadmap: Setting the Order

Tasks cannot be executed all at once, so prioritization is necessary. The factors considered are strategic importance, business performance (ROI), and ease of execution. Reducing these to two axes yields Urgency and Difficulty.

| Axis | What to Consider | ROI Perspective |
|---|---|---|
| Urgency | Connection to strategic goals, KPI target value. Is it needed now or later? | Business Effectiveness |
| Difficulty | Data acquisition/storage/processing costs, analysis application costs, analysis level | Investment Cost |

Multiplying these two axes results in four quadrants.

| Urgency | Difficulty | Order |
|---|---|---|
| Current | Easy | Do first |
| Current | Difficult | Second if urgency is prioritized |
| Future | Easy | Second if difficulty is prioritized |
| Future | Difficult | Do last |

The order of the middle two quadrants changes depending on whether urgency or difficulty is prioritized. Since quadrant numbers (I~IV) vary by source material, it is safer to remember them by their attributes (Urgency and Difficulty) rather than memorizing the numbers. For tasks that are currently needed but difficult, one can first reduce the data volume or analysis scope to lower the difficulty before applying them.

Translating this sequence rule into pandas yields the following structure. This follows an urgency-first criterion and has been verified through direct execution.

```python
import pandas as pd

tasks = pd.DataFrame({
    "과제": ["이탈 예측", "재고 수요 예측", "고객 군집", "챗봇 로그 분석"],
    "시급성": ["미래", "현재", "미래", "현재"],
    "난이도": ["어려움", "어려움", "쉬움", "쉬움"],
})

# 시급성 우선: 현재가 먼저, 같으면 쉬운 것이 먼저
tasks["u"] = tasks["시급성"].map({"현재": 0, "미래": 1})
tasks["d"] = tasks["난이도"].map({"쉬움": 0, "어려움": 1})
tasks = tasks.sort_values(["u", "d"]).drop(columns=["u", "d"]).reset_index(drop=True)
tasks.index += 1
print(tasks)
```

The execution results are as follows:

```
         과제 시급성  난이도
1  챗봇 로그 분석  현재   쉬움
2  재고 수요 예측  현재  어려움
3     고객 군집  미래   쉬움
4     이탈 예측  미래  어려움
```

To change the criterion to prioritize difficulty, simply swap the positions of 'u' and 'd' in the sort keys. Although code does not appear in the exam, understanding that the order of the two axes corresponds to the sort key sequence makes it easy to understand why the middle two quadrants change.

The roadmap is organized into three stages of implementation.

| Stage | Content |
|---|---|
| 1. Introduction of Data Analysis System | Discovery of analysis opportunities, task definition, roadmap formulation |
| 2. Validation of Data Analysis Effectiveness | Design of analysis algorithms, architecture design, pilot execution |
| 3. Expansion and Advancement of Data Analysis | Change management, system construction, advancement of related systems |

適用範囲と手法を決定する際は、業務の内実化レベル、分析データの適用レベル（内部データのみか、外部・非構造化データまで拡大するか）、技術適用レベル（既存技術の活用か新技術の導入か）を検討します。詳細な実施計画は、分析が反復して洗練される性質を持つため、データ収集・準備を順次行い、モデリング段階のみを反復するハイブリッド型が多く採用されているとされています。

アプローチ方法も 2 つに分類されます。「課題中心」は Speed & Test、Quick-Win、Problem Solving であり、「マスタープラン」は Accuracy & Deploy、Long Term View、Problem Definition です。両者のキーワードが入れ替わる選択肢が出やすいので、左側の 3 つを「速く」、右側の 3 つを「長く」捉えるようにグループ化しておくと区別がつきます。

## 分析手順：手法の 5 ステップ

分析作業計画において、分析手順は手法の 5 ステップとして扱います。階層は段階 (Phase) → タスク (Task) → ステップ (Step) の順です。段階は成果物を作成し、タスクは段階を構成する単位の活動であり、ステップは入力・処理・出力からなる単位のプロセスです。

| 順序 | 段階 | 主要タスク | 主要成果物 |
|---|---|---|---|
| 1 | 分析企画 | ビジネス理解および範囲設定、プロジェクト定義および計画策定、プロジェクトリスク計画策定 | プロジェクト範囲定義書 (SOW)、プロジェクト計画書 |
| 2 | データ準備 | 必要データ定義、データストア設計、データ収集および整合性チェック | データ定義書、データストア |
| 3 | データ分析 | 分析用データ準備、テキスト分析、探索的解析、モデリング、モデル評価および検証 | 分析用データセット、モデル評価レポート |
| 4 | システム実装 | 設計および実装、システムテストおよび運用 | システム設計書、運用マニュアル |
| 5 | 評価および展開 | モデル進化計画策定、プロジェクト評価および報告 | モデル進化計画書、最終報告書 |

分析企画が最初で、データ準備よりも先行します。システム実装は評価および展開よりも先行します。各段階を基準線 (baseline) として捉え、バージョン管理により統制します。分析企画段階内のタスクとステップを個別に見ると以下のようになります。

| タスク | ステップ |
|---|---|
| ビジネス理解および範囲設定 | ビジネス理解 → プロジェクト範囲設定 (SOW 作成) |
| プロジェクト定義および計画策定 | データ分析プロジェクト定義 → プロジェクト実行計画策定 |
| プロジェクトリスク計画策定 | データ分析リスク特定 → リスク対応計画策定 |

CRISP-DM や KDD などの他の手法と比較する選択肢は、[詳細 → 分析方法論](#/post/adsp-methodology) を併せて確認してください。

## データ確保計画

目次において、データ確保計画は分析作業計画の下にあり、必要なデータをどのように確保するかを定めることです。手法の 5 ステップに移行すると、2 ステップ「データ準備」のタスクである必要データ定義、データストア設計、データ収集および整合性チェックと続きます。したがって、必要データ定義とデータストア設計が分析企画段階のタスクとして出題される選択肢は誤りです。データ確保計画は分析企画で策定しますが、必要なデータを定義し、ストアを設計する実際のタスクはデータ準備段階に属します。

収集方式（スクレイピング、ETL、API、ログ収集）およびストレージについては、次の単元 [詳細 → データ収集と保存](#/post/bd-collection-storage) で別途扱います。

## リスク計画

プロジェクトリスク計画策定タスクは 2 つのステップからなります。まずデータ分析リスクを特定し、その後に対応計画を立てます。対応方法は 4 つあります。

| 対応 | 意味 |
|---|---|
| 回避 (Avoid) | リスク要因自体を除去または避ける |
| 転嫁 (Transfer) | リスクに伴う責任や影響を第三者に譲渡する |
| 緩和 (Mitigate) | リスクの発生可能性または影響を低減する |
| 受容 (Accept) | リスクを受け入れ、そのまま負担する |

管理 (Management) は対応方法の種類ではありません。選択肢に「リスク管理」が対応方法として含まれていれば誤りです。

<details>
<summary>対応方式のペアリング練習：シナリオ例</summary>

状況を 1 つ作成して 4 つの対応に当てはめてみると区別が早いです。これは例示であり、試験問題とは無関係です。

| リスク | 対応 | 理由 |
|---|---|---|
| 個人情報が混在したデータ | 回避 | そのデータを一切使用しない |
| データ読み込みが遅れる可能性がある | 緩和 | スケジュールに余裕を持たせて、一部を先に読み込む |
| モデル精度が目標に達しない可能性がある | 受容 | そのまま進行し、結果を報告する |
| 分析人材が不足している | 転嫁 | 外部企業に任せる |

</details>

## WBS はどこで使うか

WBS（作業分解構造）は、プロジェクト定義および計画策定タスクの「プロジェクト実行計画策定ステップ」で作成されます。スケジュール、人員、予算計画と合わせて策定します。手法のステップは、WBS のワークパッケージに相当します。分析トピックを定義したり、モデリング案を練ったりすることは、WBS を作成する段階の作業ではありません。

## よく間違える部分

- 必要なデータの定義やデータストア設計を「分析企画」段階のタスクと見なすもの。これは「データ準備」段階です。
- リスク対応策に「管理」を入れたもの。回避、移転、軽減、受容の 4 つです。
- タスク中心とマスタープランのキーワードを入れ替えたもの。
- 緊急性と難易度の 2 つの軸の順序を四半面番号だけで暗記し、資料によって異なる場合。
- トップダウン型 4 ステップの順序を混ぜたもの。問題探索、問題定義、解決策探索、妥当性検証の順です。
- 手法の 5 ステップの順序を入れ替えたもの。分析企画、データ準備、データ分析、システム実装、評価および展開です。

出題問題は、原文をそのまま転記せず、選択肢で迷うポイントのみ記載しました。解き方は、まず 5 ステップの表を書き置き、選択肢に登場するタスクがどのステップの欄に入るかを確認することから始めます。リスク対応は、4 つの単語を暗記すればよい部分です。

次は [詳細 → データ収集と保存](#/post/bd-collection-storage) です。

---

← 概念マップ ([ビッグデータ分析士 マップ](#/post/bd-map))

関連記事：[ビッグデータの概要と活用](#/post/bd-overview) · [分析手法論](#/post/adsp-methodology) · [分析タスクとマスタープラン](#/post/adsp-task-masterplan)

## 根拠リンク

- ビッグデータ分析士 教科書 (IT ウィキ): https://itwiki.kr/w/빅데이터분석기사_교본
- ビッグデータ分析手法論 (IT ウィキ): https://itwiki.kr/w/빅데이터 분석 방법론
- 分析マスタープラン (IT ウィキ): https://itwiki.kr/w/분석 마스터 플랜