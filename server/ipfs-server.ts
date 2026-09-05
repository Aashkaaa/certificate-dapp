import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { PinataSDK } from "pinata";

const app = express();

const PORT = Number(process.env.PORT) || 3001;

// Production frontend URL, e.g.
// https://credchain.vercel.app
const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

// Allow local development + deployed frontend
const allowedOrigins = [
  "http://localhost:5173",
  FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header
      // (health checks, curl, server-to-server requests)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked request from origin: ${origin}`)
      );
    },
    methods: ["GET", "POST", "OPTIONS"],
  })
);

app.use(express.json());

// =====================================================
// ENVIRONMENT CHECK
// =====================================================

if (!process.env.PINATA_JWT) {
  throw new Error(
    "PINATA_JWT environment variable is missing."
  );
}

if (!process.env.GATEWAY_URL) {
  throw new Error(
    "GATEWAY_URL environment variable is missing."
  );
}

// =====================================================
// FILE UPLOAD CONFIG
// =====================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new Error(
          "Only PDF, PNG, JPG and JPEG certificate files are allowed."
        )
      );
    }

    callback(null, true);
  },
});

// =====================================================
// PINATA
// =====================================================

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.GATEWAY_URL,
});

// =====================================================
// SERVER / HEALTH CHECK
// =====================================================

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "CredChain IPFS server is running",
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "CredChain IPFS API",
  });
});

// =====================================================
// UPLOAD CERTIFICATE + METADATA
// =====================================================

app.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      // -------------------------------------------------
      // 1. Check certificate file
      // -------------------------------------------------

      if (!req.file) {
        return res.status(400).json({
          error: "No certificate file uploaded.",
        });
      }

      // -------------------------------------------------
      // 2. Read metadata sent by frontend
      // -------------------------------------------------

      const {
        studentName,
        course,
        issuerName,
        certificateId,
        recipient,
      } = req.body;

      if (
        !studentName ||
        !course ||
        !issuerName ||
        !certificateId ||
        !recipient
      ) {
        return res.status(400).json({
          error:
            "Student name, course, issuer name, certificate ID and recipient are required.",
        });
      }

      // -------------------------------------------------
      // 3. Upload original certificate file to IPFS
      // -------------------------------------------------

      console.log(
        "Uploading certificate file to IPFS..."
      );

      const certificateFile = new File(
        [req.file.buffer],
        req.file.originalname,
        {
          type: req.file.mimetype,
        }
      );

      const certificateUpload =
        await pinata.upload.public.file(
          certificateFile
        );

      const certificateFileCID =
        certificateUpload.cid;

      const certificateFileURI =
        `ipfs://${certificateFileCID}`;

      console.log(
        "Certificate file uploaded:",
        certificateFileCID
      );

      // -------------------------------------------------
      // 4. Create structured certificate metadata
      // -------------------------------------------------

      const metadata = {
        schemaVersion: "1.0",

        studentName: studentName.trim(),

        course: course.trim(),

        issuer: issuerName.trim(),

        certificateId:
          certificateId.trim(),

        recipient: recipient.trim(),

        issueDate:
          new Date().toISOString(),

        certificateFile: {
          name: req.file.originalname,
          mimeType: req.file.mimetype,
          cid: certificateFileCID,
          uri: certificateFileURI,
        },
      };

      // -------------------------------------------------
      // 5. Convert metadata JSON into IPFS file
      // -------------------------------------------------

      const metadataJSON =
        JSON.stringify(
          metadata,
          null,
          2
        );

      const safeCertificateId =
        certificateId
          .trim()
          .replace(
            /[^a-zA-Z0-9-_]/g,
            "-"
          );

      const metadataFile =
        new File(
          [metadataJSON],
          `${safeCertificateId}-metadata.json`,
          {
            type: "application/json",
          }
        );

      console.log(
        "Uploading metadata to IPFS..."
      );

      // -------------------------------------------------
      // 6. Upload metadata JSON
      // -------------------------------------------------

      const metadataUpload =
        await pinata.upload.public.file(
          metadataFile
        );

      const metadataCID =
        metadataUpload.cid;

      const metadataURI =
        `ipfs://${metadataCID}`;

      console.log(
        "Metadata uploaded:",
        metadataCID
      );

      // -------------------------------------------------
      // 7. Return result to frontend
      // -------------------------------------------------

      return res.json({
        success: true,

        // Frontend stores THIS metadata URI
        // inside the smart contract.
        cid: metadataCID,
        ipfsURI: metadataURI,

        metadataCID,
        metadataURI,

        certificateFileCID,
        certificateFileURI,

        fileName:
          req.file.originalname,

        metadata,
      });
    } catch (error) {
      console.error(
        "IPFS upload error:",
        error
      );

      if (error instanceof Error) {
        return res.status(500).json({
          error:
            error.message ||
            "Certificate or metadata IPFS upload failed.",
        });
      }

      return res.status(500).json({
        error:
          "Certificate or metadata IPFS upload failed.",
      });
    }
  }
);

// =====================================================
// MULTER / SERVER ERROR HANDLER
// =====================================================

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(
      "Server error:",
      error
    );

    if (
      error instanceof multer.MulterError
    ) {
      if (
        error.code === "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          error:
            "Certificate file must be 10 MB or smaller.",
        });
      }

      return res.status(400).json({
        error: error.message,
      });
    }

    if (error instanceof Error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: "Unexpected server error.",
    });
  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `CredChain IPFS server running on port ${PORT}`
  );

  console.log(
    `Allowed frontend origin: ${FRONTEND_URL}`
  );
});
