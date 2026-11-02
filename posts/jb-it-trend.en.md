The new technology terminology unit is the most daunting because its scope is undefined. Cloud, Big Data, AI, Blockchain, and IoT often appear together as examples of a single problem. For this unit, it is more efficient to memorize each term with a one-line note on "what problem this term aims to solve" rather than trying to understand them in depth. Check the exam schedule and registration fees on the official site; here, we only organize concepts and problem-solving methods.

## First, the Big Picture

| Category | Representative Terms | Problem Being Solved |
|---|---|---|
| Infrastructure | Cloud, Virtualization, Containers | Time and cost of buying and installing servers |
| Data | Big Data, NoSQL, Data Lake | Large and diverse data that cannot be stored in traditional databases |
| Intelligence | AI, Machine Learning, Deep Learning | Judgments difficult for humans to formulate rules for one by one |
| Trust | Blockchain | Enabling trust in records without a central authority |
| Connectivity | IoT, 5G, Edge Computing | Processing data from things quickly and locally |

In problems, definitions are usually given to identify the term. Therefore, it is better to remember key words from the definition sentence rather than just the term name.

## Cloud Computing

The most frequently cited definition of cloud computing comes from the US NIST. It describes a model where shared computing resources (network, server, storage, application, service) can be accessed over the network whenever needed with minimal management to provision and release. This definition includes 5 characteristics, 3 service models, and 4 deployment models.

