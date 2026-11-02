Cloud computing involves renting servers instead of buying them, categorized into IaaS, PaaS, and SaaS depending on which layer you manage. Concepts like regions and Availability Zones (AZs), along with a pay-as-you-go pricing model, are layered on top.

## What is Cloud Computing?

In the past, to launch a service, you had to purchase servers and place them in a data center. You would order them weeks in advance and buy generously based on your estimate of usage. Cloud computing changed this by allowing you to rent resources over the internet. You create what you need when you need it and delete it when you don't.

The NIST (National Institute of Standards and Technology) definition document describes cloud computing as "a model that enables ubiquitous network access to a shared pool of configurable computing resources." The core point is that allocating and deallocating resources requires almost no management effort. The features highlighted in the same document are on-demand self-service, resource pooling, rapid elasticity, and measurable service (though I know there are five features including broad network access, I did not verify them directly in this text).

The AWS overview document states similarly: instead of spending a large amount upfront, you pay variable costs based on usage, and you can launch hundreds of servers within minutes. In summary, it looks like this:

| | Traditional Method (On-Premises) | Cloud |
|---|---|---|
| Setup Time | Weeks to Months | Minutes |
| Cost Structure | Large upfront payment (purchase) | Pay as you go |
| Capacity | Purchase based on estimated maximum | Scale up and down |
| Management | Direct management including hardware | Provider manages some parts |

## IaaS, PaaS, SaaS

Services are stacked in layers: hardware, virtualization, operating system, runtime, application, and data. The three models are distinguished by which layer the provider takes responsibility for.

| | What I Manage | What the Provider Manages | Example |
|---|---|---|---|
| IaaS | Everything from OS upwards | Hardware, Virtualization | Virtual servers (VMs), disks, networks |
| PaaS | My code and data | OS, Runtime, Server | Hosting services that run your code upon upload |
| SaaS | Configuration and usage | Almost everything | Email, collaboration tools |

The examples in the table and the layer distinctions are a summary of general explanations. The boundaries vary slightly by service, so it is often ambiguous which specific service fits into which category.

IaaS offers high freedom but requires more responsibility; you connect to the server and handle OS updates and security patches yourself. PaaS handles those tasks for you, but the available languages and configurations are fixed. SaaS simply allows you to use pre-built programs. The lower the layer, the easier it is; the higher the layer, the more freedom you have.

## Shared Responsibility

The AWS shared responsibility model document explains these boundaries from a security perspective. The provider operates and manages everything from the host OS and virtualization layers up to physical facility security. The customer is responsible for the guest OS (including updates and security patches), application software above it, and security group (firewall) configurations. The document also notes that customer responsibilities vary depending on the service used, which aligns with the layer distinctions discussed above. Just because you rent a server doesn't mean you've rented its security.

Note that this document includes a disclaimer stating, "This whitepaper is for reference and some content may be outdated." While the overall structure remains valid, it is appropriate to review the details against the latest documentation.

## Regions and AZs

Cloud servers exist in actual physical buildings somewhere. According to AWS documentation, a region is a physical location worldwide, and within a region, there are multiple Availability Zones (AZs). An AZ consists of one or more data centers with redundant power, network, and connectivity, located in different facilities. The document explains that using multiple AZs can improve high availability, fault tolerance, and scalability compared to using a single data center.

```
리전 (예: 서울)
 ├─ AZ-a  [데이터센터]  ← 서버 1
 ├─ AZ-b  [데이터센터]  ← 서버 2
 └─ AZ-c  [데이터센터]  ← 서버 3
```

