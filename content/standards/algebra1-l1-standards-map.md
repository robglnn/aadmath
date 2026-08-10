# Algebra I, Level 1 — standards map

*Standards alignment and mapping note — Algebra I, Level 1: The Language of Balance*

Framework: **Common Core State Standards for Mathematics (CCSS-M)**. Level **algebra1-level1**. 10 skills, 64 item forms, 23 content standards, 7 practice standards.

This document is the claim, and content/graph/algebra1-l1.json is the machine-readable copy of it. tools/validate-items.mjs fails the build if a graph node cites a standard that is not listed here, if a listed standard is claimed by no node, or if a node claims a representation that none of its item forms can actually produce. Alignment here is therefore checkable rather than asserted.

Level 1 runs from 'a letter stands for a number' to 'linear equations with the unknown on both sides, including the cases with no solution and with infinitely many'. That arc deliberately crosses grade bands: the conceptual foundations sit in Grade 6 Expressions and Equations, the procedural fluency in Grade 7, the both-sides work and the solution-set classification in Grade 8, and the justification and modelling demands in the High School Algebra conceptual category. A learner who finishes Level 1 has met the equation-solving content of HSA.REI.B.3 for linear equations in one variable.

Coverage is claimed at three depths. CORE means the standard is the thing being taught and is what the mastery gate tests. SUPPORTING means the standard is exercised inside items whose primary target is another standard. INTRODUCED means a first, deliberately partial encounter that a later level completes.

Representation coverage is treated as part of alignment, not as decoration. 6.EE.C.9 and 8.EE.B.5 explicitly require tables and graphs, so those nodes carry table and graph item forms and the mastery gate for them cannot be passed on symbolic items alone. Likewise 6.EE.A.4 ('identify when two expressions are equivalent') is enforced literally: the item verifier proves a distractor is *not* equivalent to the prompt before it is allowed to appear.

The Standards for Mathematical Practice are mapped as well as the content standards. MP.3 in particular is not left to chance: every skill from order-of-operations onward carries an error-analysis form in which two cadets disagree and the learner must decide which chain of reasoning is sound.

Deliberate exclusions at this level, each of which belongs to a later one: linear inequalities (HSA.REI.B.3, inequality half), literal equations and rearranging formulas (HSA.CED.A.4), systems solved algebraically (HSA.REI.C.6), and functions as objects with domain and range (8.F, HSF.IF). The two-trace graph item touches 8.EE.C.8.A as an INTRODUCED standard only — the crossing point is read, not solved for as a system.

Coverage is checked in both directions and at the level of individual item forms: tools/validate-items.mjs fails the build if any of the 64 item forms is never cited as evidence for a standard, or if a standard cites a form belonging to a skill it does not claim. Every form named here is generated, machine-verified against an independent solver, and rendered in strict KaTeX in all three locales before it can be cited.

## 1. The skills, in prerequisite order

Nothing unlocks before everything above it in this table is mastered. `content/graph/algebra1-l1.json` is the machine-readable source; `tools/validate-items.mjs` fails the build if the two disagree.

