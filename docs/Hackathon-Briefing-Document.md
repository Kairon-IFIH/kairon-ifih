**Young Builders’ Program** 

**Official Hackathon Brief**

*22-Hour Build  •  Round 1 & Round 2 Jury  •  Top 15 → Startup Ideation Program*

| READ THIS FIRST *You are not building a hackathon demo. You are building the first prototype of a company you may actually register next month.* Every technical choice you make in the next 22 hours should be defensible to a customer, not just to a judge. We are evaluating your architecture and your judgment: do you understand who pays for this, why it's legal (or has a credible path to legal) in India / GIFT City, and what you'd need to be true in the real world for this to work. A perfect demo built on a fantasy business is a worse outcome than a rough demo with a sharp, honest business case. |
| :---- |

# 

# **What's In This Brief**

* 1\. The Opening Context — why this hackathon exists

* 2\. Choosing Your Track — Agentic AI, Quantum Tech, or Hybrid

* 3\. Track 1: Agentic AI in Financial Services

* 4\. Track 2: Quantum Tech in Financial Services

* 5\. Five Rules to Keep You Sharp

* 6\. Prototype Requirements & Submission Format

* 7\. Synthetic Data — How to Generate It

* 8\. Your 1-Pager — Required Template

* 9\. Event Timeline — 22 Hours, R1 & R2 Same Day

* 10\. Scoring Framework — R1 and R2

* 11\. Judges' Q\&A — Questions You Should Expect

# 

# **1\. The Opening Context**

45 teams. 22 hours. 2 frontiers of financial technology. One goal: prove you can build something India's fintech ecosystem — and GIFT City specifically — actually needs.

This is not a coding competition with a trophy at the end. The teams that make it through Round 2 will move into our Startup Ideation Program, where you'll register a real company and receive a stipend to build it further. That means the judges in this room are not just asking "does this work?" They are asking "would I back this founder?"

**What that changes about how you should spend the next 22 hours**

* Every hour you spend polishing a feature no real customer asked for is an hour you didn't spend understanding your customer.

* A working prototype with a weak business case scores lower than a rougher prototype with a sharp, honest one.

* You will be asked, out loud, in front of a jury: who pays for this, and why would they pay for it from you?

* "It's a hackathon, we'll figure the business out later" is not an acceptable answer in this room.

Build like a founder. Not like a contestant.

# **2\. Choosing Your Track**

You are not restricted to the track you originally applied under. At kickoff, every team chooses one of three paths:

* **Track 1 — Agentic AI in Financial Services**

* **Track 2 — Quantum Tech in Financial Services**

* **Hybrid — a solution that genuinely combines both (e.g., a quantum-optimized decision layer feeding an agentic execution workflow)**

**Rules for track selection**

* Declare your track by the end of Hour 2\. It is locked after that — this determines your mock data setup, mentor assignment, and jury panel for Round 1\.

* If you declare Hybrid, you must meet the mandatory technical requirements of BOTH tracks — at least 2 interacting agents with a guardrail, AND a quantum-classical benchmark. "Hybrid" is not a shortcut around doing either track properly.

* Within your track, pick one/multiple focus areas to your assigned coaches for sign-off before Hour 2 ends.

**A note on the two tracks — read before you choose**

Track 1 (Agentic AI) is judged with a stronger weighting toward near-term commercial viability — we expect a credible path to a paying customer within a realistic startup timeline.

Track 2 (Quantum Tech) is judged with a stronger weighting toward technical rigor and long-term IP potential. Quantum computing does not yet offer a proven commercial advantage over classical methods for most financial use cases at production scale — we know that, and so should you. Your job in Track 2 is not to pretend you have a Year-1 go-to-market plan. It's to demonstrate genuine technical depth and a credible, honest view of when and how a quantum approach could matter. Judges will not penalize Track 2 teams for a longer runway to revenue — but they will penalize Track 1-style hand-waving dressed up as "quantum advantage."

# 

# **3\. Track 1: Agentic AI in Financial Services**	

**Objective**

