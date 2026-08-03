package com.vitabridge.backend.dto;

public class DocumentStorageInfoResponse {

    private long usedBytes;
    private long totalBytes;
    private long remainingBytes;
    private int usagePercentage;
    private int documentCount;
    private long reportUsedBytes;
    private int reportCount;
    private long prescriptionUsedBytes;
    private int prescriptionCount;

    public DocumentStorageInfoResponse(long usedBytes, long totalBytes, int documentCount,
            long reportUsedBytes, int reportCount,
            long prescriptionUsedBytes, int prescriptionCount) {
        this.usedBytes = usedBytes;
        this.totalBytes = totalBytes;
        this.remainingBytes = Math.max(totalBytes - usedBytes, 0);
        this.usagePercentage = totalBytes > 0
                ? (int) Math.min(Math.round((usedBytes * 100.0) / totalBytes), 100)
                : 0;
        this.documentCount = documentCount;
        this.reportUsedBytes = reportUsedBytes;
        this.reportCount = reportCount;
        this.prescriptionUsedBytes = prescriptionUsedBytes;
        this.prescriptionCount = prescriptionCount;
    }

    public long getUsedBytes() {
        return usedBytes;
    }

    public long getTotalBytes() {
        return totalBytes;
    }

    public long getRemainingBytes() {
        return remainingBytes;
    }

    public int getUsagePercentage() {
        return usagePercentage;
    }

    public int getDocumentCount() {
        return documentCount;
    }

    public long getReportUsedBytes() {
        return reportUsedBytes;
    }

    public int getReportCount() {
        return reportCount;
    }

    public long getPrescriptionUsedBytes() {
        return prescriptionUsedBytes;
    }

    public int getPrescriptionCount() {
        return prescriptionCount;
    }
}