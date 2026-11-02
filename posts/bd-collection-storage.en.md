This summary covers the Data Collection and Storage unit from the Big Data Analysis Engineer certification exam. Once you have determined "what data is needed" in the analysis planning phase ([see details → Defining Analysis Tasks and Planning](#/post/bd-planning)), this unit focuses on actually acquiring that data and where to store it. Since the exam frequently features questions asking you to identify concepts based on terminology, I have focused on explaining each concept by highlighting what it is and how it differs from similar terms.

You can check the exam schedule and registration fees on the official website. This article covers only the core topics of each unit and common question types. For the overall flow, see [see details → Big Data Analysis Engineer Map](#/post/bd-map).

## Where data comes from and its format

First, we distinguish two aspects: where the data originates and what its format is.

| Criterion | Category | Example |
| --- | --- | --- |
| Source | Internal Data | Company DB order/customer tables, service logs |
| Source | External Data | Public data, social media, web pages |
| Format | Structured | Tables with fixed rows and columns (RDB, CSV) |
| Format | Semi-structured | Has structure but not a fixed table schema (JSON, XML, logs) |
| Format | Unstructured | Text content, images, video, audio |

Internal data is easy to acquire and allows for some quality control. External data is readily available but varies in format and quality, requiring significant effort to organize. The exam often features questions asking you to distinguish between "internal vs. external" or "structured vs. semi-structured" based on examples. If you firmly grasp that JSON is semi-structured, you will be correct on half of these questions.

Precautions for collecting data containing personal information are covered separately in [see details → Big Data Overview and Utilization](#/post/bd-overview).

## Collection Methods: Batch and Streaming

Collection methods generally divide into acquiring everything at once versus receiving it as it flows.

Batch processing involves gathering data at a set time, such as copying an entire order table once a day. Implementation is simple and suitable for bulk processing, but any changes occurring between batches remain unknown until the next batch.

Streaming receives data immediately as it occurs. This is used for continuously generated data like sensor values or click logs. The representative tool for this approach is Apache Kafka. The Kafka introduction document describes event streaming as collecting data in real-time from sources such as databases, sensors, and apps; storing it for extended periods; processing it upon arrival or later; and sending it to other systems. These terms are also likely to appear on the exam.

| Term | Meaning |
| --- | --- |
| Topic | A named collection where events are stored. Like a folder. |
| Producer | The side that writes events. |
| Consumer | The side that reads events. Can be re-read if necessary. |
| Partition | A unit dividing a topic. Events with the same key go into the same partition, and order is maintained within it. |
| Retention | The duration for which old events are kept before deletion, set per topic. |

The core concept is that the writer and reader are separated by the topic. Therefore, even if the collector slows down, the writer does not get blocked, and multiple readers can exist simultaneously.

Similar structures from a backend perspective are explained in [see details → Asynchronous Processing and Queues](#/post/be-async-queue).

## ETL and Crawling

ETL stands for Extract, Transform, Load. It involves extracting data from a source, correcting it into a usable format, and loading it into the destination. The order is important; performing load before transform is called ELT and treated separately. The exam often asks what each letter in ETL stands for and at which stage deduplication and format unification occur. The answer is the Transform stage.

I ran a small example directly. It read a CSV, removed duplicates, filled missing prices, loaded it into SQLite, and aggregated using SQL.

```python
import pandas as pd, sqlite3, io

src = pd.read_csv(io.StringIO("id,name,price\n1,a,1000\n2,b,\n3,a,1000\n3,a,1000\n"))
# Extract: 위에서 읽은 src
# Transform: 중복 제거, 빈 값 처리
t = src.drop_duplicates().assign(price=lambda x: x.price.fillna(0).astype(int))
# Load: DB에 적재
con = sqlite3.connect(":memory:")
t.to_sql("product", con, index=False)
print(pd.read_sql("select name, sum(price) s, count(*) n from product group by name", con).to_dict("records"))
print(len(src), len(t))
```

The output was `[{'name': 'a', 's': 2000, 'n': 2}, {'name': 'b', 's': 0, 'n': 1}]` and `4 3`. The number of rows changed from 4 to 3. Filling the empty price for 'b' with 0 was done to run the example; whether missing values are actually filled with 0 depends on the analysis purpose, which is covered in [see details → Data Preprocessing](#/post/bd-preprocessing).

Crawling is a collection method where a program downloads web pages and extracts required parts. It is used when acquiring external data that is not provided in a structured format. From an exam perspective, knowing the definition "automatically collecting web documents" and the common sense that using APIs is more stable than crawling if public APIs are available is sufficient. Since terms of service and collection permissions vary by site, always check those regulations before actually implementing anything.

## Storage: Containers matching data formats

Storage technology is selected based on the data format and usage method.

| Repository | Suitable Data | Characteristics |
| --- | --- | --- |
| RDB | Structured, clearly relational data | Schema is defined first and queried using SQL. Strong transaction support ([Details → Relational DBs and SQL](#/post/db-rdb-sql)) |
| NoSQL | Semi-structured or unstructured, frequently changing schema | Many types available ([Details → NoSQL Types and Selection](#/post/db-nosql)) |
| Distributed File System (HDFS) | Very large files | Stored split across multiple servers |

### HDFS

The following points are extracted from the Hadoop official documentation's description of HDFS design.

- The NameNode, acting as the master, manages the file namespace and tracks which blocks reside on which DataNodes.
- DataNodes store the actual blocks and respond to read/write requests.
- Files follow a write-once-read-many model. After closing, only append and truncate operations are allowed.
- Prioritizes high throughput over low latency; designed for batch processing.
- Blocks are sized large. The documentation typically cites 128MB as the standard block size, though this can be configured per file.
- Replicas are commonly set to three, defined at file creation and adjustable later.
- It is more efficient to move computation to the data than to move data to the computation, reducing network overhead.

To avoid mistakes, remember: "NameNode manages metadata, while DataNodes store actual data." Also, HDFS is designed for writing and reading large files once, not for frequently modifying small files—a key point for eliminating wrong answers in exams.

### NoSQL

NoSQL refers to a collection of technologies rather than a single one. It is generally categorized into key-value, document, column-family, and graph types. For details on when to use each, refer to the linked article above; here, we focus solely on the document type.

MongoDB stores data as BSON documents and notes that documents within the same collection do not need to have identical fields or data types. When adding fields, there is no need to rewrite existing documents or perform migrations. It supports nesting documents and arrays within values and is designed around the principle that related data accessed together should be stored together. Schema validation can be applied if necessary to enforce structure. In exams, "flexible schema" is often cited as a representative characteristic of NoSQL, with this document serving as supporting evidence.

<details>
<summary>RDB vs. NoSQL: Which to Choose (Summary)</summary>

- Use RDB when inter-table relationships and data integrity are critical.
- Use document-oriented NoSQL when structure varies or changes frequently.
- You don't have to choose just one; they can be used together within a single service.
- Exams typically ask you to identify correct characteristics among options: remember that RDB is associated with fixed schema, SQL, and transactions, while NoSQL is linked to flexible schema and horizontal scaling.
</details>

## Quality Assurance: Checking Four Aspects

After collecting and storing data, assess its quality before writing it. Conceptually, this includes completeness (no missing values), uniqueness (no duplicates), validity (within allowed ranges and formats), and consistency (same entities represented consistently). Terminology may vary slightly depending on the dataset, so judge based on the meaning in the question options.

I verified that each of these four aspects can be implemented in a single line of code:

```python
import pandas as pd, io

raw = io.StringIO("""id,age,city,amount,date
1,25,Seoul,1200,2026-01-03
2,,Busan,800,2026-01-04
2,,Busan,800,2026-01-04
3,41,seoul,-50,2026-01-05
4,200,Daegu,3000,2026/01/06
5,33,Incheon,,2026-01-07
""")
df = pd.read_csv(raw)

print(df.isna().mean().round(2).to_dict())          # 완전성: 열별 결측 비율
print(df.duplicated().sum())                         # 유일성: 중복 행 수
print(df['city'].str.lower().str.strip().value_counts().to_dict())  # 일관성: 표기 통일 후 집계
print(((df.age < 0) | (df.age > 120)).sum(), (df.amount < 0).sum())  # 유효성: 범위 밖
d = pd.to_datetime(df['date'], errors='coerce', format='%Y-%m-%d')
print(d.isna().sum())                                # 유효성: 날짜 형식 불일치
```

The output was as follows:

| Check | Result |
| --- | --- |
| Missing value ratio per column | age 0.33, amount 0.17, others 0 |
| Duplicate rows | 1 |
| Aggregation after unifying city notation | seoul 2, busan 2, daegu 1, incheon 1 |
| Age out of range / negative amounts | 1 / 1 |
| Date format mismatch | 1 |

`Seoul` and `seoul` represent the same city visually but are treated as distinct values unless normalized to lowercase. Only after unifying to lowercase does `seoul` aggregate to 2. This is a consistency issue. An age of 200 or negative amounts are logically invalid values, so they fail validity rather than completeness. The date `2026/01/06` was flagged as mismatched due to inconsistent delimiters compared to other rows.

Note: This step identifies and counts issues. How to handle missing or anomalous values found is part of preprocessing.

## Common Question Types

- Classify examples into structured, semi-structured, and unstructured data (e.g., JSON, XML, logs are semi-structured).
- Roles of each ETL stage and transformations performed in the transformation step.
- Differences between batch and streaming processing; topics, producers, and consumers in streaming tools.
- Roles of NameNode and DataNode in HDFS, along with reasons for large block sizes and replication.
- Comparison of RDB and NoSQL characteristics.
- Matching quality check item names with their meanings.

## Tips for Solving Questions

Terminology questions often start by identifying key terms. If you see "real-time," think streaming; if you see "manage metadata," think NameNode; if you see "schema flexible," think NoSQL; if you see "same as same," think consistency. Since past exam questions often vary slightly each year, creating a one-line note per concept like "if this word appears, then that" can save time.

← [Concept map (#/post/bd-map)](#/post/bd-map)

Related posts: [Defining Analytical Tasks and Planning Analysis](#/post/bd-planning) · [Data Preprocessing](#/post/bd-preprocessing) · [Types of NoSQL and Selection](#/post/db-nosql)

## Reference Links

- Apache Hadoop, HDFS Architecture: https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-hdfs/HdfsDesign.html
- Apache Kafka, Introduction: https://kafka.apache.org/intro
- MongoDB Manual, Data Modeling Introduction: https://www.mongodb.com/docs/manual/core/data-modeling-introduction/