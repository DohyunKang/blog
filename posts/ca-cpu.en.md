The work a CPU does is simple: it fetches an instruction from memory, decodes what to do, and executes it. It repeats this cycle until the power is turned off. Registers, instruction sets, and pipelines are about how to make this repetition fast and accurate. How an operating system shares the CPU is covered in [Operating System Overview](#/post/cs-os), but here we focus only on the inside of the CPU.

## Von Neumann Architecture

The structure where programs (instructions) and data are stored together in the same memory, and the CPU reads and executes instructions one by one from there, is called the Von Neumann architecture. Most computers used today are built on this framework. Since instructions are ultimately just numbers in memory, changing a program means changing the contents of memory. How numbers are stored as bits is covered in [Data Representation](#/post/ca-data-representation).

There are three main components inside a CPU:

| Component | Function |
|---|---|
| Control Unit | Decodes instructions and sends signals to other devices saying "do this now" |
| ALU | Performs arithmetic operations like addition and subtraction, and logic operations like AND and OR |
| Registers | Very small and fast storage space inside the CPU |

Memory is outside the CPU and much slower than registers. Therefore, most operations load values into registers to perform calculations, then store the results back into memory. This speed difference leads to [Memory Hierarchy and Cache](#/post/ca-memory-hierarchy).

## Instruction Cycle

The process of handling one instruction is divided into three stages:

1. **Fetch**: The program counter (PC) reads the instruction at the address it points to from memory and loads it into the instruction register. The PC then advances to the next instruction address.
2. **Decode**: The control unit reads the instruction and determines what operation to perform and what operands are involved.
3. **Execute**: The ALU performs calculations, or data is read from or written to memory, and results are stored in registers.

The PC usually increments by one, but changes to a different address when branch or jump instructions occur. Constructs like `if` statements or loops are instructions that change the PC at the machine level.

I created a small virtual CPU in Python to simulate this cycle directly. Here is a program that adds numbers from 1 to 5.

<details>
<summary>Running a register machine directly (execution verified)</summary>

```python
prog = [
    ("LOADI", 0, 0),   # r0 = 0 (합)
    ("LOADI", 1, 5),   # r1 = 5 (카운터)
    ("LOADI", 2, 1),   # r2 = 1
    ("ADD", 0, 1),     # r0 += r1
    ("SUB", 1, 2),     # r1 -= r2
    ("JNZ", 1, 3),     # r1 != 0 이면 PC = 3
    ("HALT", 0, 0),
]
reg = [0] * 4
pc = 0
cycles = 0
while True:
    ins = prog[pc]          # fetch
    pc += 1
    op, a, b = ins          # decode
    cycles += 1
    if op == "LOADI": reg[a] = b             # execute
    elif op == "ADD": reg[a] += reg[b]
    elif op == "SUB": reg[a] -= reg[b]
    elif op == "JNZ":
        if reg[a] != 0: pc = b
    elif op == "HALT": break
print(reg[0], cycles)
# 15 19
```

The result is 15, and 19 instructions were executed: the first 3 + 3 iterations of the loop body × 5 + 1 HALT instruction. The code clearly shows that the loop is nothing more than a "jump back to PC - 3".
</details>

## What Do Instructions Look Like?

Actual instructions are also blocks of bits. Typically, they are divided into an operation code (opcode) that indicates what operation to perform, and operand fields that specify which registers or constants to use. The example `("ADD", 0, 1)` above is the textual representation of that format.

The entire agreement on these instructions is called the Instruction Set Architecture (ISA). The ISA defines which instructions exist, how many registers there are, and how memory addresses are specified. x86, ARM, and RISC-V are names of ISAs. Following the same ISA allows programs to run regardless of chip manufacturer, while leaving internal chip design free. The final output produced by a compiler is a stream of instructions for this ISA.

ISAs are broadly categorized into two types: RISC (Reduced Instruction Set Computer) simplifies and regularizes instructions to make hardware run faster, while CISC (Complex Instruction Set Computer) allows a single instruction to perform more tasks. The classic RISC pipeline frequently mentioned in pipeline explanations follows the RISC structure.

## Pipelines

If each stage of the three steps is completed one instruction at a time before starting the next, the fetch unit would be idle during execution. This is like having a washing machine and a dryer: if the first load goes into the dryer, you can put the next load into the washing machine. A pipeline splits instruction processing into stages so that different instructions are in different stages simultaneously.

The classic RISC pipeline has five stages:

| Stage | Function |
|---|---|
| IF | Fetches instructions from memory |
| ID | Decodes instructions and reads registers |
| EX | The ALU performs calculations (including memory address calculation) |
| MEM | Reads from and writes to data memory |
| WB | Writes results to registers |

Once the pipeline is full, one instruction completes per cycle. While the latency (processing time for a single instruction) remains unchanged, the throughput (number of instructions completed per unit time) increases.

<details>
<summary>Calculating cycle count (execution verified)</summary>

With n instructions and 5 stages, without a pipeline it takes 5n cycles; with a pipeline it takes 5 + (n-1) cycles. Additional cycles are added for any hazards.

```python
def cycles(n, stall=0, stages=5):
    return stages + (n - 1) + stall
n = 100
print("파이프라인 없음:", n * 5)        # 500
print("파이프라인:", cycles(n))          # 104
print("load-use 20번:", cycles(n, stall=20))  # 124
print(5 / (cycles(n)/n))                 # 4.80...
```

With 100 instructions, the cycle count drops from 500 to 104, resulting in approximately a 4.8x speedup. However, this does not reach the theoretical limit of 5 stages. If there are 20 stalls in the middle, the cycle count becomes 124, reducing the speedup to about 4x.
</details>

## Hazard: Problems Arising from Overlapping Execution

Executing instructions overlapped can cause issues if a subsequent instruction begins before the preceding one finishes. This situation is referred to as a **hazard**.

- **Data hazard**: Occurs when a subsequent instruction requires the result of a previous instruction, but the result has not yet been written to the register. For example, an instruction using `r1` immediately follows `ADD r1, r2, r3`. This is resolved via forwarding (bypassing), where the ALU output is directly sent as input to the next instruction without waiting for the value to be written to the register. However, since values from a `load` instruction take time to arrive from memory, if the next instruction uses the data immediately, one cycle must be left empty (creating a bubble or stall).
- **Control hazard**: Occurs when instructions are fetched before it is known where a branch instruction will jump. If the branch prediction is incorrect, the fetched instructions must be discarded and re-fetched. Branch prediction aims to reduce this waste by anticipating outcomes in advance. Early MIPS processors also employed a method where the compiler filled the delay slot immediately following a branch.
- **Structural hazard**: Occurs when two instructions attempt to use the same hardware resource simultaneously. For instance, if there is only one memory access unit, fetching and data access may conflict.

## Common Misconceptions

- **Higher clock speed always means faster performance**: The number of instructions completed per cycle (IPC) and the total instruction count also affect speed. If the pipeline stalls, performance decreases even with the same clock speed.
- **Deeper pipelines are always better**: Increasing the number of stages shortens each stage, allowing for a higher clock frequency; however, it also increases the amount of work discarded when branch predictions fail.
- **One instruction finishes in one cycle**: In a pipeline, an instruction spans multiple cycles, with multiple instructions overlapping at various stages simultaneously.
- **Memory reads are handled inside the CPU**: Memory is external to the CPU, making memory reads among the slowest operations. How devices and the CPU exchange data is covered in [I/O and Bus](#/post/ca-io-bus).

## Reference Links

- Classic RISC pipeline (Wikipedia): https://en.wikipedia.org/wiki/Classic_RISC_pipeline
- Instruction cycle (Wikipedia): https://en.wikipedia.org/wiki/Instruction_cycle

← Concept Map ([#/post/cs-map])

Related articles: [Memory Hierarchy and Cache](#/post/ca-memory-hierarchy) · [Data Representation](#/post/ca-data-representation) · [I/O and Bus](#/post/ca-io-bus)