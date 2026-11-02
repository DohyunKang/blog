Security is too broad to see how terms connect just by looking them up individually. That's why I've listed the first line of each post in this five-part Information Security series, and linked further details below. The order follows: cryptography basics → web vulnerabilities → key management → AI risks → personal data protection.

## Overview of Relationships

```
암호화·해시·서명 (바탕 도구)
   ├─ 웹 앱은 어디서 뚫리나 ........ 웹 취약점과 OWASP
   ├─ 비밀 값은 어떻게 다루나 ...... 키·시크릿 관리
   ├─ AI가 읽는 글이 명령이 되면 ... 프롬프트 인젝션
   └─ 사람 정보는 어떻게 지키나 .... 개인정보와 데이터 보호
```

## 1. Foundational Tools

**Cryptography, Hashing, and Authentication Basics**: Encryption hides information and allows recovery; hashing verifies content without allowing recovery; signatures confirm origin and integrity. Since each solves a different problem, separating their uses connects everything up to TLS in one go.
[Read more → Cryptography, Hashing, and Authentication Basics](#/post/sec-authn-crypto)

## 2. Web Vulnerabilities

**Web Vulnerabilities and OWASP**: The OWASP Top 10 is a list of common risk categories in web applications. Examining SQL injection, XSS, and CSRF within it reveals a shared root cause: "data being interpreted as commands." Simple demo code demonstrating these issues can be found in the post.
[Read more → Web Vulnerabilities and OWASP](#/post/sec-owasp)

## 3. Handling Secret Values

**Key and Secret Management**: The core principle for secrets like API keys or database passwords isn't perfect hiding, but immediate revocation and reissuance upon leakage. Storage, rotation, least privilege, and handling accidental exposure in Git are covered.
[Read more → Key and Secret Management](#/post/sec-keys)

## 4. AI Risks

**Prompt Injection and AI Security**: Models cannot distinguish between instructions and data, so a single line of text can be consumed as a command. Since there's no perfect prevention yet, minimizing damage upon success—by reducing privileges—is the center of defense.
[Read more → Prompt Injection and AI Security](#/post/sec-prompt-injection)

## 5. Protecting People's Information

**Personal Data and Privacy Protection**: Personal information includes not just names but any data that can identify an individual when combined with other information. Therefore, collecting less and retaining it briefly takes precedence over encryption.
[Read more → Personal Data and Privacy Protection](#/post/sec-privacy)

## Reading Order Guide

| Question | First Article to Read |
|---|---|
| What's the difference between encryption and hashing? | Cryptography, Hashing, and Authentication Basics |
| Building web services | Web Vulnerabilities and OWASP → Key and Secret Management |
| Adding tools to LLM apps | Prompt Injection and AI Security |
| Receiving user data | Personal Data and Privacy Protection |

## Next Articles

- [Environment Variables and Secret Management](#/post/cloud-secrets)
- [Authentication and Authorization](#/post/be-auth)
- [Guardrails and Safety Mechanisms](#/post/app-guardrails)

← Concept map for other series ([# /post/ai-map])