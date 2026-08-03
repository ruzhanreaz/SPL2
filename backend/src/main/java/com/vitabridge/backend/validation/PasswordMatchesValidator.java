package com.vitabridge.backend.validation;

import com.vitabridge.backend.dto.RegisterRequest;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class PasswordMatchesValidator implements ConstraintValidator<PasswordMatches, Object> {
    
    @Override
    public void initialize(PasswordMatches constraintAnnotation) {
    }
    
    @Override
    public boolean isValid(Object obj, ConstraintValidatorContext context) {
        if (obj == null) {
            return true;
        }
        
        if (obj instanceof RegisterRequest) {
            RegisterRequest request = (RegisterRequest) obj;
            
            String password = request.getPassword();
            String confirmPassword = request.getConfirmPassword();
            
            if (password == null || confirmPassword == null) {
                return false;
            }
            
            boolean matches = password.equals(confirmPassword);
            
            if (!matches) {
                context.disableDefaultConstraintViolation();
                context.buildConstraintViolationWithTemplate("Password and confirm password do not match")
                        .addPropertyNode("confirmPassword")
                        .addConstraintViolation();
            }
            
            return matches;
        }
        
        return true;
    }
}
