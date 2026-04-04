
import { validatePassword } from '@/utils/passwordPolicy';
import { Check, X } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  if (!password) return null;

  const { checks } = validatePassword(password);

  const rules = [
    { key: 'minLength', label: 'At least 8 characters', met: checks.minLength },
    { key: 'uppercase', label: 'One uppercase letter', met: checks.uppercase },
    { key: 'number', label: 'One number', met: checks.number },
    { key: 'specialChar', label: 'One special character', met: checks.specialChar },
  ];

  const metCount = rules.filter(r => r.met).length;
  const strengthPercent = (metCount / rules.length) * 100;

  return (
    <div className="space-y-2 mt-2">
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            strengthPercent <= 25
              ? 'bg-destructive'
              : strengthPercent <= 50
              ? 'bg-[hsl(25,95%,58%)]'
              : strengthPercent <= 75
              ? 'bg-[hsl(45,90%,50%)]'
              : 'bg-[hsl(142,71%,45%)]'
          }`}
          style={{ width: `${strengthPercent}%` }}
        />
      </div>
      <ul className="space-y-0.5">
        {rules.map(rule => (
          <li key={rule.key} className={`flex items-center gap-1.5 text-xs ${rule.met ? 'text-[hsl(142,71%,45%)]' : 'text-muted-foreground'}`}>
            {rule.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
};
