package com.vitabridge.backend.dto;

import com.vitabridge.backend.model.Document;

import java.time.Instant;

public class DocumentListItemResponse {
    private Integer documentId;
    private String fileName;
    private Document.DocumentType documentType;
    private Long fileSize;
    private Instant uploadedAt;
    private Instant issuedAt;
    private String uploadedBy;

    public DocumentListItemResponse() {
    }

    public DocumentListItemResponse(
            Integer documentId,
            String fileName,
            Document.DocumentType documentType,
            Long fileSize,
            Instant uploadedAt,
            Instant issuedAt,
            String uploadedBy) {
        this.documentId = documentId;
        this.fileName = fileName;
        this.documentType = documentType;
        this.fileSize = fileSize;
        this.uploadedAt = uploadedAt;
        this.issuedAt = issuedAt;
        this.uploadedBy = uploadedBy;
    }

    public Integer getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Integer documentId) {
        this.documentId = documentId;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public Document.DocumentType getDocumentType() {
        return documentType;
    }

    public void setDocumentType(Document.DocumentType documentType) {
        this.documentType = documentType;
    }

    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }

    public Instant getUploadedAt() {
        return uploadedAt;
    }

    public void setUploadedAt(Instant uploadedAt) {
        this.uploadedAt = uploadedAt;
    }

    public Instant getIssuedAt() {
        return issuedAt;
    }

    public void setIssuedAt(Instant issuedAt) {
        this.issuedAt = issuedAt;
    }

    public String getUploadedBy() {
        return uploadedBy;
    }

    public void setUploadedBy(String uploadedBy) {
        this.uploadedBy = uploadedBy;
    }
}
