import { useEffect, useState } from 'react';
import {
  User,
  Brush as Palette,
  Moon,
  Sun,
  Monitor,
  ArrowRight2 as ChevronRight,
  Shield,
  Logout as LogOut,
  Trash as Trash2,
  Cpu,
} from 'iconsax-reactjs';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { userAiSettingsApi, type ProviderInfo, type UserAiSettings } from '@/lib/api';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'profile',    label: 'Profile',    icon: User    },
  { id: 'ai',         label: 'AI',         icon: Cpu     },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security',   label: 'Security',   icon: Shield  },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

// ── Appearance section ────────────────────────────────────────────────────────

type ThemeMode = 'light' | 'dark' | 'system';

function ThemeCard({
  mode, current, onSelect,
}: {
  mode: ThemeMode;
  current: ThemeMode;
  onSelect: (m: ThemeMode) => void;
}) {
  const LABELS: Record<ThemeMode, { label: string; icon: React.ElementType }> = {
    light:  { label: 'Light',  icon: Sun     },
    dark:   { label: 'Dark',   icon: Moon    },
    system: { label: 'System', icon: Monitor },
  };
  const { label, icon: Icon } = LABELS[mode];
  const active = mode === current;

  // Tiny preview swatch
  const Preview = () => {
    const bg     = mode === 'dark' ? '#111111' : mode === 'light' ? '#ffffff' : 'linear-gradient(135deg,#fff 50%,#111 50%)';
    const border = mode === 'dark' ? '#2e2e2e' : '#e5e5e5';
    return (
      <div
        className="w-full h-16 rounded-lg mb-3 border"
        style={{
          background: typeof bg === 'string' ? bg : bg,
          borderColor: border,
        }}
      >
        {/* Mini fake UI */}
        <div className="p-2 flex flex-col gap-1">
          <div
            className="h-1.5 w-3/4 rounded-full"
            style={{ background: mode === 'dark' ? '#333' : '#e5e5e5' }}
          />
          <div
            className="h-1.5 w-1/2 rounded-full"
            style={{ background: mode === 'dark' ? '#2a2a2a' : '#ebebeb' }}
          />
        </div>
      </div>
    );
  };

  return (
    <button
      onClick={() => onSelect(mode)}
      className={cn(
        'flex flex-col items-center p-3 rounded-xl border-2 transition-all w-full',
        active
          ? 'border-(--foreground) bg-(--muted)'
          : 'border-(--border) hover:border-(--muted-foreground)',
      )}
    >
      <Preview />
      <div className="flex items-center gap-1.5">
        <Icon size={14} className={active ? 'text-(--foreground)' : 'text-(--muted-foreground)'} />
        <span className={cn('text-code font-medium', active ? 'text-(--foreground)' : 'text-(--muted-foreground)')}>
          {label}
        </span>
      </div>
    </button>
  );
}

// ── Section panels ────────────────────────────────────────────────────────────

