export const CONTRACT_ADDRESS =
  "0xf475076a8ad20450f8aeafa89c6f54f245ff3dea";

export const CONTRACT_ABI = [
  "function issueCertificate(address recipient, string certificateId, string ipfsURI) external returns (uint256)",

  "function revokeCertificate(uint256 tokenId) external",

  "function verifyCertificate(uint256 tokenId) external view returns (bool exists, bool revoked, address recipient, string certificateId, string ipfsURI, uint256 issuedAt)",

  "function owner() external view returns (address)",

  "event CertificateIssued(uint256 indexed tokenId, address indexed recipient, string certificateId, string ipfsURI)",

  "event CertificateRevoked(uint256 indexed tokenId)"
];