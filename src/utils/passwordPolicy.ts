
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  checks: {
    minLength: boolean;
    uppercase: boolean;
    number: boolean;
    specialChar: boolean;
  };
}

export const validatePassword = (password: string): PasswordValidation => {
  const checks = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    specialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
  };

  const errors: string[] = [];
  if (!checks.minLength) errors.push('At least 8 characters');
  if (!checks.uppercase) errors.push('At least one uppercase letter');
  if (!checks.number) errors.push('At least one number');
  if (!checks.specialChar) errors.push('At least one special character');

  return {
    isValid: Object.values(checks).every(Boolean),
    errors,
    checks,
  };
};