| Skill | Requires | Big idea | Standards | Practices | Representations the gate demands |
|---|---|---|---|---|---|
| `var-meaning` | — | A letter is a placeholder for a number that has not been named yet — not a label, not an object, not its own position in the alphabet. | 6.EE.A.2.A<br>6.EE.B.6<br>HSA.SSE.A.1.A | MP.2 MP.6 | symbolic, contextual |
| `eval-expr` | `var-meaning` | Substituting a value for a variable turns an expression into a single number — and the substitution keeps the sign it came with. | 6.EE.A.2.C<br>6.EE.C.9<br>7.EE.B.3 | MP.2 MP.4 MP.6 | symbolic, table, graph |
| `order-ops` | `eval-expr` | Grouping and exponents bind tighter than multiplication, which binds tighter than addition — and a fraction bar is a bracket. | 6.EE.A.1<br>6.EE.A.2.C<br>7.EE.B.3 | MP.3 MP.6 MP.7 | symbolic, verbal |
| `like-terms` | `eval-expr` | Terms combine only when they carry exactly the same variable part; a number and an x-term never merge, and x and x squared are different kinds. | 6.EE.A.3<br>6.EE.A.4<br>7.EE.A.1<br>HSA.SSE.A.1.B | MP.7 MP.8 | symbolic, contextual |
| `distribute` | `like-terms` | Multiplying a sum multiplies every term in it — it is the area of a rectangle split in two, and it runs backwards as factoring. | 6.EE.A.3<br>7.EE.A.1<br>7.EE.A.2<br>HSA.SSE.A.2 | MP.4 MP.7 | symbolic, contextual |
| `one-step-add` | `var-meaning` | An equation is a balance. Undo an addition with a subtraction, on both sides at once, and the balance survives. | 6.EE.B.5<br>6.EE.B.7<br>HSA.REI.B.3 | MP.1 MP.2 MP.4 | symbolic, contextual |
| `one-step-mul` | `one-step-add` | A number written against the unknown is a multiplication, so it comes off by dividing both sides — never by subtracting. | 6.EE.B.7<br>7.EE.B.4.A<br>HSA.REI.B.3 | MP.2 MP.3 MP.6 | symbolic, contextual |
| `two-step` | `one-step-mul`, `order-ops` | Unwrap in reverse order: the loose number comes off first, then the coefficient — the opposite of the order that built the expression. | 7.EE.B.4.A<br>HSA.CED.A.1<br>HSA.REI.B.3<br>8.EE.B.5 | MP.1 MP.4 MP.7 | symbolic, contextual, graph |
| `multi-step` | `two-step`, `distribute` | Simplify each side completely — expand, then collect — before you start undoing anything. | 8.EE.C.7.B<br>HSA.REI.A.1<br>7.EE.B.4.A | MP.1 MP.3 MP.7 MP.8 | symbolic, contextual |
| `both-sides` | `multi-step` | Gather the unknown on one side by removing the same variable term from both. Sometimes it vanishes — and then the statement is either always true or never true. | 8.EE.C.7.A<br>8.EE.C.7.B<br>8.EE.C.8.A<br>HSA.REI.B.3<br>HSA.CED.A.1 | MP.1 MP.2 MP.3 MP.7 | symbolic, contextual, graph |

## 2. Content standards, and what proves each one

**Depth** is a claim about the role the standard plays here. `core` — the standard is the thing being taught, and it is what the mastery gate tests. `supporting` — the standard is exercised inside items whose primary target is another standard. `introduced` — a first, deliberately partial encounter that a later level completes.

**Evidence** names the generated item forms that carry the standard. Every one is re-derived by an independent parser and solver, rendered in strict KaTeX, and produced in EN, ES and PL before it can appear here.

### CORE (15)

#### 6.EE.A.1

> Write and evaluate numerical expressions involving whole-number exponents.

Taught in: `order-ops`

Evidence: `oo-power`, `oo-negbase`

#### 6.EE.A.2.A

> Write expressions that record operations with numbers and with letters standing for numbers.

Taught in: `var-meaning`

Evidence: `vm-choose`, `vm-context`

#### 6.EE.A.2.C

> Evaluate expressions at specific values of their variables. Include expressions that arise from formulas used in real-world problems. Perform arithmetic operations, including those involving whole-number exponents, in the conventional order when there are no parentheses to specify a particular order (Order of Operations).

Taught in: `eval-expr`, `order-ops`

Evidence: `ee-linear`, `ee-two-var`, `ee-context`, `ee-fraction`, `oo-mixed`, `oo-fracbar`, `ee-square`, `oo-nested`, `oo-table`

#### 6.EE.A.3

> Apply the properties of operations to generate equivalent expressions.

Taught in: `like-terms`, `distribute`

