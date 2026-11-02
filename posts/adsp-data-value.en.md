ADsP Unit 1 asks how working methods have changed in the big data era and how personal information is anonymized for use. The first part can be memorized as pairs, while the second focuses on the names of techniques and their procedural order.

## Why is Data Value Hard to Reproduce?

Data does not have a fixed unit price like rice or oil. Three reasons are commonly cited for why valuing data is difficult.

| Reason | Explanation |
|---|---|
| Usage Context | The value of the same data varies depending on how it is used. |
| Creation of New Value | Since new services or markets did not exist before, reproducing value with existing methods is difficult. |
| Advancement of Analysis Techniques | Data that seems useless today can gain value when new analysis techniques emerge. |

This content is summarized in the "Big Data Value" section of IT Wiki. In the same section, it details the changes big data brings to enterprises (innovation, competitiveness, productivity), government agencies (policy formulation, disaster preparedness), and individuals (affordable service usage, purpose-aligned utilization). Memorizing one line per stakeholder will help when answering descriptive questions.

## Four Pairs of Fundamental Changes

This is the most significant part of this unit. It covers how four aspects of handling data have changed since the advent of big data.

| Before | After | One-Line Explanation |
|---|---|---|
| Pre-processing | Post-processing | Moving from collecting only necessary information based on predefined goals to gathering large amounts and later combining them to find hidden insights. |
| Sampling | Census | With lower processing costs, analysis is performed on the entire population rather than just a sample. |
| Quality | Quantity | When data is sufficient, overall trends become visible even with some errors. |
| Causality | Correlation | Phenomena that move together are used for prediction, even without understanding why. |

While phrasing may vary slightly between textbooks, this four-pair structure remains consistent. When memorizing, simply ensure the arrow direction is always "Before → After." This section is prone to errors where questions reverse the direction.

<details>
<summary>A book telling the same story differently: Three Changes</summary>

Mayer-Schönberger and Cukier's *Big Data* groups changes into three categories. The Oxford Internet Institute (OII) introduction page summarizes these as more (more data), messy (disordered data), and correlation. According to a book review, one aspect involves analyzing vast amounts of data on a topic, another involves accepting the messiness of real-world data, and the third emphasizes respecting correlations over finding causes.

There is significant overlap with the four pairs in the exam. Census corresponds to "more," quantity over quality to "messy," and correlation to "correlation."

</details>

Correlation is not causation. IT Wiki also notes that causal analysis remains necessary for problems requiring cause investigation, such as policy effects or medicine. Misinterpreting "correlation has become important" as "causality is no longer needed" leads to errors.

## Future Outlook

The same IT Wiki section divides the outlook into three categories: data, technology, and personnel.

- Data: "Datafication of everything," where all objects generate data via the Internet of Things.
- Technology: Evolving algorithms and artificial intelligence.
- Personnel: Data scientists and algorizmi (algorithm experts).

