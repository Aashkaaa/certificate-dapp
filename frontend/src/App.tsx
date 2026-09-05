import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
} from "react-router-dom";
import { BrowserProvider, Contract } from "ethers";

import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
} from "./contract";

import IssuerDashboard from "./pages/IssuerDashboard";
import VerifyCertificate from "./pages/VerifyCertificate";

import "./App.css";

// =====================================================
// HOME PAGE
// =====================================================

function Home() {
  const [account, setAccount] = useState("");
  const [contractOwner, setContractOwner] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  async function connectWallet() {
    try {
      setConnecting(true);
      setError("");

      const ethereum = (window as any).ethereum;

      if (!ethereum) {
        setError("MetaMask is not installed.");
        return;
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
        setError(
          "Please switch MetaMask to Sepolia network."
        );
        return;
      }

      const signer =
        await provider.getSigner();

      const address =
        await signer.getAddress();

      const contractCode =
        await provider.getCode(
          CONTRACT_ADDRESS
        );

      if (
        contractCode === "0x"
      ) {
        setError(
          "CertificateSBT contract not found on Sepolia."
        );
        return;
      }

      const contract =
        new Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          signer
        );

      const owner: string =
        await contract.owner();

      setAccount(address);
      setContractOwner(owner);
      setError("");

    } catch (err) {
      console.error(
        "CredChain error:",
        err
      );

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Wallet connection failed."
        );
      }

    } finally {
      setConnecting(false);
    }
  }

  const isIssuer =
    account &&
    contractOwner &&
    account.toLowerCase() ===
      contractOwner.toLowerCase();

  function shortAddress(
    address: string
  ) {
    if (!address) return "";

    return `${address.slice(
      0,
      6
    )}...${address.slice(-4)}`;
  }

  return (
    <main className="home-page">
      {/* ============================================= */}
      {/* HERO */}
      {/* ============================================= */}

      <section className="hero-section">
        <div className="hero-badge">
          ⛓ Ethereum Sepolia
        </div>

        <h1>CredChain</h1>

        <h2 className="hero-title">
          Issue. Verify. Trust.
        </h2>

        <p className="hero-description">
          A decentralized certificate
          verification platform powered by
          Soulbound Tokens, Ethereum and
          IPFS.
        </p>

        {/* TECHNOLOGY BADGES */}

        <div className="technology-badges">
          <span>
            ◆ Soulbound Credentials
          </span>

          <span>
            ◈ IPFS Storage
          </span>

          <span>
            ⛓ Sepolia Testnet
          </span>
        </div>

        {/* HERO ACTIONS */}

        <div className="hero-actions">
          <Link to="/verify">
            <button className="primary-action">
              Verify Certificate
            </button>
          </Link>

          <button
            className="secondary-action"
            onClick={connectWallet}
            disabled={connecting}
          >
            {connecting
              ? "Connecting..."
              : account
              ? "Wallet Connected ✓"
              : "Connect Wallet"}
          </button>
        </div>

        {/* WALLET INFORMATION */}

        {account && (
          <div className="wallet-card">
            <div>
              <span className="wallet-label">
                Connected Wallet
              </span>

              <strong>
                {shortAddress(
                  account
                )}
              </strong>
            </div>

            <span className="network-pill">
              Sepolia
            </span>
          </div>
        )}

        {isIssuer && (
          <div className="issuer-success">
            ✓ Authorized issuer wallet
            verified
          </div>
        )}

        {account &&
          contractOwner &&
          !isIssuer && (
            <div className="wallet-info-message">
              Connected as certificate
              recipient / verifier
            </div>
          )}

        {error && (
          <p className="error-message">
            {error}
          </p>
        )}
      </section>

      {/* ============================================= */}
      {/* MAIN ACTIONS */}
      {/* ============================================= */}

      <section className="action-section">
        <div className="section-heading">
          <p className="section-label">
            CREDCHAIN PLATFORM
          </p>

          <h2>
            What would you like to do?
          </h2>

          <p>
            Issue blockchain credentials
            or instantly verify an existing
            certificate.
          </p>
        </div>

        <div className="action-grid">
          {/* ISSUER CARD */}

          <div className="action-card">
            <div className="action-icon">
              🎓
            </div>

            <h3>
              Issue Certificate
            </h3>

            <p>
              Upload a certificate,
              generate decentralized IPFS
              metadata and mint a
              non-transferable credential.
            </p>

            <div className="card-features">
              <span>
                ✓ IPFS metadata
              </span>

              <span>
                ✓ Soulbound token
              </span>

              <span>
                ✓ Revocation support
              </span>
            </div>

            <Link to="/issuer">
              <button>
                Open Issuer Dashboard
              </button>
            </Link>
          </div>

          {/* VERIFY CARD */}

          <div className="action-card">
            <div className="action-icon">
              🛡️
            </div>

            <h3>
              Verify Certificate
            </h3>

            <p>
              Check certificate
              authenticity directly from
              blockchain data without
              requiring a wallet.
            </p>

            <div className="card-features">
              <span>
                ✓ Public verification
              </span>

              <span>
                ✓ Active / revoked status
              </span>

              <span>
                ✓ QR verification
              </span>
            </div>

            <Link to="/verify">
              <button>
                Verify Now
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================= */}
      {/* HOW IT WORKS */}
      {/* ============================================= */}

      <section className="workflow-section">
        <div className="section-heading">
          <p className="section-label">
            HOW IT WORKS
          </p>

          <h2>
            Certificate lifecycle
          </h2>
        </div>

        <div className="workflow-grid">
          <div className="workflow-item">
            <span>01</span>

            <h3>
              Upload
            </h3>

            <p>
              Certificate and metadata are
              securely uploaded to IPFS.
            </p>
          </div>

          <div className="workflow-item">
            <span>02</span>

            <h3>
              Mint
            </h3>

            <p>
              A Soulbound certificate is
              minted on Ethereum Sepolia.
            </p>
          </div>

          <div className="workflow-item">
            <span>03</span>

            <h3>
              Verify
            </h3>

            <p>
              Anyone can verify authenticity
              using the blockchain Token ID.
            </p>
          </div>

          <div className="workflow-item">
            <span>04</span>

            <h3>
              Revoke
            </h3>

            <p>
              Invalid credentials can be
              permanently marked revoked.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================= */}
      {/* CONTRACT INFORMATION */}
      {/* ============================================= */}

      <section className="blockchain-info">
        <div>
          <span>
            NETWORK
          </span>

          <strong>
            Ethereum Sepolia
          </strong>
        </div>

        <div>
          <span>
            STORAGE
          </span>

          <strong>
            IPFS / Pinata
          </strong>
        </div>

        <div>
          <span>
            CREDENTIAL
          </span>

          <strong>
            ERC-721 Soulbound
          </strong>
        </div>

        <div>
          <span>
            CONTRACT
          </span>

          <strong>
            {shortAddress(
              CONTRACT_ADDRESS
            )}
          </strong>
        </div>
      </section>

      {/* ============================================= */}
      {/* FOOTER */}
      {/* ============================================= */}

      <footer className="site-footer">
        <strong>
          CredChain
        </strong>

        <span>
          Decentralized Certificate
          Verification
        </span>

        <small>
          Built on Ethereum Sepolia &
          IPFS
        </small>
      </footer>
    </main>
  );
}

// =====================================================
// ISSUER PAGE
// =====================================================

function IssuerPage() {
  return (
    <main className="app-page">
      <div className="page-navigation">
        <Link to="/">
          <button className="back-button">
            ← Back Home
          </button>
        </Link>

        <div className="page-brand">
          CredChain
        </div>
      </div>

      <IssuerDashboard />
    </main>
  );
}

// =====================================================
// VERIFY PAGE
// =====================================================

function VerifyPage() {
  return (
    <main className="app-page">
      <div className="page-navigation">
        <Link to="/">
          <button className="back-button">
            ← Back Home
          </button>
        </Link>

        <div className="page-brand">
          CredChain
        </div>
      </div>

      <VerifyCertificate />
    </main>
  );
}

// =====================================================
// APP
// =====================================================

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/issuer"
          element={<IssuerPage />}
        />

        <Route
          path="/verify"
          element={<VerifyPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;