Evidence: `lt-collect`, `lt-three`, `ds-expand`, `ds-negative`

#### 6.EE.A.4

> Identify when two expressions are equivalent (i.e., when the two expressions name the same number regardless of which value is substituted into them).

Taught in: `like-terms`

Evidence: `lt-equivalent`, `lt-table`

#### 6.EE.B.6

> Use variables to represent numbers and write expressions when solving a real-world or mathematical problem; understand that a variable can represent an unknown number, or, depending on the purpose at hand, any number in a specified set.

Taught in: `var-meaning`

Evidence: `vm-context`, `vm-position`, `vm-table`

#### 6.EE.B.7

> Solve real-world and mathematical problems by writing and solving equations of the form x + p = q and px = q for cases in which p, q and x are all nonnegative rational numbers.

Taught in: `one-step-add`, `one-step-mul`

Evidence: `oa-symbolic`, `oa-context`, `om-symbolic`, `om-context`, `oa-model`, `om-balance`, `om-table`

#### 7.EE.A.1

> Apply properties of operations as strategies to add, subtract, factor, and expand linear expressions with rational coefficients.

Taught in: `like-terms`, `distribute`

Evidence: `lt-collect`, `lt-square`, `ds-expand`, `ds-twoterm`, `ds-factor`, `lt-four`, `ds-share`

#### 7.EE.B.4.A

> Solve word problems leading to equations of the form px + q = r and p(x + q) = r, where p, q, and r are specific rational numbers. Solve equations of these forms fluently. Compare an algebraic solution to an arithmetic solution, identifying the sequence of the operations used in each approach.

Taught in: `one-step-mul`, `two-step`, `multi-step`

Evidence: `ts-symbolic`, `ts-context`, `ts-fraction`, `ms-bracket`, `ms-context`, `om-fraction`, `ms-table`

#### 8.EE.C.7.A

> Give examples of linear equations in one variable with one solution, infinitely many solutions, or no solutions. Show which of these possibilities is the case by successively transforming the given equation into simpler forms, until an equivalent equation of the form x = a, a = a, or a = b results (where a and b are different numbers).

Taught in: `both-sides`

Evidence: `bs-special`, `bs-collect`

#### 8.EE.C.7.B

> Solve linear equations with rational number coefficients, including equations whose solutions require expanding expressions using the distributive property and collecting like terms.

Taught in: `multi-step`, `both-sides`

Evidence: `ms-bracket`, `ms-collect`, `ms-fracbar`, `bs-symbolic`, `bs-bracket`, `ms-table`

#### HSA.SSE.A.1.A

> Interpret parts of an expression, such as terms, factors, and coefficients.

Taught in: `var-meaning`

Evidence: `vm-groups`, `vm-position`, `vm-compose`

#### HSA.CED.A.1

> Create equations and inequalities in one variable and use them to solve problems.

Taught in: `two-step`, `both-sides`

Evidence: `ts-model`, `bs-context`

#### HSA.REI.A.1

> Explain each step in solving a simple equation as following from the equality of numbers asserted at the previous step, starting from the assumption that the original equation has a solution. Construct a viable argument to justify a solution method.

Taught in: `multi-step`

Evidence: `ms-dispute`, `ms-bracket`

#### HSA.REI.B.3

> Solve linear equations and inequalities in one variable, including equations with coefficients represented by letters.

Taught in: `one-step-add`, `one-step-mul`, `two-step`, `both-sides`

Evidence: `oa-symbolic`, `om-symbolic`, `ts-symbolic`, `bs-symbolic`, `bs-bracket`, `om-dispute`, `bs-dispute`

### SUPPORTING (6)

#### 6.EE.B.5

> Understand solving an equation or inequality as a process of answering a question: which values from a specified set, if any, make the equation or inequality true? Use substitution to determine whether a given number in a specified set makes an equation or inequality true.

Taught in: `one-step-add`

Evidence: `oa-table`, `oa-balance`

