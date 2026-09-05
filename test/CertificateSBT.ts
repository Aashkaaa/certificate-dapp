import { expect } from "chai";
import { network } from "hardhat";

describe("CertificateSBT", function () {
  it("should issue a certificate", async function () {
    const { ethers } = await network.connect();

    const [owner, recipient] = await ethers.getSigners();

    const CertificateSBT = await ethers.getContractFactory("CertificateSBT");
    const contract = await CertificateSBT.deploy();

    await contract.waitForDeployment();

    await contract.issueCertificate(
      recipient.address,
      "CERT-001",
      "ipfs://example"
    );

    const certificate = await contract.certificates(1);

    expect(certificate.certificateId).to.equal("CERT-001");
    expect(certificate.ipfsURI).to.equal("ipfs://example");
    expect(certificate.revoked).to.equal(false);
    expect(await contract.ownerOf(1)).to.equal(recipient.address);
  });

  it("should prevent certificate transfer", async function () {
    const { ethers } = await network.connect();

    const [owner, recipient, anotherUser] = await ethers.getSigners();

    const CertificateSBT = await ethers.getContractFactory("CertificateSBT");
    const contract = await CertificateSBT.deploy();

    await contract.waitForDeployment();

    await contract.issueCertificate(
      recipient.address,
      "CERT-002",
      "ipfs://example2"
    );

    await expect(
      contract
        .connect(recipient)
        .transferFrom(recipient.address, anotherUser.address, 1)
    ).to.be.revertedWith("Certificate is Soulbound");
  });

  it("should revoke a certificate", async function () {
    const { ethers } = await network.connect();

    const [owner, recipient] = await ethers.getSigners();

    const CertificateSBT = await ethers.getContractFactory("CertificateSBT");
    const contract = await CertificateSBT.deploy();

    await contract.waitForDeployment();

    await contract.issueCertificate(
      recipient.address,
      "CERT-003",
      "ipfs://example3"
    );

    await contract.revokeCertificate(1);

    const result = await contract.verifyCertificate(1);

    expect(result[0]).to.equal(true);
    expect(result[1]).to.equal(true);
  });
});