Encryption, hashing, and digital signatures look similar but solve different problems. Encryption hides data so it can be recovered later; hashing verifies that data is unchanged without allowing recovery; and signatures verify who created the data and ensure it hasn't been altered.

## Breaking Down the Three Concepts First

| Tool | Recoverable? | Key(s) | Primary Use |
|---|---|---|---|
| Symmetric-key encryption | Yes | One (shared key) | Hiding data |
| Asymmetric-key encryption & signatures | Encryption: Yes | Public key + Private key | Key exchange, signature verification |
| Hashing | No | None | Integrity verification, password storage |

The terms got mixed up and confusing, but one question helped clarify things: Do you need the original data (encryption), do you only need to verify it's unchanged (hashing), or is verifying the sender important (signatures)?

## Symmetric-key Encryption

Lock with one key and unlock with the same key. It's fast. Whether for files or communication, hiding large amounts of data is almost exclusively done with symmetric encryption. AES is currently the standard, and nowadays AEAD modes that combine encryption with tamper detection are used (such as AES-GCM, ChaCha20-Poly1305). RFC 8446 notes that TLS 1.3 removed pure encryption schemes that aren't AEAD.

There's one weakness: how do both parties securely share the same key? Sending a key over the internet in plain text defeats the purpose of hiding it.

## Asymmetric-key Encryption

Keys come in pairs. The public key can be shared with anyone, while the private key is kept secret by you. Data encrypted with the public key can only be decrypted with the private key. This allows secure communication even with someone you've never met before.

However, it's slow. So in practice, they're combined: asymmetric methods are used to agree on a symmetric key, and then the actual message body is encrypted with that symmetric key. TLS follows this structure too. RSA and elliptic curve cryptography (ECDH, ECDSA, etc.) are representative examples.

<details>
<summary>How key exchange actually works (Diffie-Hellman family)</summary>

In TLS 1.3, keys aren't "sent" to the other party; instead, each side generates its own temporary key pair and exchanges only public values to compute the same shared secret. This relies on mathematics that makes it computationally infeasible to derive the secret even if an attacker sees all exchanged public values. Since these are temporary keys, they're discarded when the session ends, so even if a server's long-term keys are compromised later, past communications remain secure. This property is called forward secrecy. RFC 8446 states that TLS 1.3's public-key-based key exchanges all possess this property (with exceptions for PSK-only modes and 0-RTT data).
</details>

## Hashing

A function that takes any input and produces a fixed-length output. The same input always yields the same output, but it's computationally infeasible to reverse-engineer the input from the output. Changing even a single character completely alters the result.

```python
import hashlib
hashlib.sha256(b"hello").hexdigest()
# 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
hashlib.sha256(b"hellp").hexdigest()
# fdd7585e08c4e2afd71dcabdb4636c89d557a3f42db9e2040c8bbd1708aa4ce7
```

These two values were verified by direct computation. Checking checksums after downloading a file serves this purpose: if the values match, the data hasn't changed.

One more point: hashing can be computed by anyone without a key. Therefore, to prevent tampering, HMAC (Hash-based Message Authentication Code) is used, which mixes in a key. Only parties who know the key can generate the correct value.

## Don't Just Hash Passwords

SHA-256 was designed for speed, and that speed becomes a problem for password storage. If a database is compromised, attackers can try an enormous number of candidate passwords per second. Additionally, identical passwords produce identical hashes, making precomputed tables (rainbow tables) effective.

So two additional measures are added:

- Salt: A unique random value mixed with each user's password. Even identical passwords produce different hashes, rendering rainbow tables useless. Salts don't need to be secret and can be stored alongside the hash.
- Slow hashing: Using functions that intentionally consume more time and memory.

The OWASP Password Storage Cheat Sheet lists priorities as follows: Argon2id is first (minimum m=19456KiB, t=2, p=1); if unavailable, use scrypt; for older systems, bcrypt (cost factor ≥10, password limit 72 bytes); if FIPS compliance is required, PBKDF2-HMAC-SHA256 with 600,000 iterations. Salts should be generated randomly per password, and most libraries handle this automatically, so don't create them manually.

```python
import hashlib, os, hmac
salt = os.urandom(16)
h = hashlib.pbkdf2_hmac("sha256", b"pw", salt, 600000)
hmac.compare_digest(h, hashlib.pbkdf2_hmac("sha256", b"pw", salt, 600000))  # True
```

Running the code produced 32-byte outputs, and identical salts and iteration counts yielded identical values. Using `compare_digest` during comparison prevents timing attacks that could leak the value. In real-world services, using a library for Argon2id is preferable (this code is a PBKDF2 example used for verification).

<details>
<summary>Pepper</summary>

Unlike salts, a pepper is a secret value shared across all passwords. It's stored outside the database (e.g., in a secrets manager or HSM). According to OWASP, a pepper alone doesn't provide security; it's an auxiliary measure prepared for scenarios where only the database is compromised. It can be mixed before hashing or used as a key for HMAC applied after hashing. If a pepper is leaked, it must be changed, requiring affected users to reset their passwords.
</details>

## Digital Signatures

It combines hashing and asymmetric keys. When a document is hashed and signed with a private key, the recipient verifies it using the public key. If verification passes, two things are confirmed: the document was created by the owner of that private key, and the document has not been altered since signing.

It's easier to remember that encryption and signing work in opposite directions. Encryption locks data with a public key and unlocks it with a private key; signing is done with a private key and verified with a public key. Software distribution, JWT signing, and certificates all rely on this principle.

But how do we know if a public key truly belongs to that person? This is where certificates and Certificate Authorities (CA) come in. A certificate is signed by a CA stating "This is the public key for this domain." The browser follows a chain of trust using a list of trusted CAs to verify it.

## What TLS Does

The 'S' in HTTPS stands for this. It uses all these tools in sequence. The flow of TLS 1.3, as outlined in RFC 8446, is roughly as follows:

1. The client sends a ClientHello containing a temporary key exchange value (key_share) and supported signature algorithms.
2. The server responds with a ServerHello, returning its own key_share. Both parties then compute the same shared secret value; subsequent messages are encrypted.
3. The server sends its certificate, CertificateVerify (a signature made with its private key), and Finished messages—proving its identity.
4. Once the client sends its Finished message, all further data is exchanged using the agreed-upon symmetric key.

The basic handshake involves one round-trip. If a connection has already been established, data can be sent in the first transmission via 0-RTT, but RFCs note that this data lacks forward secrecy. Compared to TLS 1.2, static RSA key exchange, compression, and outdated ciphers have been removed.

In summary: asymmetric cryptography (key agreement and signing) verifies identity and establishes keys; symmetric encryption (AEAD) quickly encrypts the payload; hashing and HMAC detect tampering.

## Common Misconceptions

- Hashing is not encryption. Its purpose is not to be reversible. Saying "passwords are stored by encryption" implies they can be reversed, which is actually dangerous phrasing.
- Encoding (Base64) is also not encryption. Anyone can decode it.
- Salts are not secrets; they prevent identical inputs from producing the same output.
- Do not create your own encryption algorithms. Use verified libraries and standard algorithms.
- The HTTPS padlock does not mean a site is entirely safe. It means communication cannot be read in transit and that the domain matches what you expect.

← [Concept Map](#/post/sec-map)

Related posts: [Web Vulnerabilities and OWASP](#/post/sec-owasp) · [Key & Secret Management](#/post/sec-keys) · [Personal Information and Data Protection](#/post/sec-privacy)

## Reference Links

- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- RFC 8446, TLS 1.3: https://datatracker.ietf.org/doc/html/rfc8446
- Python hashlib·hmac (run code directly to verify)