#### 6.EE.C.9

> Use variables to represent two quantities in a real-world problem that change in relationship to one another; write an equation to express one quantity, thought of as the dependent variable, in terms of the other quantity, thought of as the independent variable. Analyze the relationship between the dependent and independent variables using graphs and tables, and relate these to the equation.

Taught in: `eval-expr`

Evidence: `ee-graph`, `ee-context`, `ee-table`

#### 7.EE.A.2

> Understand that rewriting an expression in different forms in a problem context can shed light on the problem and how the quantities in it are related.

Taught in: `distribute`

Evidence: `ds-area`, `ds-factor`, `ds-table`

#### 7.EE.B.3

> Solve multi-step real-life and mathematical problems posed with positive and negative rational numbers in any form, using tools strategically.

Taught in: `eval-expr`, `order-ops`

Evidence: `ee-linear`, `oo-negbase`, `oo-fracbar`, `oo-context`, `oo-dispute`

#### HSA.SSE.A.1.B

> Interpret complicated expressions by viewing one or more of their parts as a single entity.

Taught in: `like-terms`

Evidence: `lt-perimeter`, `lt-square`

#### HSA.SSE.A.2

> Use the structure of an expression to identify ways to rewrite it.

Taught in: `distribute`

Evidence: `ds-factor`, `ds-twoterm`

### INTRODUCED (2)

#### 8.EE.B.5

> Graph proportional relationships, interpreting the unit rate as the slope of the graph.

Taught in: `two-step`

Evidence: `ts-graph`

#### 8.EE.C.8.A

> Understand that solutions to a system of two linear equations in two variables correspond to points of intersection of their graphs, because points of intersection satisfy both equations simultaneously.

Taught in: `both-sides`

Evidence: `bs-graph`

## 3. Standards for Mathematical Practice

| Practice | Statement | Where it lives | How it is actually asked for |
|---|---|---|---|
| **MP.1** | Make sense of problems and persevere in solving them. | `one-step-add`, `two-step`, `multi-step`, `both-sides` | Prerequisite gating means a learner never meets a problem they were not equipped for, so persistence is asked for where it can succeed. |
| **MP.2** | Reason abstractly and quantitatively. | `var-meaning`, `eval-expr`, `one-step-add`, `one-step-mul`, `both-sides` | Contextual forms move between a situation and its symbols in both directions. |
| **MP.3** | Construct viable arguments and critique the reasoning of others. | `order-ops`, `one-step-mul`, `multi-step`, `both-sides` | Error-analysis items present two cadets' contradictory chains and ask which is sound; each wrong option is a real, named misconception rather than a random number. |
| **MP.4** | Model with mathematics. | `eval-expr`, `distribute`, `one-step-add`, `two-step` | The modelling form asks for the equation that records a situation, before any solving happens. |
| **MP.6** | Attend to precision. | `var-meaning`, `eval-expr`, `order-ops`, `one-step-mul` | Answers are exact rationals; the game never accepts a rounded value, and negative signs are generated deliberately from difficulty band 3. |
| **MP.7** | Look for and make use of structure. | `like-terms`, `distribute`, `two-step`, `multi-step`, `both-sides` | Factoring items ask the learner to see a sum as a product; the area model shows the distributive property as a split rectangle. |
| **MP.8** | Look for and express regularity in repeated reasoning. | `like-terms`, `multi-step` | Table forms make a rule visible across rows before it is written symbolically. |

## 4. Every item form, and the standard it answers to

An item form that no standard claims is content nobody has justified shipping, so the gate rejects it. This table is the full inventory.

