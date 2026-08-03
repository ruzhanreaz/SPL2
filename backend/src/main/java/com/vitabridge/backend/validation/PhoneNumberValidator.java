package com.vitabridge.backend.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.regex.Pattern;

public class PhoneNumberValidator implements ConstraintValidator<ValidPhoneNumber, String> {

    // Accepts international format with + or without, digits only after country
    // code
    private static final String PHONE_PATTERN = "^\\+?[1-9]\\d{6,14}$";
    private static final Pattern pattern = Pattern.compile(PHONE_PATTERN);

    @Override
    public void initialize(ValidPhoneNumber constraintAnnotation) {
    }

    @Override
    public boolean isValid(String phoneNumber, ConstraintValidatorContext context) {
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            return false;
        }

        // Remove any whitespace, hyphens, or parentheses for validation
        String cleanedPhone = phoneNumber.replaceAll("[\\s()-]", "");

        if (!pattern.matcher(cleanedPhone).matches()) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                    "Phone number must contain 7-15 digits and may optionally start with +")
                    .addConstraintViolation();
            return false;
        }

        return true;
    }
}
