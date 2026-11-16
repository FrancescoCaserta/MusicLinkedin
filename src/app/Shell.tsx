import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { Bell, Bookmark, Briefcase, Building2, CalendarDays, Check, ChevronDown, FileText, Home, LogOut, MessageSquare, Pencil, Plus, RefreshCw, Search, User, Users, WifiOff, Zap } from 'lucide-react';
import type { MyApplicationView, NotificationView } from '../data/api';
import { api, isSimulatingFailure, setSimulatingFailure } from '../data/client';
import { useApiMutation, useApiQuery } from '../data/hooks';
import { keyDate } from '../domain/search/opportunities';
import { fmt, t } from '../i18n';
import { Avatar, FeeBlock } from '../ui/basics';
import { Logo } from '../ui/Logo';
import { PERSONA_GUIDE } from './personas';
import { useSession } from './session';
import { useToast } from './toast';

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export function notificationText(n: NotificationView): { text: string; to: string } {
  const who = n.actor?.name ?? t('Someone');
  const title = n.opportunity?.title ?? t('an opportunity');
  const opp = n.opportunity ? `/opportunities/${n.opportunity.id}` : '/opportunities';
  const manage = n.opportunity ? `/hiring/${n.opportunity.id}` : '/hiring';
  switch (n.notification.kind) {
    case 'urgent-call':
      return { text: t('Urgent call from {who}: “{title}”', { who, title }), to: opp };
    case 'invitation':
      return { text: t('{who} invited you to “{title}”', { who, title }), to: opp };
    case 'application':
      return { text: t('{who} applied to “{title}”', { who, title }), to: manage };
    case 'application-status': {
      const s = n.notification.status;
      if (s === 'shortlisted') return { text: t('You are on the shortlist for “{title}”', { title }), to: opp };
      if (s === 'offered') return { text: t('You have an offer: “{title}”', { title }), to: opp };
      if (s === 'confirmed') return { text: t('You are confirmed for “{title}”', { title }), to: opp };
      return { text: t('“{title}” went to someone else this time', { title }), to: opp };
    }
    case 'invitation-response': {
      const s = n.notification.status;
      if (s === 'applied') return { text: t('{who} is available for “{title}”', { who, title }), to: manage };
      if (s === 'confirmed') return { text: t('{who} confirmed “{title}”', { who, title }), to: manage };
      if (s === 'withdrawn') return { text: t('{who} withdrew from “{title}”', { who, title }), to: manage };
      return { text: t('{who} is not available for “{title}”', { who, title }), to: manage };
    }
    case 'connection-request':
      return { text: t('{who} would like to connect', { who }), to: '/network' };
    case 'connection-accepted':
      return { text: t('{who} accepted your connection request', { who }), to: n.actor?.slug ? `/musicians/${n.actor.slug}` : '/network' };
    case 'endorsement':
      return { text: t('{who} endorsed you', { who }), to: '/network?tab=endorsements' };
  }
}

