Computers contain only 0s and 1s. Numbers, letters, and images are all bundles of bits; even the same bundle of bits represents different values depending on the agreement to read them as "integers," "floating-point numbers," or "characters." This article examines three such agreements—integers (two's complement), floating-point numbers, and characters (Unicode and UTF-8)—using Python. How CPUs extract and calculate these bit bundles continues in [CPU and Instructions](#/post/ca-cpu).

## Bit Bundles and Agreements

Eight bits create 256 patterns. Attaching meaning to these patterns constitutes data representation. The same `11111011` represents 251 as an unsigned integer, but -5 as a signed integer (two's complement). The bits remain unchanged; only the interpretation shifts.

| Reading Agreement | Value of `11111011` |
|---|---|
| Unsigned Integer | 251 |
| Two's Complement Integer | -5 |
| Character Code (e.g., Latin-1) | Different characters based on the code table |

Therefore, when opening a file and seeing garbled text, it is often not that the bits are corrupted, but rather that the reading agreement has shifted. We will explore character encoding directly in the following section.

## Integers: Two's Complement

The method for representing negative numbers used by almost all CPUs today is two's complement. In n bits, a negative number -x is stored as the bit pattern of 2^n minus x. For example, -5 in 8 bits is 256 - 5 = 251, which is `11111011` in binary. In Python, you can verify this with `n & 0xFF`.

```python
for n in (5, -5, -1, 127):
    print(n, format(n & 0xFF, '08b'))
# 5 00000101
# -5 11111011
# -1 11111111
# 127 01111111
print(int('11111011', 2) - 256)   # -5
```

While the most significant bit being 1 indicates a negative number, it is not merely a simple sign bit; its place value can be thought of as -128. Thus, `11111011` equals -128 + 64 + 32 + 16 + 8 + 2 + 1 = -5.

The reason two's complement is used is that a single addition circuit can calculate both signed and unsigned numbers together. Subtraction becomes adding the opposite sign. There is only one representation for zero (`00000000`). The range representable with n bits is from -2^(n-1) to 2^(n-1)-1, meaning there is one more negative number than positive ones. For 8 bits, the range is -128 to 127.

Overflow occurs when exceeding this range. In 8 bits, adding 1 to 127 results in `10000000`, which represents -128. Since Python integers have no length limit, you must manually apply a mask to mimic this behavior.

```python
x = (127 + 1) & 0xFF
print(x, x - 256 if x > 127 else x)   # 128 -128
```

This is how overflow occurs in fixed-length integers in languages like C or Java: the value wraps around to the opposite end.

<details>
<summary>Byte Order (Endianness)</summary>

When an integer spans multiple bytes, the order in which bytes are placed is also an agreement. For 258 (`0x00000102`), big-endian places the higher-order byte first, while little-endian places the lower-order byte first.

```python
print((258).to_bytes(4, 'big').hex())      # 00000102
print((258).to_bytes(4, 'little').hex())   # 02010000
```

When exchanging numbers via files or networks, both parties must agree on the reading order. The rules for sending bytes over a network can be continued in [Network Basics](#/post/cs-network).
</details>

## Floating-Point Numbers

Fractions are more complex than integers. To represent both very large and very small numbers within limited bits, we store them by dividing them into sign, exponent, and mantissa, similar to scientific notation. Python's `float` follows IEEE 754 binary64 (double precision), using 64 bits as follows:

| Sign | Exponent | Mantissa |
|---|---|---|
| 1 bit | 11 bits | 52 bits |

The value takes the form `(-1)^sign × 1.mantissa × 2^(exponent-1023)`. Extracting the bits for 1.0 and -2.5 confirms this structure.

```python
import struct
def bits(f):
    b = struct.unpack('>Q', struct.pack('>d', f))[0]
    s = format(b, '064b')
    return s[0], s[1:12], s[12:]

print(bits(1.0))
# ('0', '01111111111', '000...0')           지수 1023 → 2^0
print(bits(-2.5))
# ('1', '10000000000', '0100...0')          지수 1024 → 2^1, 1.25 × 2 = 2.5
```

Since the exponent field for 1.0 is `01111111111` (1023), it shows that the bias is 1023. For -2.5, with a sign of 1, an exponent of 1024 (2^1), and a mantissa of `01`, the value becomes 1.25, which is then multiplied by 2 with the sign inverted.

### Why 0.1 Is Inaccurate

The decimal number 0.1 repeats infinitely in binary as 0.000110011001100…, so since the mantissa is limited to 52 bits (effectively 53 bits including the implicit leading 1), it must be truncated at some point, storing the closest possible value. According to Python's official tutorial, instead of 0.1, the stored value is 3602879701896397 / 2^55, which is slightly larger than 1/10. Python displays `0.1` because it is the shortest decimal representation that rounds back to this value.

```python
from decimal import Decimal
print(Decimal(0.1))
# 0.1000000000000000055511151231257827021181583404541015625
print(0.1 + 0.2)           # 0.30000000000000004
print(0.1 + 0.2 == 0.3)    # False
```

This is not a bug but a result of the representation method. Performing the same calculation in any language using binary64 yields identical results. When comparing, use tolerance instead of `==`.

```python
import math
print(math.isclose(0.1 + 0.2, 0.3))   # True
```

For applications requiring precise decimal calculations (such as financial computations), one can create a `Decimal` from a string. The official documentation also recommends the `decimal` module for accounting purposes.

### Small Numbers Disappearing Next to Large Numbers

Since the mantissa length is fixed, the gap between representable values widens as numbers grow larger. From 2^53 (9007199254740992) onward, even integers of size 1 cannot be distinguished.

```python
print(2**53)                              # 9007199254740992
print(float(2**53) + 1 == float(2**53))   # True
print(1e16 + 1 == 1e16)                   # True
```

So when you add a large number and a small number, the smaller one disappears. This is why the order changes the result in summation calculations involving many numbers.

<details>
<summary>Special Values</summary>

If all exponent fields are 1, it represents infinity or NaN. If the range is exceeded, it becomes `inf`, and calculations like `inf - inf` become `nan`. NaN is not equal to itself.

```python
import sys
print(sys.float_info.max * 2)         # inf
print(float('inf') - float('inf'))    # nan
nan = float('nan'); print(nan == nan) # False
print(5e-324, 5e-324 / 2)             # 5e-324 0.0
print(sys.float_info.epsilon)         # 2.220446049250313e-16
```

`5e-324` is the smallest representable positive number, and half of that rounds down to 0. `epsilon` is the difference between 1.0 and the next larger float.
</details>

## Characters: Code Points and Encoding

To avoid confusion, think of characters in two steps. First, Unicode assigns a number (code point) to each character. Then, an encoding defines the rules for converting those numbers into bytes. The code point and the sequence of bytes are distinct concepts.

ASCII was a table that fit 128 English letters and symbols into 7 bits. For characters with many variants, like Korean, one byte isn't enough, so country-specific encodings like EUC-KR were created. Unicode unified these into a single numbering system. Today, UTF-8 is the default encoding for the web and Python 3.

### UTF-8 Has Variable Length

UTF-8 uses 1 to 4 bytes depending on the code point size. The structure defined in RFC 3629 is as follows:

| Code Point Range | Number of Bytes | Bit Pattern |
|---|---|---|
| U+0000 ~ U+007F | 1 | `0xxxxxxx` |
| U+0080 ~ U+07FF | 2 | `110xxxxx 10xxxxxx` |
| U+0800 ~ U+FFFF | 3 | `1110xxxx 10xxxxxx 10xxxxxx` |
| U+10000 ~ U+10FFFF | 4 | `11110xxx 10xxxxxx 10xxxxxx 10xxxxxx` |

The number of leading 1s in the first byte indicates the total length, and subsequent bytes always start with `10`. The ASCII range fits within a single byte, so English text is identical in both ASCII and UTF-8.

Let's verify with '가' (U+AC00). Filling the code point `1010110000000000` into a 3-byte frame results in `1110 1010`, `10 110000`, and `10 000000`.

```python
ch = '가'
print(hex(ord(ch)))                                  # 0xac00
print(format(ord(ch), '016b'))                       # 1010110000000000
print([format(b, '08b') for b in ch.encode()])
# ['11101010', '10110000', '10000000']
print(ch.encode('utf-8').hex())                      # eab080
```

`eab080` is equivalent to the above three bytes (`ea`, `b0`, `80`) in binary. 'A' takes 1 byte, '가' takes 3 bytes, and an emoji (U+1F600) takes 4 bytes.

```python
for ch in ('A', '가', '\U0001F600'):
    print(hex(ord(ch)), ch.encode('utf-8').hex(), len(ch.encode('utf-8')))
# 0x41 41 1
# 0xac00 eab080 3
# 0x1f600 f09f9880 4
```

### Character Count Differs from Byte Count

```python
s = '한글'
print(len(s))                       # 2   글자(코드 포인트) 수
print(len(s.encode('utf-8')))       # 6   UTF-8 바이트 수
print(len(s.encode('euc-kr')))      # 4   EUC-KR 바이트 수
```

This is why you need to check whether database column lengths or API body size limits are based on bytes or characters. UTF-16 stores '가' in 2 bytes and an emoji in 4 bytes (as a surrogate pair), so the same string has different sizes depending on the encoding.

### When Characters Break

If the reading agreement is violated, corruption occurs. For example, reading Korean UTF-8 bytes as Latin-1, or reading EUC-KR bytes as UTF-8.

```python
s = '한글'
print(s.encode('utf-8').decode('latin-1').encode('unicode_escape'))
# b'\\xed\\x95\\x9c\\xea\\xb8\\x80'   Latin-1 글자 6개로 읽힘
print(s.encode('euc-kr').decode('utf-8', errors='replace').encode('unicode_escape'))
# b'\\ufffd\\u0471\\ufffd'            대체 문자(U+FFFD)가 섞임
try:
    b'\xea\xb0'.decode('utf-8')       # '가'의 3바이트 중 2바이트만
except Exception as e:
    print(type(e).__name__)           # UnicodeDecodeError
```

Errors occur or replacement characters (�) are inserted when encountering bytes that don't match UTF-8 rules while reading. This happens when a file is truncated in the middle or the encoding is misidentified.

<details>
<summary>Same Character, Different Code Points</summary>

'é' can be a single code point (U+00E9) or two code points consisting of 'e' followed by a combining accent (U+0301). They appear identical on the screen.

```python
import unicodedata
print(len('é'), len('é'))              # 1 2
print('é' == 'é')                       # False
print(unicodedata.normalize('NFC', 'é') == 'é')   # True
```

This is why string normalization must often be performed before searching or comparing strings.
</details>

## Moving Forward

| Target | Standard | One-Liner Summary |
|---|---|---|
| Integer | Two's Complement | Addition circuit handles sign too; wraps around if range exceeded |
| Float | IEEE 754 | Sign, exponent, mantissa; most decimal fractions are approximations |
| Character | Unicode + UTF-8 | Separate code points and bytes; 1–4 bytes per character |

Limitations arising from fixed bit counts (overflow, rounding errors, byte count differences) all stem from these three. How values created this way move from registers to cache, memory, and disk is covered in [Memory Hierarchy and Cache](#/post/ca-memory-hierarchy).

## Common Misconceptions

- 0.1 + 0.2 is not 0.3: this is a Python issue; Python simply displays binary64 values as they are. Use `decimal` for accurate decimal arithmetic.
- Negative numbers are formed by flipping only the most significant bit: in two's complement, the most significant bit represents -2^(n-1), so changing it also affects the value of the remaining bits. For example, -5 is not `10000101` but `11111011`.
- All UTF-8 characters are 3 bytes: English letters use 1 byte, while most Korean characters use 3 bytes. UTF-8 mixes 1 to 4 bytes depending on the character.
- The number of characters equals the number of bytes only when using ASCII alone: with two Korean characters encoded in UTF-8, they occupy 6 bytes.
- When Korean text appears garbled, the data itself is not corrupted; the bits remain unchanged, but the reading encoding is often incorrect.

## Reference Links

- Floating-Point Arithmetic: Issues and Limitations (Python official tutorial): https://docs.python.org/3/tutorial/floatingpoint.html
- RFC 3629, UTF-8, a transformation format of ISO 10646: https://www.rfc-editor.org/rfc/rfc3629

← Concept map (#/post/cs-map)

Related posts: [CPU and Instructions](#/post/ca-cpu) · [Memory Hierarchy and Cache](#/post/ca-memory-hierarchy) · [I/O and Buses](#/post/ca-io-bus)