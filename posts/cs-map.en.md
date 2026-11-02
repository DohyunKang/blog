CS Design Fundamentals cover a wide range of topics, making it unclear where to start. Therefore, I've listed seven key themes in one line each and linked to further details below. The order follows: how to divide code (Design) → the foundation on which code runs (Network, OS) → the process of building it (Engineering, Git).

## Overview of Relationships

```
설계(코드를 어떻게 나눌까)
  절차지향 / 객체지향  →  SOLID(바뀔 때 덜 깨지게)  →  디자인 패턴(자주 만나는 문제의 이름표)

바닥(코드가 돌아가는 곳)
  네트워크(DNS → TCP → TLS → HTTP)    운영체제(CPU·메모리를 나눠 쓰게 하는 관리자)

과정(여럿이 만들고 고쳐 나가기)
  소프트웨어 공학(방법론·요구사항·UML·테스트)  →  Git(커밋 스냅샷과 브랜치)
```

## 1. How to Divide Code

**Procedural vs. Object-Oriented**: The criteria for dividing code into parts differ between these approaches. Procedural programming breaks down problems into functions (tasks), while object-oriented programming splits them into objects (data and the operations that manipulate it). The difference lies in whether you start with "what order to execute things" or "who is responsible for this data."
[Read more → Procedural vs. Object-Oriented](#/post/cs-procedural-oop)

**SOLID Principles**: These are five guidelines in object-oriented design that help prevent code from breaking when changes are made. Rather than a rigid rulebook, it's easier to read them as a checklist for understanding why code behaves unexpectedly.
[Read more → SOLID Principles](#/post/cs-solid)

**Design Patterns**: This is a collection of common problems encountered in object-oriented design and their solutions, each given a name. While confusing at first glance based on names and categories alone, understanding the specific situations where they apply makes them much clearer.
[Read more → Design Patterns](#/post/cs-design-patterns)

## 2. The Foundation Where Code Runs

**Network Fundamentals**: Breaking it down by layers clarifies things: converting addresses to IP (DNS), establishing connections (TCP), setting up encryption (TLS), and exchanging requests and responses on top of that (HTTP). These four stages occur in sequence.
[Read more → Network Fundamentals](#/post/cs-network)

**Operating System Fundamentals**: The OS is the manager that allows multiple programs to share limited resources like CPU and memory. Terms like process, scheduling, virtual memory, and synchronization are all different perspectives on this single function.
[Read more → Operating System Fundamentals](#/post/cs-os)

## 3. The Building Process

**Software Engineering Fundamentals**: This field deals not just with how to write good code, but what to build in what order, how to verify it, and how to fix issues. It covers methodology, requirements, UML, testing, and version control as major pillars.
[Read more → Software Engineering Fundamentals](#/post/cs-sw-engineering)

**Git**: Rather than just a tool for accumulating changes, think of Git as stitching together snapshots called commits, with branches acting as labels pointing to specific points. This perspective helps clarify concepts like merge, rebase, and conflict resolution in one unified view.
[Read more → Understanding Git Properly](#/post/cs-git)

## Where to Start Reading

| What You're Curious About | Recommended Article |
|---|---|
| How to divide code | Procedural vs. Object-Oriented → SOLID |
| Design intuition | Design Patterns, Software Engineering Fundamentals |
| What happens when you type an address in a browser | Network Fundamentals |
| Processes, threads, and memory | Operating System Fundamentals |
| Merging code in a team | Understanding Git Properly |

← Other maps: [AI Concept Map](#/post/ai-map) · [Backend Map](#/post/be-map) · [Algorithm Type Map](#/post/algo-map)