function Notifications({ accountId, unread }: { accountId: string; unread: number }) {
  const { open, setOpen, ref } = usePopover();
  const list = useApiQuery(['notifications', accountId], () => api.listNotifications(accountId), { enabled: open });
  const markRead = useApiMutation(() => api.markNotificationsRead(accountId));
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        className="btn btn--quiet btn--icon top__icon"
        aria-label={unread ? t('Notifications, {n} unread', { n: unread }) : t('Notifications')}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open && unread) window.setTimeout(() => markRead.mutate(undefined), 1500);
        }}
      >
        <Bell size={19} aria-hidden />
        {unread > 0 && <span className="count top__count">{unread}</span>}
      </button>
      {open && (
        <div className="menu menu--wide" role="menu">
          <div className="menu__section" style={{ padding: '12px 16px 8px' }}>
            <div className="label">{t('Notifications')}</div>
          </div>
          <div className="menu__section">
            {list.isLoading && <div className="muted small" style={{ padding: 12 }}>{t('Loading…')}</div>}
            {list.isError && <div className="small" style={{ padding: 12, color: 'var(--urgent)' }}>{t('Notifications could not be loaded.')}</div>}
            {list.data?.length === 0 && <div className="muted small" style={{ padding: 12 }}>{t('Nothing yet. Invitations, applications and endorsements will appear here.')}</div>}
            {list.data?.map((n) => {
              const { text, to } = notificationText(n);
              return (
                <Link key={n.notification.id} to={to} className={`menu__item notif${n.notification.read ? '' : ' is-unread'}`} role="menuitem">
                  {n.actor ? <Avatar name={n.actor.name} tint={n.actor.tint} size="sm" /> : <span className="avatar avatar--sm" />}
                  <span className="grow">
                    <span className="notif__text">{text}</span>
                    <span className="tiny muted">{fmt.ago(n.notification.createdAt)}</span>
                  </span>
                  {n.notification.kind === 'urgent-call' && <span className="tag tag--urgent">{t('Urgent')}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { session, accountId, signIn, signOut } = useSession();
  const { open, setOpen, ref } = usePopover();
  const navigate = useNavigate();
  const toast = useToast();
  const personas = useApiQuery(['personas'], () => api.listPersonas(), { enabled: open });
  const [failing, setFailing] = useState(isSimulatingFailure);
  const reset = useApiMutation(() => api.resetDemo(), { success: t('Demo data restored to its starting point.') });
  const a = session?.account;
  const musician = session?.musician;
  const item = (to: string, icon: ReactNode, label: string) => (
    <Link to={to} className="menu__item" role="menuitem">
      {icon}
      {label}
    </Link>
  );
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button type="button" className="top__me" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t('Account menu')}>
        <Avatar name={a?.name ?? '· ·'} tint={a?.tint} size="sm" />
        <span className="top__me-name">{a?.name.split(' ')[0] ?? ''}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu__section" style={{ padding: '14px 16px' }}>
            <div className="row">
              <Avatar name={a?.name ?? ''} tint={a?.tint} />
              <div className="grow">
                <div style={{ fontWeight: 650 }}>{a?.name}</div>
                <div className="tiny muted">{a?.title}</div>
              </div>
            </div>
          </div>
          <div className="menu__section">
            {musician && item(`/musicians/${musician.slug}`, <User size={16} aria-hidden />, t('My profile'))}
            {musician && item('/profile/edit', <Pencil size={16} aria-hidden />, t('Edit profile'))}
            {musician && item('/calendar', <CalendarDays size={16} aria-hidden />, t('My calendar'))}
            {musician && item('/applications', <FileText size={16} aria-hidden />, t('Applications and invitations'))}
            {item('/hiring', <Briefcase size={16} aria-hidden />, t('My postings'))}
            {item('/shortlist', <Bookmark size={16} aria-hidden />, t('Saved musicians'))}
            {session?.organisations.map((o) => (
              <Link key={o.id} to={`/ensembles/${o.slug}`} className="menu__item" role="menuitem">
                <Building2 size={16} aria-hidden />
                {o.name}
              </Link>
            ))}
            {item('/ensembles', <Building2 size={16} aria-hidden />, t('Ensembles and organisations'))}
          </div>
          <div className="menu__section">
            <div className="label" style={{ padding: '8px 10px 4px' }}>{t('Demo personas')}</div>
            {personas.data?.map((p) => (
              <button
                key={p.account.id}
                type="button"
                className="menu__item"
                role="menuitem"
                onClick={() => {
                  if (p.account.id !== accountId) {
                    signIn(p.account.id);
                    navigate('/home');
                    toast.ok(t('You are now {name}.', { name: p.account.name }));
                  }
                  setOpen(false);
                }}
              >
                <Avatar name={p.account.name} tint={p.account.tint} size="sm" />
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600, lineHeight: 1.25 }}>{p.account.name}</span>
                  <span className="tiny muted">{t(PERSONA_GUIDE[p.account.id]?.role ?? '')}</span>
                </span>
                {p.account.id === accountId && <Check size={16} aria-hidden />}
              </button>
            ))}
            {personas.isLoading && <div className="muted small" style={{ padding: '6px 10px' }}>{t('Loading…')}</div>}
          </div>
          <div className="menu__section">
            <div className="label" style={{ padding: '8px 10px 4px' }}>{t('Demo tools')}</div>
            <button
              type="button"
              className="menu__item"
              role="menuitemcheckbox"
              aria-checked={failing}
              onClick={() => {
                setSimulatingFailure(!failing);
                setFailing(!failing);
                toast.ok(!failing ? t('Network failure simulated: every request now fails.') : t('Network restored.'));
              }}
            >
              <WifiOff size={16} aria-hidden />
              <span className="grow">{t('Simulate a network failure')}</span>
              {failing && <Check size={16} aria-hidden />}
            </button>
            <button
              type="button"
              className="menu__item"
              role="menuitem"
              onClick={() => {
                if (window.confirm(t('Restore the demo to its starting point? Everything you changed will be lost.'))) {
                  reset.mutate(undefined);
                  setOpen(false);
                }
              }}
            >
              <RefreshCw size={16} aria-hidden />
              {t('Reset demo data')}
            </button>
            <button
              type="button"
              className="menu__item"
              role="menuitem"
              onClick={() => {
                signOut();
                navigate('/');
              }}
            >
              <LogOut size={16} aria-hidden />
              {t('Leave the demo')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A pending urgent call is the one thing that may interrupt whatever the musician is doing. */
function UrgentBanner({ call, accountId }: { call: MyApplicationView; accountId: string }) {
  const o = call.opportunity;
  const respond = useApiMutation((accept: boolean) => api.respond(call.application.id, accountId, accept), {
    success: (_r, accept) => (accept ? t('Sent — {name} knows you can do it.', { name: call.poster.name }) : t('Declined. Thank you for answering quickly.')),
  });
  const date = keyDate(o);
  const perf = o.dates.find((d) => d.date === date && d.kind === 'performance') ?? o.dates.find((d) => d.date === date);
  return (
    <div className="urgent-bar" role="alert">
      <div className="wrap urgent-bar__in">
        <span className="urgent-bar__flag">
          <Zap size={14} aria-hidden /> {t('Urgent call')}
        </span>
        <Link to={`/opportunities/${o.id}`} className="urgent-bar__title">
          {o.title}
        </Link>
        <span className="urgent-bar__meta">
          {date && fmt.day(date)}
          {perf?.time ? `, ${perf.time}` : ''} · {o.place.name} · <FeeBlock fee={o.fee} />
        </span>
        <span className="urgent-bar__actions">
          <button type="button" className="btn btn--sm urgent-bar__yes" disabled={respond.isPending} onClick={() => respond.mutate(true)}>
            {t('I can do it')}
          </button>
          <button type="button" className="btn btn--sm urgent-bar__no" disabled={respond.isPending} onClick={() => respond.mutate(false)}>
            {t('I can’t')}
          </button>
        </span>
      </div>
    </div>
  );
}

export function Shell() {
  const { accountId, session } = useSession();
  const location = useLocation();
  const badges = useApiQuery(['badges', accountId], () => api.getBadges(accountId!), { enabled: !!accountId, refetchInterval: 20_000 });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!accountId) return <Navigate to={`/demo?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  const unread = badges.data?.unreadMessages ?? 0;
  const links: { to: string; label: string; icon: ReactNode; badge?: number; mobile: boolean }[] = [
    { to: '/home', label: t('Home'), icon: <Home size={20} aria-hidden />, mobile: true },
    { to: '/search', label: t('Find musicians'), icon: <Search size={20} aria-hidden />, mobile: true },
    { to: '/opportunities', label: t('Opportunities'), icon: <Briefcase size={20} aria-hidden />, mobile: true },
    { to: '/network', label: t('Network'), icon: <Users size={20} aria-hidden />, mobile: true },
    { to: '/ensembles', label: t('Ensembles'), icon: <Building2 size={20} aria-hidden />, mobile: false },
    { to: '/messages', label: t('Messages'), icon: <MessageSquare size={20} aria-hidden />, badge: unread, mobile: true },
  ];
  const short: Record<string, string> = { '/search': t('Search'), '/opportunities': t('Work') };
  const call = badges.data?.urgentCalls[0];

  return (
    <div className="shell">
      <header className="top no-print">
        <div className="wrap top__in">
          <Link to="/home" aria-label={t('Leggio home')}>
            <Logo size={26} />
          </Link>
          <nav className="top__nav" aria-label={t('Main')}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className="top__link">
                {l.label}
                {!!l.badge && <span className="count">{l.badge}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="top__actions">
            <Link to="/opportunities/urgent" className="btn btn--sm btn--urgent top__sub">
              <Zap size={15} aria-hidden />
              <span>{t('Find a substitute')}</span>
            </Link>
            <Link to="/opportunities/new" className="btn btn--sm btn--ghost top__post">
              <Plus size={15} aria-hidden />
              {t('Post')}
            </Link>
            <Notifications accountId={accountId} unread={badges.data?.unreadNotifications ?? 0} />
            <AccountMenu />
          </div>
        </div>
      </header>
      {call && !location.pathname.startsWith(`/opportunities/${call.opportunity.id}`) && <UrgentBanner call={call} accountId={accountId} />}
      <main key={session?.account.id ?? 'loading'}>
        <Outlet />
      </main>
      <nav className="tabbar no-print" aria-label={t('Main')}>
        {links
          .filter((l) => l.mobile)
          .map((l) => (
            <NavLink key={l.to} to={l.to} className="tabbar__link">
              <span className="tabbar__icon">
                {l.icon}
                {!!l.badge && <span className="count">{l.badge}</span>}
              </span>
              {short[l.to] ?? l.label}
            </NavLink>
          ))}
      </nav>
    </div>
  );
}
