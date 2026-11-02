ビッグデータ分析士 필기試験は、ビッグデータの概要から始まります。この単元は計算がなく、用語を正確に区別する問題がほとんどです。どの単語がどこに属するかだけ覚えておけば点数が取れます。大きく 4 つの塊に分かれています。ビッグデータの特徴、データの種類、価値創出、個人情報保護です。

## ビッグデータとは何か

IT ウィキは、ビッグデータを「従来のデータ処理能力を超えた大量のデータ、あるいはそのデータを分析して価値を生み出す技術」と定義しています。単に量が大きいだけではビッグデータではなく、分析して活用するものまでを含みます。試験では定義そのものよりも、特徴を V で問われることが多いです。

## 特徴は V で覚える

ガートナーが提唱した 3V が基本です。

| V | 意味 |
|---|---|
| Volume(規模) | 処理するデータの量が従来のデータベースより巨大である |
| Velocity(速度) | データが入り出る速度が非常に速い |
| Variety(多様性) | 非構造化データやダークデータのように種類が多様な |

これに IBM などが追加した項目もあります。

| V | 意味 |
|---|---|
| Veracity(信頼性) | 大容量を高速で処理しながらも品質を維持する |
| Value(価値) | 集めて高速処理し、新たな価値を生み出す |
| Validity(妥当性) | 扱えなかった大容量データを正確に分析・予測する |
| Volatility(揮発性) | 結果が意味を持つ期間内に処理する |

3V に価値を加えると 4V、さらに信頼性を加えると 5V と整理する方法もあります。ただし、教材や機関によって V の数や構成は異なります。4V の第四番目を信頼性に置く場合もあります。そのため、この部分は問題に「V がいくつあるか」が出たら教材の基準に合わせて答え、選択肢に出てくる単語がどの V に該当するかを解き明かして読む方が安全です。

<details>
<summary>V の名前を意味から逆に見つける練習</summary>

選択肢が名前の代わりに説明として出ている場合は、以下のように解きます。

1. 量、大きさ、容量という言葉が見えたら規模です。
2. リアルタイム、入出力が速いという言葉が見えたら速度です。
3. テキスト・映像・ログのように種類が混ざっているという言葉が見えたら多様性です。
4. 品質を維持するという言葉が見えたら信頼性、新たな価値を生み出すという言葉が見えたら価値です。
5. 正確な分析・予測であれば妥当性、結果が有効な期間内に処理すれば揮発性です。

信頼性と妥当性はどちらも「信じていい」という意味で聞こえてしまい、よく混同されます。信頼性はデータ品質の側面、妥当性は分析・予測の精度の側面として区別しておくと混乱しにくいです。
</details>

## データの種類

データは構造がどれだけ決まっているかによって分類されます。IT ウィキの基準で整理すると以下のようになります。

| 種類 | 説明 |
|---|---|
| 構造化 | 決められた形式と規則的な値を持つ。機械による読み取りと自動演算が可能。RDBMS テーブル、スプレッドシート |
| 半構造化 | スキーマ（構造定義）はあるが演算はできない |
| 非構造化 | スキーマもなければ演算もできない |

スキーマがあるかないか、演算ができるかどうかという 2 つの基準で分かれます。構造化データは両方でき、半構造化データはスキーマのみあり、非構造化データはどちらもありません。

