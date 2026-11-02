Usability refers to how easy a screen is to use, and Nielsen's 10 Heuristics represent the most common checklist for evaluating it.

## What is Usability?

Nielsen Norman Group defines usability as "a quality attribute that assesses how easy a user interface is to use." It is evaluated separately from whether something looks pretty or has many features. Having features doesn't matter if users can't find them; the text even states, "If you can't find a product, you can't buy it."

When broken down, usability consists of five elements:

| Element | Question Asked |
|---|---|
| Learnability | Can a first-time user perform basic tasks immediately? |
| Efficiency | How quickly can they perform tasks once familiar? |
| Memorability | Can someone who returns after a long time use it easily again? |
| Errors | How frequent, severe are mistakes, and how easily can they be recovered from them? |
| Satisfaction | Is using the system pleasant? |

From a frontend developer's perspective, this boils down to the question: "Can my created interface withstand being used by strangers?" There is significant overlap with [Accessibility → Web Accessibility](#/post/fe-accessibility), but accessibility focuses on whether everyone can use it, whereas usability focuses on whether it is easy to use.

## Nielsen's 10 Heuristics

This list was created by Jakob Nielsen in 1990 with Rolf Molich and refined for publication in 1994. The term "heuristic" is closer to "rule of thumb" than a strict law; it serves as a checklist rather than a rigid rule. Names are listed based on the official English titles.

| # | Principle | One-Liner Meaning |
|---|---|---|
| 1 | Visibility of system status | Immediately inform users what is happening |
| 2 | Match between system and the real world | Use language and conventions familiar to users |
| 3 | User control and freedom | Provide easy undo, redo, and exit options for mistakes |
| 4 | Consistency and standards | Use consistent shapes and words; follow platform conventions |
| 5 | Error prevention | Prevent errors through constraints, defaults, and confirmations before they occur |
| 6 | Recognition rather than recall | Minimize memory load by making information visible rather than requiring memorization |
| 7 | Flexibility and efficiency of use | Cater to both novices (avoid confusion) and experts (provide shortcuts) |
| 8 | Aesthetic and minimalist design | Remove unnecessary information so important elements stand out |
| 9 | Help users recognize, diagnose, and recover from errors | Explain errors in plain language along with solutions |
| 10 | Help and documentation | Provide easy-to-find, task-oriented help |

## Things Frontend Developers Can Grasp Easily

Understanding improves by focusing on a few principles frequently encountered in code rather than memorizing all ten.

Feedback (Principle #1) manifests as loading indicators. If a button is pressed with no response, users may press it again, resulting in duplicate requests.

```html
<button type="submit" disabled aria-busy="true">저장 중…</button>
```

This single line displays the status (#1) and prevents duplicate submissions (#5). The code below is just a structural example, not executable code.

Consistency (Principle #4) is why design systems exist. If a save button appears blue on the right in one screen but gray on the left in another, users must relearn the interface for each screen. Reusing components is the way to maintain consistency at the code level. This continues in [Component Design](#/post/fe-component).

Error prevention (Principle #5) and error recovery (Principle #9) are most evident in forms. Using a date picker for date input prevents format errors from occurring in the first place. However, if an error does occur, stating "An error occurred" is worse than "Password must be at least 8 characters." The message should indicate what went wrong and how to fix it.

User control (Principle #3) includes features like an "Undo" toast after deletion or warnings when leaving a field during input. It is commonly said that providing the ability to undo is less annoying than popping up confirmation dialogs every time.

Recognition rather than recall (Principle #6) refers to autocomplete, recent search terms, and example text next to fields. If hints are placed only inside an input field, they disappear as soon as typing begins, forcing reliance on memory; hence the advice to use separate labels.

The ten principles can be broadly grouped into four categories: things users know (Principles #2, #6), achieving goals accurately (#5, #9), learning easily (#4, #10), and accommodating user needs (#3, #7). This grouping was derived from an attempt to understand the concepts and is not an official mapping.

## How to Evaluate

Heuristic evaluation is a method where experts review an interface using the checklist without conducting user testing. According to Nielsen Norman Group articles, 3–5 people should evaluate the same screen independently. This is because one person may miss certain issues. The process involves preparation, individual evaluation, and then consolidating findings. Each evaluator should spend about 1–2 hours; they first familiarize themselves with the product and then mark violations of the principles. Results should not be shared until the end.

<details>
<summary>Example: Reviewing a login form using all 10 heuristics</summary>

- 1: Is there a loading indicator after submission?
- 2: Does it use terms like "Login" instead of "Authenticate"?
- 3: Does input persist when navigating back during sign-up?
- 4: Are the positions and colors of other forms and buttons consistent?
- 5: Did you set `type="email"` on the email field to reduce format errors?
- 6: Is the password rule shown before input?
- 7: Does pressing Enter submit, and does browser autocomplete work?
- 8: Are unnecessary links or banners mixed in?
- 9: Do error messages explain the reason and solution?
- 10: Is there a path to the "Forgot Password" feature visible?

This checklist was created as an example while writing this article and is not a result of evaluating an actual service.
</details>

## Common Misconceptions

It's easy to think that good usability means simple design. While item 8 refers to minimalism, removing necessary information violates item 6 (cognition over memory). Since items can conflict with each other, this should be viewed as a list requiring balance based on context rather than a scoring system.

Another misconception is that heuristic evaluation replaces user testing. This method helps find candidate issues cheaply, but it doesn't show where actual users get stuck separately. Nielsen Norman Group articles also state that after evaluation, one should discuss which problems to test with users.

## Reference Links

- Nielsen Norman Group, 10 Usability Heuristics for User Interface Design: https://www.nngroup.com/articles/ten-usability-heuristics/
- Nielsen Norman Group, Usability 101: Introduction to Usability: https://www.nngroup.com/articles/usability-101-introduction-to-usability/
- Nielsen Norman Group, How to Conduct a Heuristic Evaluation: https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/

← [Concept Map](#/post/fe-map)

Related articles: [Web Accessibility](#/post/fe-accessibility) · [Component Design](#/post/fe-component) · [Frontend Performance](#/post/fe-performance)