import { useState } from "react";
import {
  BrowserProvider,
  Contract,
  isAddress,
} from "ethers";

import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
} from "../contract";

const ETHERSCAN = "https://sepolia.etherscan.io";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

function IssuerDashboard() {
  // =====================================================
  // ISSUE CERTIFICATE STATES
  // =====================================================

  const [studentName, setStudentName] = useState("");
  const [course, setCourse] = useState("");
  const [issuerName, setIssuerName] = useState("");

  const [recipient, setRecipient] = useState("");
  const [certificateId, setCertificateId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [tokenId, setTokenId] = useState("");
  const [ipfsURI, setIpfsURI] = useState("");
  const [txHash, setTxHash] = useState("");

  const [issuing, setIssuing] = useState(false);

  // =====================================================
  // REVOKE STATES
  // =====================================================

  const [revokeTokenId, setRevokeTokenId] = useState("");
  const [revokeStatus, setRevokeStatus] = useState("");
  const [revokeError, setRevokeError] = useState("");
  const [revokeTxHash, setRevokeTxHash] = useState("");

  const [revoking, setRevoking] = useState(false);

  // =====================================================
  // GET ISSUER CONTRACT
  // =====================================================

  async function getIssuerContract() {
    const ethereum = (window as any).ethereum;

    if (!ethereum) {
      throw new Error("MetaMask is not installed.");
    }

    const provider = new BrowserProvider(ethereum);

    await provider.send(
      "eth_requestAccounts",
      []
    );

    const network =
      await provider.getNetwork();

    if (
      network.chainId !==
      11155111n
    ) {
      throw new Error(
        "Please switch MetaMask to Sepolia network."
      );
    }

    const signer =
      await provider.getSigner();

    const signerAddress =
      await signer.getAddress();

    const contract = new Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      signer
    );

    const owner: string =
      await contract.owner();

    if (
      owner.toLowerCase() !==
      signerAddress.toLowerCase()
    ) {
      throw new Error(
        "Only the authorized issuer wallet can perform this action."
      );
    }

    return contract;
  }

  // =====================================================
  // ISSUE CERTIFICATE
  // =====================================================

  async function issueCertificate() {
    try {
      setIssuing(true);

      setError("");
      setStatus("");
      setTokenId("");
      setIpfsURI("");
      setTxHash("");

      if (
        !studentName.trim() ||
        !course.trim() ||
        !issuerName.trim()
      ) {
        setError(
          "Please enter student name, course and issuer name."
        );

        return;
      }

      if (
        !recipient.trim() ||
        !certificateId.trim() ||
        !file
      ) {
        setError(
          "Please enter recipient wallet, certificate ID and select a certificate file."
        );

        return;
      }

      if (!isAddress(recipient)) {
        setError(
          "Invalid Ethereum wallet address."
        );

        return;
      }

      const contract =
        await getIssuerContract();

      // -------------------------------------------------
      // STEP 1 — IPFS
      // -------------------------------------------------

      setStatus(
        "Uploading certificate and metadata to IPFS..."
      );

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "studentName",
        studentName
      );

      formData.append(
        "course",
        course
      );

      formData.append(
        "issuerName",
        issuerName
      );

      formData.append(
        "certificateId",
        certificateId
      );

      formData.append(
        "recipient",
        recipient
      );

      const uploadResponse =
        await fetch(
          `${API_BASE_URL}/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

      const uploadResult =
        await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(
          uploadResult.error ||
            "IPFS upload failed."
        );
      }

      const uploadedIpfsURI =
        uploadResult.ipfsURI as string;

      if (!uploadedIpfsURI) {
        throw new Error(
          "IPFS metadata URI was not returned."
        );
      }

      setIpfsURI(
        uploadedIpfsURI
      );

      // -------------------------------------------------
      // STEP 2 — BLOCKCHAIN
      // -------------------------------------------------

      setStatus(
        "IPFS upload complete ✓ Confirm the transaction in MetaMask."
      );

      const tx =
        await contract.issueCertificate(
          recipient,
          certificateId,
          uploadedIpfsURI
        );

      setTxHash(tx.hash);

      setStatus(
        "Transaction submitted. Waiting for blockchain confirmation..."
      );

      const receipt =
        await tx.wait();

      // -------------------------------------------------
      // STEP 3 — READ EVENT
      // -------------------------------------------------

      let issuedTokenId = "";

      if (receipt) {
        for (
          const log of receipt.logs
        ) {
          try {
            const parsed =
              contract.interface.parseLog(
                log
              );

            if (
              parsed &&
              parsed.name ===
                "CertificateIssued"
            ) {
              issuedTokenId =
                parsed.args.tokenId.toString();

              break;
            }
          } catch {
            // Ignore unrelated logs
          }
        }
      }

      setTokenId(
        issuedTokenId
      );

      setStatus(
        issuedTokenId
          ? `Certificate issued successfully — Token ID ${issuedTokenId}`
          : "Certificate issued successfully."
      );

      // Clear form
      setStudentName("");
      setCourse("");
      setIssuerName("");
      setRecipient("");
      setCertificateId("");
      setFile(null);

    } catch (err) {
      console.error(
        "Issue certificate error:",
        err
      );

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Certificate issuance failed."
        );
      }

      setStatus("");

    } finally {
      setIssuing(false);
    }
  }

  // =====================================================
  // REVOKE CERTIFICATE
  // =====================================================

  async function revokeCertificate() {
    try {
      setRevoking(true);

      setRevokeStatus("");
      setRevokeError("");
      setRevokeTxHash("");

      const cleanTokenId =
        revokeTokenId.trim();

      if (!cleanTokenId) {
        setRevokeError(
          "Please enter a Token ID."
        );

        return;
      }

      if (
        !/^\d+$/.test(
          cleanTokenId
        ) ||
        BigInt(cleanTokenId) <= 0n
      ) {
        setRevokeError(
          "Token ID must be a positive number."
        );

        return;
      }

      const contract =
        await getIssuerContract();

      setRevokeStatus(
        "Checking certificate status..."
      );

      const result =
        await contract.verifyCertificate(
          cleanTokenId
        );

      const exists =
        result[0];

      const alreadyRevoked =
        result[1];

      if (!exists) {
        setRevokeError(
          `Token ID ${cleanTokenId} does not exist.`
        );

        setRevokeStatus("");

        return;
      }

      if (alreadyRevoked) {
        setRevokeError(
          "This certificate is already revoked."
        );

        setRevokeStatus("");

        return;
      }

      setRevokeStatus(
        "Confirm certificate revocation in MetaMask."
      );

      const tx =
        await contract.revokeCertificate(
          cleanTokenId
        );

      setRevokeTxHash(tx.hash);

      setRevokeStatus(
        "Revocation submitted. Waiting for blockchain confirmation..."
      );

      await tx.wait();

      setRevokeStatus(
        `Certificate Token ID ${cleanTokenId} revoked successfully.`
      );

      setRevokeTokenId("");

    } catch (err) {
      console.error(
        "Revoke certificate error:",
        err
      );

      if (err instanceof Error) {
        setRevokeError(
          err.message
        );
      } else {
        setRevokeError(
          "Certificate revocation failed."
        );
      }

      setRevokeStatus("");

    } finally {
      setRevoking(false);
    }
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="issuer-dashboard">
      {/* HEADER */}

      <div className="issuer-header">
        <div className="issuer-header-icon">
          🎓
        </div>

        <div>
          <span className="issuer-eyebrow">
            AUTHORIZED ISSUER
          </span>

          <h2>
            Issuer Dashboard
          </h2>

          <p>
            Create verifiable,
            non-transferable blockchain
            credentials backed by IPFS.
          </p>
        </div>
      </div>

      <div className="issuer-layout">
        {/* ============================================= */}
        {/* ISSUE CARD */}
        {/* ============================================= */}

        <section className="issuer-card issue-certificate-card">
          <div className="issuer-card-header">
            <div>
              <span className="card-number">
                01
              </span>

              <h3>
                Issue Certificate
              </h3>

              <p>
                Enter credential details,
                upload the original
                certificate and mint its
                Soulbound Token.
              </p>
            </div>

            <span className="issuer-card-pill">
              SEPOLIA
            </span>
          </div>

          {/* Credential Details */}

          <div className="issuer-form-section">
            <div className="form-section-title">
              <span>
                Credential Details
              </span>

              <small>
                Public certificate
                information
              </small>
            </div>

            <div className="issuer-form-grid">
              <div className="issuer-field">
                <label>
                  Student Name
                </label>

                <input
                  type="text"
                  placeholder="e.g. Test Student"
                  value={studentName}
                  onChange={(e) =>
                    setStudentName(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="issuer-field">
                <label>
                  Course / Program
                </label>

                <input
                  type="text"
                  placeholder="e.g. Blockchain Development"
                  value={course}
                  onChange={(e) =>
                    setCourse(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="issuer-field issuer-field-full">
                <label>
                  Issuer Name
                </label>

                <input
                  type="text"
                  placeholder="University / Organization"
                  value={issuerName}
                  onChange={(e) =>
                    setIssuerName(
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          </div>

          {/* Blockchain Details */}

          <div className="issuer-form-section">
            <div className="form-section-title">
              <span>
                Blockchain Details
              </span>

              <small>
                Recipient and certificate
                identity
              </small>
            </div>

            <div className="issuer-form-grid">
              <div className="issuer-field issuer-field-full">
                <label>
                  Recipient Wallet Address
                </label>

                <input
                  type="text"
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) =>
                    setRecipient(
                      e.target.value
                    )
                  }
                />

                <small>
                  The Soulbound certificate
                  will be permanently linked
                  to this wallet.
                </small>
              </div>

              <div className="issuer-field issuer-field-full">
                <label>
                  Certificate ID
                </label>

                <input
                  type="text"
                  placeholder="e.g. CERT-005"
                  value={certificateId}
                  onChange={(e) =>
                    setCertificateId(
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          </div>

          {/* File */}

          <div className="issuer-form-section">
            <div className="form-section-title">
              <span>
                Certificate File
              </span>

              <small>
                PDF, PNG, JPG or JPEG
              </small>
            </div>

            <div className="certificate-upload-box">
              <div className="upload-icon">
                ⇧
              </div>

              <div>
                <strong>
                  Upload certificate
                </strong>

                <p>
                  Maximum file size 10 MB
                </p>
              </div>

              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) =>
                  setFile(
                    e.target.files
                      ? e.target.files[0]
                      : null
                  )
                }
              />
            </div>

            {file && (
              <div className="selected-file">
                <span>✓</span>

                <div>
                  <strong>
                    {file.name}
                  </strong>

                  <small>
                    Ready for IPFS upload
                  </small>
                </div>
              </div>
            )}
          </div>

          {/* ACTION */}

          <button
            className="issue-certificate-button"
            onClick={
              issueCertificate
            }
            disabled={issuing}
          >
            {issuing
              ? "Processing Certificate..."
              : "Issue Blockchain Certificate"}
          </button>

          {/* PROCESS STATUS */}

          {status && (
            <div className="issuer-alert issuer-alert-success">
              <span>✓</span>

              <p>
                {status}
              </p>
            </div>
          )}

          {error && (
            <div className="issuer-alert issuer-alert-error">
              <span>!</span>

              <p>
                {error}
              </p>
            </div>
          )}

          {/* SUCCESS RESULT */}

          {tokenId && (
            <div className="issue-result">
              <div className="result-check">
                ✓
              </div>

              <div>
                <span>
                  CERTIFICATE ISSUED
                </span>

                <h3>
                  Token #{tokenId}
                </h3>

                <p>
                  The certificate is now
                  recorded on Ethereum
                  Sepolia.
                </p>
              </div>
            </div>
          )}

          {txHash && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                marginTop: "14px",
              }}
            >
              <a
                href={`${ETHERSCAN}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                <button className="secondary-action">
                  View Transaction on Etherscan ↗
                </button>
              </a>

              <a
                href={`${ETHERSCAN}/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
              >
                <button className="secondary-action">
                  View Smart Contract ↗
                </button>
              </a>
            </div>
          )}

          {tokenId &&
            ipfsURI && (
              <details className="issue-technical-details">
                <summary>
                  View IPFS Metadata URI
                </summary>

                <small>
                  {ipfsURI}
                </small>
              </details>
            )}
        </section>

        {/* ============================================= */}
        {/* REVOKE CARD */}
        {/* ============================================= */}

        <section className="issuer-card revoke-certificate-card">
          <div className="revoke-icon">
            !
          </div>

          <span className="danger-label">
            DANGER ZONE
          </span>

          <h3>
            Revoke Certificate
          </h3>

          <p>
            Permanently mark an issued
            credential as revoked on the
            blockchain.
          </p>

          <div className="revoke-warning">
            Revocation does not delete the
            token. Its blockchain status will
            permanently change to revoked.
          </div>

          <div className="issuer-field">
            <label>
              Certificate Token ID
            </label>

            <input
              type="text"
              placeholder="e.g. 2"
              value={revokeTokenId}
              onChange={(e) =>
                setRevokeTokenId(
                  e.target.value
                )
              }
            />
          </div>

          <button
            className="revoke-button"
            onClick={
              revokeCertificate
            }
            disabled={revoking}
          >
            {revoking
              ? "Processing..."
              : "Revoke Certificate"}
          </button>

          {revokeStatus && (
            <div className="issuer-alert issuer-alert-warning">
              <span>✓</span>

              <p>
                {revokeStatus}
              </p>
            </div>
          )}

          {revokeTxHash && (
            <a
              href={`${ETHERSCAN}/tx/${revokeTxHash}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                marginTop: "12px",
                color: "#fca5a5",
                fontSize: "0.82rem",
                fontWeight: 650,
                textDecoration: "none",
              }}
            >
              View Revocation Transaction on Etherscan ↗
            </a>
          )}

          {revokeError && (
            <div className="issuer-alert issuer-alert-error">
              <span>!</span>

              <p>
                {revokeError}
              </p>
            </div>
          )}

          <div className="revoke-footer">
            <span>🔒</span>

            <small>
              Only the authorized contract
              owner can revoke credentials.
            </small>
          </div>
        </section>
      </div>
    </div>
  );
}

export default IssuerDashboard;