Build an autonomous, multi-agent system with human-in-the-loop (HITL) safety controls that solves a high-friction Indian or GIFT City (cross-border) financial operations bottleneck.

**Sample Focus Areas — pick one, or propose another relevant bottleneck**

**Cross-Border Trade Finance & LCs (GIFT City):** Agents that process synthetic trade documents (Bills of Lading, SWIFT MT700, invoices), cross-check against IFSCA/RBI regulatory guidelines, flag compliance anomalies, and present structured approvals to a human officer.

**Autonomous Corporate Treasury & FX Hedging:** Agents that monitor multi-currency balances across simulated offshore accounts, predict currency exposure, and execute hedged transfers within strict risk-limit guardrails.

**India Stack & Account Aggregator (AA) Underwriting:** Multi-agent workflows that ingest simulated Account Aggregator JSONs and GSTN filings, perform automated credit risk scoring, and generate explainable underwriting reports.

**Suggested Technical Requirements**

* Architecture: at least 2 interacting agents (e.g., Execution Agent \+ Audit/Verification Agent).

* Guardrails: demonstrate either Self-Correction (Agent A catches and fixes Agent B's mistake) OR a Human-in-the-Loop (HITL) circuit where high-risk decisions pause for UI human sign-off.

* Data: generate or simulate your own sample inputs/datasets using your AI/cloud credits — see Section 7\.

* Disclose what's synthetic/mocked in your build versus what would need to be real in production.

**Additional Recommendations**

* Name a specific buyer persona (e.g., "Head of Trade Finance Ops at a GIFT City IBU," not "banks").

* State the pathway your idea needs — sandbox route, partnership with a regulated entity, license category, or explicit positioning as a B2B tool for regulated players.

# **4\. Track 2: Quantum Tech in Financial Services**

**Objective**

Develop a hybrid quantum-classical pipeline using open-source quantum SDKs (e.g., Qiskit, PennyLane) on simulators to address a computationally complex financial math problem, benchmarking performance against a classical baseline.

**Sample Focus Areas — pick one, or propose a closely related bottleneck**

**Cross-Border Portfolio & Liquidity Optimization:** Model multi-asset, multi-currency portfolio optimization under capital and regulatory constraints using algorithms like QAOA or VQE.

**High-Volume Fraud Detection (UPI / SWIFT):** Implement a Quantum Machine Learning model (e.g., QSVM or Quantum Neural Network) to classify anomalous/fraudulent transaction patterns on synthetic imbalanced datasets.

**Risk Analysis & Derivatives Pricing:** Accelerate Value-at-Risk (VaR) or options calculations using Quantum Amplitude Estimation (QAE).

**Suggested Technical Requirements**

* Execution: run on a Quantum Simulator using standard open-source libraries.

* Benchmarking: include a direct Classical vs. Quantum Comparison Chart (execution time, accuracy, or convergence rate).

* Data: generate synthetic financial time-series or transactional datasets — see Section 7\.

**Additional Recommendations**

* State honestly where the current quantum advantage (if any) actually shows up in your results — and where it doesn't yet.

* Describe the realistic horizon for this to matter commercially, and what would need to be true (hardware, cost, regulation) for it to happen.

* Name who would fund or sponsor this work today — e.g., an innovation lab, a regulator sandbox grant, a quant desk — even if it isn't a paying customer yet.

# 

# **5\. Five Rules to Keep You Sharp**

**1\. Synthetic data is expected and encouraged**

Do not spend hours hunting for real-world private banking data. Use your credits and libraries (Faker, pandas, or LLMs) to generate realistic synthetic JSONs, CSVs, or PDFs in the first two hours.

**2\. Mock the external APIs**

If an agent needs to connect to an external RBI, SWIFT, or Account Aggregator API, write a mock API endpoint or local stub. Judges care about the agent logic and workflow, not whether you had a live production API key from a real bank.

**3\. UI can be simple**

A Streamlit, Gradio, Next.js, or CLI dashboard is more than enough. Evaluation heavily favors technical architecture, working execution, and venture potential over UI polish.

**4\. No external contribution**

Ideation, research, and building on existing open-source or personal repositories is allowed. However, all new code written during the event must be authored exclusively by registered team members. We may spot-check Git commit histories for teams that advance to Round 2\.

**5\. You own your IP**

The organizers take no equity or IP claim from your participation in this hackathon or your use of the provided AI/cloud credits. Whatever you build, and whatever company you register from it afterward, is yours.

# **6\. Prototype Requirements & Submission Format**

**Submission Process:**

* The **one pager template and google form** will be shared with all participating teams via the WhatsApp group a few hours prior to the deadline. Submissions must be completed by 12 PM on Saturday.

  **What your submission should include**

* A working demo/build shown via a live link (if hosted, e.g. on AWS) or a recorded demo (max 3 minutes) — not just a UI walkthrough, but the actual agent/quantum logic firing on your synthetic data.

* A public code repository (or zipped submission if private) with a README covering: setup instructions, architecture overview, and what's mocked vs. real.

* Your completed 1-Pager (Section 8\) — this is your business case, and it is scored as heavily as your build.

*Submissions close at Hour 22\. No changes accepted after the deadline, including for teams later selected into the top 20 — the 1-hour R1→R2 window (Section 9\) is for refining your pitch, not resubmitting your build.*

#    **7\. Synthetic Data — How to Generate It**

You will not have access to real customer, banking, or transactional data — and you shouldn't try to source any. Building credible synthetic data is itself part of what we're evaluating: can you reason about what real inputs would look like?

**Recommended approach**

* Spend the first 1–2 hours on this, not more. It should not eat your build time.

* Use Faker (Python/JS) for realistic names, company entities, addresses, and transaction IDs.

* Use pandas or a spreadsheet to generate structured time-series or transactional datasets (balances, FX rates, claims, trade volumes) with realistic distributions — include some noise and edge cases, not just clean data.

* Use your LLM credits to draft realistic unstructured documents — Bills of Lading, SWIFT MT700 messages, invoices, GSTN filings, Account Aggregator JSON payloads — based on publicly available format specifications.

* For fraud/anomaly tracks: deliberately inject a small percentage of anomalous or fraudulent records into an otherwise realistic dataset, and document the injection logic — this is what makes your benchmark credible.

**What to avoid**

* Do not attempt to scrape, source, or use any real customer, account, or transaction data from any institution.

* Do not present synthetic data as real in your 1-Pager or demo — disclosure is mandatory and scored (Section 6, Section 10).

* Do not spend more than 2 hours on this — a mediocre dataset ready by Hour 2 beats a perfect one ready by Hour 8\.

# **8\. Your 1-Pager — Required Template**

Every team submits exactly one page pdf, using the section structure below. This is standardized on purpose — it puts every team's business thinking side-by-side for judges, and it stops the round from turning into a slide-design contest.

**Required sections, in this order**

| Section | What goes here |
| :---- | :---- |
| 1\. Team & Track | • Team name, members, track (Track 1 / Track 2 / Hybrid), focus area chosen |
| 2\. The Problem | • The specific bottleneck, in 2–3 sentences. Who feels this pain today, and how (time, cost, risk)? |
| 3\. What You Built | • 1–2 sentences on the prototype. What does it actually do, end to end? |
| 4\. Architecture Snapshot | • A simple diagram or 3–4 bullets: agents/components and how they interact, OR your quantum-classical pipeline and benchmark method |
| 5\. Who Pays, and Why Now | • Named buyer persona. Why is this buildable/sellable now — AA framework maturity, IFSCA sandbox posture, agentic AI cost curves, etc. — not "fintech is growing" |
| 6\. Regulatory Pathway | • Sandbox route, partnership with a regulated entity, license category, or explicit B2B-tool-for-regulated-players positioning |
| 7\. What's Fake vs. What's Real | • Explicit disclosure: what's synthetic/mocked in this build, and what would need to be true in production |
| 8\. What's Next | • If you had to start this company Monday, what would you build first — and is it what you built tonight? |

**Format rules**

* Maximum 1 page. Landscape or portrait, your choice.

* Use the provided template file (distributed separately) — do not redesign the layout or reorder sections.

* Diagrams/charts may be embedded images within the section they belong to; keep them legible at a glance.

* No appendix, no second page. If it doesn't fit, it's not focused enough yet.

# **9\. Event Timeline — 22 Hours, R1 & R2 Same Day**

**Build phase**

| Time | Block |
| :---- | :---- |
| Hour 0–2 | Kickoff, track selection lock-in, rubric walkthrough |
| Hour 1–3 | Problem framing \+ synthetic data / mock API generation (mandatory checkpoint — no core build past this without a data plan) |
| Hour 3–14 | Core build |
| Hour 14–16 | Mentor office hours / architecture review — catch teams building something technically impressive but unpitchable while there's still time to redirect |
| Hour 16–19 | Build continues in parallel with 1-Pager drafting |
| Hour 19–21 | Freeze code, finalize 1-Pager, rehearse demo |
| Hour 22 | Submission deadline \+ tech check |

**Round 1 — all 50 teams, parallel panels**

* Teams split into 5 jury panels of \~10 teams each, running simultaneously.

* 3 min presentation \+ 7 min Q\&A per team

* Every panel uses the identical rubric (Section 10\) and identical mandatory Q\&A prompts (Section 11\) so scores are comparable across panels when all 50 are ranked together.

* Judges submit a short written scorecard per team — numeric scores plus 2–3 lines of specific feedback. This feedback is what fuels the top 20's prep hour, so it is not optional even under time pressure.

**Top 20 announced → 1-hour prep window**

This hour is for responding to judge feedback, not for building. Structure it exactly like this:

* First 15 min: Read your R1 scorecard. Identify the single biggest gap flagged by judges — usually either a shaky technical claim or a thin business case.

* Next 30 min: Fix that one thing. Tighten the demo flow, rewrite one section of your 1-Pager, prep a sharper answer to the question that stumped you in R1. This is not a rebuild.

* Last 15 min: Rehearse your R2 pitch, specifically the founder Q\&A you now know is coming.

**Round 2 — top 20, full jury, single room**

* GIFT \+ IFIH \+ IFSCA Jury. \~5 min per team: 1 min pitch \+ 4 min hard Q\&A.

* Founder assessment carries the heaviest weight of the day here (see Section 10\) — this is where "good hackathon team" and "future founder" get separated.

* Top 15 from Round 2 move into the Startup Ideation Program.

# 

# **10\. Scoring Framework**

**Round 1&2 parameters and weightage**

| Criteria | Weight |
| :---- | :---- |
| Technical execution (mandatory requirements met, working live) | 25% |
| Problem clarity and depth | 15% |
| Solution Innovation & Differentiation | 20% |
| Market Viability | 15% |
| Presentation / demo clarity | 15% |
| Team Assessment (Psychometric Test) (Round 1 only) | 10% |

**Additional assessment criteria (for Round 2\)**

| Dimension | What judges are looking for |
| :---- | :---- |
| Problem ownership | Can they explain why THEY specifically are positioned to build this — beyond "we found this interesting"? |
| Customer specificity | Named buyer persona (e.g., "Head of Trade Finance Ops at a GIFT City IBU"), not "banks and fintechs" |
| Why now | A real answer tied to AA framework maturity, IFSCA sandbox posture, agentic AI cost curves, etc. — not generic "fintech is growing" |
| Coachability (R2 only) | Did they meaningfully incorporate R1 feedback, or paste the same pitch back with a new intro slide? |

# **11\. Judges' Q\&A — Questions You Should Expect**

Every panel, in both rounds, will ask some version of these three questions. Prepare real answers — not deck slides.

| *"Who is your first paying customer, specifically, and how do you get to them?"* *"What part of this would break first if you tried to sell it to a real bank/NBFC next week?"* *"If you had to start this company Monday, what would you build first — and is it what you built tonight?"* |
| :---- |

That last question is the one that matters most. It tells the jury immediately whether you understand tonight's prototype as a proof point — or whether you've confused it with your actual product. Good founders know the difference. That's what we're here to find.