| Skill | Form | Representation | Bands | Standards it is evidence for |
|---|---|---|---|---|
| `var-meaning` | `vm-groups` | symbolic | 1–5 | HSA.SSE.A.1.A |
| `var-meaning` | `vm-context` | contextual | 1–5 | 6.EE.A.2.A, 6.EE.B.6 |
| `var-meaning` | `vm-choose` | verbal | 1–3 | 6.EE.A.2.A |
| `var-meaning` | `vm-table` | table | 1–5 | 6.EE.B.6 |
| `var-meaning` | `vm-position` | verbal | 2–5 | 6.EE.B.6, HSA.SSE.A.1.A |
| `var-meaning` | `vm-compose` | contextual | 4–5 | HSA.SSE.A.1.A |
| `eval-expr` | `ee-linear` | symbolic | 1–5 | 6.EE.A.2.C, 7.EE.B.3 |
| `eval-expr` | `ee-two-var` | symbolic | 3–5 | 6.EE.A.2.C |
| `eval-expr` | `ee-context` | contextual | 1–5 | 6.EE.A.2.C, 6.EE.C.9 |
| `eval-expr` | `ee-graph` | graph | 2–5 | 6.EE.C.9 |
| `eval-expr` | `ee-fraction` | symbolic | 3–5 | 6.EE.A.2.C |
| `eval-expr` | `ee-table` | table | 1–5 | 6.EE.C.9 |
| `eval-expr` | `ee-square` | symbolic | 4–5 | 6.EE.A.2.C |
| `order-ops` | `oo-context` | contextual | 1–5 | 7.EE.B.3 |
| `order-ops` | `oo-mixed` | symbolic | 1–3 | 6.EE.A.2.C |
| `order-ops` | `oo-power` | symbolic | 2–5 | 6.EE.A.1 |
| `order-ops` | `oo-negbase` | symbolic | 3–5 | 6.EE.A.1, 7.EE.B.3 |
| `order-ops` | `oo-fracbar` | symbolic | 3–5 | 6.EE.A.2.C, 7.EE.B.3 |
| `order-ops` | `oo-dispute` | verbal | 2–5 | 7.EE.B.3 |
| `order-ops` | `oo-nested` | symbolic | 4–5 | 6.EE.A.2.C |
| `order-ops` | `oo-table` | table | 2–5 | 6.EE.A.2.C |
| `like-terms` | `lt-collect` | symbolic | 1–5 | 6.EE.A.3, 7.EE.A.1 |
| `like-terms` | `lt-three` | symbolic | 3–5 | 6.EE.A.3 |
| `like-terms` | `lt-perimeter` | contextual | 2–5 | HSA.SSE.A.1.B |
| `like-terms` | `lt-equivalent` | verbal | 2–3 | 6.EE.A.4 |
| `like-terms` | `lt-square` | symbolic | 4–5 | 7.EE.A.1, HSA.SSE.A.1.B |
| `like-terms` | `lt-four` | symbolic | 5–5 | 7.EE.A.1 |
| `like-terms` | `lt-table` | table | 2–5 | 6.EE.A.4 |
| `distribute` | `ds-expand` | symbolic | 1–5 | 6.EE.A.3, 7.EE.A.1 |
| `distribute` | `ds-negative` | symbolic | 3–5 | 6.EE.A.3 |
| `distribute` | `ds-area` | contextual | 1–5 | 7.EE.A.2 |
| `distribute` | `ds-twoterm` | symbolic | 4–5 | 7.EE.A.1, HSA.SSE.A.2 |
| `distribute` | `ds-factor` | verbal | 3–5 | 7.EE.A.1, 7.EE.A.2, HSA.SSE.A.2 |
| `distribute` | `ds-share` | symbolic | 4–5 | 7.EE.A.1 |
| `distribute` | `ds-table` | table | 2–5 | 7.EE.A.2 |
| `one-step-add` | `oa-symbolic` | symbolic | 1–5 | 6.EE.B.7, HSA.REI.B.3 |
| `one-step-add` | `oa-context` | contextual | 1–5 | 6.EE.B.7 |
| `one-step-add` | `oa-balance` | graph | 1–3 | 6.EE.B.5 |
| `one-step-add` | `oa-table` | table | 2–5 | 6.EE.B.5 |
| `one-step-add` | `oa-model` | verbal | 3–5 | 6.EE.B.7 |
| `one-step-mul` | `om-symbolic` | symbolic | 1–5 | 6.EE.B.7, HSA.REI.B.3 |
| `one-step-mul` | `om-fraction` | symbolic | 3–5 | 7.EE.B.4.A |
| `one-step-mul` | `om-context` | contextual | 1–5 | 6.EE.B.7 |
| `one-step-mul` | `om-balance` | graph | 1–3 | 6.EE.B.7 |
| `one-step-mul` | `om-dispute` | verbal | 2–5 | HSA.REI.B.3 |
| `one-step-mul` | `om-table` | table | 3–5 | 6.EE.B.7 |
| `two-step` | `ts-symbolic` | symbolic | 1–5 | 7.EE.B.4.A, HSA.REI.B.3 |
| `two-step` | `ts-context` | contextual | 1–5 | 7.EE.B.4.A |
| `two-step` | `ts-graph` | graph | 2–5 | 8.EE.B.5 |
| `two-step` | `ts-model` | verbal | 3–5 | HSA.CED.A.1 |
| `two-step` | `ts-fraction` | symbolic | 4–5 | 7.EE.B.4.A |
| `multi-step` | `ms-bracket` | symbolic | 1–5 | 7.EE.B.4.A, 8.EE.C.7.B, HSA.REI.A.1 |
| `multi-step` | `ms-collect` | symbolic | 2–5 | 8.EE.C.7.B |
| `multi-step` | `ms-context` | contextual | 2–5 | 7.EE.B.4.A |
| `multi-step` | `ms-fracbar` | symbolic | 4–5 | 8.EE.C.7.B |
| `multi-step` | `ms-dispute` | verbal | 3–5 | HSA.REI.A.1 |
| `multi-step` | `ms-table` | table | 3–5 | 7.EE.B.4.A, 8.EE.C.7.B |
| `both-sides` | `bs-symbolic` | symbolic | 1–5 | 8.EE.C.7.B, HSA.REI.B.3 |
| `both-sides` | `bs-special` | symbolic | 2–5 | 8.EE.C.7.A |
| `both-sides` | `bs-collect` | symbolic | 3–5 | 8.EE.C.7.A |
| `both-sides` | `bs-context` | contextual | 2–5 | HSA.CED.A.1 |
| `both-sides` | `bs-graph` | graph | 3–5 | 8.EE.C.8.A |
| `both-sides` | `bs-bracket` | symbolic | 4–5 | 8.EE.C.7.B, HSA.REI.B.3 |
| `both-sides` | `bs-dispute` | verbal | 3–5 | HSA.REI.B.3 |

