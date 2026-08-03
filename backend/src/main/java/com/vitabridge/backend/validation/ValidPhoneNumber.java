package com.vitabridge.backend.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = PhoneNumberValidator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidPhoneNumber {
    String message() default "Phone number must be valid (e.g., +1234567890 or 1234567890)";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
