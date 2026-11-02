CPUs execute instructions rapidly, whereas disks, network cards, and keyboards are significantly slower in comparison. The story of input/output (I/O) largely revolves around how to hide this speed disparity. Internal CPU operations are covered in [CPU and Instructions](#/post/ca-cpu), and memory speed differences are discussed in [Memory Hierarchy and Caching](#/post/ca-memory-hierarchy); here, we focus solely on devices outside the CPU and the pathways between them.

## Devices Appear as a Few Registers

OSTEP (the textbook) explains using a hypothetical standard device. A device consists of two parts: the interface presented to the system and its internal structure behind it. The internal structure can be as simple as ending with a single chip, or as complex as including a small CPU and memory running firmware. The operating system does not need to understand the internals; it only needs to handle the interface.

The interface is simplified into three registers:

| Register | Usage |
|---|---|
| Status | Read to check if the device is currently busy |
| Command | Write to start the device's operation |
| Data | Write data to send to the device or read data received from it |

The basic procedure involves four steps: wait while the status indicates busy, write to the data register, write to the command register, and wait again while the status indicates busy. Continuously reading the status while waiting is called polling, and the CPU directly moving data is referred to as programmed I/O (PIO). While simple and functional, if a device is slow, the CPU wastes time simply reading the status register.

## How to Access Registers

There are two methods for a CPU to access device registers. One uses dedicated input/output instructions. Examples include x86's `in` and `out`, which point to devices via port numbers. These instructions are typically privileged and can only be used by the operating system; otherwise, any program directly touching a disk would cause trouble.

The other method is memory-mapped I/O. This makes device registers appear as memory addresses, so loading or storing to that address causes hardware to send the data to the device rather than memory. The advantage is that no new instructions are needed. OSTEP notes that neither approach is clearly superior and both are still in use today.

Since each device has different registers and procedures, the entire operating system cannot know them all. Therefore, device-specific details are encapsulated within device drivers, while higher-level components like file systems make only general requests such as "read/write block." The file system side is covered in [File Systems and I/O](#/post/os-filesystem).

## The Cost of Waiting: Polling vs. Interrupts

Using interrupts instead of polling allows the operating system to send a request, suspend the process, and let it do other work. Once the device finishes, hardware triggers an interrupt, and the CPU jumps to the designated interrupt service routine (ISR). The handler completes the request and wakes up the suspended process. During this time, the CPU executes other processes, enabling computation and I/O to overlap.

Does this mean interrupts are always better? OSTEP says no. Handling interrupts and context switching also incurs costs. If a device is very fast, polling for just a few times may suffice, making polling preferable in that case. Thus, hybrid approaches exist where the system polls briefly and switches to interrupts if completion doesn't occur. In scenarios like networks flooding with packets, too many interrupts can cause livelock, where the operating system spends all its time handling interrupts; in such cases, occasionally taking direct control via polling is beneficial. There is also an optimization called coalescing, which groups multiple interrupts and notifies them at once.

<details>
<summary>Polling vs. Blocking Wait: How Much CPU Usage? (Executed Directly)</summary>

Simulated a slow device that reports "finished" after 1 second using threads. One side continuously calls non-blocking `recv` in a loop (polling), while the other uses blocking `recv` to let the kernel suspend it. Note that blocking is not exactly equivalent to the interrupt method; however, they share a similar structure because the operating system suspends the process and wakes it upon an event.

```python
import socket, time, threading

def device(sock, delay):
    time.sleep(delay)
    sock.send(b"done")

def run(mode, delay=1.0):
    a, b = socket.socketpair()
    threading.Thread(target=device, args=(b, delay), daemon=True).start()
    c0, t0 = time.process_time(), time.perf_counter()
    if mode == "poll":
        a.setblocking(False)
        n = 0
        while True:
            n += 1
            try:
                a.recv(4); break
            except BlockingIOError:
                pass
    else:
        a.recv(4); n = 1
    return mode, n, time.process_time() - c0, time.perf_counter() - t0

for m in ("poll", "block"):
    mode, n, cpu, wall = run(m)
    print(f"{mode:5s} 확인 {n:>9,}회  CPU {cpu:.2f}s  경과 {wall:.2f}s")
```

This result was obtained running on Windows with Python 3.13. Polling performed approximately 580,000 checks and consumed 0.98 seconds of CPU time, whereas blocking took 0.00 seconds per call. Both took 1.00 second for elapsed time, meaning the waiting duration was identical; the difference lay in whether CPU was used during that wait. The number of calls varies with each execution.
</details>

## Moving Data: DMA

Even if interrupts reduce waiting time, PIO requires the CPU to copy data one word at a time from the device. For large blocks, the CPU spends time on simple copying. DMA (Direct Memory Access) addresses this issue. A DMA engine is a dedicated device that performs transfers between memory and the device without CPU intervention.

The process works as follows. The operating system informs the DMA engine about where in memory the data resides, how much needs to be transferred, and which device should receive it. This is the extent of the OS's involvement; the actual transfer is handled by the engine. Once complete, the engine raises an interrupt to signal completion. Looking at the OSTEP timeline, while a process copies data during PIO (Programmed I/O), the CPU remains idle in that interval. In contrast, with DMA, another process can execute during that same period.

DMA is not free. There are costs associated with setting up the engine and handling end-of-transfer interrupts, so for very small transfers, PIO might actually be more efficient.

<details>
<summary>Breakeven calculation between PIO and DMA (assumed numbers, executed)</summary>

These calculations are based on assumed figures rather than measurements from actual hardware. We assume that transferring one word (8 bytes) takes 20 cycles, while setting up the DMA engine and handling interrupts costs 2000 cycles.

```python
BLOCK = 4096
WORD = 8
COPY_CYCLES = 20
SETUP_CYCLES = 2000

dma = SETUP_CYCLES
for size in (64, 512, 4096, 65536):
    p = (size // WORD) * COPY_CYCLES
    print(f"{size:>6}B  PIO {p:>7}  DMA {dma}  ->", "PIO가 유리" if p < dma else "DMA가 유리")
```

The results showed: at 64B, PIO is better with a cost of 160 versus 2000 for DMA; at 512B, 1280 versus 2000 (PIO still better); at 4096B, 10240 versus 2000 (DMA becomes better); and at 65536B, 163840 versus 2000 (DMA clearly better). The breakeven point depends on the assumed values, and actual thresholds vary by device and CPU.
</details>

## Buses and Addresses

A bus is a connection pathway through which CPUs, memory, and devices exchange data and signals. In OSTEP's diagram of modern systems, the CPU connects directly to memory via a memory interconnect and to graphics cards via high-performance PCIe. Other devices pass through an I/O chip connected via DMI (Direct Media Interface). Below that chip, slower devices like keyboards or mice attach via USB, while hard drives connect via eSATA. High-performance devices such as network cards or NVMe storage often attach directly to PCIe. Faster devices typically use connections closer to the CPU, forming a hierarchical structure where slower devices go through distant chips.

Since DMA-capable devices write memory addresses directly, an additional concept of addressing arises. Linux kernel documentation divides addresses into three categories: virtual addresses used by the kernel, CPU physical addresses used for managing resources like device registers, and bus addresses used by devices for MMIO (Memory-Mapped I/O) and DMA. Bus addresses may differ from CPU physical addresses because host bridges or IOMMUs (Input-Output Memory Management Units) can translate them. An IOMMU is a device that translates the address seen by a device into an actual RAM address; simple systems may not have one.

Linux DMA mapping falls into two types. Coherent mapping is created during driver initialization and reused for a long time, ensuring hardware consistency between what the CPU and the device see; this suits structures like descriptor rings used for communication with devices. Streaming mapping is created once per transfer and then released, typically used for network or filesystem buffers. If the CPU accesses such a buffer in the middle, a synchronization call is required.

## Where Does the GPU Attach?

GPUs also attach to buses like other devices. However, in the CUDA documentation model, memory directly attached to the CPU is called host memory, while memory attached to the GPU is device memory. Programs start on the CPU, use the CUDA API to copy data between the two, execute kernels (code running on the GPU), and then wait for completion. The CPU and GPU can operate simultaneously. On supported systems, thanks to a unified virtual address space, you can determine whether memory is GPU-resident or system-resident simply by examining the address. Using Unified Memory allows the runtime or hardware to move data as needed. The documentation notes that PCIe or NVLink-based access where the GPU reads CPU memory directly does not replace the benefit of placing data in the appropriate location.

In summary, the "data copy" cost when using a GPU ultimately reflects the cost of traversing the bus. This also explains why keeping models on the GPU avoids repeated copies. Discussions on inference optimization can be found in [inference optimization](#/post/ml-inference).

## Common Misconceptions

- Using DMA means the CPU is not involved at all: While the engine handles the transfer itself, the CPU sets up the transfer and processes interrupts upon completion.
- Interrupts are always better than polling: For fast devices or situations with many interrupts, polling might be preferable.
- Device addresses and memory addresses are separate: In memory-mapped I/O, device registers appear within the address space.
- Physical addresses seen by the CPU always match those used by devices: This may not be true if bridges or IOMMUs are present.

## Reference Links

- OSTEP, I/O Devices: https://pages.cs.wisc.edu/~remzi/OSTEP/file-devices.pdf
- Linux Kernel Documentation, Dynamic DMA Mapping Guide: https://docs.kernel.org/core-api/dma-api-howto.html
- NVIDIA CUDA Programming Guide, Programming Model: https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/programming-model.html

← Concept Map (#/post/cs-map)

Related Posts: [Operating System Overview](#/post/cs-os) · [Memory Hierarchy and Cache](#/post/ca-memory-hierarchy) · [File Systems and I/O](#/post/os-filesystem)