## 5. Misconceptions the bank can recognise

A misconception is only ever named to a learner when the value they entered is one this item is able to produce from that misconception. Anything else is answered without a diagnosis. These are the ones the graph declares and the generators can actually produce.

| Skill | Misconception | What the learner is doing |
|---|---|---|
| `var-meaning` | `letter-as-object` | Reads 4m as a labelled quantity — '4 metres', four of a thing called m — so the letter carries no value of its own and the answer given is simply the 4. |
| `var-meaning` | `add-not-multiply` | Turns 'k groups of v' into k + v: the two quantities are joined by the operation that is easiest to say rather than the one the situation describes. |
| `var-meaning` | `subtract-not-multiply` | Joins the two quantities by subtraction, often in whichever order they appeared in the sentence. |
| `var-meaning` | `divide-not-multiply` | Shares the group size out among the groups instead of counting the groups up, so multiplication is replaced by division. |
| `var-meaning` | `neg-substitution` | Substitutes a negative value but keeps the answer positive, as if the minus were decoration. |
| `var-meaning` | `letter-as-position` | Assumes the letter's position in the alphabet is its value (a = 1, b = 2). |
| `var-meaning` | `implicit-mult-missed` | Reads 3x with x = 4 as the digits 34 rather than the product 12. |
| `var-meaning` | `arith-slip` | Right reading of the letter, wrong arithmetic afterwards. |
| `var-meaning` | `partial-rule` | Answers with one of the given numbers instead of the value of the expression. |
| `var-meaning` | `off-by-one-row` | Answers with the neighbouring row of the log rather than the burned one. |
| `var-meaning` | `sign-slip` | Loses a minus sign on the way through. |
| `eval-expr` | `implicit-mult-missed` | Adds instead of multiplying when a coefficient sits against the letter. |
| `eval-expr` | `neg-substitution` | Drops the sign when substituting a negative value. |
| `eval-expr` | `div-direction` | Divides the wrong way round when the variable sits over a fraction bar. |
| `eval-expr` | `axis-swap` | Reads the input axis when the question asked for the output, or the reverse. |
| `eval-expr` | `combine-unlike` | Merges two different variables into one before substituting. |
| `eval-expr` | `strict-left-right` | Evaluates strictly left to right, ignoring precedence. |
| `eval-expr` | `exponent-as-mult` | Reads a squared term as a doubling: treats x^2 as 2x when substituting. |
| `eval-expr` | `neg-base-power` | Squares a negative substituted value and keeps the minus sign. |
| `eval-expr` | `partial-rule` | Substitutes and multiplies but never adds the constant on. |
| `order-ops` | `strict-left-right` | Evaluates strictly left to right, ignoring precedence. |
| `order-ops` | `exponent-as-mult` | Reads 3^2 as 3 times 2. |
| `order-ops` | `neg-base-power` | Treats -3^2 as (-3)^2, or the reverse. |
| `order-ops` | `subtract-coefficient` | Subtracts a divisor instead of dividing by it. |
| `order-ops` | `sign-slip` | Loses the sign of the leading term. |
| `order-ops` | `partial-rule` | Evaluates part of the expression and reports that as the whole. |
| `order-ops` | `arith-slip` | Correct precedence, wrong arithmetic. |
| `like-terms` | `combine-unlike` | Adds 3x + 2 to get 5x. |
| `like-terms` | `coefficient-sign-lost` | Ignores the sign attached to a term when collecting. |
| `like-terms` | `x-and-x-squared` | Combines x and x squared as if they were like terms. |
| `like-terms` | `partial-distribute` | Doubles only part of an expression when finding a perimeter. |
| `like-terms` | `partial-rule` | Collects the variable terms and forgets the constants, or the reverse. |
| `like-terms` | `arith-slip` | Multiplies the coefficients instead of adding them, or slips a digit. |
| `distribute` | `partial-distribute` | Multiplies only the first term inside the parentheses. |
| `distribute` | `neg-distribute` | Fails to carry a negative factor across both terms. |
| `distribute` | `combine-unlike` | Multiplies the two inside terms together instead of distributing over them. |
| `distribute` | `coefficient-sign-lost` | Keeps the sign of a term when the factor outside should have flipped it. |
| `distribute` | `div-direction` | Inverts a division when a fraction bar is shared out over a sum. |
| `distribute` | `partial-rule` | Opens the bracket on the first term and stops. |
| `one-step-add` | `same-op-both` | Repeats the operation shown instead of applying its inverse. |
| `one-step-add` | `one-side-only` | Operates on one side of the equation only, or reports the constant as the answer. |
| `one-step-add` | `sign-slip` | Solves correctly but reports the value with the wrong sign. |
| `one-step-add` | `swapped-roles` | Builds the model with the numbers in each other’s places: what was removed and what remains change ends. |
| `one-step-add` | `off-by-one-row` | Answers with the neighbouring row of the log rather than the burned one. |
| `one-step-add` | `arith-slip` | Right move, wrong arithmetic on the undo step. |
| `one-step-mul` | `subtract-coefficient` | Subtracts the coefficient instead of dividing by it. |
| `one-step-mul` | `div-direction` | Divides the coefficient by the constant rather than the other way round. |
| `one-step-mul` | `one-side-only` | Divides one side only, or reports the total unchanged. |
| `one-step-mul` | `sign-slip` | Loses the sign when the coefficient or the constant is negative. |
| `one-step-mul` | `off-by-one-row` | Answers with the neighbouring row of the log rather than the burned one. |
| `one-step-mul` | `arith-slip` | Right move, wrong arithmetic on the division. |
| `two-step` | `wrong-unwrap-order` | Divides before removing the constant term. |
| `two-step` | `sign-on-constant` | Adds the constant to both sides when it should have been subtracted. |
| `two-step` | `subtract-coefficient` | Subtracts the coefficient at the last step instead of dividing. |
| `two-step` | `div-direction` | Divides the wrong way round on the final step. |
| `two-step` | `axis-swap` | Reports the height of the trace when the question asked for the position along it. |
| `two-step` | `swapped-roles` | Builds the model with the rate and the fixed fee swapped. |
| `two-step` | `arith-slip` | Right method, wrong arithmetic. |
| `two-step` | `sign-slip` | Solves correctly but reports the value with the wrong sign. |
| `two-step` | `collect-wrong-side` | Moves a term across the equals sign without flipping its sign. |
| `multi-step` | `distribute-then-forget` | Distributes but does not collect the resulting like terms. |
| `multi-step` | `partial-distribute` | Multiplies only the first term inside the bracket. |
| `multi-step` | `sign-on-constant` | Moves the constant across with the wrong sign. |
| `multi-step` | `wrong-unwrap-order` | Divides before removing the constant term. |
| `multi-step` | `coefficient-sign-lost` | Loses a sign while collecting like terms on one side. |
| `multi-step` | `arith-slip` | Right chain of moves, wrong arithmetic somewhere along it. |
| `both-sides` | `collect-wrong-side` | Moves the variable term across without changing its sign. |
| `both-sides` | `no-solution-confusion` | Reads 0 = 5 as x = 5, or reads an identity as having no solution. |
| `both-sides` | `partial-distribute` | Expands only part of a bracket before gathering. |
| `both-sides` | `wrong-unwrap-order` | Divides before removing the constant term. |
| `both-sides` | `axis-swap` | Reports the height at which two traces cross rather than the position. |
| `both-sides` | `sign-slip` | Solves correctly but reports the value with the wrong sign. |
| `both-sides` | `coefficient-sign-lost` | Collects the unknown onto one side and drops the sign of its coefficient. |
| *(any)* | `arith-slip` | Right method, wrong arithmetic — a slip rather than a misconception. |
| *(any)* | `sign-slip` | Loses or invents a minus sign somewhere in the chain. |
| *(any)* | `partial-rule` | Applies part of the rule and stops before finishing it. |
| *(any)* | `off-by-one-row` | Reads the neighbouring row of a table instead of the one asked for. |

## 6. What Level 1 deliberately does not cover

Each of these belongs to a later level, and none of them is silently half-taught here.

- Linear **inequalities** — the inequality half of HSA.REI.B.3.
- **Literal equations** and rearranging formulas — HSA.CED.A.4.
- **Systems** solved algebraically — HSA.REI.C.6. The two-trace graph item reads a crossing point; it does not solve a system, which is why 8.EE.C.8.A is claimed only at INTRODUCED depth.
- **Functions** as objects with domain and range — 8.F and HSF.IF.

## 7. How to check any of this

```bash
node tools/validate-items.mjs   # alignment, both directions, plus every item re-derived
node tools/simulate.mjs         # does the sequence actually get learners there
```

`validate-items.mjs` fails the build if a skill cites a standard this document does not list, if a listed standard is claimed by no skill, if an item form is evidence for nothing, if a standard cites a form belonging to a skill it does not claim, or if this document falls out of step with the JSON it was written from.
