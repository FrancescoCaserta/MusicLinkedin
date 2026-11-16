import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Briefcase, CalendarDays, Check, CircleAlert, Clock, MapPin, Music2, Plus, Send, Users, X, Zap } from 'lucide-react';
import { useViewer } from '../../app/session';
import type { ApplicantView, OpportunityView, SearchHit } from '../../data/api';
import { api } from '../../data/client';
import { useApiMutation, useApiQuery } from '../../data/hooks';
import type { ApplicationStatus, ID } from '../../domain/types';
import { fmt, plural, t } from '../../i18n';
import { Async, Avatar, EmptyState, ErrorState, feeRange, FeeBlock, instrumentsLine, SkeletonList } from '../../ui/basics';
import { datesSummary, MessageButton, TypeTag } from '../shared';

export function HiringPage() {
  const viewer = useViewer();
  const list = useApiQuery(['postings', viewer.id], () => api.listPostings(viewer.id));
  return (
    <div className="wrap wrap--narrow page">
      <div className="page__head">
        <div>
          <div className="label">{t('Hiring')}</div>
          <h1 className="h-page">{t('My postings')}</h1>
        </div>
        <div className="row">
          <Link to="/opportunities/urgent" className="btn btn--urgent"><Zap size={15} aria-hidden />{t('Find a substitute')}</Link>
          <Link to="/opportunities/new" className="btn btn--primary"><Plus size={15} aria-hidden />{t('Post')}</Link>
        </div>
      </div>
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <SkeletonList rows={3} height={120} />
      ) : list.data.length === 0 ? (
        <EmptyState icon={<Briefcase size={22} aria-hidden />} title={t('You have not posted anything yet')} text={t('Post an engagement, an audition or a teaching post — or send an urgent call when someone drops out. Every posting states its fee.')} action={<Link to="/opportunities/new" className="btn btn--primary btn--sm">{t('Post an opportunity')}</Link>} />
      ) : (
        <div className="stack">
          {list.data.map((p) => {
            const o = p.opportunity;
            return (
              <Link key={o.id} to={`/hiring/${o.id}`} className={`opp${o.urgent && o.status === 'open' ? ' opp--urgent' : ''}`} style={o.status !== 'open' ? { opacity: 0.72 } : undefined}>
                <div className="opp__main">
                  <div className="row row--wrap" style={{ gap: 8 }}>
                    <TypeTag o={o} />
                    {o.status !== 'open' && <span className="tag">{o.status === 'filled' ? t('Filled') : t('Closed')}</span>}
                    {p.counts.applied > 0 && o.status === 'open' && <span className="tag tag--accent">{plural(p.counts.applied, '{n} to review', '{n} to review')}</span>}
                  </div>
                  <h3 className="h-card opp__title">{o.title}</h3>
                  <div className="meta" style={{ marginTop: 6 }}>
                    <span><CalendarDays size={14} aria-hidden />{datesSummary(o)}</span>
                    <span><MapPin size={14} aria-hidden />{o.place.name}</span>
                    {p.organisation && <span>{p.organisation.name}</span>}
                  </div>
                  <div className="pipeline">
                    <span><b className="num">{p.counts.applied + p.counts.shortlisted}</b> {t('applicants')}</span>
                    <span><b className="num">{p.counts.shortlisted}</b> {t('shortlisted')}</span>
                    <span><b className="num">{p.counts.invited}</b> {t('invited, waiting')}</span>
                    <span><b className="num">{p.counts.offered}</b> {t('offered')}</span>
                    <span className={p.counts.confirmed ? 'is-done' : ''}><b className="num">{p.counts.confirmed}</b> {t('confirmed')}</span>
                  </div>
                </div>
                <div className="opp__fee"><FeeBlock fee={o.fee} /></div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const HIRER_STATUS: Record<ApplicationStatus, [string, string]> = {
  invited: ['Invited — no answer yet', 'tag--line'],
  applied: ['To review', 'tag--accent'],
  shortlisted: ['Shortlisted', 'tag--ok'],
  offered: ['Offer sent — awaiting confirmation', 'tag--warn'],
  confirmed: ['Confirmed', 'tag--ok'],
  declined: ['Declined by you', ''],
  unavailable: ['Not available', ''],
  withdrawn: ['Withdrew', ''],
};

function FitLine({ a, total }: { a: ApplicantView; total: number }) {
  const f = a.fit;
  return (
    <div className="meta" style={{ marginTop: 6 }}>
      <span><MapPin size={14} aria-hidden />{fmt.km(f.distanceKm)}{!f.withinTravelRadius && <span className="tag tag--warn">{t('beyond usual radius')}</span>}</span>
      <span className={f.clashes.length ? 'is-warn' : ''}>
        {f.clashes.length ? <CircleAlert size={14} aria-hidden style={{ color: 'var(--warn)' }} /> : <Check size={14} aria-hidden style={{ color: 'var(--ok)' }} />}
        {f.clashes.length ? t('calendar clash on {dates}', { dates: f.clashes.map((c) => fmt.day(c.date)).join(', ') }) : t('free on every date')}
      </span>
      {total > 0 && <span><Music2 size={14} aria-hidden />{f.known.length ? t('has played {n} of {total}', { n: f.known.length, total }) : t('programme new to them')}</span>}
      <span className="num">{feeRange(a.musician.fee)}</span>
      {a.network?.sharedConcerts ? <span><Users size={14} aria-hidden />{plural(a.network.sharedConcerts, '{n} concert with you', '{n} concerts with you')}</span> : null}
    </div>
  );
}

function Applicant({ a, view }: { a: ApplicantView; view: OpportunityView }) {
  const viewer = useViewer();
  const o = view.opportunity;
  const app = a.application;
  const m = a.musician;
  const set = useApiMutation((status: 'applied' | 'shortlisted' | 'declined' | 'offered' | 'confirmed') => api.setApplicationStatus(app.id, status, viewer.id), {
    success: (_r, status) =>
      status === 'confirmed' ? t('{name} is confirmed. Everyone else has been told the call is filled.', { name: m.name }) : status === 'offered' ? t('Offer sent to {name}.', { name: m.name }) : status === 'shortlisted' ? t('{name} is on your shortlist.', { name: m.name }) : status === 'declined' ? t('{name} has been told, politely.', { name: m.name }) : undefined,
  });
  const [label, cls] = HIRER_STATUS[app.status];
  const open = o.status === 'open';
  const faded = ['declined', 'unavailable', 'withdrawn'].includes(app.status);
  return (
    <li className={`applicant card${faded ? ' is-faded' : ''}${app.status === 'confirmed' ? ' is-confirmed' : ''}`}>
      <div className="applicant__head">
        <Link to={`/musicians/${m.slug}`} className="mini__main">
          <Avatar name={m.name} tint={m.tint} />
          <span className="grow">
            <span className="mini__name">{m.name}</span>
            <span className="mini__sub">{instrumentsLine(m.instruments, 2)} · {m.base.name}</span>
          </span>
        </Link>
        <span className={`tag ${cls}`}>{app.status === 'applied' && app.origin === 'invited' ? t('Available — answered your invitation') : t(label)}</span>
      </div>
      {!faded && <FitLine a={a} total={o.repertoire.length} />}
      {app.message && <blockquote className="applicant__msg">“{app.message}”</blockquote>}
      <div className="applicant__foot">
        <span className="tiny muted">{app.origin === 'invited' ? t('invited by you') : t('applied')} · {fmt.ago(app.updatedAt)}</span>
        <span className="grow" />
        {open && (app.status === 'applied' || app.status === 'shortlisted') && (
          <>
            <button type="button" className="btn btn--quiet btn--sm" disabled={set.isPending} onClick={() => set.mutate('declined')}><X size={14} aria-hidden />{t('Decline')}</button>
            {app.status === 'applied' && !o.urgent && <button type="button" className="btn btn--ghost btn--sm" disabled={set.isPending} onClick={() => set.mutate('shortlisted')}>{t('Shortlist')}</button>}
            {o.urgent ? (
              <button type="button" className="btn btn--urgent btn--sm" disabled={set.isPending} onClick={() => set.mutate('confirmed')}><Check size={14} aria-hidden />{t('Confirm {name}', { name: m.name.split(' ')[0] })}</button>
            ) : (
              <button type="button" className="btn btn--primary btn--sm" disabled={set.isPending} onClick={() => set.mutate('offered')}>{t('Make an offer')}</button>
            )}
          </>
        )}
        {app.status === 'offered' && <span className="small muted"><Clock size={13} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('waiting for {name} to confirm', { name: m.name.split(' ')[0] })}</span>}
        {app.status === 'declined' && open && <button type="button" className="btn btn--quiet btn--sm" disabled={set.isPending} onClick={() => set.mutate('applied')}>{t('Reconsider')}</button>}
        <MessageButton to={{ id: m.id, name: m.name }} opportunityId={o.id} quiet />
      </div>
    </li>
  );
}

function Suggestions({ view }: { view: OpportunityView }) {
  const viewer = useViewer();
  const o = view.opportunity;
  const suggested = useApiQuery(['suggestions', o.id, viewer.id], () => api.suggestForOpportunity(o.id, viewer.id));
  const [picked, setPicked] = useState<ID[] | null>(null);
  const [message, setMessage] = useState('');
  const hits: SearchHit[] = suggested.data?.hits ?? [];
  // For an urgent call the best matches are pre-selected: one tap sends it.
  const selected = picked ?? (o.urgent ? hits.slice(0, 6).map((h) => h.musician.id) : []);
  const invite = useApiMutation(() => api.invite(o.id, selected, message, viewer.id), {
    success: (apps) => (o.urgent ? plural(apps.length, 'Call sent to {n} musician. Answers will appear above.', 'Call sent to {n} musicians. Answers will appear above.') : plural(apps.length, 'Invitation sent to {n} musician.', 'Invitations sent to {n} musicians.')),
    onDone: () => {
      setPicked(null);
      setMessage('');
    },
  });
  const toggle = (id: ID) => setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (suggested.isError) return <ErrorState error={suggested.error} onRetry={() => void suggested.refetch()} compact />;
  if (!suggested.data) return <SkeletonList rows={3} height={64} />;
  if (hits.length === 0) {
    return <EmptyState compact title={t('No one else fits right now')} text={t('Everyone who matches the instrument, the dates and the fee has already been invited or has applied. Try the full search to widen the net.')} action={<Link to={`/search?i=${o.instruments.join(',')}${o.place.cityId ? `&near=${o.place.cityId}&r=200` : ''}`} className="btn btn--ghost btn--sm">{t('Open the search')}</Link>} />;
  }
  return (
    <div className="stack">
      <ul className="card rows">
        {hits.map((h) => {
          const m = h.musician;
          const on = selected.includes(m.id);
          return (
            <li key={m.id} className={`rows__item suggest${on ? ' is-on' : ''}`}>
              <label className="check" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(m.id)} aria-label={t('Select {name}', { name: m.name })} />
              </label>
              <Link to={`/musicians/${m.slug}`} className="mini__main">
                <Avatar name={m.name} tint={m.tint} />
                <span className="grow">
                  <span className="mini__name">{m.name}</span>
                  <span className="mini__sub">
                    {instrumentsLine(m.instruments, 1)} · {m.base.name}
                    {h.distanceKm != null && ` · ${fmt.km(h.distanceKm)}`} · {feeRange(m.fee)}
                  </span>
                </span>
              </Link>
              <span className="row row--wrap suggest__tags" style={{ gap: 4, justifyContent: 'flex-end' }}>
                {h.availability === 'tentative' && <span className="tag tag--warn">{t('pencilled')}</span>}
                {h.network?.connected && <span className="tag">{t('in your network')}</span>}
                {h.network?.sharedConcerts ? <span className="tag tag--ok">{plural(h.network.sharedConcerts, '{n} concert together', '{n} concerts together')}</span> : null}
                {h.shortlisted && <span className="tag tag--accent">{t('saved')}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="invitebar card card--pad">
        <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={o.urgent ? t('Add a line to the call (optional)') : t('Add a personal note (optional)')} aria-label={t('Message')} />
        <button type="button" className={`btn ${o.urgent ? 'btn--urgent' : 'btn--primary'}`} disabled={!selected.length || invite.isPending} onClick={() => invite.mutate(undefined)}>
          {o.urgent ? <Zap size={15} aria-hidden /> : <Send size={15} aria-hidden />}
          {o.urgent ? plural(selected.length, 'Call {n} musician', 'Call {n} musicians') : plural(selected.length, 'Invite {n} musician', 'Invite {n} musicians')}
        </button>
      </div>
    </div>
  );
}

function Manage({ view }: { view: OpportunityView }) {
  const viewer = useViewer();
  const o = view.opportunity;
  const applicants = useApiQuery(['applicants', o.id, viewer.id], () => api.listApplicants(o.id, viewer.id), { refetchInterval: (q) => (q.state.data?.some((a) => a.application.status === 'invited' || a.application.status === 'offered') ? 4000 : false) });
  const setStatus = useApiMutation((status: 'open' | 'filled' | 'closed') => api.setOpportunityStatus(o.id, status, viewer.id), {
    success: (_r, s) => (s === 'open' ? t('Reopened — it is back on the board.') : s === 'filled' ? t('Marked as filled and taken off the board.') : t('Closed and taken off the board.')),
  });
  const list = applicants.data ?? [];
  const responses = list.filter((a) => a.application.status !== 'invited');
  const waiting = list.filter((a) => a.application.status === 'invited');
  const confirmed = list.filter((a) => a.application.status === 'confirmed');

  return (
    <div className="wrap page" style={{ maxWidth: 940 }}>
      <Link to="/hiring" className="btn btn--quiet btn--sm" style={{ marginLeft: -10, marginBottom: 8 }}><ArrowLeft size={15} aria-hidden /> {t('My postings')}</Link>
      <header className="manage__head">
        <div className="grow">
          <div className="row row--wrap" style={{ gap: 8, marginBottom: 8 }}>
            <TypeTag o={o} />
            <span className={`tag ${o.status === 'open' ? 'tag--ok' : ''}`}>{o.status === 'open' ? t('Open') : o.status === 'filled' ? t('Filled') : t('Closed')}</span>
          </div>
          <h1 className="h-page">{o.title}</h1>
          <div className="meta" style={{ marginTop: 10 }}>
            <span><CalendarDays size={14} aria-hidden />{datesSummary(o)}</span>
            <span><MapPin size={14} aria-hidden />{o.place.venue ? `${o.place.venue}, ` : ''}{o.place.name}</span>
            <span><FeeBlock fee={o.fee} /></span>
          </div>
        </div>
        <div className="row row--wrap">
          <Link to={`/opportunities/${o.id}`} className="btn btn--ghost btn--sm">{t('View posting')}</Link>
          {o.status === 'open' ? (
            <>
              <button type="button" className="btn btn--ghost btn--sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate('filled')}>{t('Mark as filled')}</button>
              <button type="button" className="btn btn--quiet btn--sm" disabled={setStatus.isPending} onClick={() => window.confirm(t('Close this posting? It will leave the board.')) && setStatus.mutate('closed')}>{t('Close')}</button>
            </>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate('open')}>{t('Reopen')}</button>
          )}
        </div>
      </header>

      {confirmed.length > 0 && (
        <div className="filledbar card">
          <Check size={18} aria-hidden />
          <span className="grow">
            <b>{t('{names} confirmed.', { names: fmt.list(confirmed.map((a) => a.musician.name)) })}</b> {t('The dates are in their calendar.')}
          </span>
          <MessageButton to={{ id: confirmed[0].musician.id, name: confirmed[0].musician.name }} opportunityId={o.id} />
        </div>
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="h-section">{o.urgent ? t('Answers') : t('Applicants')}</h2>
          <span className="small muted">
            {applicants.data ? plural(responses.length, '{n} response', '{n} responses') : ''}
            {waiting.length > 0 && ` · ${plural(waiting.length, '{n} not yet answered', '{n} not yet answered')}`}
          </span>
        </div>
        {applicants.isError ? (
          <ErrorState error={applicants.error} onRetry={() => void applicants.refetch()} compact />
        ) : !applicants.data ? (
          <SkeletonList rows={2} height={120} />
        ) : list.length === 0 ? (
          <EmptyState compact icon={<Users size={20} aria-hidden />} title={o.urgent ? t('Nobody called yet') : t('No applicants yet')} text={o.urgent ? t('Choose who to call below. Answers arrive here as they come in.') : t('It is on the board. In the meantime, invite the musicians who fit — suggestions are below.')} />
        ) : (
          <>
            <ul className="stack">{responses.map((a) => <Applicant key={a.application.id} a={a} view={view} />)}</ul>
            {waiting.length > 0 && (
              <div className="waiting">
                <span className="label">{o.urgent ? t('Called, no answer yet') : t('Invited, no answer yet')}</span>
                <div className="row row--wrap" style={{ gap: 8, marginTop: 8 }}>
                  {waiting.map((a) => (
                    <Link key={a.application.id} to={`/musicians/${a.musician.slug}`} className="chip">
                      <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, color: 'var(--ink-3)' }} />
                      {a.musician.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {o.status === 'open' && (
        <section className="section">
          <div className="section__head">
            <h2 className="h-section">{o.urgent ? t('Who to call') : t('Suggested musicians')}</h2>
            <span className="small muted">{o.urgent ? t('free that day · close by · take last-minute calls') : t('right instrument · free on the dates · fee within range')}</span>
          </div>
          <Suggestions view={view} />
        </section>
      )}
    </div>
  );
}

export function ManagePage() {
  const { id = '' } = useParams();
  const viewer = useViewer();
  const view = useApiQuery(['opportunity', id, viewer.id], () => api.getOpportunity(id, viewer.id));
  return (
    <Async query={view} page>
      {(v) =>
        v.isMine ? (
          <Manage view={v} key={v.opportunity.id} />
        ) : (
          <div className="wrap wrap--narrow page">
            <EmptyState title={t('This is not your posting')} text={t('Only {name} can review its applicants. Switch persona from the menu, or open the posting itself.', { name: v.poster.name })} action={<Link to={`/opportunities/${v.opportunity.id}`} className="btn btn--primary btn--sm">{t('View the posting')}</Link>} />
          </div>
        )
      }
    </Async>
  );
}
