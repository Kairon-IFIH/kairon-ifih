# 5. Asset Discovery & Cyber Scanning

**What exactly can KAIRON discover?** — Digital assets like endpoints, cloud resources, APIs, databases, certificates, critical systems and third-party connections.

**How does KAIRON discover assets?** — It connects to existing enterprise tools and data sources to build a unified asset inventory.

**Agent-based or agentless?** — For the MVP, we should keep it primarily agentless through APIs and integrations.

**API integrations?** — Yes, APIs are the preferred way to connect existing security and infrastructure systems.

**Network scanning?** — It can be part of the future product, but it should not be our core hackathon claim.

**Cloud integrations?** — Yes, cloud assets can be imported through cloud-provider APIs.

**CMDB integrations?** — Yes, KAIRON can use CMDB data to enrich and validate its asset inventory.

**EDR/SIEM feeds?** — Yes, these can provide security signals and asset information.

**Vulnerability scanner integration?** — Yes, existing vulnerability findings can feed into KAIRON's risk model.

**Can it discover shadow assets?** — Yes, the goal is to identify assets that are missing or poorly represented in the institution's official inventory.

**How do we detect duplicates?** — We correlate identifiers and attributes across different data sources to merge duplicate records.

**How do we identify critical assets?** — We score them based on business importance, data sensitivity, regulatory exposure and operational impact.

**How do we map assets to business services?** — We connect technical assets to the business function they support.

**How do we detect stale assets?** — We flag assets that show outdated, inactive or inconsistent activity across connected sources.

**How do we discover cryptographic dependencies?** — We map certificates, encryption technologies and systems that depend on them.

**Can we identify RSA/ECC usage?** — Yes, where that information is available through the connected systems and inventory data.

**Can we identify certificates and key dependencies?** — Yes, these can be included in the cryptographic asset inventory.

**Can we identify third-party systems?** — Yes, third-party dependencies can be mapped as part of the asset graph.

**Can we identify cross-border data flows?** — Potentially, if the required metadata is available from the institution's systems.

**Can we identify assets handling regulated data?** — Yes, by combining asset metadata with data classification and regulatory mapping.

**How does asset discovery feed the risk model?** — Every asset becomes an input into our risk calculation based on its criticality, exposure, controls and regulatory importance.

**Why integrate asset discovery into KAIRON?** — Because knowing what assets exist is the foundation for knowing what is at risk and where to spend money fixing it.

**Why isn't KAIRON just another attack-surface-management platform?** — Because we don't stop at finding assets; KAIRON connects assets to regulations, financial exposure and quantum optimization to decide what should be fixed first.
