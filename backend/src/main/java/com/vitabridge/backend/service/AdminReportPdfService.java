package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.AppointmentResponse;
import com.vitabridge.backend.util.TimezoneUtil;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AdminReportPdfService {

    private static final PDType1Font FONT_REGULAR = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDType1Font FONT_BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

    private static final float PAGE_MARGIN = 42f;
    private static final float METRIC_ROW_HEIGHT = 19f;

    private static final Color HEADER_BG = new Color(28, 65, 113);
    private static final Color SECTION_BG = new Color(237, 242, 247);
    private static final Color ONLINE_BG = new Color(219, 234, 254);
    private static final Color OFFLINE_BG = new Color(237, 233, 254);
    private static final Color BORDER = new Color(205, 214, 227);
    private static final Color TEXT_DARK = new Color(34, 38, 44);
    private static final Color TEXT_MUTED = new Color(103, 116, 132);

    public byte[] generateDailyReportPdf(
            LocalDate date,
            Map<String, Object> reportData,
            List<AppointmentResponse> appointments,
            String generatedByEmail
    ) {
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);

            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                float pageWidth = page.getMediaBox().getWidth();
                float contentWidth = pageWidth - (PAGE_MARGIN * 2f);
                float y = page.getMediaBox().getHeight() - PAGE_MARGIN;

                y = drawHeader(content, PAGE_MARGIN, y, contentWidth, date);
                y -= 12f;

                String generatedAt = TimezoneUtil.instantToISO8601(TimezoneUtil.now()).substring(0, 16);
                // Format: YYYY-MM-DD HH:mm
                y = drawMetaBox(
                        content,
                        PAGE_MARGIN,
                        y,
                        contentWidth,
                    truncate(generatedByEmail != null ? generatedByEmail : "System", 64),
                    generatedAt,
                    truncate(String.valueOf(reportData.getOrDefault("selectedDoctorName", "All Doctors")), 64)
                );

                y -= 12f;
                y = drawSection(
                        content,
                        PAGE_MARGIN,
                        y,
                        contentWidth,
                        "Summary Metrics",
                        new String[][]{
                                {"Total Appointments", formatWhole(reportData.get("totalAppointments"))},
                                {"Confirmed Appointments", formatWhole(reportData.get("confirmedAppointments"))},
                                {"Pending Appointments", formatWhole(reportData.get("pendingAppointments"))},
                                {"Completed Appointments", formatWhole(reportData.get("completedAppointments"))},
                                {"Cancelled Appointments", formatWhole(reportData.get("cancelledAppointments"))},
                                {"No-show Appointments", formatWhole(reportData.get("noShowAppointments"))}
                        }
                );

                        y -= 10f;
                        y = drawDoctorWiseSection(
                            content,
                            PAGE_MARGIN,
                            y,
                            contentWidth,
                            getDoctorWiseRows(reportData.get("doctorWiseReport"))
                        );

                        List<AppointmentResponse> sortedAppointments = new ArrayList<>(appointments != null ? appointments : List.of());
                        sortedAppointments.sort(Comparator
                            .comparing((AppointmentResponse a) -> safe(a.getDoctorName()))
                            .thenComparing(a -> safe(a.getPatientName())));

                        List<AppointmentResponse> online = sortedAppointments.stream()
                            .filter(a -> "ONLINE".equalsIgnoreCase(safe(a.getAppointmentType())))
                            .collect(Collectors.toList());

                        List<AppointmentResponse> offline = sortedAppointments.stream()
                            .filter(a -> !"ONLINE".equalsIgnoreCase(safe(a.getAppointmentType())))
                            .collect(Collectors.toList());

                y -= 10f;
                        y = drawConsultationSection(
                        content,
                        PAGE_MARGIN,
                        y,
                        contentWidth,
                            "Online Consultations",
                            online,
                            ONLINE_BG
                        );

                        y -= 10f;
                        y = drawConsultationSection(
                            content,
                            PAGE_MARGIN,
                            y,
                            contentWidth,
                            "Offline Consultations",
                            offline,
                            OFFLINE_BG
                );

                y -= 10f;
                y = drawSection(
                        content,
                        PAGE_MARGIN,
                        y,
                        contentWidth,
                        "Financial Snapshot",
                        new String[][]{
                                {"Estimated Revenue", formatCurrency(reportData.get("estimatedRevenue"))},
                                {"Collection Rate", formatPercent(reportData.get("collectionRate"))}
                        }
                );

                y -= 10f;
                y = drawSection(
                        content,
                        PAGE_MARGIN,
                        y,
                        contentWidth,
                        "Platform Capacity",
                        new String[][]{
                                {"Total Users", formatWhole(reportData.get("totalUsers"))},
                                {"Total Doctors", formatWhole(reportData.get("totalDoctors"))},
                                {"Total Assistants", formatWhole(reportData.get("totalAssistants"))}
                        }
                );

                y -= 14f;
                writeText(
                        content,
                        "Generated from live system data for administrative planning and operational review.",
                        PAGE_MARGIN,
                        y,
                        FONT_REGULAR,
                        9f,
                        TEXT_MUTED
                );
            }

            document.save(outputStream);
            return outputStream.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate report PDF", e);
        }
    }

    private float drawHeader(PDPageContentStream content, float x, float y, float width, LocalDate date)
            throws IOException {
        float headerHeight = 64f;
        float bottom = y - headerHeight;

        content.setNonStrokingColor(HEADER_BG);
        content.addRect(x, bottom, width, headerHeight);
        content.fill();

        writeText(content, "VitaBridge Daily Report", x + 16f, y - 24f, FONT_BOLD, 18f, Color.WHITE);
        writeText(content, "Operational Snapshot for " + date, x + 16f, y - 43f, FONT_REGULAR, 11f, Color.WHITE);

        return bottom;
    }

    private float drawMetaBox(
            PDPageContentStream content,
            float x,
            float y,
            float width,
            String generatedBy,
            String generatedAt,
            String selectedDoctor
    ) throws IOException {
        float boxHeight = 72f;
        float bottom = y - boxHeight;

        content.setStrokingColor(BORDER);
        content.addRect(x, bottom, width, boxHeight);
        content.stroke();

        writeText(content, "Generated By: " + generatedBy, x + 12f, y - 20f, FONT_REGULAR, 10.5f, TEXT_DARK);
        writeText(content, "Generated At: " + generatedAt, x + 12f, y - 38f, FONT_REGULAR, 10.5f, TEXT_DARK);
        writeText(content, "Doctor Filter: " + safe(selectedDoctor), x + 12f, y - 56f, FONT_REGULAR, 10.5f, TEXT_DARK);

        return bottom;
    }

    private float drawSection(
            PDPageContentStream content,
            float x,
            float y,
            float width,
            String title,
            String[][] rows
    ) throws IOException {
        float titleHeight = 22f;
        float sectionTop = y;

        content.setNonStrokingColor(SECTION_BG);
        content.addRect(x, sectionTop - titleHeight, width, titleHeight);
        content.fill();

        content.setStrokingColor(BORDER);
        content.addRect(x, sectionTop - titleHeight, width, titleHeight);
        content.stroke();

        writeText(content, title, x + 10f, sectionTop - 15.5f, FONT_BOLD, 11f, TEXT_DARK);

        float currentY = sectionTop - titleHeight;
        for (String[] row : rows) {
            float rowBottom = currentY - METRIC_ROW_HEIGHT;

            content.setStrokingColor(BORDER);
            content.addRect(x, rowBottom, width, METRIC_ROW_HEIGHT);
            content.stroke();

            writeText(content, row[0], x + 10f, currentY - 13f, FONT_REGULAR, 10.5f, TEXT_DARK);
            writeRightAlignedText(content, row[1], x + width - 10f, currentY - 13f, FONT_BOLD, 10.5f, TEXT_DARK);

            currentY = rowBottom;
        }

        return currentY;
    }

    private float drawConsultationSection(
            PDPageContentStream content,
            float x,
            float y,
            float width,
            String title,
            List<AppointmentResponse> rows,
            Color titleBg
    ) throws IOException {
        float titleHeight = 22f;
        float rowHeight = 15f;
        float sectionTop = y;

        content.setNonStrokingColor(titleBg);
        content.addRect(x, sectionTop - titleHeight, width, titleHeight);
        content.fill();

        content.setStrokingColor(BORDER);
        content.addRect(x, sectionTop - titleHeight, width, titleHeight);
        content.stroke();

        writeText(content, title + " (" + rows.size() + ")", x + 10f, sectionTop - 15.5f, FONT_BOLD, 11f, TEXT_DARK);

        String[] header = {"#", "Doctor", "Patient", "Phone", "Status", "Payment"};
        float[] colRatio = {0.06f, 0.24f, 0.24f, 0.16f, 0.15f, 0.15f};

        float currentY = sectionTop - titleHeight;
        currentY = drawTableRow(content, x, currentY, width, rowHeight, colRatio, header, true);

        if (rows.isEmpty()) {
            return drawTableRow(
                    content,
                    x,
                    currentY,
                    width,
                    rowHeight,
                    new float[]{1f},
                    new String[]{"No consultations found for this category."},
                    false
            );
        }

        int index = 1;
        for (AppointmentResponse appointment : rows) {
            String payment = "PAYMENT_PENDING".equalsIgnoreCase(safe(appointment.getStatus())) ? "PENDING" : "COMPLETED";
            String[] data = {
                    String.valueOf(index++),
                    truncate(safe(appointment.getDoctorName()), 24),
                    truncate(safe(appointment.getPatientName()), 24),
                    truncate(safe(appointment.getPatientPhone()), 15),
                    truncate(safe(appointment.getStatus()), 14),
                    payment
            };
            currentY = drawTableRow(content, x, currentY, width, rowHeight, colRatio, data, false);
        }

        return currentY;
    }

    private float drawDoctorWiseSection(
            PDPageContentStream content,
            float x,
            float y,
            float width,
            List<Map<String, Object>> rows
    ) throws IOException {
        float titleHeight = 22f;
        float rowHeight = 15.5f;
        float sectionTop = y;
        List<Map<String, Object>> visibleRows = rows != null ? rows.stream().limit(8).collect(Collectors.toList()) : List.of();

        content.setNonStrokingColor(SECTION_BG);
        content.addRect(x, sectionTop - titleHeight, width, titleHeight);
        content.fill();

        content.setStrokingColor(BORDER);
        content.addRect(x, sectionTop - titleHeight, width, titleHeight);
        content.stroke();

        writeText(content, "Doctor-wise Summary (Top " + visibleRows.size() + ")", x + 10f, sectionTop - 15.5f,
                FONT_BOLD, 11f, TEXT_DARK);

        String[] header = {"Doctor", "Total", "Confirmed", "Completed", "Pending", "Revenue"};
        float[] colRatio = {0.32f, 0.10f, 0.14f, 0.14f, 0.12f, 0.18f};

        float currentY = sectionTop - titleHeight;
        currentY = drawTableRow(content, x, currentY, width, rowHeight, colRatio, header, true);

        if (visibleRows.isEmpty()) {
            return drawTableRow(
                    content,
                    x,
                    currentY,
                    width,
                    rowHeight,
                    new float[]{1f},
                    new String[]{"No doctor-wise activity found for this date."},
                    false
            );
        }

        for (Map<String, Object> doctorRow : visibleRows) {
            String[] data = {
                    truncate((String) doctorRow.get("doctorName"), 24),
                    formatWhole(doctorRow.get("totalAppointments")),
                    formatWhole(doctorRow.get("confirmedAppointments")),
                    formatWhole(doctorRow.get("completedAppointments")),
                    formatWhole(doctorRow.get("pendingAppointments")),
                    formatCurrency(doctorRow.get("estimatedRevenue"))
            };
            currentY = drawTableRow(content, x, currentY, width, rowHeight, colRatio, data, false);
        }

        if (rows != null && rows.size() > visibleRows.size()) {
            currentY -= 8f;
            writeText(
                    content,
                    "Showing the top " + visibleRows.size() + " doctors by appointment volume.",
                    x + 8f,
                    currentY,
                    FONT_REGULAR,
                    8.8f,
                    TEXT_MUTED
            );
            currentY -= 12f;
        }

        return currentY;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getDoctorWiseRows(Object value) {
        if (value instanceof List<?> list) {
            return list.stream()
                    .filter(Map.class::isInstance)
                    .map(item -> (Map<String, Object>) item)
                    .collect(Collectors.toList());
        }

        return List.of();
    }

    private float drawTableRow(
            PDPageContentStream content,
            float x,
            float top,
            float totalWidth,
            float rowHeight,
            float[] colRatio,
            String[] values,
            boolean header
    ) throws IOException {
        float bottom = top - rowHeight;

        content.setStrokingColor(BORDER);
        content.addRect(x, bottom, totalWidth, rowHeight);
        content.stroke();

        float runningX = x;
        for (int i = 0; i < colRatio.length; i++) {
            float cellWidth = totalWidth * colRatio[i];
            if (i > 0) {
                content.moveTo(runningX, top);
                content.lineTo(runningX, bottom);
                content.stroke();
            }

            String value = i < values.length ? values[i] : "";
            writeText(
                    content,
                    value,
                    runningX + 5f,
                    top - 10.7f,
                    header ? FONT_BOLD : FONT_REGULAR,
                    8.2f,
                    TEXT_DARK
            );
            runningX += cellWidth;
        }

        return bottom;
    }

    private void writeText(
            PDPageContentStream content,
            String text,
            float x,
            float y,
            PDType1Font font,
            float fontSize,
            Color color
    )
            throws IOException {
        content.beginText();
        content.setNonStrokingColor(color);
        content.setFont(font, fontSize);
        content.newLineAtOffset(x, y);
        content.showText(text != null ? text : "");
        content.endText();
    }

    private void writeRightAlignedText(
            PDPageContentStream content,
            String text,
            float rightX,
            float y,
            PDType1Font font,
            float fontSize,
            Color color
    ) throws IOException {
        String safe = text != null ? text : "";
        float textWidth = font.getStringWidth(safe) / 1000f * fontSize;
        writeText(content, safe, rightX - textWidth, y, font, fontSize, color);
    }

    private String formatWhole(Object value) {
        if (value == null) {
            return "0";
        }

        if (value instanceof Number number) {
            return String.format(Locale.US, "%,d", number.longValue());
        }

        return value.toString();
    }

    private String formatCurrency(Object value) {
        double amount = toDouble(value);
        return String.format(Locale.US, "BDT %,.2f", amount);
    }

    private String formatPercent(Object value) {
        double amount = toDouble(value);
        return String.format(Locale.US, "%.2f%%", amount);
    }

    private double toDouble(Object value) {
        if (value == null) {
            return 0d;
        }

        if (value instanceof Number number) {
            return number.doubleValue();
        }

        try {
            String normalized = value.toString().replace("%", "").trim();
            return Double.parseDouble(normalized);
        } catch (NumberFormatException ignored) {
            return 0d;
        }
    }

    private String truncate(String value, int maxLen) {
        if (value == null) {
            return "System";
        }

        if (value.length() <= maxLen) {
            return value;
        }

        return value.substring(0, maxLen - 3) + "...";
    }

    private String safe(String value) {
        if (value == null || value.isBlank()) {
            return "-";
        }
        return value;
    }
}