[Details → Cloud Basics](#/post/cloud-basics)

### Five Essential Characteristics

| Characteristic | One-Liner Description |
|---|---|
| On-demand self-service | Users can provision resources without human intervention |
| Broad network access | Accessible over the network using standard mechanisms from various client devices |
| Resource pooling | The provider pools resources for multiple customers (multi-tenancy), with allocation changing based on demand |
| Rapid elasticity | Resources can be scaled up and down quickly according to demand |
| Measured service | Usage is monitored, controlled, and reported; typically, you pay for what you use |

The scaling aspect connects well with autoscaling. [Details → Autoscaling](#/post/infra-autoscaling)

### Three Service Models

The three models are distinguished by "how much the customer manages."

| Model | What the Customer Uses | What the Customer Manages | Example |
|---|---|---|---|
| IaaS | Basic resources like servers, storage, and network | OS, storage, deployed applications | Renting a virtual server |
| PaaS | Development and execution environment for deploying apps | Deployed applications and environment configuration | A platform where code runs upon upload |
| SaaS | Completed applications created by the provider | User-specific settings only | Webmail |

The scope of customer management decreases in the order of IaaS, PaaS, SaaS. In problems, if "directly managing up to the OS" appears, it's IaaS; if "uploading only applications," it's PaaS; and if "using only via a browser," it's SaaS.

### Four Deployment Models

| Model | One-Liner Description |
|---|---|
| Private | A cloud configured for use by a single organization |
| Community | Multiple organizations with common interests, such as security requirements or regulations, share the cloud |
| Public | A cloud opened for general public use |
| Hybrid | Two or more clouds linked via standard and proprietary technologies to enable moving data and applications between them |

<details>
<summary>Confusing Pairs in Exams</summary>

- Private is not the same as on-premises. Under the NIST definition, a private cloud can exist within an organization or externally operated by a third party.
- The core of "Public" is that it's used by the masses, while the core of "Hybrid" is linking two or more clouds together.
- Serverless does not mean there are no servers; it means the provider manages the server infrastructure. [Details → Serverless](#/post/cloud-serverless)

</details>

## Virtualization and Containers

Virtualization is a technology that allows multiple virtual servers to run on top of a single physical server. Each virtual server runs its own operating system. Containers share the OS kernel while bundling only the application and its execution requirements, isolating them; thus, they are generally described as lighter than virtual servers. This difference connects with process and kernel concepts from the OS unit. [Details → Operating System](#/post/jb-os)

As containers increase in number, tools are needed to automatically handle deployment, restarts, and replacement; Kubernetes serves this role. The official Kubernetes documentation introduces it as a portable open-source platform for managing containerized workloads and services. Its features include service discovery and load balancing, self-healing by restarting unresponsive containers, and automatic rollout/rollback that adjusts the actual state to match the desired state. [Details → Docker and Containers](#/post/cloud-docker)

## Blockchain

Blockchain began with the Bitcoin whitepaper. The paper proposes that to send money directly between parties without a trusted institution like a bank, double-spending must be prevented. This is solved using a P2P network. Transactions are grouped into hashes and linked in a chain of proof-of-work, with each block timestamped; this chain cannot be altered without redoing the proof-of-work. Nodes accept the longest chain as the correct one.

Simplified for study purposes:

| Term | One-liner |
|---|---|
| Block | A unit containing a bundle of transactions and the hash of the previous block |
| Proof-of-work | A method to link blocks in a chain by demonstrating completion of computational work |
| Distributed ledger | A structure where participating nodes share the same record, rather than having it in one place |
| Double-spending | Using the same money twice |

Hash and cryptography concepts overlap with security topics. [Learn more → Information Security](#/post/jb-security)

## Data and AI Terms

This section mostly asks for definitions, so they are summarized in a table.

| Term | One-liner |
|---|---|
| Big Data | Data that is too large, diverse, and fast to be stored, processed, and analyzed with traditional methods |
| NoSQL | A database approach that handles data using non-relational table models (e.g., key-value, document) |
| Data Warehouse | An integrated repository where data is organized and accumulated for analysis |
| Data Lake | A repository that stores raw, unorganized source data as-is |
| Artificial Intelligence | The collective term for technologies that enable computers to perform tasks typically done by human intelligence |
| Machine Learning | An approach where patterns are learned from data without manually crafting rules |
| Deep Learning | A branch of machine learning that uses multi-layered neural networks for learning |
| Generative AI | AI that creates new outputs such as text or images |

The inclusion hierarchy is: Artificial Intelligence contains Machine Learning, which in turn contains Deep Learning. Questions often reverse this order. Recent discussions on LLMs are covered separately in the AI glossary. [Learn more → LLM](#/post/ai-llm), [Learn more → Generative AI](#/post/ai-generative), [Learn more → NoSQL](#/post/db-nosql)

## Connectivity Technologies

| Term | One-liner |
|---|---|
| IoT | Connecting objects to the internet via sensors and communication functions to exchange data |
| Edge Computing | Processing data near its source to reduce the volume and latency of data traveling to distant data centers |
| 5G | One generation of mobile communication that emphasizes connecting many devices and reducing latency |

Basic networking concepts are covered in a separate section. [Learn more → Networking](#/post/jb-network)

## Problem-Solving Approaches

1. If the option contains an English acronym, recall the full name first (e.g., IaaS is Infrastructure as a Service).
2. Identify key words in the definition sentence. Phrases like "management scope," "without a central authority," or "as-is original" help distinguish answers.
3. Summarize similar pairs with one line of difference. Representative examples include warehouse vs. lake, private vs. public, and machine learning vs. deep learning.
4. New terms may change annually, so review both recent official exam standards and the textbook term list alongside past questions. It is better to reorganize past question originals based on concepts rather than copying them directly for long-term retention.

<details>
<summary>Mnemonic pairs for memorization</summary>

- Associate IaaS with "foundation site," PaaS with "construction workshop," and SaaS with "completed house" to visualize management scope.
- Think of blockchain as a "public ledger where tearing one page invalidates all subsequent pages" to remember hash linking.
- Imagine a container as a "moving box that shares an OS," and a virtual server as "splitting an entire house."

</details>

← [Concept Map](#/post/jb-map)

Related articles: [Cloud Basics](#/post/cloud-basics) · [Information Security](#/post/jb-security) · [Networking](#/post/jb-network)

## Reference Links

- NIST SP 800-145, The NIST Definition of Cloud Computing: https://csrc.nist.gov/pubs/sp/800/145/final
- Satoshi Nakamoto, Bitcoin: A Peer-to-Peer Electronic Cash System: https://bitcoin.org/bitcoin.pdf
- Kubernetes Documentation, Overview: https://kubernetes.io/docs/concepts/overview/