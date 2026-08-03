package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.DocumentListItemResponse;
import com.vitabridge.backend.dto.DocumentListResponse;
import com.vitabridge.backend.dto.DocumentStorageInfoResponse;
import com.vitabridge.backend.model.Document;
import com.vitabridge.backend.model.Patient;
import com.vitabridge.backend.repository.DocumentRepository;
import com.vitabridge.backend.repository.PatientRepository;
import com.vitabridge.backend.repository.UserRepository;
import com.vitabridge.backend.util.TimezoneUtil;
import io.minio.*;
import io.minio.http.Method;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.net.URLConnection;

@Service
public class DocumentService {

    private static final Logger logger = LoggerFactory.getLogger(DocumentService.class);
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "fileName",
            "documentType",
            "fileSize",
            "uploadedAt",
            "issuedAt");

    private volatile boolean bucketInitialized = false;

    public static class DocumentContent {
        private final String fileName;
        private final String contentType;
        private final byte[] bytes;

        public DocumentContent(String fileName, String contentType, byte[] bytes) {
            this.fileName = fileName;
            this.contentType = contentType;
            this.bytes = bytes;
        }

        public String getFileName() {
            return fileName;
        }

        public String getContentType() {
            return contentType;
        }

        public byte[] getBytes() {
            return bytes;
        }
    }

    @Autowired
    private MinioClient minioClient;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private UserRepository userRepository;

    @Value("${minio.bucket-name}")
    private String bucketName;

    @Value("${documents.storage.total-bytes:524288000}")
    private long documentStorageTotalBytes;

    /**
     * Initialize MinIO bucket if it doesn't exist (cached after first check)
     */
    public void initializeBucket() {
        if (bucketInitialized) {
            return;
        }
        try {
            boolean exists = minioClient.bucketExists(BucketExistsArgs.builder()
                    .bucket(bucketName)
                    .build());

            if (!exists) {
                minioClient.makeBucket(MakeBucketArgs.builder()
                        .bucket(bucketName)
                        .build());
                logger.info("MinIO bucket created: {}", bucketName);
            }
            bucketInitialized = true;
        } catch (Exception e) {
            logger.error("Error initializing MinIO bucket: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to initialize storage bucket", e);
        }
    }

    /**
     * Upload a document for a patient
     */
    @Transactional
    public Document uploadDocument(String userEmail, MultipartFile file,
            Document.DocumentType documentType, String documentName, String issuedAtStr) {
        try {
            // Validate file
            validateFile(file);

            // Get patient
            var user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            Patient patient = patientRepository.findByUser(user)
                    .orElseThrow(() -> new RuntimeException("Patient not found"));

            Long currentUsedBytes = documentRepository.getTotalFileSizeByPatient(patient);
            long projectedUsage = (currentUsedBytes != null ? currentUsedBytes : 0L) + file.getSize();
            if (projectedUsage > documentStorageTotalBytes) {
                throw new IllegalArgumentException(
                        "Storage quota exceeded. Please delete existing files before uploading.");
            }

            // Initialize bucket
            initializeBucket();

            // Determine display file name
            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || !originalFilename.contains(".")) {
                throw new IllegalArgumentException("File must have a valid name with extension");
            }
            String extension = originalFilename.substring(originalFilename.lastIndexOf("."));

            String displayName;
            if (documentName != null && !documentName.isBlank()) {
                String trimmed = sanitizeDocumentName(documentName);
                displayName = trimmed.toLowerCase().endsWith(".pdf") ? trimmed : trimmed + ".pdf";
            } else {
                displayName = originalFilename;
            }

            // Check for duplicate name
            if (documentRepository.existsByPatientAndFileName(patient, displayName)) {
                throw new IllegalArgumentException(
                        "A document named '" + displayName + "' already exists. Please choose a different name.");
            }
            String uniqueFileName = String.format("%d_%s_%s%s",
                    patient.getPatientId(),
                    documentType.toString().toLowerCase(),
                    UUID.randomUUID().toString(),
                    extension);

            // Upload to MinIO
            try (InputStream inputStream = file.getInputStream()) {
                minioClient.putObject(
                        PutObjectArgs.builder()
                                .bucket(bucketName)
                                .object(uniqueFileName)
                                .stream(inputStream, file.getSize(), -1)
                                .contentType(file.getContentType())
                                .build());
            }

            logger.info("File uploaded to MinIO: {}", uniqueFileName);

            // Save document metadata to database
            Document document = new Document();
            document.setPatient(patient);
            document.setFileName(displayName);
            document.setFileUrl(uniqueFileName); // Store MinIO object name
            document.setDocumentType(documentType);
            document.setFileSize(file.getSize());
            document.setUploadedAt(TimezoneUtil.now());

            // Set issued date if provided
            if (issuedAtStr != null && !issuedAtStr.isBlank()) {
                Instant issuedAt = parseIssuedAt(issuedAtStr);
                if (issuedAt != null) {
                    document.setIssuedAt(issuedAt);
                } else {
                    logger.warn("Invalid issuedAt format: {}", issuedAtStr);
                }
            }

            Document savedDocument = documentRepository.save(document);
            logger.info("Document metadata saved to database: {}", savedDocument.getDocumentId());

            return savedDocument;
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error uploading document: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to upload document: " + e.getMessage(), e);
        }
    }

    /**
     * Get all documents for a patient
     */
    public List<Document> getPatientDocuments(String userEmail) {
        Patient patient = getPatientByEmail(userEmail);

        return documentRepository.findByPatientOrderByUploadedAtDesc(patient);
    }

    /**
     * Get documents by type for a patient
     */
    public List<Document> getPatientDocumentsByType(String userEmail,
            Document.DocumentType documentType) {
        Patient patient = getPatientByEmail(userEmail);

        return documentRepository.findByPatientAndDocumentTypeOrderByUploadedAtDesc(patient, documentType);
    }

    public DocumentListResponse queryPatientDocuments(
            String userEmail,
            Document.DocumentType documentType,
            String search,
            LocalDate uploadedFrom,
            LocalDate uploadedTo,
            LocalDate issuedFrom,
            LocalDate issuedTo,
            int page,
            int size,
            String sortField,
            String sortOrder) {

        Patient patient = getPatientByEmail(userEmail);

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        String safeSortField = ALLOWED_SORT_FIELDS.contains(sortField) ? sortField : "uploadedAt";
        Sort.Direction direction = "asc".equalsIgnoreCase(sortOrder) ? Sort.Direction.ASC : Sort.Direction.DESC;

        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(direction, safeSortField));

        Specification<Document> specification = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("patient"), patient));

            if (documentType != null) {
                predicates.add(cb.equal(root.get("documentType"), documentType));
            }

            if (search != null && !search.isBlank()) {
                predicates.add(
                        cb.like(
                                cb.lower(root.get("fileName")),
                                "%" + search.trim().toLowerCase(Locale.ROOT) + "%"));
            }

            if (uploadedFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("uploadedAt"), uploadedFrom.atStartOfDay()));
            }

            if (uploadedTo != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("uploadedAt"), uploadedTo.atTime(23, 59, 59)));
            }

            if (issuedFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("issuedAt"), issuedFrom.atStartOfDay()));
            }

            if (issuedTo != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("issuedAt"), issuedTo.atTime(23, 59, 59)));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Document> result = documentRepository.findAll(specification, pageable);

        List<DocumentListItemResponse> items = result.getContent().stream()
                .map(doc -> new DocumentListItemResponse(
                        doc.getDocumentId(),
                        doc.getFileName(),
                        doc.getDocumentType(),
                        doc.getFileSize(),
                        doc.getUploadedAt(),
                        doc.getIssuedAt(),
                        null))
                .toList();

        return new DocumentListResponse(
                items,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.hasNext(),
                result.hasPrevious());
    }

    public DocumentStorageInfoResponse getPatientStorageInfo(String userEmail) {
        Patient patient = getPatientByEmail(userEmail);

        long usedBytes = documentRepository.getTotalFileSizeByPatient(patient);
        int documentCount = (int) documentRepository.countByPatient(patient);
        long reportUsedBytes = documentRepository.getTotalFileSizeByPatientAndDocumentType(
                patient,
                Document.DocumentType.REPORT);
        int reportCount = (int) documentRepository.countByPatientAndDocumentType(
                patient,
                Document.DocumentType.REPORT);
        long prescriptionUsedBytes = documentRepository.getTotalFileSizeByPatientAndDocumentType(
                patient,
                Document.DocumentType.PRESCRIPTION);
        int prescriptionCount = (int) documentRepository.countByPatientAndDocumentType(
                patient,
                Document.DocumentType.PRESCRIPTION);

        return new DocumentStorageInfoResponse(
                usedBytes,
                documentStorageTotalBytes,
                documentCount,
                reportUsedBytes,
                reportCount,
                prescriptionUsedBytes,
                prescriptionCount);
    }

    /**
     * Get a presigned URL for downloading a document
     */
    public String getDocumentDownloadUrl(String userEmail, Integer documentId) {
        try {
            Document document = getOwnedDocumentOrThrow(userEmail, documentId);

            // Generate presigned URL (valid for 1 hour)
            String url = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucketName)
                            .object(document.getFileUrl())
                            .expiry(1, TimeUnit.HOURS)
                            .build());

            logger.info("Generated download URL for document: {}", documentId);
            return url;

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error generating download URL: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to generate download URL: " + e.getMessage(), e);
        }
    }

    /**
     * Stream document bytes through backend so frontend does not depend on
     * storage CORS/content-type behavior for opening/downloading files.
     */
    public DocumentContent getDocumentContent(String userEmail, Integer documentId) {
        try {
            Document document = getOwnedDocumentOrThrow(userEmail, documentId);

            String contentType = resolveContentType(document);
            String fileName = (document.getFileName() == null || document.getFileName().isBlank())
                    ? ("document-" + documentId)
                    : document.getFileName();

            byte[] bytes;
            try (InputStream stream = minioClient.getObject(
                    GetObjectArgs.builder()
                            .bucket(bucketName)
                            .object(document.getFileUrl())
                            .build())) {
                bytes = stream.readAllBytes();
            }

            if (bytes == null || bytes.length == 0) {
                throw new RuntimeException("Document content is empty");
            }

            return new DocumentContent(fileName, contentType, bytes);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error reading document content: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to load document content", e);
        }
    }

    /**
     * Update document metadata (name and/or issued date) for an owned document.
     */
    @Transactional
    public Document updateDocumentMetadata(String userEmail, Integer documentId, String documentName, String issuedAtStr) {
        Document document = getOwnedDocumentOrThrow(userEmail, documentId);
        boolean updated = false;

        if (documentName != null) {
            String sanitizedName = sanitizeDocumentName(documentName);
            String normalizedName = sanitizedName.toLowerCase(Locale.ROOT).endsWith(".pdf")
                    ? sanitizedName
                    : sanitizedName + ".pdf";

            if (!normalizedName.equalsIgnoreCase(document.getFileName())
                    && documentRepository.existsByPatientAndFileNameAndDocumentIdNot(
                            document.getPatient(),
                            normalizedName,
                            documentId)) {
                throw new IllegalArgumentException(
                        "A document named '" + normalizedName + "' already exists. Please choose a different name.");
            }

            document.setFileName(normalizedName);
            updated = true;
        }

        if (issuedAtStr != null) {
            if (issuedAtStr.isBlank()) {
                document.setIssuedAt(null);
            } else {
                Instant parsedIssuedAt = parseIssuedAt(issuedAtStr);
                if (parsedIssuedAt == null) {
                    throw new IllegalArgumentException("Invalid issued date format");
                }
                document.setIssuedAt(parsedIssuedAt);
            }
            updated = true;
        }

        if (!updated) {
            throw new IllegalArgumentException("No metadata changes provided");
        }

        return documentRepository.save(document);
    }

    /**
     * Delete a document
     */
    @Transactional
    public boolean deleteDocument(String userEmail, Integer documentId) {
        try {
            Document document = documentRepository.findById(documentId).orElse(null);

            if (document == null) {
                logger.info("Delete called for already-absent document: {}", documentId);
                return false;
            }

            Patient patient = getPatientByEmail(userEmail);
            if (!document.getPatient().getPatientId().equals(patient.getPatientId())) {
                throw new SecurityException("Unauthorized access to document");
            }

            // Delete from MinIO
            try {
                minioClient.removeObject(
                        RemoveObjectArgs.builder()
                                .bucket(bucketName)
                                .object(document.getFileUrl())
                                .build());
                logger.info("File deleted from MinIO: {}", document.getFileUrl());
            } catch (Exception storageError) {
                logger.warn("Failed to delete object from storage for document {}: {}", documentId,
                        storageError.getMessage());
            }

            // Delete from database
            documentRepository.delete(document);
            logger.info("Document deleted from database: {}", documentId);
            return true;

        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error deleting document: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to delete document: " + e.getMessage(), e);
        }
    }

    private Patient getPatientByEmail(String userEmail) {
        var user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return patientRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("Patient not found"));
    }

    private Document getOwnedDocumentOrThrow(String userEmail, Integer documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found"));

        Patient patient = getPatientByEmail(userEmail);

        if (!document.getPatient().getPatientId().equals(patient.getPatientId())) {
            throw new SecurityException("Unauthorized access to document");
        }

        return document;
    }

    private String sanitizeDocumentName(String rawName) {
        String trimmed = rawName == null ? "" : rawName.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Document name cannot be empty");
        }

        String normalized = trimmed
                .replaceAll("[\\\\/:*?\"<>|]", " ")
                .replaceAll("\\s+", " ")
                .trim();

        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Document name contains invalid characters");
        }

        if (normalized.length() > 180) {
            normalized = normalized.substring(0, 180).trim();
        }

        return normalized;
    }

    private String resolveContentType(Document document) {
        if (document == null || document.getFileUrl() == null || document.getFileUrl().isBlank()) {
            return "application/octet-stream";
        }

        try {
            StatObjectResponse stat = minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(bucketName)
                            .object(document.getFileUrl())
                            .build());

            String statContentType = stat.contentType();
            if (isSpecificContentType(statContentType)) {
                return statContentType;
            }
        } catch (Exception ignored) {
            // Fallback to extension-based content type.
        }

        String guessed = URLConnection.guessContentTypeFromName(document.getFileName());
        if (isSpecificContentType(guessed)) {
            return guessed;
        }

        String fileName = document.getFileName() == null ? "" : document.getFileName().toLowerCase(Locale.ROOT);
        if (fileName.endsWith(".pdf")) {
            return "application/pdf";
        }

        return "application/octet-stream";
    }

    private boolean isSpecificContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return false;
        }

        String normalized = contentType.toLowerCase(Locale.ROOT);
        return !normalized.equals("application/octet-stream")
                && !normalized.equals("application/download");
    }

    /**
     * Parse issuedAt from UI payload in common ISO formats.
     */
    private Instant parseIssuedAt(String issuedAtStr) {
        try {
            return Instant.parse(issuedAtStr);
        } catch (Exception ignored) {
            // Try offset-aware format (e.g. 2026-03-26T00:00:00Z)
        }

        try {
            return OffsetDateTime.parse(issuedAtStr).toInstant();
        } catch (Exception ignored) {
            // Try date-only format (e.g. 2026-03-26)
        }

        try {
            return LocalDate.parse(issuedAtStr).atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * Validate uploaded file
     */
    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds 10MB limit");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.equals("application/pdf")) {
            throw new IllegalArgumentException("Only PDF files are allowed");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || !originalFilename.toLowerCase().endsWith(".pdf")) {
            throw new IllegalArgumentException("Only PDF files are allowed");
        }
    }
}
