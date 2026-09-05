// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CertificateSBT is ERC721, Ownable {

    struct Certificate {
        string certificateId;
        string ipfsURI;
        uint256 issuedAt;
        bool revoked;
    }

    uint256 private _nextTokenId = 1;

    mapping(uint256 => Certificate) public certificates;

    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed recipient,
        string certificateId,
        string ipfsURI
    );

    event CertificateRevoked(
        uint256 indexed tokenId
    );

    constructor()
        ERC721("Certificate SBT", "CERT")
        Ownable(msg.sender)
    {}

    function issueCertificate(
        address recipient,
        string calldata certificateId,
        string calldata ipfsURI
    )
        external
        onlyOwner
        returns (uint256)
    {
        require(recipient != address(0), "Invalid recipient");
        require(bytes(certificateId).length > 0, "Certificate ID required");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(recipient, tokenId);

        certificates[tokenId] = Certificate({
            certificateId: certificateId,
            ipfsURI: ipfsURI,
            issuedAt: block.timestamp,
            revoked: false
        });

        emit CertificateIssued(
            tokenId,
            recipient,
            certificateId,
            ipfsURI
        );

        return tokenId;
    }

    function revokeCertificate(uint256 tokenId)
        external
        onlyOwner
    {
        _requireOwned(tokenId);

        require(
            !certificates[tokenId].revoked,
            "Certificate already revoked"
        );

        certificates[tokenId].revoked = true;

        emit CertificateRevoked(tokenId);
    }

    function verifyCertificate(uint256 tokenId)
        external
        view
        returns (
            bool exists,
            bool revoked,
            address recipient,
            string memory certificateId,
            string memory ipfsURI,
            uint256 issuedAt
        )
    {
        address owner = _ownerOf(tokenId);

        if (owner == address(0)) {
            return (
                false,
                false,
                address(0),
                "",
                "",
                0
            );
        }

        Certificate memory cert = certificates[tokenId];

        return (
            true,
            cert.revoked,
            owner,
            cert.certificateId,
            cert.ipfsURI,
            cert.issuedAt
        );
    }

    // Make the certificate Soulbound (non-transferable).
    // Minting is allowed, but transferring between wallets is not.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0)) {
            revert("Certificate is Soulbound");
        }

        return super._update(to, tokenId, auth);
    }
}