import { asControlId, asFrameworkId, asRegulationId, asRequirementId } from "@kairon/shared-kernel";
import { Control, Framework, Regulation } from "./domain";
import type { ControlRepository, FrameworkRepository, RegulationRepository } from "./domain";

/**
 * 1-2 hardcoded frameworks for MVP (ARCHITECTURE.md §1.13 / Architecture
 * Decision #7): DPDP (India) + ISO27001 (international baseline) — the pair
 * that supports a GIFT City IBU buyer persona without pretending the
 * platform has ingested a live regulatory feed.
 */
export async function seedComplianceReferenceData(deps: {
  frameworkRepository: FrameworkRepository & { save(framework: Framework): Promise<void> };
  regulationRepository: RegulationRepository & { save(frameworkId: ReturnType<typeof asFrameworkId>, regulation: Regulation): Promise<void> };
  controlRepository: ControlRepository & { save(regulationId: ReturnType<typeof asRegulationId>, control: Control): Promise<void> };
}): Promise<void> {
  const dpdpId = asFrameworkId("framework-dpdp");
  const dpdpDataSecurityRegId = asRegulationId("dpdp-reg-data-security");
  const dpdpEncryptionControlId = asControlId("dpdp-control-encryption");

  const dpdp = Framework.create(dpdpId, {
    code: "DPDP",
    version: "2023",
    regulationIds: [dpdpDataSecurityRegId],
  });
  const dpdpDataSecurity = Regulation.create(dpdpDataSecurityRegId, {
    name: "Reasonable Security Safeguards",
    clauseReference: "DPDP Act 2023, Section 8(5)",
    controlIds: [dpdpEncryptionControlId],
  });
  const dpdpEncryptionControl = Control.create(dpdpEncryptionControlId, {
    name: "Encryption of Personal Data at Rest",
    requirementIds: [asRequirementId("dpdp-req-encryption")],
    maturityLevel: 3,
  });

  const isoId = asFrameworkId("framework-iso27001");
  const isoAccessControlRegId = asRegulationId("iso-reg-access-control");
  const isoMfaControlId = asControlId("iso-control-mfa");

  const iso27001 = Framework.create(isoId, {
    code: "ISO27001",
    version: "2022",
    regulationIds: [isoAccessControlRegId],
  });
  const isoAccessControl = Regulation.create(isoAccessControlRegId, {
    name: "Access Control",
    clauseReference: "ISO/IEC 27001:2022 Annex A.8",
    controlIds: [isoMfaControlId],
  });
  const isoMfaControl = Control.create(isoMfaControlId, {
    name: "Multi-Factor Authentication for Privileged Access",
    requirementIds: [asRequirementId("iso-req-mfa")],
    maturityLevel: 2,
  });

  await deps.frameworkRepository.save(dpdp);
  await deps.regulationRepository.save(dpdpId, dpdpDataSecurity);
  await deps.controlRepository.save(dpdpDataSecurityRegId, dpdpEncryptionControl);

  await deps.frameworkRepository.save(iso27001);
  await deps.regulationRepository.save(isoId, isoAccessControl);
  await deps.controlRepository.save(isoAccessControlRegId, isoMfaControl);
}
