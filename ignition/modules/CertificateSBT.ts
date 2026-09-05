import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CertificateSBTModule", (m) => {
  const certificateSBT = m.contract("CertificateSBT");

  return { certificateSBT };
});