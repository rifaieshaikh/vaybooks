import { Button } from '@vaybooks/ui-kit';
import { useCrmCan } from '../hooks/useCrmSettings';

function normalizePhoneForWhatsapp(phone: string, defaultCountry = '91'): string | null {
  const digits = String(phone || '')
    .replace(/\D/g, '')
    .trim();
  if (!digits) return null;
  if (digits.length === 10 && '6789'.includes(digits[0])) {
    return `${defaultCountry}${digits}`;
  }
  if (digits.length === 12 && digits.startsWith(defaultCountry)) return digits;
  if (digits.length === 11 && digits.startsWith('0')) {
    const local = digits.slice(1);
    if (local.length === 10 && '6789'.includes(local[0])) {
      return `${defaultCountry}${local}`;
    }
  }
  if (digits.length >= 11) return digits;
  return null;
}

export function buildWhatsAppUrl(phone: string, message = ''): string | null {
  const intl = normalizePhoneForWhatsapp(phone);
  if (!intl) return null;
  const text = encodeURIComponent(message || '');
  return text ? `https://wa.me/${intl}?text=${text}` : `https://wa.me/${intl}`;
}

type Props = {
  phone: string;
  message?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
};

/** Opens wa.me for the given phone. Hidden when the user lacks WhatsApp send permission. */
export function WhatsAppButton({ phone, message, label = 'WhatsApp', disabled, className }: Props) {
  const can = useCrmCan();
  if (!can.sendWhatsapp) return null;

  const url = buildWhatsAppUrl(phone, message);
  if (!url) {
    return (
      <Button type="button" variant="ghost" disabled className={className}>
        {label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      disabled={disabled}
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
    >
      {label}
    </Button>
  );
}
