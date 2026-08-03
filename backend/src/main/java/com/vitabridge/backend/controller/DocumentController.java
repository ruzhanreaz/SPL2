package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.DocumentListResponse;
import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.model.Document;
import com.vitabridge.backend.service.DocumentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * REST Controller for patient document management.
 * Handles document upload, retrieval, and deletion with MinIO storage.
 */
@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private static final Logger logger = LoggerFactory.getLogger(DocumentController.class);

    @Autowired
    private DocumentService documentService;

    /**
     * Upload a new document
     */
    @PostMapping("/upload")
    public ResponseEntity<?> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam("documentType") String documentType,
            @RequestParam(value = "documentName", required = false) String documentName,
            @RequestParam(value = "issuedAt", required = false) String issuedAt) {
        try {
            String email = getCurrentUserEmail();
            logger.info("Upload request from user: {}, type: {}", email, documentType);

            Document.DocumentType type = parseDocumentType(documentType);

            Document document = documentService.uploadDocument(email, file, type, documentName, issuedAt);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Document uploaded successfully");
            response.put("document", document);

            logger.info("Document uploaded successfully: {}", document.getDocumentId());
            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            logger.warn("Validation error: {}", e.getMessage());
            return ResponseEntity
                    .badRequest()
                    .body(new ErrorResponse("VALIDATION_ERROR", e.getMessage()));

        } catch (Exception e) {
            logger.error("Error uploading document: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("UPLOAD_ERROR",
                            "Failed to upload document. Please try again."));
        }
    }

    /**
     * Query documents with server-side filtering, sorting, and pagination.
     */
    @GetMapping("/query")
    public ResponseEntity<?> queryDocuments(
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate uploadedFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate uploadedTo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate issuedFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate issuedTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "uploadedAt") String sortField,
            @RequestParam(defaultValue = "desc") String sortOrder) {
        try {
            String email = getCurrentUserEmail();

            Document.DocumentType type = null;
            if (documentType != null && !documentType.isBlank()) {
                type = parseDocumentType(documentType);
            }

            DocumentListResponse response = documentService.queryPatientDocuments(
                    email,
                    type,
                    q,
                    uploadedFrom,
                    uploadedTo,
                    issuedFrom,
                    issuedTo,
                    page,
                    size,
                    sortField,
                    sortOrder);
            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            return ResponseEntity
                    .badRequest()
                    .body(new ErrorResponse("INVALID_TYPE", e.getMessage()));
        } catch (Exception e) {
            logger.error("Error querying documents: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("QUERY_ERROR", "Failed to query documents. Please try again."));
        }
    }

    /**
     * Get all documents for the current patient
     */
    @GetMapping
    public ResponseEntity<?> getDocuments(
            @RequestParam(required = false) String documentType) {
        try {
            String email = getCurrentUserEmail();
            logger.info("Get documents request from user: {}, type: {}", email, documentType);

            List<Document> documents;

            if (documentType != null && !documentType.isEmpty()) {
                Document.DocumentType type = parseDocumentType(documentType);
                documents = documentService.getPatientDocumentsByType(email, type);
            } else {
                // Get all documents
                documents = documentService.getPatientDocuments(email);
            }

            logger.info("Retrieved {} documents for user: {}", documents.size(), email);
            return ResponseEntity.ok(documents);

        } catch (IllegalArgumentException e) {
            return ResponseEntity
                    .badRequest()
                    .body(new ErrorResponse("INVALID_TYPE", e.getMessage()));
        } catch (Exception e) {
            logger.error("Error retrieving documents: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("RETRIEVAL_ERROR",
                            "Failed to retrieve documents. Please try again."));
        }
    }

    /**
     * Get storage usage info for the current patient documents.
     */
    @GetMapping("/storage-info")
    public ResponseEntity<?> getStorageInfo() {
        try {
            String email = getCurrentUserEmail();
            logger.info("Storage info request from user: {}", email);

            return ResponseEntity.ok(documentService.getPatientStorageInfo(email));

        } catch (Exception e) {
            logger.error("Error retrieving storage info: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("STORAGE_INFO_ERROR",
                            "Failed to retrieve storage info. Please try again."));
        }
    }

    /**
     * Get a presigned download URL for a document
     */
    @GetMapping("/{documentId}/download-url")
    public ResponseEntity<?> getDownloadUrl(@PathVariable Integer documentId) {
        try {
            String email = getCurrentUserEmail();
            logger.info("Download URL request from user: {} for document: {}", email, documentId);

            String downloadUrl = documentService.getDocumentDownloadUrl(email, documentId);

            Map<String, String> response = new HashMap<>();
            response.put("downloadUrl", downloadUrl);

            logger.info("Generated download URL for document: {}", documentId);
            return ResponseEntity.ok(response);

        } catch (SecurityException e) {
            return ResponseEntity
                    .status(HttpStatus.FORBIDDEN)
                    .body(new ErrorResponse("FORBIDDEN", "Access denied"));
        } catch (RuntimeException e) {
            logger.warn("Error generating download URL: {}", e.getMessage());
            return mapDocumentRuntimeError(e, "DOWNLOAD_ERROR", "Failed to generate download URL");

        } catch (Exception e) {
            logger.error("Error generating download URL: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("DOWNLOAD_ERROR",
                            "Failed to generate download URL"));
        }
    }

    /**
     * Get raw document bytes via backend with auth and normalized content type.
     */
    @GetMapping("/{documentId}/content")
    public ResponseEntity<?> getDocumentContent(
            @PathVariable Integer documentId,
            @RequestParam(value = "download", required = false, defaultValue = "false") boolean download) {
        try {
            String email = getCurrentUserEmail();
            DocumentService.DocumentContent content = documentService.getDocumentContent(email, documentId);

            String safeFileName = (content.getFileName() == null || content.getFileName().isBlank())
                    ? ("document-" + documentId)
                    : content.getFileName().replace("\"", "");
            String dispositionType = download ? "attachment" : "inline";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            dispositionType + "; filename=\"" + safeFileName + "\"")
                    .contentType(MediaType.parseMediaType(content.getContentType()))
                    .body(content.getBytes());
        } catch (SecurityException e) {
            return ResponseEntity
                    .status(HttpStatus.FORBIDDEN)
                    .body(new ErrorResponse("FORBIDDEN", "Access denied"));
        } catch (RuntimeException e) {
            logger.warn("Error loading document content: {}", e.getMessage());
            return mapDocumentRuntimeError(e, "CONTENT_ERROR", "Failed to load document content");
        } catch (Exception e) {
            logger.error("Error loading document content: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("CONTENT_ERROR", "Failed to load document content"));
        }
    }

    /**
     * Update document metadata (rename and/or issued date).
     */
    @PatchMapping("/{documentId}/metadata")
    public ResponseEntity<?> updateDocumentMetadata(
            @PathVariable Integer documentId,
            @RequestBody Map<String, String> payload) {
        try {
            String email = getCurrentUserEmail();
            String documentName = payload != null && payload.containsKey("documentName")
                    ? payload.get("documentName")
                    : null;
            String issuedAt = payload != null && payload.containsKey("issuedAt")
                    ? payload.get("issuedAt")
                    : null;

            Document updated = documentService.updateDocumentMetadata(email, documentId, documentName, issuedAt);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Document metadata updated successfully");
            response.put("document", updated);
            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            return ResponseEntity
                    .badRequest()
                    .body(new ErrorResponse("VALIDATION_ERROR", e.getMessage()));
        } catch (SecurityException e) {
            return ResponseEntity
                    .status(HttpStatus.FORBIDDEN)
                    .body(new ErrorResponse("FORBIDDEN", "Access denied"));
        } catch (RuntimeException e) {
            logger.warn("Error updating document metadata: {}", e.getMessage());
            return mapDocumentRuntimeError(e, "UPDATE_ERROR", "Failed to update document metadata");
        } catch (Exception e) {
            logger.error("Error updating document metadata: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("UPDATE_ERROR", "Failed to update document metadata"));
        }
    }

    /**
     * Delete a document
     */
    @DeleteMapping("/{documentId}")
    public ResponseEntity<?> deleteDocument(@PathVariable Integer documentId) {
        try {
            String email = getCurrentUserEmail();
            logger.info("Delete request from user: {} for document: {}", email, documentId);

            boolean deleted = documentService.deleteDocument(email, documentId);

            Map<String, String> response = new HashMap<>();
            response.put("message", deleted
                    ? "Document deleted successfully"
                    : "Document was already deleted");

            logger.info("Delete completed for document {} (deleted={})", documentId, deleted);
            return ResponseEntity.ok(response);

        } catch (SecurityException e) {
            logger.warn("Unauthorized delete attempt for document {}", documentId);
            return ResponseEntity
                    .status(HttpStatus.FORBIDDEN)
                    .body(new ErrorResponse("FORBIDDEN", "Access denied"));
        } catch (RuntimeException e) {
            logger.warn("Error deleting document: {}", e.getMessage());
            return mapDocumentRuntimeError(e, "DELETE_ERROR", "Failed to delete document");

        } catch (Exception e) {
            logger.error("Error deleting document: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("DELETE_ERROR",
                            "Failed to delete document"));
        }
    }

    private String getCurrentUserEmail() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    private ResponseEntity<ErrorResponse> mapDocumentRuntimeError(
            RuntimeException e,
            String fallbackCode,
            String fallbackMessage) {
        String message = e.getMessage();
        if (message != null && message.toLowerCase(Locale.ROOT).contains("not found")) {
            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", "Document not found"));
        }

        if (message != null && message.toLowerCase(Locale.ROOT).contains("unauthorized")) {
            return ResponseEntity
                    .status(HttpStatus.FORBIDDEN)
                    .body(new ErrorResponse("FORBIDDEN", "Access denied"));
        }

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse(fallbackCode, fallbackMessage));
    }

    private Document.DocumentType parseDocumentType(String documentType) {
        try {
            return Document.DocumentType.valueOf(documentType.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Document type must be REPORT or PRESCRIPTION");
        }
    }
}
