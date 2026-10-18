import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

type Language = 'id' | 'en' | 'zh-CN';
type IconName =
  | 'arrow'
  | 'bell'
  | 'bookmark'
  | 'check'
  | 'chevron'
  | 'close'
  | 'dots'
  | 'globe'
  | 'message'
  | 'paperclip'
  | 'plus'
  | 'search'
  | 'send'
  | 'settings'
  | 'smile'
  | 'sparkles'
  | 'users'
  | 'video';

type User = {
  id: string;
  displayName: string;
  username: string;
  preferredLanguage: Language;
  role: string;
};

type Workspace = {
  name: string;
  inviteCode: string;
};

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  language: Language;
  time: string;
};

type Conversation = {
  id: string;
  name: string;
  username: string;
  initials: string;
  color: string;
  status: 'online' | 'away' | 'offline';
  preview: string;
  time: string;
  unread: number;
  language: string;
  messages: Message[];
};

type ApiConversation = {
  id: string;
  created_at: string;
  display_name: string;
  other_username: string | null;
  other_language: Language | null;
  last_message: string | null;
  last_message_at: string | null;
  member_count: number;
  unread_count: number;
};

type ApiMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_username: string;
  original_text: string;
  source_language: Language;
  created_at: string;
};

type ApiError = Error & { status: number };

const languageLabels: Record<Language, string> = {
  id: 'Indonesia',
  en: 'English',
  'zh-CN': '中文'
};

const colors = ['lavender', 'peach', 'mint', 'blue', 'rose'];

const icons: Record<IconName, string> = {
  arrow: 'M7 17 17 7M7 7h10v10',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  bookmark: 'M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4z',
  check: 'm5 12 4 4L19 6',
  chevron: 'm9 18 6-6-6-6',
  close: 'm18 6-12 12M6 6l12 12',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z',
  message: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z',
  paperclip: 'm21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5',
  plus: 'M12 5v14M5 12h14',
  search: 'm21 21-4.34-4.34M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z',
  send: 'm22 2-7 20-4-9-9-4 20-7ZM22 2 11 13',
  settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.2 3.5a8.3 8.3 0 0 0-.1-1.3l1.5-1.2-1.5-2.6-1.8.7a8.4 8.4 0 0 0-2.2-1.3L15.8 3h-3.1l-.3 2.3a8.4 8.4 0 0 0-2.2 1.3l-1.8-.7-1.5 2.6 1.5 1.2a8.3 8.3 0 0 0 0 2.6l-1.5 1.2 1.5 2.6 1.8-.7a8.4 8.4 0 0 0 2.2 1.3l.3 2.3h3.1l.3-2.3a8.4 8.4 0 0 0 2.2-1.3l1.8.7 1.5-2.6-1.5-1.2c.1-.4.1-.8.1-1.3Z',
  smile: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  sparkles: 'm12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3ZM19 14l1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14ZM5 2l.8 2.2L8 5l-2.2.8L5 8l-.8-2.2L2 5l2.2-.8L5 2Z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6',
  video: 'M15 10l5-3v10l-5-3M3 6h12v12H3z'
};

async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin'
  });
  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      ('error' in payload || 'message' in payload) &&
      typeof ('error' in payload ? payload.error : payload.message) === 'string'
        ? ('error' in payload ? payload.error : payload.message) as string
        : 'Permintaan gagal. Coba lagi.';
    const error = new Error(message) as ApiError;
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? '')
    .join('');
}

