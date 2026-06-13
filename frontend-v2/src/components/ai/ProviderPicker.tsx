import { useEffect, useState } from 'react';
import { userAiProvidersApi, type UserAiProvider } from '@/lib/api';
import { Select } from '@/components/ui/Select';

interface ProviderPickerProps {
  /** Currently selected provider id, or null/undefined to use the default. */
  value?: number | null;
  /** Called with the selected provider id (null = use account default). */
  onChange: (providerId: number | null) => void;
  className?: string;
}

/**
 * Compact dropdown to pick which saved AI provider powers this chat.
 * Renders nothing useful when the user has 0–1 providers (no choice to make),
 * but still shows the single provider's name as a static hint.
 */
export function ProviderPicker({ value, onChange, className }: ProviderPickerProps) {
  const [providers, setProviders] = useState<UserAiProvider[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await userAiProvidersApi.list();
        if (!cancelled) setProviders(list);
      } catch {
        // ignore — picker just won't render
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to choose between — don't clutter the UI.
  if (!loaded || providers.length < 2) return null;

  const defaultLabel =
    providers.find((p) => p.is_default)?.label ?? 'Account default';

  return (
    <Select
      value={value != null ? String(value) : ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className={className}
      placeholder="Provider"
    >
      <option value="">{`Default · ${defaultLabel}`}</option>
      {providers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label || p.provider}
          {p.model ? ` · ${p.model}` : ''}
        </option>
      ))}
    </Select>
  );
}

export default ProviderPicker;
