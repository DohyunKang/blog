The Big Data Analysis Specialist written exam begins with the Overview of Big Data. This unit consists mostly of problems that do not require calculations but rather precise terminology; if you can identify which word belongs to which category, you will score well. It is broadly divided into four parts: characteristics of Big Data, data types, value creation, and personal information protection.

## What is Big Data?

IT Wiki defines Big Data as "massive amounts of data that exceed existing data processing capabilities" or "technologies that create value by analyzing such data." Having a large volume alone does not make it Big Data; the definition includes the analysis and utilization of the data. In exams, questions often focus on the characteristics (the Vs) rather than the definition itself.

## Memorize the Characteristics as 'Vs'

The three Vs proposed by Gartner are the basics.

| V | Meaning |
|---|---|
| Volume | The volume of data processed is massive compared to traditional databases |
| Velocity | The speed at which data enters and exits is very fast |
| Variety | There are many types, such as unstructured data and dark data |

There are additional items added by IBM and others.

| V | Meaning |
|---|---|
| Veracity | Maintains quality while processing massive volumes quickly |
| Value | Creates new value by collecting and processing quickly |
| Validity | Accurately analyzes and predicts using massive data that was previously unmanageable |
| Volatility | Processes results within the period during which they hold meaning |

Some resources summarize this as 4Vs if value is added to the original three, or 5Vs if veracity is added. However, the number of Vs and their composition vary by textbook and organization. Some places list reliability as the fourth V. Therefore, if a question asks "How many Vs are there?", align your answer with your textbook. It is safer to read through the options and determine which V each word corresponds to.

<details>
<summary>Practice: Finding V names from meanings</summary>

If the option appears as an explanation instead of a name, solve it like this:

1. If words like "volume," "size," or "capacity" appear, it is Volume.
2. If words like "real-time" or "fast input/output" appear, it is Velocity.
3. If words indicating mixed types (e.g., text, video, logs) appear, it is Variety.
4. If maintaining quality is mentioned, it is Veracity; if creating new value is mentioned, it is Value.
5. If accurate analysis/prediction is mentioned, it is Validity; if processing within the valid period of results is mentioned, it is Volatility.

Veracity and Validity are often confused because both sound like "trustworthy." Distinguish them by associating Veracity with data quality and Validity with the accuracy of analysis and prediction to avoid confusion.
</details>

## Data Types

Data is classified based on how much its structure is defined. According to IT Wiki, it is summarized as follows:

| Type | Description |
|---|---|
| Structured | Has a fixed format and regular values; machine-readable and suitable for automatic computation (e.g., RDBMS tables, spreadsheets) |
| Semi-structured | Has a schema (structure definition) but cannot be computed directly |
| Unstructured | Has no schema and cannot be computed directly |

You can think of this as being divided based on two criteria: whether it has a schema and whether it supports computation. Structured data satisfies both, semi-structured data has only a schema, and unstructured data has neither.

