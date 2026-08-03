package com.vitabridge.backend.service;

import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.EmergencyContact;
import com.vitabridge.backend.model.Patient;
import com.vitabridge.backend.model.Prescription;
import com.vitabridge.backend.model.PrescriptionMedication;
import com.vitabridge.backend.model.User;
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
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class PrescriptionPdfService {

    private static final PDType1Font FONT_REGULAR = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDType1Font FONT_BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

    private static final float PAGE_WIDTH = PDRectangle.A4.getWidth();
    private static final float PAGE_HEIGHT = PDRectangle.A4.getHeight();

    private static final float MARGIN_LEFT = 28f;
    private static final float MARGIN_RIGHT = 28f;
    private static final float MARGIN_TOP = 28f;
    private static final float MARGIN_BOTTOM = 28f;

    private static final float CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

    private static final float BODY_FONT_SIZE = 10f;
    private static final float LABEL_FONT_SIZE = 10f;
    private static final float LINE_HEIGHT = 12.5f;

    private static final Color HEADER_TEXT = new Color(32, 39, 53);
    private static final Color LABEL_TEXT = new Color(80, 86, 99);
    private static final Color LIGHT_LINE = new Color(210, 214, 220);
    private static final Color EMERGENCY_BG = new Color(255, 243, 243);
    private static final Color EMERGENCY_BORDER = new Color(220, 100, 100);
    private static final Color EMERGENCY_TEXT = new Color(160, 30, 30);

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    public byte[] generatePrescriptionPdf(Prescription prescription) {
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            validatePrescriptionForPdf(prescription);

            Appointment appointment = prescription.getAppointment();

            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);

            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                float y = PAGE_HEIGHT - MARGIN_TOP;

                y = addLetterhead(content, appointment, y);
                y = addPatientRow(content, appointment, prescription, y - 4f);
                y = addPrescriptionBody(content, appointment, prescription, y - 6f);
                y = addSignatureArea(content, appointment, prescription, y - 6f);
                addFooter(content, appointment, y - 8f);
            }

            document.save(outputStream);
            return outputStream.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate prescription PDF", e);
        }
    }

    private void validatePrescriptionForPdf(Prescription prescription) {
        if (prescription == null) {
            throw new IllegalArgumentException("Prescription is required");
        }

        Appointment appointment = prescription.getAppointment();
        if (appointment == null) {
            throw new IllegalArgumentException("Prescription is missing appointment context");
        }

        if (!notBlank(prescription.getDiagnosis())) {
            throw new IllegalArgumentException("Diagnosis is required before generating prescription PDF");
        }

        List<PrescriptionMedication> medications = prescription.getMedications();
        boolean hasMedication = medications != null
                && medications.stream().anyMatch(m -> m != null && notBlank(m.getName()));

        if (!hasMedication) {
            throw new IllegalArgumentException("At least one medication is required before generating prescription PDF");
        }
    }

    private float addLetterhead(PDPageContentStream content,
                                Appointment appointment,
                                float y) throws IOException {
        Doctor doctor = appointment.getDoctor();

        String doctorName = formatDoctorName(doctor);
        String specialty = safe(doctor != null ? doctor.getSpecialization() : null, "General Medicine");
        String regNo = safe(doctor != null ? doctor.getRegistrationNumber() : null, "N/A");
        String hospital = safe(doctor != null ? doctor.getLocation() : null, "VitaBridge Healthcare");
        String phone = safe(doctor != null && doctor.getUser() != null
                ? doctor.getUser().getPhoneNumber() : null, "N/A");

        float leftWidth = CONTENT_WIDTH * 0.40f;
        float centerWidth = CONTENT_WIDTH * 0.20f;
        float rightWidth = CONTENT_WIDTH * 0.40f;

        float leftX = MARGIN_LEFT;
        float centerX = leftX + leftWidth;
        float rightX = centerX + centerWidth;

        float leftY = y;
        leftY = writeLine(content, hospital, leftX, leftY, FONT_BOLD, 11f, HEADER_TEXT);
        writeLine(content, "Tel: " + phone, leftX, leftY, FONT_REGULAR, 8f, null);

        writeCenteredLine(content, "MEDICAL", centerX, centerWidth, y, FONT_BOLD, 11f, HEADER_TEXT);
        writeCenteredLine(content, "PRESCRIPTION", centerX, centerWidth, y - 13f, FONT_REGULAR, 8f, null);

        float rightY = y;
        rightY = writeRightLine(content, doctorName, rightX + rightWidth, rightY, FONT_BOLD, 11f, HEADER_TEXT);
        rightY = writeRightLine(content, specialty, rightX + rightWidth, rightY, FONT_REGULAR, 8f, null);
        writeRightLine(content, "Reg No: " + regNo, rightX + rightWidth, rightY, FONT_REGULAR, 8f, null);

        float afterHeaderY = y - 50f;
        drawLine(content, MARGIN_LEFT, afterHeaderY, PAGE_WIDTH - MARGIN_RIGHT, afterHeaderY, LIGHT_LINE, 1f);
        return afterHeaderY - 6f;
    }

    private float addPatientRow(PDPageContentStream content,
                                Appointment appointment,
                                Prescription prescription,
                                float y) throws IOException {
        Patient patient = appointment.getPatient();
        User user = patient != null ? patient.getUser() : null;

        String name = fullName(user);
        int age = calculateAge(patient != null ? patient.getDateOfBirth() : null);
        String gender = safe(patient != null ? patient.getGender() : null, "-");
        String guardian = primaryGuardian(patient);
        String address = safe(patient != null ? patient.getAddress() : null, "-");

        String date = formatDate(appointment.getAppointmentDate());
        String patientId = user != null && user.getUserId() != null
                ? String.valueOf(user.getUserId()) : "-";
        String followUpNo = prescription.getFollowUpNumber() != null
                ? String.valueOf(prescription.getFollowUpNumber()) : "-";
        String bloodGroup = safe(patient != null ? patient.getBloodGroup() : null, "-");

        float boxTop = y;
        float boxHeight = 66f;
        float boxBottom = boxTop - boxHeight;
        drawRect(content, MARGIN_LEFT, boxBottom, CONTENT_WIDTH, boxHeight, LIGHT_LINE, 1f);

        float splitX = MARGIN_LEFT + CONTENT_WIDTH / 2f;
        float leftX = MARGIN_LEFT + 6f;
        float rightX = splitX + 6f;
        float lineY = boxTop - 12f;

        lineY = writeLine(content, "Name: " + name, leftX, lineY, FONT_REGULAR, BODY_FONT_SIZE, null);
        lineY = writeLine(content, "Age: " + (age > 0 ? age + " yrs" : "-") + "   Gender: " + gender,
                leftX, lineY, FONT_REGULAR, BODY_FONT_SIZE, null);
        lineY = writeLine(content, "Guardian: " + guardian, leftX, lineY, FONT_REGULAR, BODY_FONT_SIZE, null);
        writeLine(content, "Address: " + address, leftX, lineY, FONT_REGULAR, BODY_FONT_SIZE, null);

        float rightLineY = boxTop - 12f;
        rightLineY = writeLine(content, "Date: " + date, rightX, rightLineY, FONT_REGULAR, BODY_FONT_SIZE, null);
        rightLineY = writeLine(content, "Patient ID: " + patientId, rightX, rightLineY, FONT_REGULAR, BODY_FONT_SIZE, null);
        rightLineY = writeLine(content, "Visit No: " + followUpNo, rightX, rightLineY, FONT_REGULAR, BODY_FONT_SIZE, null);
        writeLine(content, "Blood Group: " + bloodGroup, rightX, rightLineY, FONT_REGULAR, BODY_FONT_SIZE, null);

        float separatorY = boxBottom - 6f;
        drawLine(content, MARGIN_LEFT, separatorY, PAGE_WIDTH - MARGIN_RIGHT, separatorY, LIGHT_LINE, 0.8f);
        return separatorY - 4f;
    }

    private float addPrescriptionBody(PDPageContentStream content,
                                      Appointment appointment,
                                      Prescription prescription,
                                      float y) throws IOException {
        float bodyTop = y;
        float bodyHeight = 420f;
        float bodyBottom = Math.max(MARGIN_BOTTOM + 80f, bodyTop - bodyHeight);

        drawRect(content, MARGIN_LEFT, bodyBottom, CONTENT_WIDTH, bodyTop - bodyBottom, LIGHT_LINE, 1f);

        float leftWidth = CONTENT_WIDTH * 0.44f;
        float splitX = MARGIN_LEFT + leftWidth;
        drawLine(content, splitX, bodyBottom, splitX, bodyTop, LIGHT_LINE, 1f);

        Patient patient = appointment.getPatient();

        String chiefComplaints = safe(prescription.getChiefComplaints(), safe(prescription.getDiagnosis(), "-"));
        String pastHistory = safe(prescription.getPastHistory(), safe(patient != null ? patient.getCondition() : null, "-"));
        String drugHistory = safe(prescription.getDrugHistory(), "-");
        String allergy = "-";
        String examination = safe(prescription.getOnExamination(), "-");
        String diagnosis = safe(prescription.getDiagnosis(), "-");

        float leftX = MARGIN_LEFT + 8f;
        float leftY = bodyTop - 12f;
        leftY = addClinicalSection(content, "C/C", chiefComplaints, leftX, leftY, leftWidth - 16f);
        leftY = addClinicalSection(content, "P/H", pastHistory, leftX, leftY, leftWidth - 16f);
        leftY = addClinicalSection(content, "D/H", drugHistory, leftX, leftY, leftWidth - 16f);
        leftY = addClinicalSection(content, "Allergy", allergy, leftX, leftY, leftWidth - 16f);
        leftY = addClinicalSection(content, "O/E", examination, leftX, leftY, leftWidth - 16f);
        addClinicalSection(content, "Dx", diagnosis, leftX, leftY, leftWidth - 16f);

        float rightX = splitX + 8f;
        float rightWidth = CONTENT_WIDTH - leftWidth - 16f;
        float rightY = bodyTop - 12f;

        rightY = writeLine(content, "R", rightX, rightY, FONT_BOLD, 18f, HEADER_TEXT);
        rightY -= 1f;

        rightY = addMedicationList(content, prescription.getMedications(), rightX, rightY, rightWidth);
        rightY = addRightSection(content, "Advice", prescription.getAdvice(), rightX, rightY, rightWidth);
        rightY = addRightSection(content, "Investigations", prescription.getLabTests(), rightX, rightY, rightWidth);
        addFollowupSection(content, prescription, rightX, rightY, rightWidth);

        return bodyBottom;
    }

    private float addClinicalSection(PDPageContentStream content,
                                     String label,
                                     String value,
                                     float x,
                                     float y,
                                     float width) throws IOException {
        y = writeLine(content, label + ":", x, y, FONT_BOLD, LABEL_FONT_SIZE, LABEL_TEXT);
        for (String line : wrapByWidth(safe(value, "-"), FONT_REGULAR, BODY_FONT_SIZE, width)) {
            y = writeLine(content, line, x, y, FONT_REGULAR, BODY_FONT_SIZE, null);
        }
        return y - 3f;
    }

    private float addMedicationList(PDPageContentStream content,
                                    List<PrescriptionMedication> medications,
                                    float x,
                                    float y,
                                    float width) throws IOException {
        if (medications == null || medications.isEmpty()) {
            y = writeLine(content, "1) ______________________________", x, y, FONT_REGULAR, BODY_FONT_SIZE, null);
            y = writeLine(content, "2) ______________________________", x, y, FONT_REGULAR, BODY_FONT_SIZE, null);
            return writeLine(content, "3) ______________________________", x, y, FONT_REGULAR, BODY_FONT_SIZE, null);
        }

        int idx = 1;
        float indent = x + 8f;

        for (PrescriptionMedication med : medications) {
            if (med == null || med.getName() == null || med.getName().isBlank()) {
                continue;
            }

            String nameLine = idx + ")  " + safe(med.getName(), "Medicine")
                    + (notBlank(med.getDosage()) ? "  " + med.getDosage().trim() : "");
            for (String part : wrapByWidth(nameLine, FONT_BOLD, BODY_FONT_SIZE, width)) {
                y = writeLine(content, part, x, y, FONT_BOLD, BODY_FONT_SIZE, null);
            }

            String detail = buildDetailLine(med);
            if (!detail.isBlank()) {
                for (String part : wrapByWidth(detail, FONT_REGULAR, BODY_FONT_SIZE, width - 8f)) {
                    y = writeLine(content, part, indent, y, FONT_REGULAR, BODY_FONT_SIZE, LABEL_TEXT);
                }
            }

            y -= 2f;
            idx++;
        }
        return y;
    }

    private String buildDetailLine(PrescriptionMedication med) {
        List<String> parts = new ArrayList<>();
        if (notBlank(med.getQuantity())) {
            parts.add(med.getQuantity().trim());
        }
        if (notBlank(med.getFrequency())) {
            parts.add(formatFrequency(med.getFrequency()));
        }
        if (notBlank(med.getDuration())) {
            parts.add("x " + med.getDuration().trim());
        }
        if (notBlank(med.getInstructions())) {
            parts.add(med.getInstructions().trim());
        }
        return String.join(" - ", parts);
    }

    private String formatFrequency(String frequency) {
        String normalized = frequency.trim().toUpperCase();
        return switch (normalized) {
            case "OD" -> "Once daily";
            case "BD" -> "Twice daily";
            case "TDS" -> "Three times daily";
            case "1-0-1" -> "1 tablet in the morning, 0 at noon, 1 at night";
            case "1-1-1" -> "1 tablet three times a day (morning, noon, night)";
            case "0-0-1" -> "1 tablet only at night";
            case "1-0-0" -> "1 tablet only in the morning";
            case "QID" -> "Four times daily";
            case "SOS" -> "When required";
            case "PRN" -> "As needed";
            case "STAT" -> "Immediately";
            case "HS" -> "At bedtime";
            case "OW" -> "Once a week";
            case "BW" -> "Twice a week";
            default -> frequency.trim();
        };
    }

    private float addRightSection(PDPageContentStream content,
                                  String label,
                                  String value,
                                  float x,
                                  float y,
                                  float width) throws IOException {
        if (value == null || value.isBlank()) {
            return y;
        }
        y -= 4f;
        y = writeLine(content, label, x, y, FONT_BOLD, LABEL_FONT_SIZE, LABEL_TEXT);
        for (String line : wrapByWidth(value, FONT_REGULAR, BODY_FONT_SIZE, width)) {
            y = writeLine(content, line, x, y, FONT_REGULAR, BODY_FONT_SIZE, null);
        }
        return y;
    }

    private float addFollowupSection(PDPageContentStream content,
                                     Prescription prescription,
                                     float x,
                                     float y,
                                     float width) throws IOException {
        String followUpDate = prescription.getFollowUpDate() != null
                ? formatDate(prescription.getFollowUpDate()) : null;
        String followInstruction = safe(prescription.getFollowUpInstruction(), null);
        String emergency = safe(prescription.getEmergencyInstruction(), null);

        boolean hasFollowUp = followUpDate != null || followInstruction != null;
        boolean hasEmergency = emergency != null;

        if (!hasFollowUp && !hasEmergency) {
            return y;
        }

        y -= 4f;

        if (hasFollowUp) {
            y = writeLine(content, "Follow up", x, y, FONT_BOLD, LABEL_FONT_SIZE, LABEL_TEXT);
            if (followUpDate != null) {
                y = writeLine(content, "Date: " + followUpDate, x, y, FONT_REGULAR, BODY_FONT_SIZE, null);
            }
            if (followInstruction != null) {
                for (String line : wrapByWidth(followInstruction, FONT_REGULAR, BODY_FONT_SIZE, width)) {
                    y = writeLine(content, line, x, y, FONT_REGULAR, BODY_FONT_SIZE, null);
                }
            }
            y -= 3f;
        }

        if (hasEmergency) {
            float boxPad = 4f;
            List<String> emergencyLines = wrapByWidth(
                    "EMERGENCY: " + emergency, FONT_BOLD, BODY_FONT_SIZE, width - boxPad * 2f);
            float boxHeight = emergencyLines.size() * LINE_HEIGHT + boxPad * 2f + 2f;
            float boxBottom = y - boxHeight;

            content.setNonStrokingColor(EMERGENCY_BG);
            content.addRect(x, boxBottom, width, boxHeight);
            content.fill();

            content.setStrokingColor(EMERGENCY_BORDER);
            content.setLineWidth(0.8f);
            content.addRect(x, boxBottom, width, boxHeight);
            content.stroke();

            float textY = y - boxPad - BODY_FONT_SIZE;
            for (String line : emergencyLines) {
                writeText(content, line, x + boxPad, textY, FONT_BOLD, BODY_FONT_SIZE, EMERGENCY_TEXT);
                textY -= LINE_HEIGHT;
            }
            y = boxBottom - 3f;
        }

        return y;
    }

    private float addSignatureArea(PDPageContentStream content,
                                   Appointment appointment,
                                   Prescription prescription,
                                   float y) throws IOException {
        float generatedY = y - 10f;
        java.time.LocalDateTime generatedAt = prescription.getCreatedAt() != null
                ? TimezoneUtil.instantToDhakaLocalDateTime(prescription.getCreatedAt()) 
                : TimezoneUtil.instantToDhakaLocalDateTime(TimezoneUtil.now());
        writeText(content, "Generated on: " + generatedAt.format(DATETIME_FMT),
                MARGIN_LEFT, generatedY, FONT_REGULAR, 8f, Color.GRAY);

        float rightStart = MARGIN_LEFT + (CONTENT_WIDTH * 0.60f) + 20f;
        float rightEnd = PAGE_WIDTH - MARGIN_RIGHT;
        drawLine(content, rightStart, generatedY + 2f, rightEnd, generatedY + 2f, LIGHT_LINE, 0.8f);

        Doctor doctor = appointment.getDoctor();
        String doctorName = formatDoctorName(doctor);
        String specialty = safe(doctor != null ? doctor.getSpecialization() : null, "-");
        String regNo = safe(doctor != null ? doctor.getRegistrationNumber() : null, "N/A");

        float textY = generatedY - 12f;
        writeText(content, doctorName, rightStart, textY, FONT_BOLD, 10f, null);
        writeText(content, specialty, rightStart, textY - 11f, FONT_REGULAR, 8f, Color.GRAY);
        writeText(content, "Reg No: " + regNo, rightStart, textY - 21f, FONT_REGULAR, 8f, Color.GRAY);

        return generatedY - 30f;
    }

    private void addFooter(PDPageContentStream content,
                           Appointment appointment,
                           float y) throws IOException {
        float boxHeight = 34f;
        float boxBottom = Math.max(MARGIN_BOTTOM, y - boxHeight);
        drawRect(content, MARGIN_LEFT, boxBottom, CONTENT_WIDTH, boxHeight, LIGHT_LINE, 1f);

        String hospital = safe(appointment.getDoctor() != null
                ? appointment.getDoctor().getLocation() : null,
                "VitaBridge Healthcare");
        String phone = safe(appointment.getDoctor() != null
                && appointment.getDoctor().getUser() != null
                ? appointment.getDoctor().getUser().getPhoneNumber() : null, "N/A");

        writeCenteredText(content,
                "This is a digitally generated prescription. Verify patient and medicine details before dispensing.",
                MARGIN_LEFT, CONTENT_WIDTH, boxBottom + 20f, FONT_REGULAR, 8f, null);
        writeCenteredText(content,
                hospital + "  |  Contact: " + phone,
                MARGIN_LEFT, CONTENT_WIDTH, boxBottom + 10f, FONT_REGULAR, 8f, Color.GRAY);
    }

    private float writeLine(PDPageContentStream content, String text,
                            float x, float y, PDType1Font font, float fontSize, Color color)
            throws IOException {
        writeText(content, text, x, y, font, fontSize, color);
        return y - LINE_HEIGHT;
    }

    private float writeRightLine(PDPageContentStream content, String text,
                                 float rightX, float y, PDType1Font font, float fontSize, Color color)
            throws IOException {
        float w = textWidth(text, font, fontSize);
        writeText(content, text, rightX - w, y, font, fontSize, color);
        return y - LINE_HEIGHT;
    }

    private float writeCenteredLine(PDPageContentStream content, String text,
                                    float x, float width, float y,
                                    PDType1Font font, float fontSize, Color color)
            throws IOException {
        float tw = textWidth(text, font, fontSize);
        writeText(content, text, x + (width - tw) / 2f, y, font, fontSize, color);
        return y - LINE_HEIGHT;
    }

    private void writeCenteredText(PDPageContentStream content, String text,
                                   float x, float width, float y,
                                   PDType1Font font, float fontSize, Color color)
            throws IOException {
        float tw = textWidth(text, font, fontSize);
        writeText(content, text, x + (width - tw) / 2f, y, font, fontSize, color);
    }

    private void writeText(PDPageContentStream content, String text,
                           float x, float y, PDType1Font font, float fontSize, Color color)
            throws IOException {
        content.beginText();
        content.setFont(font, fontSize);
        content.setNonStrokingColor(color != null ? color : Color.BLACK);
        content.newLineAtOffset(x, y);
        content.showText(sanitize(text));
        content.endText();
    }

    private void drawLine(PDPageContentStream content,
                          float x1, float y1, float x2, float y2,
                          Color color, float width) throws IOException {
        content.setStrokingColor(color);
        content.setLineWidth(width);
        content.moveTo(x1, y1);
        content.lineTo(x2, y2);
        content.stroke();
    }

    private void drawRect(PDPageContentStream content,
                          float x, float y, float width, float height,
                          Color color, float lineWidth) throws IOException {
        content.setStrokingColor(color);
        content.setLineWidth(lineWidth);
        content.addRect(x, y, width, height);
        content.stroke();
    }

    private List<String> wrapByWidth(String text, PDType1Font font,
                                     float fontSize, float maxWidth) throws IOException {
        String normalized = safe(text, "-");
        String[] words = sanitize(normalized).split("\\s+");
        List<String> lines = new ArrayList<>();
        StringBuilder current = new StringBuilder();

        for (String word : words) {
            if (word.isBlank()) {
                continue;
            }
            String candidate = current.isEmpty() ? word : current + " " + word;
            if (textWidth(candidate, font, fontSize) <= maxWidth) {
                current.setLength(0);
                current.append(candidate);
            } else {
                if (!current.isEmpty()) {
                    lines.add(current.toString());
                }
                current.setLength(0);
                current.append(word);
            }
        }
        if (!current.isEmpty()) {
            lines.add(current.toString());
        }
        if (lines.isEmpty()) {
            lines.add("-");
        }
        return lines;
    }

    private float textWidth(String text, PDType1Font font, float fontSize) throws IOException {
        return (font.getStringWidth(sanitize(text)) / 1000f) * fontSize;
    }

    private String primaryGuardian(Patient patient) {
        if (patient == null
                || patient.getEmergencyContacts() == null
                || patient.getEmergencyContacts().isEmpty()) {
            return "-";
        }
        EmergencyContact first = patient.getEmergencyContacts().get(0);
        return (first == null || first.getName() == null || first.getName().isBlank())
                ? "-" : first.getName().trim();
    }

    private int calculateAge(LocalDate dateOfBirth) {
        if (dateOfBirth == null) {
            return 0;
        }
        return Period.between(dateOfBirth, LocalDate.now()).getYears();
    }

    private String formatDate(LocalDate date) {
        return date == null ? "-" : date.format(DATE_FMT);
    }

    private String formatDoctorName(Doctor doctor) {
        String name = fullName(doctor != null ? doctor.getUser() : null);
        if (name.equals("-")) {
            return "Dr. -";
        }
        return name.toLowerCase().startsWith("dr.") ? name : "Dr. " + name;
    }

    private String fullName(User user) {
        if (user == null) {
            return "-";
        }
        String first = safe(user.getFirstName(), "");
        String last = safe(user.getLastName(), "");
        String full = (first + " " + last).trim();
        return full.isBlank() ? "-" : full;
    }

    private boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private String safe(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value.trim();
    }

    private String sanitize(String value) {
        if (value == null) {
            return "";
        }
        String cleaned = value
                .replace('\u2013', '-')
                .replace('\u2014', '-')
                .replace('\u2018', '\'')
                .replace('\u2019', '\'')
                .replace('\u201c', '"')
                .replace('\u201d', '"')
                .replace('\t', ' ')
                .replace("\u00A0", " ");

        StringBuilder ascii = new StringBuilder(cleaned.length());
        for (int i = 0; i < cleaned.length(); i++) {
            char ch = cleaned.charAt(i);
            ascii.append((ch >= 32 && ch <= 126) ? ch : ' ');
        }
        return ascii.toString().replaceAll(" +", " ").trim();
    }
}