ビッグデータが拡大した核心的要因として、構造化データではなく非構造化データの増加が挙げられます。SNS、スマートフォン、IoT センサーから文章、写真、映像、ログが溢れ出るためです。大量の半構造化データは NoSQL で柔軟に照会・更新します。保存に関する話は [詳細 → データ収集と保存](#/post/bd-collection-storage) で続きます。

半構造化データが実際にどのように表に変換されるかは pandas を使えば感覚が掴めます。JSON のように内部で構造が重なっているデータを `json_normalize` で展開しました。項目がないセルは NaN で埋められます。

```python
import pandas as pd

raw = [
    {"user": "u1", "tags": ["x", "y"], "geo": {"city": "서울"}},
    {"user": "u2", "geo": {"city": "부산", "dist": "해운대"}},
]
print(pd.json_normalize(raw))
```

実行すると列が `user`, `tags`, `geo.city`, `geo.dist` の 4 つになり、u1 では `geo.dist` が、u2 では `tags` が空になっています。レコードごとに持つ項目が違うことが半構造化データの性質であり、分析するにはこのように表に展開する前処理が必要です。その段階は [詳細 → データ前処理](#/post/bd-preprocessing) で扱います。

## 価値創出

同じデータでも、誰が、いつ、どのような目的で使うかによって価値が変わります。そのため、ビッグデータの価値を一括して評価するのは困難です。理由としては、活用方法の多様化、新たな価値の創出、分析技術の発展の 3 つが挙げられます。

主体別には以下のように分けて覚えます。

| 主体 | 変化 |
|---|---|
| 企業 | 顧客行動分析による市場変化予測、原価削減、製品差別化 |
| 政府 | 気象・交通・人口データによる政策立案、災害対策 |
| 個人 | 安価にサービスを利用し、目的に合わせてデータを活用 |

ビッグデータが登場して以来、データを扱う方法が 4 つの点で変化したという内容がよく出題されます。

| Before | After | Reason for Change |
|---|---|---|
| Preprocessing | Post-processing | Find hidden information by combining data collected without predefining the format |
| Sampling survey | Census | Lower processing costs allow analysis of the entire population |
| Quality | Quantity | Collecting a large amount reveals overall trends even with some errors |
| Causality | Correlation | Utilize phenomena that occur together even without knowing the cause |

The last line is easily misunderstood. Using correlation does not mean correlation implies causation. Issues requiring causal analysis, such as policy effects or medicine, still require causal analysis. These four pairs are explained in detail in [Data Value and Future →](#/post/adsp-data-value), where ADsP-specific organization is also available; reviewing them together clarifies overlapping parts.

<details>
<summary>When the direction of view is reversed</summary>

This table focuses on the 'Before → After' direction, so incorrect sentences are created in the view by simply reversing the direction. For example, "changed from census to sampling" or "changed from quantity to quality". Remember that the 'After' side includes post-processing, census, quantity, and correlation, and you can immediately filter them out.
</details>

## Using Personal Data with Anonymization

Big data uses a lot of data about people, so methods for hiding personal information are included in exams. The Guidelines on De-identification Measures released by relevant ministries and agencies jointly in June 2016 guide the use of five techniques either individually or in combination. The technique names listed in the Financial Services Commission press release are as follows.

| Technique | Inferred Direction from Name |
|---|---|
| Pseudonymization | Changes identification values to other values |
| Aggregation | Uses aggregated values like sums or averages instead of individual values |
| Data Deletion | Removes all or part of identifying elements |
| Categorization | Groups values into intervals or categories |
| Data Masking | Hides parts so they are not visible |

The press release only lists the technique names without definitions. It is best to align with detailed definitions and examples in textbooks. Pseudonymization and masking, as well as aggregation and categorization, have similar names and are easily confused; remember by distinguishing whether it changes or hides, and whether individual values are retained or aggregated.

The procedure consists of four steps:

1. **Pre-screening**: Check if the data is personal information. If not, it can be utilized without separate measures.
2. **De-identification Measures**: Remove identifying elements using the above techniques.
3. **Appropriateness Assessment**: An external evaluation team checks if the measures are appropriate. At this stage, k-anonymity is used as a quantitative means.
4. **Post-management**: Follow protection measures for safe utilization and prevention of misuse. After the purpose ends, destroy the data, manage access rights, and stop processing and destroy it if re-identification occurs.

k-anonymity is a concept that makes it difficult to infer specific individuals by creating k or more records with the same values. If k=5, there are at least 5 identical records.

I tried categorization, masking, and k-check directly using pandas.

```python
import pandas as pd

df = pd.DataFrame({
    "id":   [1, 2, 3, 4, 5, 6],
    "age":  [23, 27, 24, 41, 45, 43],
    "city": ["서울"] * 3 + ["부산"] * 3,
})

# 범주화: 나이를 구간으로 묶는다
df["age_grp"] = pd.cut(df["age"], bins=[20, 30, 40, 50],
                       labels=["20대", "30대", "40대"], right=False)

# k 확인: 같은 (나이대, 도시) 조합이 몇 건씩인지
sizes = df.groupby(["age_grp", "city"], observed=True).size()
print(sizes)
print("k =", sizes.min())

# 마스킹: 전화번호 뒷자리 가리기
phone = pd.Series(["010-1234-5678", "010-9876-5432"])
print(phone.str.replace(r"-\d{4}$", "-****", regex=True))
```

Running this yields 3 cases for "20s·Seoul" and 3 cases for "40s·Busan", so k=3, and phone numbers change to `010-1234-****` and `010-9876-****`. Looking at this, it becomes clear that grouping values with categorization increases the number of identical combinations, thereby increasing k. This example is a small table created to show the structure and differs from actual appropriateness assessment criteria.

<details>
<summary>Pseudonymized Information and 5 Steps of Pseudonymization</summary>

Separate from the guidelines, there is a concept of pseudonymized information in the Personal Information Protection Act. The Personal Information Protection Commission explains pseudonymized information as information that cannot identify a specific individual without the use or combination of additional information for restoring to the original state. The legal basis is Article 2, Paragraph 1 and Article 28-2 of the Act.

It can be utilized for purposes of statistical compilation, scientific research, and public interest record preservation. Statistical compilation refers to creating quantitative information about specific groups; scientific research involves applying scientific methods like technology development, basic, or applied research; and public interest record preservation means preserving records worth viewing for public benefit.

The pseudonymization procedure consists of five steps: pre-preparation such as setting purposes, risk assessment, pseudonymization, appropriateness review, and safe management. This is a different document's procedure from the 4-step de-identification measure guidelines (pre-screening, de-identification measures, appropriateness assessment, post-management). Distinguish based on which terminology appears in the problem.
</details>

The big picture regarding personal information protection is reviewed separately in [Personal Information and Privacy →](#/post/sec-privacy).

## Common Shapes Appearing in This Unit

Original exam questions are not moved here; only types are summarized.

- **Feature Selection**: Match V names based on descriptions or select items that are not specific V. Confusion arises from mixing reliability, validity, and value.
- **Type Classification**: Divide examples like logs, JSON, tables, and videos into structured, semi-structured, and unstructured data. Solve using the presence of schema and operability.
- **Direction of Change**: Check if the direction aligns with post-processing, census, quantity, and correlation.
- **De-identification**: Match technique names and descriptions, list procedure order, and understand k-anonymity.

試験日程と受験情報は公式ウェブサイトでご確認ください。

## まとめ

- 3V は規模・速度・多様性、4V は付加価値、5V は信頼性の追加。テキストブックごとに構成が異なるため、基準となるテキストブックで確認してください。
- 構造化データはスキーマと演算の両方を持ち、準構造化データはスキーマのみを持ち、非構造化データはどちらも持ちません。
- ビッグデータの進化は事後処理、全数調査、量、相関関係の方向です。
- 匿名化手法の 5 つは、仮名化・集計処理・データ削除・カテゴライズ・データマスキングです。
- 匿名化手順は、事前審査 → 匿名化措置 → 適切性評価（k-匿名性） → 事後管理です。

← 概念マップ ([ビッグデータ分析技術者マップ](#/post/bd-map))

関連記事：[分析課題の定義と分析計画](#/post/bd-planning) · [データの収集と保存](#/post/bd-collection-storage) · [データの前処理](#/post/bd-preprocessing)

## 参考リンク

- [IT ウィキ — ビッグデータ](https://itwiki.kr/w/빅데이터)
- [IT ウィキ — 構造化データ](https://itwiki.kr/w/정형_데이터)
- [IT ウィキ — ビッグデータの価値](https://itwiki.kr/w/빅데이터_가치)
- [金融委員会 — 個人情報匿名化措置ガイドライン報道資料 (2016.6.30)](https://www.fsc.go.kr/no010101/72222)
- [個人情報保護委員会 — 仮名情報](https://pipc.go.kr/np/default/page.do?mCode=D040010000)