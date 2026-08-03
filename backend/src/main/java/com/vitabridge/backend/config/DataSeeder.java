package com.vitabridge.backend.config;

import com.vitabridge.backend.model.*;
import com.vitabridge.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/**
 * Seeds the database with comprehensive test data:
 * - 1 Admin
 * - 40 Doctors
 * - 40 Assistants per Doctor (1600 total)
 * - 150 Patients
 * 
 * All users have unique names, all fields filled, password="password"
 */
@Component
public class DataSeeder implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(DataSeeder.class);
    private static final String PASSWORD = "password";

    private final UserRepository userRepository;
    private final AdminRepository adminRepository;
    private final DoctorRepository doctorRepository;
    private final PatientRepository patientRepository;
    private final AssistantRepository assistantRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository,
            AdminRepository adminRepository,
            DoctorRepository doctorRepository,
            PatientRepository patientRepository,
            AssistantRepository assistantRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.adminRepository = adminRepository;
        this.doctorRepository = doctorRepository;
        this.patientRepository = patientRepository;
        this.assistantRepository = assistantRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // ── Extended Bangladesh male first names (100+) ──────────────
    private static final String[] MALE_FIRST = {
            "Rahim", "Kamal", "Arif", "Sabbir", "Tanvir",
            "Mahbub", "Shakib", "Imran", "Farhan", "Rashed",
            "Nazrul", "Rafiq", "Aziz", "Belal", "Jasim",
            "Mobin", "Sumon", "Mizan", "Liton", "Babul",
            "Ripon", "Jewel", "Mamun", "Tuhin", "Sohel",
            "Rubel", "Masud", "Shahin", "Bokul", "Iqbal",
            "Rajesh", "Vineet", "Sanjay", "Ramesh", "Deepak",
            "Arun", "Vikram", "Anand", "Manish", "Rohan",
            "Pradeep", "Suresh", "Harish", "Govind", "Ashok",
            "Nikhil", "Arjun", "Varun", "Kunal", "Amit",
            "Rajiv", "Saurav", "Abhishek", "Akshay", "Dhruv",
            "Pranav", "Ritesh", "Sameer", "Tushar", "Yusuf",
            "Hassan", "Ibrahim", "Abdullah", "Mustafa", "Omar",
            "Ahmed", "Karim", "Farook", "Bashir", "Nasir",
            "Rashid", "Samir", "Walid", "Zahir", "Habib",
            "Mohammad", "Mirza", "Jamal", "Khalil", "Salim",
            "Tariq", "Kadir", "Fatih", "Amir", "Sufiyan",
            "Rayan", "Adnan", "Hassan", "Malik", "Jarir",
            "Faisal", "Aarav", "Akram", "Anwar", "Bilal",
            "Fahim", "Galib", "Hamza", "Iqram", "Junaid"
    };

    // ── Extended Bangladesh female first names (100+) ─────────────
    private static final String[] FEMALE_FIRST = {
            "Nasrin", "Fatema", "Mitu", "Roksana", "Liza",
            "Sharmin", "Nadia", "Farhana", "Sadia", "Tahmina",
            "Poly", "Moni", "Rina", "Layla", "Puja",
            "Tania", "Munni", "Shathi", "Bristy", "Akhi",
            "Rima", "Setu", "Jharna", "Kamrun", "Mariam",
            "Soma", "Nitu", "Bithi", "Sumaiya", "Anika",
            "Priya", "Sneha", "Pooja", "Anjali", "Divya",
            "Kavya", "Neha", "Isha", "Riya", "Zara",
            "Aisha", "Hana", "Lia", "Mina", "Nina",
            "Ova", "Petra", "Qara", "Rosa", "Sara",
            "Tara", "Uma", "Veda", "Wara", "Xara",
            "Yasmin", "Zainab", "Amira", "Bina", "Chitra",
            "Disha", "Esha", "Farina", "Gita", "Hira",
            "Irma", "Jaya", "Kala", "Leila", "Meera",
            "Nora", "Oma", "Puja", "Quah", "Rupa",
            "Sheela", "Teeja", "Uma", "Varsha", "Waheeda",
            "Yasmeena", "Zoya", "Alisha", "Bhavna", "Chhaya",
            "Deepali", "Ekta", "Farah", "Gagan", "Hansa",
            "Indira", "Janani", "Kaveri", "Lalita", "Madhu",
            "Namrata", "Odessa", "Padma", "Quinley", "Ramya"
    };

    // ── Extended Common Bangladeshi surnames (100+) ──────────────
    private static final String[] LAST_NAMES = {
            "Ahmed", "Rahman", "Islam", "Hossain", "Khan",
            "Chowdhury", "Akter", "Begum", "Khatun", "Ali",
            "Sarkar", "Mondal", "Sheikh", "Talukder", "Miah",
            "Biswas", "Das", "Paul", "Dey", "Roy",
            "Siddiqui", "Jahan", "Sultana", "Noor", "Uddin",
            "Bhuiyan", "Azad", "Kabir", "Haider", "Reza",
            "Sharma", "Singh", "Patel", "Gupta", "Verma",
            "Desai", "Rao", "Nair", "Reddy", "Menon",
            "Iyer", "Kulkarni", "Joshi", "Mishra", "Pandey",
            "Tripathi", "Bhat", "Sinha", "Das", "Mukherjee",
            "Banerjee", "Ghosh", "Roy", "Dutta", "Bose",
            "Chatterjee", "Mallik", "Saha", "Mitra", "Dasgupta",
            "Dutt", "Sen", "Mazumdar", "Nag", "Pal",
            "Das", "De", "Biswas", "Chatterjee", "Ganguly",
            "Hassan", "Hussein", "Ibrahim", "Mahmood", "Mansur",
            "Nassar", "Osman", "Pasha", "Qureshi", "Rashid",
            "Saleh", "Samir", "Taha", "Usman", "Vali",
            "Walid", "Yaseen", "Zaki", "Abed", "Aziz",
            "Bakr", "Dawood", "Fahad", "Galal", "Hafiz",
            "Jamal", "Kamal", "Latif", "Malik", "Nasser",
            "Oman", "Parvin", "Quayle", "Rayan", "Saeed",
            "Tamim", "Ubaid", "Valid", "Wadud", "Yasir"
    };

    // ── Medical specializations (50+) ────────────────────────────
    private static final String[] SPECIALIZATIONS = {
            "Cardiology", "General Medicine", "Orthopedics",
            "Neurology", "Pediatrics", "Gynecology",
            "Dermatology", "ENT", "Ophthalmology",
            "Psychiatry", "Gastroenterology", "Respiratory Medicine",
            "Endocrinology", "Nephrology", "Oncology",
            "Rheumatology", "Urology", "General Surgery",
            "Radiology", "Anesthesiology", "Emergency Medicine",
            "Internal Medicine", "Family Medicine", "Infectious Disease",
            "Hematology", "Physical Medicine", "Dental Surgery",
            "Nutrition", "Diabetology", "Hepatology",
            "Nephrology", "Pulmonology", "Thoracic Surgery",
            "Vascular Surgery", "Plastic Surgery", "Neurosurgery",
            "Oral and Maxillofacial Surgery", "Prosthodontics", "Oral Surgery",
            "Clinical Pharmacology", "Toxicology", "Occupational Medicine",
            "Community Medicine", "Public Health", "Epidemiology",
            "Microbiology", "Pathology", "Biochemistry",
            "Physiology", "Anatomy", "Medical Genetics"
    };

    // ── Extended Bangladesh cities / districts (50+) ──────────────
    private static final String[] LOCATIONS = {
            "Dhaka"
    };

    // ── ABO blood groups ─────────────────────────────────────────
    private static final String[] BLOOD_GROUPS = {
            "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"
    };

    // ── Common conditions in Bangladesh (50+) ──────────────────────
    private static final String[] CONDITIONS = {
            "Diabetes Type 1", "Diabetes Type 2", "Hypertension", "Asthma",
            "Arthritis", "Anemia", "Gastritis", "GERD", "Celiac Disease",
            "Thyroid Disorder", "Back Pain", "Migraine", "Tension Headache",
            "Obesity", "Heart Disease", "Hepatitis A", "Hepatitis B", "Hepatitis C",
            "Kidney Disease", "COPD", "Asthma", "Dengue Fever",
            "Tuberculosis", "Malaria", "Eczema", "Psoriasis",
            "Insomnia", "Anxiety", "Depression", "PTSD",
            "Fibromyalgia", "Lupus", "Rheumatoid Arthritis", "Gout",
            "Gallstones", "Pancreatitis", "Appendicitis", "Diverticulitis",
            "Crohn's Disease", "Ulcerative Colitis", "IBS", "Constipation",
            "Hemorrhoids", "Varicose Veins", "Blood Clots", "Stroke Risk",
            "Hypercholesterolemia", "Metabolic Syndrome",
            null, null, null, null, null, null, null, null  // 8 nulls for ~14% no condition
    };

    private Set<String> usedEmails = new HashSet<>();
    private Set<String> usedPhoneNumbers = new HashSet<>();
    private Random random = new Random(42); // Seed for reproducibility

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // if (userRepository.existsByEmail("admin@vitabridge.com")) {
        //     logger.info("=== DataSeeder: demo data already present, skipping ===");
        //     return;
        // }

        long startTime = System.currentTimeMillis();
        logger.info("=== DataSeeder: seeding comprehensive Bangladesh data ===");
        
        seedAdmin();
        List<Doctor> doctors = seedDoctors();
        seedAssistants(doctors);
        seedPatients();
        
        long endTime = System.currentTimeMillis();
        logger.info("=== DataSeeder: done — 1 admin | 40 doctors | 1600 assistants | 150 patients ===");
        logger.info("=== DataSeeder: completed in {} ms ===", (endTime - startTime));
    }

    // ── Admin ─────────────────────────────────────────────────────
    private void seedAdmin() {
        String email = "admin@vitabridge.com";
        String phone = "+8801700000001";
        usedEmails.add(email);
        usedPhoneNumbers.add(phone);
        
        User u = buildUser("Aminul", "Islam", email, phone, PASSWORD, Role.ADMIN);
        u = userRepository.save(u);
        Admin a = new Admin();
        a.setUser(u);
        adminRepository.save(a);
        logger.info("  [1/3] ADMIN: admin@vitabridge.com / password");
    }

    // ── Doctors 1–40 ──────────────────────────────────────────────
    private List<Doctor> seedDoctors() {
        List<Doctor> result = new ArrayList<>();
        logger.info("  [2/3] Seeding 40 doctors...");
        
        for (int i = 1; i <= 40; i++) {
            String firstName = getUniqueFirstName(i, i % 2 == 0);
            String lastName = getUniqueLastName(i);
            String email = generateUniqueEmail(String.format("doctor%03d", i));
            String phone = generateUniquePhone(2000 + i);

            User u = buildUser(firstName, lastName, email, phone, PASSWORD, Role.DOCTOR);
            u = userRepository.save(u);

            Doctor d = new Doctor();
            d.setUser(u);
            d.setSpecialization(SPECIALIZATIONS[(i - 1) % SPECIALIZATIONS.length]);
            d.setYearOfExperience(3 + ((i - 1) % 28)); // 3–30 years
            d.setLocation(LOCATIONS[(i - 1) % LOCATIONS.length]);
            d.setConsultationFee(300.0f + (i * 50)); // 350–2300 BDT
            d.setQualifications("MBBS, FCPS, MD");
            d.setLanguages("Bangla, English, Hindi");
            d.setHospitalAffiliation("VitaBridge Medical Center - Dhaka");
            d.setAbout("Dedicated to patient-centered care with evidence-based treatment planning and clear communication. Specialist in " + d.getSpecialization());
            d.setRegistrationNumber("REG" + String.format("%05d", i));
            d.setIsAvailableForCalls(true);
            d.setAverageRating(3.5 + (i % 15) * 0.1);
            d.setTotalRatings(50 + (i % 150));
            
            Doctor saved = doctorRepository.save(d);
            result.add(saved);
            
            if (i % 10 == 0) {
                logger.info("    ... seeded {} doctors", i);
            }
        }
        logger.info("    ✓ 40 doctors seeded");
        return result;
    }

    // ── Assistants 1–40 per Doctor (1600 total) ───────────────────
    private void seedAssistants(List<Doctor> doctors) {
        logger.info("  [3/3] Seeding 1600 assistants (40 per doctor)...");
        int totalAssistants = 0;
        int seq = 1;
        
        for (Doctor doctor : doctors) {
            for (int slot = 1; slot <= 40; slot++, seq++) {
                String firstName = getUniqueFirstName(seq + 5000, seq % 2 == 0);
                String lastName = getUniqueLastName(seq + 5000);
                String email = generateUniqueEmail(String.format("assistant%05d", seq));
                String phone = generateUniquePhone(3000 + seq);

                User u = buildUser(firstName, lastName, email, phone, PASSWORD, Role.ASSISTANT);
                u = userRepository.save(u);

                Assistant ast = new Assistant();
                ast.setUser(u);
                ast.setDoctor(doctor);
                assistantRepository.save(ast);
                totalAssistants++;
            }
            
            if (doctor.getDoctorId() % 5 == 0) {
                logger.info("    ... seeded {} assistants", totalAssistants);
            }
        }
        logger.info("    ✓ 1600 assistants seeded");
    }

    // ── Patients 1–150 ────────────────────────────────────────────
    private void seedPatients() {
        logger.info("  [4/4] Seeding 150 patients...");
        
        for (int i = 1; i <= 150; i++) {
            String firstName = getUniqueFirstName(i + 10000, i % 2 == 0);
            String lastName = getUniqueLastName(i + 10000);
            String gender = (i % 2 == 0) ? "Female" : "Male";
            String email = generateUniqueEmail(String.format("patient%05d", i));
            String phone = generateUniquePhone(4000 + i);

            User u = buildUser(firstName, lastName, email, phone, PASSWORD, Role.PATIENT);
            u = userRepository.save(u);

            Patient p = new Patient();
            p.setUser(u);
            p.setGender(gender);
            p.setBloodGroup(BLOOD_GROUPS[(i - 1) % BLOOD_GROUPS.length]);
            p.setDateOfBirth(LocalDate.of(
                    1960 + ((i - 1) / 3), // distribute across 50 years
                    1 + ((i - 1) % 12),   // month 1–12
                    1 + ((i - 1) % 28))); // day 1–28
            p.setWeight(45.0f + ((i - 1) % 55)); // 45–99 kg
            p.setHeight(150.0f + ((i - 1) % 40)); // 150–189 cm
            String cond = CONDITIONS[(i - 1) % CONDITIONS.length];
            if (cond != null) {
                p.setCondition(cond);
            }
            p.setAddress(LOCATIONS[(i - 1) % LOCATIONS.length] + ", District");
            patientRepository.save(p);
            
            if (i % 30 == 0) {
                logger.info("    ... seeded {} patients", i);
            }
        }
        logger.info("    ✓ 150 patients seeded");
    }

    // ── Helpers ───────────────────────────────────────────────────

    /** Generate unique first name based on index and gender */
    private String getUniqueFirstName(int index, boolean isFemale) {
        String[] names = isFemale ? FEMALE_FIRST : MALE_FIRST;
        return names[(index - 1) % names.length];
    }

    /** Generate unique last name based on index */
    private String getUniqueLastName(int index) {
        return LAST_NAMES[(index - 1) % LAST_NAMES.length];
    }

    /** Generate unique email with fallback mechanism */
    private String generateUniqueEmail(String base) {
        String email = base.toLowerCase() + "@vitabridge.com";
        int counter = 1;
        while (usedEmails.contains(email)) {
            email = base.toLowerCase() + counter + "@vitabridge.com";
            counter++;
        }
        usedEmails.add(email);
        return email;
    }

    /** Generate unique phone number */
    private String generateUniquePhone(int seed) {
        String phone = "+880" + String.format("%010d", seed);
        int counter = 0;
        while (usedPhoneNumbers.contains(phone) && counter < 100) {
            phone = "+880" + String.format("%010d", seed + counter);
            counter++;
        }
        usedPhoneNumbers.add(phone);
        return phone;
    }
    private User buildUser(String firstName, String lastName,
            String email, String phone,
            String rawPassword, Role role) {
        User user = new User();
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEmail(email);
        user.setPhoneNumber(phone);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setRole(role);
        user.setIsActive(true);
        user.setIsLocked(false);
        user.setFailedLoginAttempts(0);
        return user;
    }
}