The discussion on personnel leads directly to the next unit, [Data Science and Talent](#/post/adsp-ds-bigdata). Distinctions between data, information, and knowledge, as well as the definition of big data, are covered in the previous unit, [Understanding Data](#/post/adsp-data-understanding).

## How to Use Personal Information with Anonymization

Using big data inevitably involves personal information issues. What needs to be memorized from this unit includes five anonymization techniques and their procedural steps.

The "Guidelines for Personal Information Anonymization Measures," jointly released by relevant ministries in June 2016, guide users to apply each technique individually or in combination. This is also mentioned in a Financial Services Commission press release.

| Technique | Meaning Suggested by Name |
|---|---|
| Pseudonymization | Replaces identifying values with other values. |
| Aggregation | Displays aggregated values like sums or averages instead of individual values. |
| Data Deletion | Removes identifying elements. |
| Categorization | Groups values into intervals or categories. |
| Data Masking | Obscures parts to prevent identification. |

Each technique has specific sub-techniques (e.g., heuristic pseudonymization within pseudonymization). Initially, focus on the five names and their general meanings; memorize detailed techniques separately using textbook lists.

The procedure consists of four steps:

1. Preliminary Review: First determine if the information is personal data. If not, it can be used without additional measures.
2. Anonymization Measures: Remove identifying elements using the above techniques.
3. Appropriateness Assessment: An external evaluation team assesses whether sufficient processing has been done. The metric indicator used here is k-anonymity.
4. Post-Management: Destroy data once the purpose is achieved, control access, and stop processing and destroy data if re-identification occurs.

### k-Anonymity

A model where a record must appear at least k times with the same combination of values that indirectly narrow down an individual, such as age and residence. If k is set to 5, records sharing the same values must appear in at least 5 instances, making it difficult to identify a specific person. A security news article cites a case where matching U.S. voter rolls (names) with medical data (diseases) by age, region, and gender revealed who had which illness as an example of a linkage attack. If only one person meets the same conditions, that individual is immediately exposed. By grouping records in sets of k, the probability of identifying a specific person drops to 1/k.

<details>
<summary>Explanation of k-anonymity</summary>

The problem typically presents a table and asks, "Up to what level does this table satisfy k-anonymity?" The solution steps are as follows:

1. Identify the columns containing quasi-identifiers (indirect identifiers such as age and region).
2. Group rows that share the same combination of values in those columns.
3. Determine the smallest group size; this defines k.

The smallest group determines the overall k. For example, if groups are formed with sizes 4, 4, and 3, then k is 3. Just be careful to use the minimum value, not the average.

</details>

### Pseudonymization System Exists Separately

In August 2020, the Personal Information Protection Act was amended to introduce the pseudonymization system. According to the Personal Information Protection Commission, pseudonymized information refers to data that cannot identify a specific individual without additional information or linkage. Data undergoing pseudonymization may be used for statistical purposes, scientific research, or public interest record preservation without the data subject's consent. The legal basis is Article 28-2. Pseudonymization is guided by five stages: pre-preparation, risk assessment, pseudonymization, appropriateness review, and secure management. Linkage between different processors must be conducted by designated specialized institutions.

The steps in the Non-identifiable Measures Guidelines (pre-review - non-identification - appropriateness evaluation - post-management) differ from the five stages of pseudonymization; these are procedures from separate documents and can easily be confused. When exam questions use terminology from either side, align with your textbook accordingly. For a broader overview of personal information protection, refer to [Personal Information and Privacy](#/post/sec-privacy).

## Key Points to Remember While Studying

- Memorize the four pairs of essential changes, including their directions.
- Be able to match the five names of non-identification techniques with their core meanings. Terms like pseudonymization and masking, or generalization and categorization, are often confused due to similar names.
- Solve k-anonymity using the minimum group size.
- Check exam schedules and registration fees on the official website.
- Data mining techniques will be revisited later in [Structured Data Mining](#/post/adsp-datamining).

## Reference Links

- IT Wiki, Value of Big Data: https://itwiki.kr/w/빅데이터_가치
- Financial Services Commission, Press Release on Non-identifiable Measures Guidelines (June 30, 2016): https://www.fsc.go.kr/no010101/72222
- Personal Information Protection Commission, Guide to the Pseudonymization System: https://pipc.go.kr/np/default/page.do?mCode=D040010000
- Boan News, K-Anonymity in the Non-identification Guidelines for Personal Information: http://www.boannews.com/news/articleView.html?idxno=52020
- Oxford Internet Institute, Big Data (Mayer-Schönberger, Cukier): https://www.oii.ox.ac.uk/books/big-data/

← Concept Map ([#/post/adsp-map])

Related Articles: [Understanding Data](#/post/adsp-data-understanding) · [Data Science and Talent](#/post/adsp-ds-bigdata) · [Structured Data Mining](#/post/adsp-datamining)