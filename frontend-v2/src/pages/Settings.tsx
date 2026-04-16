import { useEffect, useState } from 'react';
import { User, Brush as Palette, Moon, Sun, Monitor, ArrowRight2 as ChevronRight, Shield, Logout as LogOut, Trash as Trash2 } from 'iconsax-reactjs';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'profile',    label: 'Profile',    icon: User    },
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
          ? 'border-[var(--foreground)] bg-[var(--muted)]'
          : 'border-[var(--border)] hover:border-[var(--muted-foreground)]',
      )}
    >
      <Preview />
      <div className="flex items-center gap-1.5">
        <Icon size={14} className={active ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'} />
        <span className={cn('text-code font-medium', active ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]')}>
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
        <h2 className="text-subheading font-semibold text-[var(--foreground)] mb-1">Profile</h2>
        <p className="text-code text-[var(--muted-foreground)]">Manage your personal information</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-[var(--muted)] flex items-center justify-center border-2 border-[var(--border)] overflow-hidden">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-subheading font-semibold text-[var(--muted-foreground)]">{initials}</span>
          )}
        </div>
        <div>
          <p className="text-body font-medium text-[var(--foreground)]">{user?.display_name || '—'}</p>
          <p className="text-caption text-[var(--muted-foreground)]">{user?.email || '—'}</p>
          <p className="text-caption text-[var(--muted-foreground)] mt-0.5 uppercase tracking-wide">
            {user?.role === 'admin' ? 'Administrator' : 'Member'}
          </p>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <div>
          <label className="text-caption font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5 block">
            Display name
          </label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="text-caption font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5 block">
            Email
          </label>
          <Input value={user?.email ?? ''} type="email" disabled />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-caption font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5 block">
              Organization
            </label>
            <Input value={organization} onChange={(e) => setOrganization(e.target.value)} />
          </div>
          <div>
            <label className="text-caption font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5 block">
              Department
            </label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-caption font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5 block">
            Research field
          </label>
          <Input value={researchField} onChange={(e) => setResearchField(e.target.value)} />
        </div>
        <div>
          <label className="text-caption font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5 block">
            Bio
          </label>
          <textarea
            className="w-full bg-[var(--card)] text-[var(--foreground)] text-code px-3 py-2 h-20 rounded-lg border border-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--ring)] resize-none"
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
            status.kind === 'ok' ? 'text-[var(--success-green)]' : 'text-[var(--destructive)]',
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
        <h2 className="text-subheading font-semibold text-[var(--foreground)] mb-1">Appearance</h2>
        <p className="text-code text-[var(--muted-foreground)]">Customise how Lumen looks</p>
      </div>

      <div>
        <p className="text-caption font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">Theme</p>
        <div className="grid grid-cols-3 gap-3">
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
        <h2 className="text-subheading font-semibold text-[var(--foreground)] mb-1">Security</h2>
        <p className="text-code text-[var(--muted-foreground)]">Manage your account security</p>
      </div>

      <div className="border border-[var(--destructive)]/30 rounded-xl p-4">
        <p className="text-caption font-semibold uppercase tracking-widest text-[var(--destructive)] mb-4">
          Danger zone
        </p>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-body font-medium text-[var(--foreground)]">Sign out</p>
            <p className="text-caption text-[var(--muted-foreground)]">End this session</p>
          </div>
          <Button
            variant="ghost"
            icon={<LogOut size={14} />}
            className="!text-[var(--destructive)]"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
        <div className="flex items-center justify-between opacity-60">
          <div>
            <p className="text-body font-medium text-[var(--foreground)]">Delete account</p>
            <p className="text-caption text-[var(--muted-foreground)]">Contact an administrator</p>
          </div>
          <Button variant="ghost" icon={<Trash2 size={14} />} className="!text-[var(--destructive)]" disabled>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

const PANELS: Record<SectionId, React.ComponentType> = {
  profile:    ProfileSection,
  appearance: AppearanceSection,
  security:   SecuritySection,
};

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [active, setActive] = useState<SectionId>('profile');
  const Panel = PANELS[active];

  return (
    <div className="max-w-content mx-auto px-6 py-8">
      <div className="mb-7">
        <h1>Settings</h1>
        <p className="text-body text-[var(--muted-foreground)] mt-1">
          Manage your account and appearance
        </p>
      </div>

      <div className="flex gap-8">
        {/* Left nav */}
        <nav className="w-48 shrink-0 space-y-0.5">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={cn(
                'w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-code font-medium transition-colors text-left',
                active === id
                  ? 'bg-[var(--muted)] text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
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
