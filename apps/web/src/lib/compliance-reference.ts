/**
 * Frameworks/regulations/controls are platform-owned reference data seeded
 * once server-side (packages/compliance/src/seed.ts) — DPDP + ISO27001 only,
 * one control each, for the MVP. There is no GET endpoint to list them today,
 * so this mirrors that fixed seed exactly. Replace with a live fetch once a
 * GET /compliance/frameworks (or /controls) endpoint exists.
 */
export interface KnownControl {
  controlId: string;
  controlName: string;
  frameworkCode: "DPDP" | "ISO27001";
  regulationName: string;
  clauseReference: string;
}

export const KNOWN_CONTROLS: KnownControl[] = [
  {
    controlId: "dpdp-control-encryption",
    controlName: "Encryption of Personal Data at Rest",
    frameworkCode: "DPDP",
    regulationName: "Reasonable Security Safeguards",
    clauseReference: "DPDP Act 2023, Section 8(5)",
  },
  {
    controlId: "iso-control-mfa",
    controlName: "Multi-Factor Authentication for Privileged Access",
    frameworkCode: "ISO27001",
    regulationName: "Access Control",
    clauseReference: "ISO/IEC 27001:2022 Annex A.8",
  },
];

export function findKnownControl(controlId: string): KnownControl | undefined {
  return KNOWN_CONTROLS.find((c) => c.controlId === controlId);
}