In practice, if you place a server in only one AZ, the service stops if there is an issue with that building. By distributing across two or more locations and balancing requests from the front end, the system survives even if one side fails. The device used for balancing is [Load Balancer → Details](#/post/infra-load-balancer). While it is also explained that choosing a region closer to users results in faster response times and compliance with country-specific data retention regulations makes careful selection important initially, I did not verify this against official documentation this time.

## What is a VM?

A Virtual Machine (VM) is created by splitting a physical server using software to use it like multiple servers. The "server" rented in IaaS is typically this VM. By selecting the number of cores, memory, and disk, you can create an accessible computer within minutes. Since each VM requires its own OS installation, they are heavier and take time to boot. A lighter alternative is containers. Continue reading about [Docker and Containers → Details](#/post/cloud-docker).

## Cost Structure

Cloud costs can be summarized in one line: "pay as you go." The AWS overview document also highlights on-demand and pay-as-you-go pricing. Therefore, some intuition is required.

- You pay for the time it's running. Even if a VM receives no requests, you are charged as long as it remains powered on.
- Costs extend beyond just server instances. Additional charges often apply for disk storage capacity, data transferred from the server to the internet, and managed services.
- If you create something and forget about it, costs continue to accumulate. It is common for forgotten test servers left running to result in mounting charges.
- For long-term usage, negotiated discounts are available; for tasks that can be interrupted, there are options to utilize spare resources at a lower cost.

Therefore, setting up alerts first is essential. Most platforms allow you to define a budget and receive notifications when it is exceeded. For more on aggregating logs and metrics, see [Learn more → Monitoring, Logs, and Alerts](#/post/cloud-observability).

## What is Serverless?

Serverless does not mean there are no servers. Servers exist; however, you do not provision or manage them. When you deploy functions, they execute only upon receiving requests, and you pay for the actual time used. While VMs charge based on "time rented," serverless charges based on "time actually worked." Many people consider it a layer above PaaS. For more details, see [Learn more → Serverless](#/post/cloud-serverless).

## Common Misconceptions

- **Cloud is always cheaper:** Initial costs may be low, but running large servers 24/7 can be more expensive than purchasing on-premises hardware. The advantage of cloud is that you do not need to buy capacity in advance.
- **Uploading to the cloud means it won't go down:** If an application runs only in a single Availability Zone (AZ), it will fail if that zone goes down. High availability must be designed by you.
- **Security is handled automatically:** Following the shared responsibility model, tasks such as OS patching and firewall configuration are often the customer's responsibility. Password and key management fall under this category as well. For more details, see [Learn more → Environment Variables and Secrets Management](#/post/cloud-secrets).
- **Traffic scaling happens automatically:** While auto-scaling features exist, you must configure them and set thresholds. See [Learn more → Auto-scaling and Scaling](#/post/infra-autoscaling) for details.

<details>
<summary>Detailed Explanation: Three Deployment Models</summary>

Distinct from service models (IaaS/PaaS/SaaS), there are deployment models that determine where the application is hosted. AWS documentation categorizes these into three types:

- **Cloud:** The entire application runs in the cloud. This includes applications built from scratch in the cloud or migrated from existing infrastructure. You can build using lower-level components or utilize higher-level services that manage operations for you.
- **Private (On-premises):** Configured within your own building using virtualization and resource management tools. Documentation notes that while you miss out on many cloud advantages, this is chosen when dedicated resources are required.
- **Hybrid:** Connects existing on-premises facilities with the cloud. The most common form involves expanding existing infrastructure into the cloud while maintaining a connection between both environments.

NIST documentation divides deployment models into four types, noting that community cloud is included in their definition.

</details>

<details>
<summary>Detailed Explanation: How to Handle Databases and State</summary>

Servers are easy to create and delete, but data is not. It is common for files stored inside a VM to be deleted when the VM is terminated; therefore, critical data should be stored in external storage or managed databases. Designing without storing state within the server is discussed again under auto-scaling. Methods for replicating databases are covered in [Learn more → Replication and Sharding](#/post/db-scaling). This section reflects general design principles rather than specific content from official documentation released at this time.

</details>

## Reference Links

- NIST SP 800-145, The NIST Definition of Cloud Computing: https://csrc.nist.gov/pubs/sp/800/145/final
- AWS, Global infrastructure: https://docs.aws.amazon.com/whitepapers/latest/aws-overview/global-infrastructure.html
- AWS, Types of cloud computing: https://docs.aws.amazon.com/whitepapers/latest/aws-overview/types-of-cloud-computing.html
- AWS, Overview of Amazon Web Services: https://docs.aws.amazon.com/whitepapers/latest/aws-overview/introduction.html
- AWS, Shared responsibility model: https://docs.aws.amazon.com/whitepapers/latest/aws-risk-and-compliance/shared-responsibility-model.html
- NIST Definition PDF text: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf

← Concept map ([Cloud & Deployment map](#/post/cloud-map))

Related posts: [Docker and Containers](#/post/cloud-docker) · [Serverless](#/post/cloud-serverless) · [Auto-scaling and Scaling](#/post/infra-autoscaling)