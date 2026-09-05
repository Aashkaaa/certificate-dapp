import { useEffect, useState } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import { QRCodeSVG } from "qrcode.react";

import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
} from "../contract";

const SEPOLIA_RPC =
  "https://ethereum-sepolia-rpc.publicnode.com";

const IPFS_GATEWAY =
  "https://violet-obliged-mastodon-216.mypinata.cloud/ipfs/";

const ETHERSCAN =
  "https://sepolia.etherscan.io";

type CertificateMetadata = {
  schemaVersion?: string;
  studentName?: string;
  course?: string;
  issuer?: string;
  certificateId?: string;
  recipient?: string;
  issueDate?: string;

  certificateFile?: {
    name?: string;
    mimeType?: string;
    cid?: string;
    uri?: string;
  };
};

type CertificateData = {
  tokenId: string;
  revoked: boolean;
  recipient: string;
  certificateId: string;
  ipfsURI: string;
  issuedAt: string;
  issuerWallet: string;
  metadata: CertificateMetadata | null;
  isMetadataCertificate: boolean;
};

function VerifyCertificate() {
  const [tokenId, setTokenId] = useState("");
  const [certificate, setCertificate] =
    useState<CertificateData | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // =====================================================
  // IPFS URI -> HTTP URL
  // =====================================================

  function getIPFSUrl(uri: string) {
    if (!uri) return "";

    if (
      uri.startsWith("http://") ||
      uri.startsWith("https://")
    ) {
      return uri;
    }

    if (uri.startsWith("ipfs://")) {
      const cid = uri.replace("ipfs://", "");
      return `${IPFS_GATEWAY}${cid}`;
    }

    return uri;
  }

  // =====================================================
  // SHORTEN WALLET ADDRESS
  // =====================================================

  function shortAddress(address: string) {
    if (!address) return "";

    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  // =====================================================
  // LOAD IPFS METADATA
  // =====================================================

  async function loadMetadata(
    ipfsURI: string
  ): Promise<CertificateMetadata | null> {
    try {
      const metadataURL = getIPFSUrl(ipfsURI);

      const response = await fetch(metadataURL, {
        cache: "no-store",
      });

      if (!response.ok) {
        return null;
      }

      const contentType =
        response.headers.get("content-type");

      // Legacy certificates may point directly
      // to PDF / PNG / JPG instead of JSON.
      if (
        contentType &&
        !contentType.includes("application/json") &&
        !contentType.includes("text/plain")
      ) {
        return null;
      }

      const text = await response.text();

      let metadata: CertificateMetadata;

      try {
        metadata = JSON.parse(text);
      } catch {
        return null;
      }

      if (
        !metadata.studentName &&
        !metadata.course &&
        !metadata.issuer &&
        !metadata.certificateFile
      ) {
        return null;
      }

      return metadata;
    } catch {
      return null;
    }
  }

  // =====================================================
  // VERIFY TOKEN
  // =====================================================

  async function verifyByTokenId(id: string) {
    try {
      setError("");
      setCertificate(null);

      const cleanId = id.trim();

      if (!cleanId) {
        setError("Please enter a Token ID.");
        return;
      }

      if (
        !/^\d+$/.test(cleanId) ||
        BigInt(cleanId) <= 0n
      ) {
        setError(
          "Token ID must be a positive number."
        );
        return;
      }

      setLoading(true);

      const provider =
        new JsonRpcProvider(SEPOLIA_RPC);

      const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

      const result =
        await contract.verifyCertificate(cleanId);

      const [
        exists,
        revoked,
        recipient,
        certificateId,
        ipfsURI,
        issuedAt,
      ] = result;

      if (!exists) {
        setError(
          `No certificate exists with Token ID ${cleanId}.`
        );
        return;
      }

      const issuerWallet: string =
        await contract.owner();

      const blockchainDate = new Date(
        Number(issuedAt) * 1000
      ).toLocaleString();

      const metadata =
        await loadMetadata(ipfsURI);

      setCertificate({
        tokenId: cleanId,
        revoked,
        recipient,
        certificateId,
        ipfsURI,
        issuedAt: blockchainDate,
        issuerWallet,
        metadata,
        isMetadataCertificate:
          metadata !== null,
      });
    } catch (err) {
      console.error(
        "Verification error:",
        err
      );

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Certificate verification failed."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyCertificate() {
    await verifyByTokenId(tokenId);
  }

  // =====================================================
  // AUTO VERIFY QR URL
  // /verify?tokenId=4
  // =====================================================

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const id = params.get("tokenId");

    if (id) {
      setTokenId(id);
      void verifyByTokenId(id);
    }

    // Run once when page loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =====================================================
  // QR URL
  // =====================================================

  const verificationURL =
    certificate
      ? `${window.location.origin}/verify?tokenId=${certificate.tokenId}`
      : "";

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="verify-page">
      {/* HEADER */}

      <div className="verify-header">
        <div className="verify-icon">
          ✓
        </div>

        <h2>Verify Certificate</h2>

        <p>
          Check the authenticity of a
          blockchain credential using its
          Token ID.
        </p>
      </div>

      {/* SEARCH */}

      <div className="verify-search">
        <input
          type="text"
          placeholder="Enter Token ID, e.g. 4"
          value={tokenId}
          onChange={(e) =>
            setTokenId(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void verifyCertificate();
            }
          }}
        />

        <button
          onClick={verifyCertificate}
          disabled={loading}
        >
          {loading
            ? "Verifying..."
            : "Verify Certificate"}
        </button>
      </div>

      {error && (
        <p className="verify-error">
          {error}
        </p>
      )}

      {/* RESULT */}

      {certificate && (
        <div
          className={`certificate-result ${
            certificate.revoked
              ? "certificate-revoked"
              : "certificate-valid"
          }`}
        >
          {/* STATUS HEADER */}

          <div className="result-status">
            <div
              className={`status-symbol ${
                certificate.revoked
                  ? "status-symbol-revoked"
                  : ""
              }`}
            >
              {certificate.revoked
                ? "×"
                : "✓"}
            </div>

            <div>
              <span className="status-label">
                BLOCKCHAIN STATUS
              </span>

              <h3>
                {certificate.revoked
                  ? "Certificate Revoked"
                  : "Verified Certificate"}
              </h3>

              <p>
                {certificate.revoked
                  ? "This credential has been revoked by the issuer."
                  : "This credential exists on Ethereum Sepolia and is currently active."}
              </p>
            </div>

            <span
              className={`status-pill ${
                certificate.revoked
                  ? "revoked-pill"
                  : "valid-pill"
              }`}
            >
              {certificate.revoked
                ? "REVOKED"
                : "ACTIVE"}
            </span>
          </div>

          {/* HUMAN READABLE DETAILS */}

          <div className="certificate-main">
            <div className="certificate-details">
              {certificate.metadata
                ?.studentName && (
                <div className="student-heading">
                  <span>
                    CERTIFICATE HOLDER
                  </span>

                  <h2>
                    {
                      certificate
                        .metadata
                        .studentName
                    }
                  </h2>

                  {certificate.metadata
                    .course && (
                    <p>
                      {
                        certificate
                          .metadata
                          .course
                      }
                    </p>
                  )}
                </div>
              )}

              <div className="certificate-info-grid">
                <div>
                  <span>
                    Certificate ID
                  </span>

                  <strong>
                    {
                      certificate.certificateId
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Token ID
                  </span>

                  <strong>
                    #{certificate.tokenId}
                  </strong>
                </div>

                <div>
                  <span>
                    Issuer
                  </span>

                  <strong>
                    {certificate.metadata
                      ?.issuer ||
                      "Blockchain Issuer"}
                  </strong>
                </div>

                <div>
                  <span>
                    Status
                  </span>

                  <strong
                    className={
                      certificate.revoked
                        ? "text-revoked"
                        : "text-active"
                    }
                  >
                    {certificate.revoked
                      ? "Revoked"
                      : "Active"}
                  </strong>
                </div>
              </div>

              {/* MAIN ACTION */}

              <div className="certificate-actions">
                {certificate
                  .isMetadataCertificate &&
                certificate.metadata
                  ?.certificateFile
                  ?.uri ? (
                  <a
                    href={getIPFSUrl(
                      certificate
                        .metadata
                        .certificateFile
                        .uri
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <button>
                      View Original Certificate
                    </button>
                  </a>
                ) : (
                  <a
                    href={getIPFSUrl(
                      certificate.ipfsURI
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <button>
                      View Certificate
                    </button>
                  </a>
                )}
              </div>
            </div>

            {/* QR */}

            <div className="qr-card">
              <span className="qr-label">
                QR VERIFICATION
              </span>

              <div className="qr-box">
                <QRCodeSVG
                  value={verificationURL}
                  size={170}
                  level="H"
                />
              </div>

              <strong>
                Scan to Verify
              </strong>

              <p>
                Opens this certificate's
                verification page.
              </p>
            </div>
          </div>

          {/* TECHNICAL DETAILS */}

          <details className="technical-details">
            <summary>
              Blockchain & Technical Details
            </summary>

            <div className="technical-grid">
              <div>
                <span>
                  Recipient Wallet
                </span>

                <strong>
                  {shortAddress(
                    certificate.recipient
                  )}
                </strong>

                <small>
                  {
                    certificate.recipient
                  }
                </small>
              </div>

              <div>
                <span>
                  Issuer Wallet
                </span>

                <strong>
                  {shortAddress(
                    certificate.issuerWallet
                  )}
                </strong>

                <small>
                  {
                    certificate.issuerWallet
                  }
                </small>
              </div>

              <div>
                <span>
                  Blockchain Issued At
                </span>

                <strong>
                  {
                    certificate.issuedAt
                  }
                </strong>
              </div>

              {certificate.metadata
                ?.issueDate && (
                <div>
                  <span>
                    Metadata Created
                  </span>

                  <strong>
                    {new Date(
                      certificate
                        .metadata
                        .issueDate
                    ).toLocaleString()}
                  </strong>
                </div>
              )}

              <div className="technical-full">
                <span>
                  On-chain IPFS URI
                </span>

                <small>
                  {
                    certificate.ipfsURI
                  }
                </small>
              </div>

              {certificate.metadata
                ?.certificateFile
                ?.cid && (
                <div className="technical-full">
                  <span>
                    Certificate File CID
                  </span>

                  <small>
                    {
                      certificate
                        .metadata
                        .certificateFile
                        .cid
                    }
                  </small>
                </div>
              )}
            </div>

            <div className="technical-actions">
              {certificate
                .isMetadataCertificate && (
                <a
                  href={getIPFSUrl(
                    certificate.ipfsURI
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <button className="secondary-action">
                    View IPFS Metadata
                  </button>
                </a>
              )}

              <a
                href={`${ETHERSCAN}/address/${certificate.recipient}`}
                target="_blank"
                rel="noreferrer"
              >
                <button className="secondary-action">
                  View Recipient on Etherscan ↗
                </button>
              </a>

              <a
                href={`${ETHERSCAN}/address/${certificate.issuerWallet}`}
                target="_blank"
                rel="noreferrer"
              >
                <button className="secondary-action">
                  View Issuer on Etherscan ↗
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
          </details>

          {!certificate
            .isMetadataCertificate && (
            <p className="legacy-note">
              This is a legacy certificate.
              Structured IPFS metadata was
              not stored for this token.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default VerifyCertificate;