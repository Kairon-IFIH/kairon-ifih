# 22. AI Reliability

**What exactly does AI do?** — AI helps understand regulatory documents, connect risks and explain recommendations.

**Which decisions require deterministic logic?** — Risk calculations, scoring, constraints and optimization should use controlled deterministic logic.

**Which decisions use LLMs?** — Mainly document understanding, regulatory search and natural-language explanations.

**Where do we use RAG?** — For retrieving answers from verified regulatory documents and sources.

**How do we prevent hallucinations?** — We ground regulatory answers in approved sources and require citations.

**How do we validate regulatory answers?** — We compare them against the underlying official document and flag uncertain cases for human review.

**How do we measure confidence?** — By considering source quality, retrieval evidence and consistency of the answer.

**Can AI be bypassed?** — Yes, critical workflows can fall back to deterministic rules and human review.

**Can AI recommend an illegal action?** — It could theoretically make an error, which is why high-impact recommendations require validation and human approval.

**How do we audit AI outputs?** — We log the input, source evidence, output, confidence and subsequent human decision.

**How do we handle model drift?** — We continuously test the models and update or replace them when performance drops.

**What happens if the LLM is unavailable?** — KAIRON should still provide core risk, scoring and optimization functionality through deterministic systems.