function ProfileSection() {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [organization, setOrganization] = useState(user?.organization ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [researchField, setResearchField] = useState(user?.research_field ?? '');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setDisplayName(user?.display_name ?? '');
    setOrganization(user?.organization ?? '');
    setDepartment(user?.department ?? '');
    setResearchField(user?.research_field ?? '');
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await updateProfile({
        display_name: displayName || undefined,
        organization: organization || undefined,
        department: department || undefined,
        research_field: researchField || undefined,
        bio: bio || undefined,
      });
      setStatus({ kind: 'ok', text: 'Profile updated' });
    } catch (e) {
      setStatus({ kind: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.display_name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-subheading font-semibold text-(--foreground) mb-1">Profile</h2>
        <p className="text-code text-(--muted-foreground)">Manage your personal information</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-(--muted) flex items-center justify-center border-2 border-(--border) overflow-hidden">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-subheading font-semibold text-(--muted-foreground)">{initials}</span>
          )}
        </div>
        <div>
          <p className="text-body font-medium text-(--foreground)">{user?.display_name || '—'}</p>
          <p className="text-caption text-(--muted-foreground)">{user?.email || '—'}</p>
          <p className="text-caption text-(--muted-foreground) mt-0.5 uppercase tracking-wide">
            {user?.role === 'admin' ? 'Administrator' : 'Member'}
          </p>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <div>
          <label className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wide mb-1.5 block">
            Display name
          </label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wide mb-1.5 block">
            Email
          </label>
          <Input value={user?.email ?? ''} type="email" disabled />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wide mb-1.5 block">
              Organization
            </label>
            <Input value={organization} onChange={(e) => setOrganization(e.target.value)} />
          </div>
          <div>
            <label className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wide mb-1.5 block">
              Department
            </label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wide mb-1.5 block">
            Research field
          </label>
          <Input value={researchField} onChange={(e) => setResearchField(e.target.value)} />
        </div>
        <div>
          <label className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wide mb-1.5 block">
            Bio
          </label>
          <textarea
            className="w-full bg-(--card) text-(--foreground) text-code px-3 py-2 h-20 rounded-lg border border-(--border) placeholder:text-(--muted-foreground) focus:outline-none focus:border-(--ring) resize-none"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about your research interests"
          />
        </div>
      </div>

      {status && (
        <p
          className={cn(
            'text-caption',
            status.kind === 'ok' ? 'text-(--success-green)' : 'text-(--destructive)',
          )}
        >
          {status.text}
        </p>
      )}

      <Button variant="primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}

function AppearanceSection() {
  const { theme, toggle } = useTheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    theme === 'dark' ? 'dark' : 'light',
  );

  const handleTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    const wantDark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (
      (wantDark && theme !== 'dark') ||
      (!wantDark && theme !== 'light')
    ) toggle();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-subheading font-semibold text-(--foreground) mb-1">Appearance</h2>
        <p className="text-code text-(--muted-foreground)">Customise how Lumen looks</p>
      </div>

      <div>
        <p className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wide mb-3">Theme</p>
        <div className="grid grid-cols-3 gap-3 sm:gap-3">
          {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
            <ThemeCard key={m} mode={m} current={themeMode} onSelect={handleTheme} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SecuritySection() {
  const { logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      window.location.href = '/login';
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-subheading font-semibold text-(--foreground) mb-1">Security</h2>
        <p className="text-code text-(--muted-foreground)">Manage your account security</p>
      </div>

      <div className="border border-(--destructive)/30 rounded-xl p-4">
        <p className="text-caption font-semibold uppercase tracking-widest text-(--destructive) mb-4">
          Danger zone
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-body font-medium text-(--foreground)">Sign out</p>
            <p className="text-caption text-(--muted-foreground)">End this session</p>
          </div>
          <Button
            variant="ghost"
            icon={<LogOut size={14} />}
            className="text-(--destructive)!"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 opacity-60">
          <div>
            <p className="text-body font-medium text-(--foreground)">Delete account</p>
            <p className="text-caption text-(--muted-foreground)">Contact an administrator</p>
          </div>
          <Button variant="ghost" icon={<Trash2 size={14} />} className="text-(--destructive)!" disabled>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── AI section ─────────────────────────────────────────────────────────────────

function AiSettingsSection() {
  const [settings, setSettings] = useState<UserAiSettings | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Form fields
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [sett, provs] = await Promise.all([
          userAiSettingsApi.get(),
          userAiSettingsApi.listProviders(),
        ]);
        setSettings(sett);
        setProviders(provs);
        setProvider(sett.provider ?? '');
        setBaseUrl(sett.base_url ?? '');
        setModel(sett.model ?? '');
        setEmbeddingModel(sett.embedding_model ?? '');
      } catch {
        // noop — no settings yet is fine
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedProvider = providers.find((p) => p.type === provider);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const updated = await userAiSettingsApi.upsert({
        provider: provider || null,
        api_key: apiKey || null,
        base_url: baseUrl || null,
        model: model || null,
        embedding_model: embeddingModel || null,
      });
      setSettings(updated);
      setStatus({ kind: 'ok', text: 'AI settings saved' });
    } catch (e) {
      setStatus({ kind: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setStatus(null);
    try {
      await userAiSettingsApi.delete();
      setSettings(null);
      setProvider('');
      setApiKey('');
      setBaseUrl('');
      setModel('');
      setEmbeddingModel('');
      setStatus({ kind: 'ok', text: 'AI settings reset to defaults' });
    } catch (e) {
      setStatus({ kind: 'err', text: e instanceof Error ? e.message : 'Reset failed' });
    }
  };

  if (loading) {
    return <p className="text-code text-(--muted-foreground)">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-subheading font-semibold text-(--foreground) mb-1">AI Provider</h2>
        <p className="text-code text-(--muted-foreground)">
          Configure which AI provider powers chat, discovery, and other AI features
        </p>
      </div>

      {/* Provider */}
      <div>
        <label className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wide mb-1.5 block">
          Provider
        </label>
        <Select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="Select a provider"
        >
          <option value="">None (use server default)</option>
          {providers.map((p) => (
            <option key={p.type} value={p.type}>
              {p.display_name}
            </option>
          ))}
        </Select>
      </div>

      {/* API key */}
      <div>
        <label className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wide mb-1.5 block">
          API key
        </label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={settings?.api_key ? '•••••••• (stored)' : 'Enter API key'}
        />
        <p className="text-caption text-(--muted-foreground) mt-1">
          {settings?.api_key
            ? 'Replace the value above to change the stored key'
            : 'Your key is encrypted at rest'}
        </p>
      </div>

      {/* Base URL — shown only for openai-compatible */}
      <div>
        <label className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wide mb-1.5 block">
          Base URL
        </label>
        <Input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={selectedProvider?.display_name ?? 'https://api.openai.com/v1'}
        />
        <p className="text-caption text-(--muted-foreground) mt-1">
          Override the default API endpoint (optional)
        </p>
      </div>

      {/* Model */}
      <div>
        <label className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wide mb-1.5 block">
          Model
        </label>
        <Input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={
            provider === 'gemini' ? 'gemini-2.0-flash' :
            provider === 'anthropic' ? 'claude-sonnet-4-20250514' :
            provider === 'deepseek' ? 'deepseek-chat' :
            'gpt-4o'
          }
        />
      </div>

      {/* Embedding model */}
      <div>
        <label className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wide mb-1.5 block">
          Embedding model
        </label>
        <Input
          value={embeddingModel}
          onChange={(e) => setEmbeddingModel(e.target.value)}
          placeholder={
            provider === 'gemini' ? 'text-embedding-004' :
            'text-embedding-3-small'
          }
        />
      </div>

      {status && (
        <p
          className={cn(
            'text-caption',
            status.kind === 'ok' ? 'text-(--success-green)' : 'text-(--destructive)',
          )}
        >
          {status.text}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="ghost" onClick={handleReset}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}

const PANELS: Record<SectionId, React.ComponentType> = {
  profile:    ProfileSection,
  ai:         AiSettingsSection,
  appearance: AppearanceSection,
  security:   SecuritySection,
};

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [active, setActive] = useState<SectionId>('profile');
  const Panel = PANELS[active];

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 sm:mb-7">
        <h1 className="text-heading">Settings</h1>
        <p className="text-body text-(--muted-foreground) mt-1">
          Manage your account and appearance
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
        {/* Mobile: horizontal scrollable pills */}
        <nav className="sm:hidden flex gap-1 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption transition-all duration-150 border whitespace-nowrap',
                active === id
                  ? 'bg-(--foreground) text-(--card) border-(--foreground) font-medium'
                  : 'bg-(--card) text-(--muted-foreground) border-(--border) hover:text-(--foreground) hover:border-(--foreground)/30',
              )}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Desktop: left nav */}
        <nav className="hidden sm:block w-48 shrink-0 space-y-0.5">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={cn(
                'w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-code font-medium transition-colors text-left',
                active === id
                  ? 'bg-(--muted) text-(--foreground)'
                  : 'text-(--muted-foreground) hover:bg-(--muted) hover:text-(--foreground)',
              )}
            >
              <Icon size={15} className="shrink-0" />
              <span>{label}</span>
              {active === id && <ChevronRight size={13} className="ml-auto opacity-50" />}
            </button>
          ))}
        </nav>

        {/* Panel */}
        <div className="flex-1 min-w-0">
          <Panel />
        </div>
      </div>
    </div>
  );
}