function colorFor(name: string) {
  const hash = [...name].reduce((total, character) => total + character.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function formatTime(value: string | null) {
  if (!value) return 'Baru';
  return new Date(value).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function Icon({
  name,
  size = 18,
  className
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={icons[name]} />
    </svg>
  );
}

function Avatar({
  label,
  color,
  status,
  size = 'normal'
}: {
  label: string;
  color: string;
  status?: 'online' | 'away' | 'offline';
  size?: 'normal' | 'large' | 'small';
}) {
  return (
    <span className={`avatar avatar-${color} avatar-${size}`}>
      {label}
      {status && <i className={`presence presence-${status}`} />}
    </span>
  );
}

function AuthScreen({
  onAuthenticated,
  serverError
}: {
  onAuthenticated: (user: User, workspace: Workspace) => void;
  serverError: string;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [language, setLanguage] = useState<Language>('id');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'register'
          ? {
              displayName,
              username: username.trim().toLowerCase(),
              password,
              workspaceName: workspaceName.trim() || undefined,
              inviteCode: inviteCode.trim() || undefined,
              preferredLanguage: language
            }
          : { username: username.trim(), password };
      const result = await apiRequest<{ user: User; workspace: Workspace }>(path, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      onAuthenticated(result.user, result.workspace);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Permintaan gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">
            <span className="brand-symbol">
              <span />
              <span />
              <span />
              <span />
            </span>
          </span>
          <span>univoxia</span>
        </div>
        <div className="auth-intro">
          <span className="auth-eyebrow">RUANG BICARA TANPA BATAS</span>
          <h1>{mode === 'register' ? 'Mulai terhubung.' : 'Senang bertemu lagi.'}</h1>
          <p>
            {mode === 'register'
              ? 'Buat akun atau gabung ke workspace timmu untuk mulai mengobrol.'
              : 'Masuk ke akunmu untuk melanjutkan percakapan.'}
          </p>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Akun">
          <button
            className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Buat akun
          </button>
          <button
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Masuk
          </button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label className="modal-field">
                <span>Nama tampilan</span>
                <input
                  autoComplete="name"
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Nama kamu"
                />
              </label>
              <label className="modal-field">
                <span>Nama workspace baru <small>Opsional jika bergabung</small></span>
                <input
                  maxLength={80}
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Contoh: Northstar Studio"
                />
              </label>
              <label className="modal-field">
                <span>Kode undangan workspace <small>Opsional</small></span>
                <input
                  autoCapitalize="characters"
                  maxLength={16}
                  minLength={16}
                  value={inviteCode}
                  onChange={(event) =>
                    setInviteCode(event.target.value.toUpperCase())
                  }
                  placeholder="Masukkan kode 16 karakter"
                />
              </label>
            </>
          )}
          <label className="modal-field">
            <span>Username</span>
            <input
              autoComplete="username"
              autoCapitalize="none"
              required
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9._-]+"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
            />
          </label>
          <label className="modal-field">
            <span>Kata sandi {mode === 'register' && <small>Minimal 10 karakter</small>}</span>
            <input
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'register' ? 10 : 1}
              maxLength={72}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••"
            />
          </label>
          {mode === 'register' && (
            <label className="modal-field">
              <span>Bahasa pesanmu</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
              >
                {Object.entries(languageLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(error || serverError) && (
            <div className="auth-error" role="alert">{error || serverError}</div>
          )}
          <button className="modal-submit" type="submit" disabled={submitting}>
            {submitting
              ? 'Tunggu sebentar…'
              : mode === 'register'
                ? 'Buat akun'
                : 'Masuk ke Univoxia'}
            {!submitting && <Icon name="arrow" size={16} />}
          </button>
        </form>
        <p className="auth-footnote">
          Kata sandi dienkripsi sebelum disimpan. Terjemahan AI belum dikonfigurasi.
        </p>
      </section>
      <p className="auth-legal">Univoxia · MVP untuk ruang kerja tim</p>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [targetLanguage, setTargetLanguage] = useState<Language>('id');
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatUsername, setNewChatUsername] = useState('');
  const [newChatError, setNewChatError] = useState('');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [appError, setAppError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const searchInput = useRef<HTMLInputElement>(null);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ?? null;
  const visibleConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return conversations.filter((conversation) => {
      const matchesQuery =
        !normalizedSearch ||
        conversation.name.toLocaleLowerCase().includes(normalizedSearch) ||
        conversation.username.toLocaleLowerCase().includes(normalizedSearch) ||
        conversation.preview.toLocaleLowerCase().includes(normalizedSearch);
      const matchesFilter = filter === 'all' || conversation.unread > 0;
      return matchesQuery && matchesFilter;
    });
  }, [conversations, filter, search]);
  const totalUnread = conversations.reduce(
    (total, conversation) => total + conversation.unread,
    0
  );

  const notify = (message: string) => {
    if (toastTimer.current !== undefined) {
      window.clearTimeout(toastTimer.current);
    }
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(''), 3000);
  };

  const handleRequestError = (cause: unknown) => {
    if (cause instanceof Error && 'status' in cause && cause.status === 401) {
      setUser(null);
      setWorkspace(null);
      setConversations([]);
      setActiveId(null);
      setAppError('Sesi berakhir. Silakan masuk kembali.');
      return;
    }
    notify(cause instanceof Error ? cause.message : 'Permintaan gagal.');
  };

  const loadConversations = async (signal?: AbortSignal) => {
    const result = await apiRequest<{ conversations: ApiConversation[] }>(
      '/api/conversations',
      { signal }
    );
    setConversations((current) => {
      const existingMessages = new Map(
        current.map((conversation) => [conversation.id, conversation.messages])
      );
      return result.conversations.map((item) => {
        const name = item.display_name || item.other_username || 'Percakapan';
        return {
          id: item.id,
          name,
          username: item.other_username ?? '',
          initials: initials(name),
          color: colorFor(item.other_username ?? name),
          status: 'offline' as const,
          preview: item.last_message ?? 'Mulai percakapan baru',
          time: formatTime(item.last_message_at ?? item.created_at),
          unread: Number(item.unread_count),
          language: item.other_language
            ? languageLabels[item.other_language]
            : `${item.member_count} anggota`,
          messages: existingMessages.get(item.id) ?? []
        };
      });
    });
    setActiveId((current) => {
      if (current && result.conversations.some((item) => item.id === current)) {
        return current;
      }
      return result.conversations[0]?.id ?? null;
    });
  };

  const loadMessages = async (conversationId: string, signal?: AbortSignal) => {
    const result = await apiRequest<{ messages: ApiMessage[] }>(
      `/api/conversations/${conversationId}/messages`,
      { signal }
    );
    const messages: Message[] = result.messages.map((message) => ({
      id: message.id,
      senderId: message.sender_id,
      senderName: message.sender_name,
      text: message.original_text,
      language: message.source_language,
      time: formatTime(message.created_at)
    }));
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, messages, unread: 0 }
          : conversation
      )
    );
  };

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ user: User; workspace: Workspace }>('/api/auth/me', {
      signal: controller.signal
    })
      .then((result) => {
        setUser(result.user);
        setWorkspace(result.workspace);
        setTargetLanguage(result.user.preferredLanguage);
      })
      .catch((cause: unknown) => {
        if (
          cause instanceof Error &&
          'status' in cause &&
          cause.status === 401
        ) {
          setAppError('');
          return;
        }
        if (!controller.signal.aborted) {
          setAppError(
            cause instanceof Error
              ? cause.message
              : 'Server tidak dapat dihubungi.'
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const refresh = () => {
      void loadConversations(controller.signal).catch((cause: unknown) => {
        if (!controller.signal.aborted) handleRequestError(cause);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || !activeId) return;
    const controller = new AbortController();
    const refresh = () => {
      void loadMessages(activeId, controller.signal).catch((cause: unknown) => {
        if (!controller.signal.aborted) handleRequestError(cause);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [user?.id, activeId]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
      if (toastTimer.current !== undefined) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const selectConversation = (id: string) => {
    setActiveId(id);
    setMobileChatOpen(true);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeId || isSending) return;
    setIsSending(true);
    try {
      await apiRequest<{ message: ApiMessage }>(
        `/api/conversations/${activeId}/messages`,
        { method: 'POST', body: JSON.stringify({ text }) }
      );
      setDraft('');
      await Promise.all([loadMessages(activeId), loadConversations()]);
    } catch (cause) {
      handleRequestError(cause);
    } finally {
      setIsSending(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const createConversation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewChatError('');
    try {
      const result = await apiRequest<{ id: string }>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ username: newChatUsername.trim() })
      });
      await loadConversations();
      setActiveId(result.id);
      setMobileChatOpen(true);
      setNewChatUsername('');
      setNewChatOpen(false);
    } catch (cause) {
      if (cause instanceof Error && 'status' in cause && cause.status === 401) {
        handleRequestError(cause);
      } else {
        setNewChatError(
          cause instanceof Error ? cause.message : 'Percakapan gagal dibuat.'
        );
      }
    }
  };

  const changeLanguage = async (value: string) => {
    if (value !== 'id' && value !== 'en' && value !== 'zh-CN') return;
    const previous = targetLanguage;
    setTargetLanguage(value);
    try {
      const result = await apiRequest<{ user: User }>('/api/auth/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ preferredLanguage: value })
      });
      setUser(result.user);
    } catch (cause) {
      setTargetLanguage(previous);
      handleRequestError(cause);
    }
  };

  const logout = async () => {
    try {
      await apiRequest<void>('/api/auth/logout', { method: 'POST' });
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal keluar.');
    } finally {
      setUser(null);
      setWorkspace(null);
      setConversations([]);
      setActiveId(null);
      setMobileChatOpen(false);
    }
  };

  if (isLoading) {
    return (
      <main className="auth-shell">
        <div className="auth-loading">
          <span className="brand-mark">
            <span className="brand-symbol"><span /><span /><span /><span /></span>
          </span>
          <span>Menghubungkan ke Univoxia…</span>
        </div>
      </main>
    );
  }

  if (!user || !workspace) {
    return (
      <AuthScreen
        serverError={appError}
        onAuthenticated={(authenticatedUser, authenticatedWorkspace) => {
          setUser(authenticatedUser);
          setWorkspace(authenticatedWorkspace);
          setTargetLanguage(authenticatedUser.preferredLanguage);
          setAppError('');
        }}
      />
    );
  }

  return (
    <main className={mobileChatOpen ? 'app-shell mobile-chat-open' : 'app-shell'}>
      <aside className="rail" aria-label="Navigasi utama">
        <a className="brand-mark" href="/" aria-label="Univoxia beranda">
          <span className="brand-symbol"><span /><span /><span /><span /></span>
        </a>
        <div className="rail-nav">
          <button className="rail-button is-active" aria-label="Pesan" title="Pesan">
            <Icon name="message" size={20} />
            {totalUnread > 0 && <i className="rail-indicator" />}
          </button>
          <button
            className="rail-button"
            aria-label="Disimpan"
            title="Disimpan"
            onClick={() => notify('Pesan tersimpan akan hadir di versi berikutnya.')}
          >
            <Icon name="bookmark" size={20} />
          </button>
          <button
            className="rail-button"
            aria-label="Kontak"
            title="Kontak"
            onClick={() => setNewChatOpen(true)}
          >
            <Icon name="users" size={20} />
          </button>
        </div>
        <div className="rail-bottom">
          <button
            className="rail-button"
            aria-label="Keluar"
            title="Keluar"
            onClick={logout}
          >
            <Icon name="settings" size={20} />
          </button>
          <Avatar label={initials(user.displayName)} color="indigo" size="small" />
        </div>
      </aside>

      <section className="conversation-sidebar">
        <header className="sidebar-header">
          <div className="wordmark">
            <span className="wordmark-symbol"><span /><span /><span /><span /></span>
            <span>univoxia</span>
          </div>
          <button
            className="icon-button quiet-button"
            aria-label="Salin kode undangan workspace"
            title="Salin kode undangan"
            onClick={() => {
              void navigator.clipboard
                .writeText(workspace.inviteCode)
                .then(() => notify(`Kode undangan ${workspace.inviteCode} disalin.`))
                .catch(() => notify(`Kode undangan: ${workspace.inviteCode}`));
            }}
          >
            <Icon name="users" size={18} />
          </button>
        </header>

        <button
          className="workspace-switcher"
          onClick={() => notify(`Kode undangan: ${workspace.inviteCode}`)}
          title="Klik untuk melihat kode undangan"
        >
          <div className="workspace-avatar">{initials(workspace.name).slice(0, 1)}</div>
          <div className="workspace-copy">
            <strong>{workspace.name}</strong>
            <span>@{user.username} · Undang anggota</span>
          </div>
          <Icon name="chevron" size={16} className="workspace-chevron" />
        </button>

        <div className="inbox-heading">
          <div>
            <h1>Pesan</h1>
            <span className="inbox-count">{conversations.length}</span>
          </div>
          <button
            className="icon-button new-chat-button"
            aria-label="Buat percakapan"
            title="Mulai chat dengan username"
            onClick={() => {
              setNewChatError('');
              setNewChatOpen(true);
            }}
          >
            <Icon name="plus" size={19} />
          </button>
        </div>

        <label className="search-box">
          <Icon name="search" size={17} />
          <input
            ref={searchInput}
            type="search"
            placeholder="Cari percakapan"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Cari percakapan"
          />
          <kbd>⌘ K</kbd>
        </label>

        <div className="filter-tabs" role="tablist" aria-label="Filter pesan">
          <button
            className={filter === 'all' ? 'filter-tab active' : 'filter-tab'}
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            Semua
          </button>
          <button
            className={filter === 'unread' ? 'filter-tab active' : 'filter-tab'}
            role="tab"
            aria-selected={filter === 'unread'}
            onClick={() => setFilter('unread')}
          >
            Belum dibaca
            {totalUnread > 0 && <span className="unread-tab-count">{totalUnread}</span>}
          </button>
        </div>

        <div className="conversation-list">
          {visibleConversations.map((conversation) => (
            <button
              className={
                conversation.id === activeId
                  ? 'conversation-item selected'
                  : 'conversation-item'
              }
              key={conversation.id}
              onClick={() => selectConversation(conversation.id)}
            >
              <Avatar
                label={conversation.initials}
                color={conversation.color}
                status={conversation.status}
              />
              <span className="conversation-copy">
                <span className="conversation-topline">
                  <strong>{conversation.name}</strong>
                  <time>{conversation.time}</time>
                </span>
                <span className="conversation-bottomline">
                  <span className="conversation-preview">{conversation.preview}</span>
                  {conversation.unread > 0 && (
                    <span className="unread-badge">{conversation.unread}</span>
                  )}
                </span>
              </span>
            </button>
          ))}
          {visibleConversations.length === 0 && (
            <div className="empty-list">
              <Icon name={search ? 'search' : 'message'} size={20} />
              <p>
                {search
                  ? 'Tidak ada percakapan yang cocok.'
                  : 'Belum ada chat. Buat percakapan atau undang anggota workspace.'}
              </p>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="translation-tip">
            <span className="tip-icon"><Icon name="sparkles" size={17} /></span>
            <div>
              <strong>Chat tersimpan di server.</strong>
              <span>Terjemahan AI belum terhubung.</span>
            </div>
            <Icon name="arrow" size={15} />
          </div>
          <div className="profile-row">
            <Avatar label={initials(user.displayName)} color="indigo" size="small" />
            <div className="profile-copy">
              <strong>{user.displayName}</strong>
              <span>@{user.username}</span>
            </div>
            <button
              className="icon-button quiet-button"
              aria-label="Keluar"
              title="Keluar"
              onClick={logout}
            >
              <Icon name="dots" size={19} />
            </button>
          </div>
        </div>
      </section>

      <section className="chat-panel" aria-label="Percakapan">
        {!activeConversation ? (
          <div className="welcome-panel">
            <div className="empty-chat-icon"><Icon name="message" size={24} /></div>
            <h2>Mulai percakapan.</h2>
            <p>Undang anggota ke workspace, lalu mulai chat dengan username mereka.</p>
            <button
              className="modal-submit"
              onClick={() => {
                void navigator.clipboard
                  .writeText(workspace.inviteCode)
                  .then(() => notify(`Kode undangan ${workspace.inviteCode} disalin.`))
                  .catch(() => notify(`Kode undangan: ${workspace.inviteCode}`));
              }}
            >
              Salin kode undangan
              <Icon name="arrow" size={16} />
            </button>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <div className="chat-person">
                <button
                  className="icon-button mobile-back"
                  aria-label="Kembali ke daftar pesan"
                  onClick={() => setMobileChatOpen(false)}
                >
                  <Icon name="chevron" size={19} className="back-chevron" />
                </button>
                <Avatar
                  label={activeConversation.initials}
                  color={activeConversation.color}
                  status={activeConversation.status}
                  size="large"
                />
                <div className="chat-person-copy">
                  <div className="chat-title-row"><h2>{activeConversation.name}</h2></div>
                  <span className="chat-presence">@{activeConversation.username}</span>
                </div>
              </div>
              <div className="chat-actions">
                <label className="language-picker">
                  <Icon name="globe" size={17} />
                  <select
                    value={targetLanguage}
                    onChange={(event) => void changeLanguage(event.target.value)}
                    aria-label="Bahasa pesan"
                    title="Bahasa pilihan untuk pesan yang kamu kirim"
                  >
                    {Object.entries(languageLabels).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </label>
                <span className="action-divider" />
                <button
                  className="icon-button"
                  aria-label="Panggilan video"
                  title="Panggilan video belum tersedia"
                  onClick={() => notify('Panggilan video belum tersedia.')}
                >
                  <Icon name="video" size={19} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Info workspace"
                  title={`Workspace: ${workspace.name}`}
                  onClick={() => notify(`Kode undangan: ${workspace.inviteCode}`)}
                >
                  <Icon name="dots" size={20} />
                </button>
              </div>
            </header>

            <div className="translation-banner">
              <span className="banner-sparkle"><Icon name="sparkles" size={15} /></span>
              <span>
                Pesanmu ditandai dalam <strong>{languageLabels[targetLanguage]}</strong>
              </span>
              <span className="demo-label">AI OFF</span>
              <span className="banner-link">Pesan ditampilkan dalam bahasa asli</span>
            </div>

            <div className="messages-scroll" key={activeConversation.id}>
              <div className="date-divider">
                <span />
                <time>Pesan tersimpan di workspace</time>
                <span />
              </div>
              {activeConversation.messages.map((message) => {
                const isOwnMessage = message.senderId === user.id;
                return (
                  <article
                    className={isOwnMessage ? 'message-row message-own' : 'message-row'}
                    key={message.id}
                  >
                    {!isOwnMessage && (
                      <Avatar
                        label={initials(message.senderName)}
                        color={activeConversation.color}
                        size="small"
                      />
                    )}
                    <div className="message-content">
                      {!isOwnMessage && (
                        <div className="message-meta">
                          <strong>{message.senderName}</strong>
                          <time>{message.time}</time>
                        </div>
                      )}
                      <div className={isOwnMessage ? 'message-bubble bubble-own' : 'message-bubble'}>
                        <p>{message.text}</p>
                        {!isOwnMessage && message.language !== targetLanguage && (
                          <span className="translation-caption original-language">
                            <Icon name="globe" size={12} />
                            {languageLabels[message.language]} · bahasa asli
                          </span>
                        )}
                      </div>
                      {isOwnMessage && (
                        <div className="own-message-meta">
                          <time>{message.time}</time>
                          <Icon name="check" size={13} />
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
              {activeConversation.messages.length === 0 && (
                <div className="empty-chat">
                  <div className="empty-chat-icon"><Icon name="message" size={24} /></div>
                  <h3>Mulai percakapan dengan {activeConversation.name}</h3>
                  <p>Kirim pesan pertama. Pesan akan disimpan ke database.</p>
                </div>
              )}
            </div>

            <div className="composer-wrap">
              <form className="composer" onSubmit={sendMessage}>
                <textarea
                  placeholder="Tulis pesan dalam bahasamu…"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  aria-label="Tulis pesan"
                  maxLength={8000}
                  rows={1}
                />
                <div className="composer-toolbar">
                  <div className="composer-tools">
                    <button
                      className="icon-button composer-tool"
                      type="button"
                      aria-label="Lampirkan file"
                      onClick={() => notify('Lampiran belum tersedia.')}
                    >
                      <Icon name="paperclip" size={18} />
                    </button>
                    <button
                      className="icon-button composer-tool"
                      type="button"
                      aria-label="Tambahkan emoji"
                      onClick={() => setDraft((current) => `${current} 😊`)}
                    >
                      <Icon name="smile" size={18} />
                    </button>
                    <span className="composer-hint">
                      <span className="hint-sparkle"><Icon name="globe" size={13} /></span>
                      Bahasa: {languageLabels[targetLanguage]}
                    </span>
                  </div>
                  <div className="send-controls">
                    <span className="keyboard-hint">↵</span>
                    <button
                      className="send-button"
                      type="submit"
                      aria-label="Kirim pesan"
                      disabled={!draft.trim() || isSending}
                    >
                      <Icon name="send" size={16} />
                    </button>
                  </div>
                </div>
              </form>
              <p className="demo-disclaimer">
                <span className="demo-dot" />
                Aktifkan HTTPS untuk akses jarak jauh · Pesan disimpan di database workspace
              </p>
            </div>
          </>
        )}
      </section>

      {appError && <div className="toast" role="alert">{appError}</div>}
      {toast && <div className="toast" role="status">{toast}</div>}

      {newChatOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setNewChatOpen(false);
          }}
        >
          <form className="new-chat-modal" onSubmit={createConversation}>
            <div className="modal-heading">
              <div className="modal-icon"><Icon name="message" size={20} /></div>
              <button
                className="icon-button quiet-button"
                type="button"
                aria-label="Tutup"
                onClick={() => setNewChatOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <h2>Percakapan baru</h2>
            <p>Masukkan username anggota lain di workspace ini.</p>
            <label className="modal-field">
              <span>Username anggota</span>
              <input
                autoFocus
                autoCapitalize="none"
                required
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9._-]+"
                value={newChatUsername}
                onChange={(event) => setNewChatUsername(event.target.value)}
                placeholder="Contoh: maya"
              />
            </label>
            {newChatError && <div className="auth-error" role="alert">{newChatError}</div>}
            <button className="modal-submit" type="submit" disabled={!newChatUsername.trim()}>
              Mulai percakapan
              <Icon name="arrow" size={16} />
            </button>
            <span className="modal-note">
              Belum satu workspace? Bagikan kode undangan {workspace.inviteCode}.
            </span>
          </form>
        </div>
      )}
    </main>
  );
}