A key factor in the growth of Big Data is not an increase in structured data, but rather an increase in unstructured data. This is because text, photos, videos, and logs are pouring out from SNS, smartphones, and IoT sensors. Massive amounts of semi-structured data are flexibly queried and updated using NoSQL. For details on storage, see [Data Collection and Storage](#/post/bd-collection-storage).

You can get a feel for how semi-structured data actually transforms into tables by looking at pandas. Data with nested structures, like JSON, is flattened using `json_normalize`. Empty cells are filled with NaN.

```python
import pandas as pd

raw = [
    {"user": "u1", "tags": ["x", "y"], "geo": {"city": "서울"}},
    {"user": "u2", "geo": {"city": "부산", "dist": "해운대"}},
]
print(pd.json_normalize(raw))
```

Upon execution, the columns `user`, `tags`, `geo.city`, and `geo.dist` appear; `geo.dist` is empty for u1, and `tags` is empty for u2. The fact that items vary per record is characteristic of semi-structured data, and preprocessing to flatten such data into a table is required for analysis. This step is covered in [Data Preprocessing](#/post/bd-preprocessing).

## Value Creation

The value of the same data varies depending on who uses it, when, and for what purpose. Therefore, assigning a single value to Big Data is difficult. The reasons include the diversification of usage methods, creation of new value, and advancements in analysis technology.

Here is how to memorize the changes by stakeholder:

| Stakeholder | Changes |
|---|---|
| Enterprise | Predict market changes through customer behavior analysis, cost reduction, product differentiation |
| Government | Policy formulation and disaster preparedness using weather, traffic, and population data |
| Individual | Use services affordably and utilize data according to specific purposes |

Content frequently appears stating that the way data is handled has changed in four areas since the advent of Big Data.

| Before | After | Reason for Change |
|---|---|---|
| Preprocessing | Post-processing | Instead of defining a format in advance, we collect data and then combine it to uncover hidden information. |
| Sampling survey | Census | Lower processing costs allow analysis of the entire population. |
| Quality | Quantity | With large amounts of data, overall trends become apparent even if some errors exist. |
| Causality | Correlation | We leverage phenomena that occur together without necessarily knowing the cause. |

The last row is often misunderstood. Just because we use correlation does not mean correlation implies causation. Issues requiring causal analysis, such as policy effectiveness or medicine, still require causal analysis. These four pairs are explained in detail in [Data Value and Future →](#/post/adsp-data-value), where a separate section on ADsP clarifies overlapping parts when viewed together.

<details>
<summary>When the direction of view is reversed</summary>

This table focuses on the 'Before → After' direction, so incorrect sentences are created by simply reversing the direction in the questions. For example, "changed from census to sampling" or "changed from quantity to quality." Remember that the "After" side includes post-processing, census, quantity, and correlation; this will help you filter out incorrect options immediately.
</details>

## Using Data with Personal Information Masked

Big data uses a lot of data about people, so methods for masking personal information are often tested. The Guidelines on De-identification Measures released by relevant ministries in June 2016 guide the use of five techniques individually or in combination. The names of these techniques from the Financial Services Commission press release are as follows:

| Technique | Inferred Direction from Name |
|---|---|
| Pseudonymization | Changes identification values to other values. |
| Aggregation | Uses aggregated values like sums or averages instead of individual values. |
| Data Deletion | Removes all or part of identifying elements. |
| Categorization | Groups values into intervals or categories. |
| Data Masking | Obscures parts so they are not visible. |

The press release lists only the technique names without definitions; it is best to refer to textbooks for detailed definitions and examples. Be careful not to confuse pseudonymization with masking, and aggregation with categorization, as their names are similar. Remember by distinguishing whether you are changing or obscuring values, and whether individual values are retained or aggregated.

The procedure consists of four steps:

1. **Pre-screening**: Check if the data is personal information. If not, it can be utilized without additional measures.
2. **De-identification Measures**: Remove identifying elements using the above techniques.
3. **Appropriateness Assessment**: An external evaluation team assesses whether the measures are appropriate. At this stage, k-anonymity is used as a quantitative means.
4. **Post-management**: Adhere to protective measures for safe utilization and prevention of misuse. Once the purpose ends, destroy the data, manage access rights, and stop processing if re-identification occurs.

k-anonymity is a concept that makes it difficult to infer specific individuals by creating at least k records with the same values. If k=5, there are at least 5 identical records.

I tried implementing categorization, masking, and k-check directly using pandas.

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

Running this produces three cases for "20s age group, Seoul" and three for "40s age group, Busan," resulting in k=3. Phone numbers change to `010-1234-****` and `010-9876-****`. From this view, it becomes clear that grouping values via categorization increases the number of identical combinations, thereby increasing k. This example is a small table created to demonstrate the structure and differs from actual appropriateness assessment criteria.

<details>
<summary>Pseudonymized Information and the 5 Steps of Pseudonymization</summary>

Separate from the guidelines, the Personal Information Protection Act defines the concept of pseudonymized information. The Personal Information Protection Commission explains pseudonymized information as data that cannot identify a specific individual without additional information used or combined to restore it to its original state. The legal basis is Article 2, Paragraph 1 and Article 28-2 of the Act.

It can be utilized for purposes of statistical compilation, scientific research, and public interest record preservation. Statistical compilation refers to creating quantitative information about specific groups; scientific research involves applying scientific methods such as technology development, basic, or applied research; and public interest record preservation means preserving records worthy of public access for the benefit of the public.

The pseudonymization procedure consists of five steps: preliminary preparation (including purpose setting), risk assessment, pseudonymization, appropriateness review, and safe management. This is a different document's procedure from the four-step de-identification measure guidelines (pre-screening, de-identification measures, appropriateness assessment, post-management). Distinguish based on which terminology appears in the problem.
</details>

The big picture regarding personal information protection can be seen separately in [Personal Information and Privacy →](#/post/sec-privacy).

## Common Shapes Frequently Appearing in This Unit

Original exam questions are not moved here; only types are summarized.

- **Feature Selection**: Match V names based on descriptions or select items that do not match specific Vs. Confusion arises from mixing reliability, validity, and value.
- **Data Type Classification**: Divide examples like logs, JSON, tables, and videos into structured, semi-structured, and unstructured data. Solve by checking for the presence of a schema and whether operations are possible.
- **Direction of Change**: Check if the direction aligns with post-processing, census, quantity, and correlation.
- **De-identification**: Match technique names with descriptions, list procedural orders, and understand the meaning of k-anonymity.

Check the exam schedule and registration information on the official site.

## Summary

- 3V stands for Volume, Velocity, and Variety; 4V adds Value; 5V adds Veracity. Refer to your designated textbook as compositions may vary across materials.
- Structured data includes both schema and operations; semi-structured data includes only schema; unstructured data includes neither.
- Changes in big data involve post-processing, census-style surveys, volume, and correlation direction.
- Five anonymization techniques include pseudonymization, aggregation, data deletion, categorization, and data masking.
- Anonymization procedures follow: pre-assessment → anonymization measures → adequacy evaluation (k-anonymity) → post-management.

← Concept map ([Big Data Analyst Exam Map](#/post/bd-map))

Related posts: [Defining Analysis Tasks and Planning Analysis](#/post/bd-planning) · [Data Collection and Storage](#/post/bd-collection-storage) · [Data Preprocessing](#/post/bd-preprocessing)

## Reference Links

- [IT Wiki — Big Data](https://itwiki.kr/w/빅데이터)
- [IT Wiki — Structured Data](https://itwiki.kr/w/정형_데이터)
- [IT Wiki — Value of Big Data](https://itwiki.kr/w/빅데이터_가치)
- [Financial Services Commission — Press Release on Guidelines for Personal Information Anonymization Measures (2016.6.30)](https://www.fsc.go.kr/no010101/72222)
- [Personal Information Protection Commission — Pseudonymized Information](https://pipc.go.kr/np/default/page.do?mCode=D040010000)