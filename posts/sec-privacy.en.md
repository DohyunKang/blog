Personal information is not limited to just names or social security numbers; it encompasses any data that, when combined with other information, can identify a specific individual. Therefore, the primary approach to protection has been to collect less and hold onto shorter durations of data rather than relying solely on encryption.

## What is Personal Information?

The Korean Personal Information Protection Act defines personal information as information about living individuals, extending to anything that can identify a specific person either by itself or when easily combined with other information. Names, contact details, and email addresses are obvious examples, but IP addresses, device IDs, and location data also qualify if they can be linked to an individual. The definition below is close to what was found in GDPR Article 4.

GDPR defines "personal data" as "any information relating to an identified or identifiable natural person." Whether directly or indirectly, if a person can be specified using names, identification numbers, location data, online identifiers, etc., it is considered identifiable.

The core concept here is "identifiability." Even if a name is removed, combining birth date, gender, and postal code can narrow down to a specific individual. Often, while each piece of information seems ordinary on its own, they become personal information when combined.

## Basic Principles for Compliance

GDPR Article 5 outlines several principles, which align with the principle of minimum collection in Korean law; thus, they are summarized together below.

| Principle | Meaning |
|---|---|
| Purpose Limitation | Use data only for the stated purpose of collection |
| Data Minimization | Collect only what is necessary for the purpose |
| Storage Limitation | Do not retain identifiable data longer than needed after the purpose ends |

Korean legal resources, such as those from the Personal Information Portal and Seoul Metropolitan Office of Education, summarize this principle as "clearly defining the purpose and collecting legally only the minimum required for that purpose."

When building a service, this translates to deciding whether to collect birth dates during registration. Collecting unnecessary fields is both less safe and more costly. Information that isn't collected cannot be leaked.

## Masking, Pseudonymization, and Anonymization

The term "hiding" has different stages, and mixing them up causes confusion.

| Method | Action | Example | Reversible? |
|---|---|---|---|
| Masking | Partially hide or replace with tags | 010-****-5678 | Possible if original is kept separately |
| Pseudonymization | Replace so identification is impossible without additional info | Email → Hash value | Possible with separately stored additional info |
| Anonymization | Cannot identify the person and cannot be restored | Statistical totals | Impossible |

Article 2 of the Korean Personal Information Protection Act defines pseudonymization as deleting part of the data or replacing part/all of it so that a specific individual cannot be identified without additional information (based on Life Law Regulations explanations). GDPR's pseudonymization follows the same structure. It includes the condition that additional information must be stored separately and protected via technical and organizational measures.

Information that has been pseudonymized is still considered personal information because there exists somewhere a key to unlock it. This is why it should not be called "anonymous data."

## Masking Code I Tried Personally

I ran a short code using regular expressions to replace social security numbers, phone numbers, and emails with tags, and generating pseudonymous values based on hashes.

```python
import re, hmac, hashlib

PATTERNS = [
    ("RRN",   re.compile(r"\b\d{6}-[1-4]\d{6}\b")),
    ("PHONE", re.compile(r"\b01[016789]-?\d{3,4}-?\d{4}\b")),
    ("EMAIL", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")),
]

def mask(text):
    for name, p in PATTERNS:
        text = p.sub(f"[{name}]", text)
    return text

def pseudonym(value, secret):
    return hmac.new(secret, value.encode(), hashlib.sha256).hexdigest()[:12]
```

Inputting "Contact: Hong Gildong 010-1234-5678, hong@example.com, Social Security Number 900101-1234567" resulted in the phone number, email, and social security number changing to `[PHONE]`, `[EMAIL]`, and `[RRN]` respectively. However, "Hong Gildong" remained unchanged. Regular expressions only capture values with fixed formats and cannot handle unstructured data like names. Capturing names would require separate tools like named entity recognition, which was not attempted here.

Pseudonymous values produced the same result for the same input, but different results for different secret keys. While some sources advise against using simple hashes (like SHA-256 alone), this is because limited-value candidates like emails can be cracked by hashing all possible candidates and comparing them. Therefore, HMAC with a secret key was used. This secret key must be stored separately from the data, as per conditions for pseudonymization, similar to [key management](#/post/sec-keys).

## Points to Watch Out for in AI Services

When using AI, the paths through which personal information leaks are roughly established.

- Prompt: User-submitted questions often include names, phone numbers, and the original customer inquiry text verbatim. The moment this data is sent to an external model API, it leaves your server. That's why many systems implement a masking step before sending data. What you put in the [prompt](#/post/ai-prompt) determines where the data goes.
- Conversation logs and audit trails: Logging requests and responses in their entirety turns those logs into personal information repositories. Retention periods must also be defined.
- Retrieval Augmented Generation (RAG): If internal documents are attached via [RAG](#/post/ai-rag), personal information belonging to others could be retrieved and mixed into answers even when queried by unauthorized individuals. Access controls must be applied at the retrieval stage.
- Vendor-side processing: Whether external APIs use sent data for model training, and how long they retain it, varies by vendor and pricing plan. You must review the terms of service and data processing documents for each service used.
- Model memory: Research indicates that personal information included in training data can be regurgitated verbatim by the model.
- Injection: There are attacks that prompt the model to "reveal customer information seen earlier." Details are covered separately in [Prompt Injection](#/post/sec-prompt-injection).

## Common Misconceptions

- Removing names makes data anonymous: Data can still be re-identified when combined with other information. Pseudonymization and anonymization are distinct concepts.
- Encryption solves all personal information issues: Encryption protects data at rest and in transit, but once decrypted for use, the information remains personal data. How much data is collected and how long it is retained are separate concerns from encryption.
- Publicly available information can be used freely: Even if information is public, there remains the principle that it must be used within its intended scope.
- Logs do not contain personal information: If logs include IP addresses or request bodies, they may constitute personal information.

<details>
<summary>Detailed explanation: How identifiability arises</summary>

Identifiability is not judged by whether "a person can be identified with this single piece of information," but rather by whether "a person can be identified when combined with other information you possess." For example, if a member table contains only member IDs without names, but another table links member IDs to names, combining these tables allows identification. In such cases, the member table is also considered to contain personal information.

External data combinations also pose risks. Even if information does not directly contain names, combinations such as postal code, date of birth, and gender may match with publicly available external datasets, narrowing down to a specific individual. This explains why "removing just the name does not make data anonymous."

In practice, it is common to create separate views that extract only necessary columns for specific purposes, provide pseudonymized values for analysis, and restrict access to original data and pseudonymization mapping information to tightly controlled locations. This is a general design approach and not necessarily tied to a specific guideline.

</details>

## Reference Links

- GDPR Art. 4 (Definitions): https://gdpr-info.eu/art-4-gdpr/
- GDPR Art. 5 (Principles of Processing): https://gdpr-info.eu/art-5-gdpr/
- Life Law Information, Processing of Pseudonymized Information: https://www.easylaw.go.kr/CSP/CnpClsMain.laf?csmSeq=1257&ccfNo=2&cciNo=4&cnpClsNo=1 (Summary of search results only)
- Personal Information Protection Act Interpretation (Seoul Metropolitan Office of Education): https://www.sen.go.kr/resources/www/data/infoprotect_3_03.pdf (Summary of search results only)

← [Concept Map](#/post/sec-map)

Related articles: [Key Management](#/post/sec-keys) · [Prompt Injection and AI Security](#/post/sec-prompt-injection) · [RAG](#/post/ai-rag)