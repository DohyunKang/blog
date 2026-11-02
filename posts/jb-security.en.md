The Information Security unit is filled with many terms and a succession of attacks with similar names, which tend to get mixed up when memorized. If you first separate the tools by what they protect, things become organized. Check exam schedules and fees on the official site; here we focus only on concepts and problem-solving methods.

## The Big Picture First

| What is Protected | Tools Used | Section in This Article |
|---|---|---|
| Confidentiality (preventing others from reading) | Encryption | Encryption |
| Integrity (preventing alteration) | Hashing, Digital Signatures | Encryption |
| Who can do what | Authentication, Access Control | Authentication and Access Control |
| Keeping services running | Attack Type Identification and Response | Attack Types |

[Need a networking background? → Network](#/post/jb-network)

## Encryption

Encryption is a method to protect confidentiality by converting data into an unreadable form. Exams often ask questions divided by the number of keys used.

| Category | Key | Characteristics | Example |
|---|---|---|---|
| Symmetric Key | Same key for encryption and decryption | Fast, but requires pre-sharing keys | DES, AES |
| Asymmetric Key (Public Key) | Pair of public and private keys | Public keys can be distributed; only the private key must be kept secret | RSA, ECC |

Symmetric keys require a unique secret key for each pair of users, making key management increasingly difficult as the number of users grows. In asymmetric key systems, there is no need to pre-share secrets, but you must verify that the public key truly belongs to the claimed owner. This verification is handled by systems like PKI.

In public-key cryptography, the roles of keys are reversed depending on the purpose—a point that appears almost every time in exams.

| Purpose | Creator Side | Receiver Side |
|---|---|---|
| Encryption (Confidentiality) | Encrypt using the recipient's public key | Decrypt using the recipient's private key |
| Digital Signature (Integrity & Non-repudiation) | Sign using the sender's private key | Verify using the sender's public key |

[For more details on encryption, hashing, and signatures → Encryption, Hashing, and Authentication Basics](#/post/sec-authn-crypto)

<details>
<summary>Try RSA with Small Numbers</summary>

RSA relies on the difficulty of factoring the product of two large prime numbers. Here is a walkthrough using very small primes: if p=61 and q=53, then n=3233, and the private exponent d corresponding to the public exponent e=17 is 2753.

```python
p, q = 61, 53
n = p * q
phi = (p - 1) * (q - 1)
e = 17
d = pow(e, -1, phi)
c = pow(65, e, n)       # 평문 65를 공개키(e, n)로 암호화
print(n, d, c, pow(c, d, n))
# 3233 2753 2790 65
```

The plaintext 65 becomes 2790 after encryption, and decrypting with the private key d returns it to 65. In practice, much larger numbers are used instead of these small ones.

</details>

### Hashing

Hashing is a function that reduces input of any length to a fixed-length value. It is one-way and irreversible, so there is no concept of decryption; it is used for integrity checks to verify whether files or messages have been altered. Even a single character change in the input results in a completely different hash output.

```python
import hashlib
print(hashlib.sha256(b"password").hexdigest()[:16])  # 5e884898da280471
print(hashlib.sha256(b"passworD").hexdigest()[:16])  # 9e78de733c6a51c0
```

SHA-256 produces a 256-bit value, while MD5 produces a 128-bit value. In both cases, the length is fixed and independent of the input size.

When storing passwords, a salt (a random value unique to each user) is mixed with the password before hashing. Even identical passwords produce different hashes, making it difficult for attackers to use precomputed tables to match them at once.

```python
print(hashlib.sha256(b"s1" + b"password").hexdigest()[:16])  # 33453fb858dcac18
print(hashlib.sha256(b"s2" + b"password").hexdigest()[:16])  # bd22d1631a4e4c66
```

<details>
<summary>Where Hashing and Encryption Overlap</summary>

- Encryption can be reversed if the key is known; hashing cannot be reversed.
- Inserting a secret key into a hash to check whether a message has been tampered with is called a Message Authentication Code (MAC). The term MAC is also used for Mandatory Access Control, so context must be used to distinguish between them in problems.
- Digital signatures are typically created by signing the hash of the entire message rather than the message itself.

</details>

## Authentication and Access Control

Authentication ("Who are you?") verifies identity, while Authorization ("What can that person do?") determines permissions. Access control refers to the mechanisms that enforce authorization decisions.

Authentication methods are typically grouped into three categories:

| Type | Example |
|---|---|
| Something You Know | Password, PIN |
| Something You Have | OTP device, smartphone, certificate |
| Something You Are | Fingerprint, face recognition |

Multi-factor authentication (MFA) involves combining two or more different types. Using two passwords does not constitute MFA because they belong to the same category.

### Access Control Models

| Model | Who Determines Permissions? | One-Liner Description |
|---|---|---|
| DAC (Discretionary) | Resource Owner | The owner decides who can access the resource |
| MAC (Mandatory) | System Policy | Decisions are based on security levels (e.g., Top Secret, Secret) and user clearance levels |
| RBAC (Role-Based) | Organizational Roles | Permissions are assigned based on job roles |

The principle of least privilege states that users should be granted only the permissions necessary for their tasks. RBAC is relatively easy to adhere to this principle; for example, preventing HR personnel from creating network accounts.

[How authentication is implemented using tokens and sessions → Unified Implementation and Interfaces](#/post/jb-integration-api)

## Attack Types

Attack names often don't immediately suggest what they do, so I memorized them by pairing each name with a one-line description of its behavior.

| Attack | Behavior |
|---|---|
| SYN Flooding | Floods the server with spoofed SYN packets, creating half-open connections without responses and exhausting server resources |
| Smurf | Sends packets with the victim's address as the source to a broadcast address, causing responses from multiple hosts to flood the victim |
| Ping of Death | Crashes vulnerable systems using malformed ping packets |
| Teardrop | Sends overlapping and malformed IP fragments, causing errors during the reassembly process |
| DDoS | A massive number of compromised hosts (botnet) attack simultaneously, exhausting bandwidth and resources |

[How TCP connections and IP fragmentation work → Network](#/post/jb-network)

The goal of DoS is to make services unusable, thereby affecting availability. Since the source isn't a single entity, stopping one source is insufficient for DDoS. In exams, you'll often encounter questions that match attack names with their behaviors. It's also helpful to remember that source spoofing is used in both SYN Flooding and Smurf attacks.

### Web Attacks: SQL Injection and XSS

SQL Injection is an attack where SQL fragments are inserted into input values to alter the intended meaning of a query. Below is a direct demonstration using SQLite's in-memory database.

```python
import sqlite3
db = sqlite3.connect(":memory:")
db.execute("create table u(n,p)")
db.execute("insert into u values('kim','pw')")

n = "kim' --"
q = "select * from u where n='%s' and p='bad'" % n
print(db.execute(q).fetchall())      # [('kim', 'pw')]  비밀번호가 틀렸는데 통과
print(db.execute("select * from u where n=? and p=?", (n, 'bad')).fetchall())  # []
```

Concatenating strings causes the condition after `--` to become a comment, effectively bypassing password checks. Passing values as placeholders (`?`) ensures the input is treated as data rather than SQL, thus blocking the attack. [SQL Basics → Database Concepts](#/post/jb-db-concept)

XSS is an attack where malicious scripts are injected into trusted sites and executed in the visitor's browser. Since the browser trusts the site, these scripts can access sensitive data like cookies or session tokens, or manipulate the display. If input is immediately reflected in the response, it's a Reflected XSS; if stored on the server and executed for all viewers, it's Stored XSS. The basics of defense involve input validation and output encoding.

```python
import html
print(html.escape("<script>x</script>"))  # &lt;script&gt;x&lt;/script&gt;
```

[More Web Vulnerabilities → Web Vulnerabilities and OWASP](#/post/sec-owasp)

<details>
<summary>Tips for Solving</summary>

Security problems typically ask you to either select the correct term based on a description or provide an explanation for a given term. Here's how to approach them:

1. Identify the security property being protected (Confidentiality, Integrity, Availability) from the description.
2. If keys are mentioned, determine how many there are and whose keys they are. For signatures, the sender uses their private key.
3. Match attack names with their one-line behavior descriptions. If you see "broadcast" and "source spoofing," it's Smurf; if you see "half-open connections," it's SYN Flooding.
4. For access control, determine who makes the decision: Owner-based is DAC, Level-based is MAC, Role-based is RBAC.

</details>

## Common Misconceptions

- Calling a hash "encrypted" is incorrect. It's a one-way summary that cannot be reversed.
- Signing is done with a private key, not a public key. Verification uses the public key.
- Requiring two passwords of the same type does not constitute Multi-Factor Authentication (MFA).
- The MAC in Mandatory Access Control and Message Authentication Code share only the name; they are fundamentally different concepts.

## Conclusion

Keep four tables in mind: Cryptography, Key Roles, Access Control, and Attacks. When a problem arises, start by identifying the security property being protected.

← [Concept Map](#/post/jb-map)

Related articles: [Network](#/post/jb-network) · [Operating Systems](#/post/jb-os) · [Software Testing](#/post/jb-testing)

## Reference Links

- [Public-key cryptography — Wikipedia](https://en.wikipedia.org/wiki/Public-key_cryptography)
- [Access control — Wikipedia](https://en.wikipedia.org/wiki/Access_control)
- [Denial-of-service attack — Wikipedia](https://en.wikipedia.org/wiki/Denial-of-service_attack)
- [Cross Site Scripting (XSS) — OWASP](https://community.owasp.org/attacks/xss)