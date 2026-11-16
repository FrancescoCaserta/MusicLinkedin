import { Link } from 'react-router';
import { ArrowRight, Briefcase, CalendarDays, FileText, MessageSquare, Search, UserPlus, Users, Zap } from 'lucide-react';
import { PERSONA_GUIDE } from '../../app/personas';
import { useViewer } from '../../app/session';
import type { HomeView, MyApplicationView } from '../../data/api';
import { api } from '../../data/client';
import { useApiMutation, useApiQuery } from '../../data/hooks';
import { today } from '../../domain/dates';
import { keyDate } from '../../domain/search/opportunities';
import { fmt, plural, t } from '../../i18n';
import { Avatar, EmptyState, ErrorState, FeeBlock, SkeletonList } from '../../ui/basics';
import { OpportunityCard } from '../shared';

function Invitation({ v, kind }: { v: MyApplicationView; kind: 'invitation' | 'offer' }) {
  const viewer = useViewer();
  const o = v.opportunity;
  const respond = useApiMutation((accept: boolean) => api.respond(v.application.id, viewer.id, accept), {
    success: (r) => (r.status === 'confirmed' ? t('Confirmed. The dates are now in your calendar.') : r.status === 'applied' ? t('Sent — {name} knows you are available.', { name: v.poster.name }) : t('Declined. {name} has been told.', { name: v.poster.name })),
  });
  const date = keyDate(o);
  const urgent = o.urgent && kind === 'invitation';
  return (
    <li className={`todo card${urgent ? ' todo--urgent' : ''}`}>
      <div className="grow">
        <div className="row row--wrap" style={{ gap: 8 }}>
          {urgent ? <span className="tag tag--urgent"><Zap size={11} aria-hidden />{t('Urgent call')}</span> : <span className="tag tag--accent">{kind === 'offer' ? t('Offer') : t('Invitation')}</span>}
          <span className="tiny muted">{t('from {name}', { name: v.organisation?.name ?? v.poster.name })} · {fmt.ago(v.application.updatedAt)}</span>
        </div>
        <Link to={`/opportunities/${o.id}`} className="h-card todo__title">{o.title}</Link>
        <div className="small soft">{date ? fmt.day(date) : ''} · {o.place.name} · <FeeBlock fee={o.fee} /></div>
        {v.application.inviteMessage && kind === 'invitation' && <p className="small soft todo__note">“{v.application.inviteMessage}”</p>}
      </div>
      <div className="todo__actions">
        <button type="button" className={`btn btn--sm ${urgent ? 'btn--urgent' : kind === 'offer' ? 'btn--accent' : 'btn--primary'}`} disabled={respond.isPending} onClick={() => respond.mutate(true)}>
          {kind === 'offer' ? t('Confirm') : urgent ? t('I can do it') : t('I’m interested')}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={respond.isPending} onClick={() => respond.mutate(false)}>{t('Decline')}</button>
        <Link to={`/opportunities/${o.id}`} className="btn btn--quiet btn--sm">{t('Details')}</Link>
      </div>
    </li>
  );
}

function Activity({ items }: { items: HomeView['activity'] }) {
  if (!items.length) return <EmptyState compact icon={<Users size={20} aria-hidden />} title={t('Quiet for now')} text={t('Endorsements, new postings and connections in your network will appear here.')} />;
  return (
    <ul className="feed">
      {items.map((it) => {
        if (it.kind === 'endorsement') {
          const e = it.endorsement;
          return (
            <li key={`e-${it.id}`} className="feed__item">
              <Avatar name={e.from.name} tint={e.from.tint} size="sm" />
              <div className="grow">
                <div className="small">
                  <b>{e.from.name}</b> {t('endorsed')} {e.to.slug ? <Link className="link" to={`/musicians/${e.to.slug}`}>{e.to.name}</Link> : <b>{e.to.name}</b>}
                  <span className="muted"> · {fmt.ago(it.at)}</span>
                </div>
                <p className="feed__quote">{e.text}</p>
                <div className="tiny muted">{e.concert.programme[0] ? `${e.concert.programme[0].composer}, ${e.concert.programme[0].work} — ` : ''}{e.concert.venue}, {e.concert.city}, {fmt.date(e.concert.date)}</div>
              </div>
            </li>
          );
        }
        if (it.kind === 'opportunity') {
          return (
            <li key={`o-${it.id}`} className="feed__item">
              <Avatar name={it.organisation?.name ?? it.poster.name} tint={it.poster.tint} size="sm" org={!!it.organisation} />
              <div className="grow">
                <div className="small"><b>{it.organisation?.name ?? it.poster.name}</b> {it.opportunity.urgent ? t('needs a substitute') : t('posted an opportunity')}<span className="muted"> · {fmt.ago(it.at)}</span></div>
                <Link to={`/opportunities/${it.opportunity.id}`} className="feed__link">{it.opportunity.title}</Link>
                <div className="tiny muted">{it.opportunity.place.name} · <FeeBlock fee={it.opportunity.fee} /></div>
              </div>
            </li>
          );
        }
        return (
          <li key={`c-${it.id}`} className="feed__item">
            <Avatar name={it.a.name} tint={it.a.tint} size="sm" />
            <div className="grow small">
              {it.a.slug ? <Link className="link" to={`/musicians/${it.a.slug}`}>{it.a.name}</Link> : <b>{it.a.name}</b>} {t('and')} {it.b.slug ? <Link className="link" to={`/musicians/${it.b.slug}`}>{it.b.name}</Link> : <b>{it.b.name}</b>} {t('are now connected')}
              <span className="muted"> · {fmt.ago(it.at)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function HomePage() {
  const viewer = useViewer();
  const home = useApiQuery(['home', viewer.id], () => api.getHome(viewer.id), { refetchInterval: 30_000 });
  const meta = useApiQuery(['meta'], () => api.getMeta());
  const a = viewer.account;
  const guide = PERSONA_GUIDE[viewer.id];
  const h = home.data;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('Good morning, {name}') : hour < 18 ? t('Good afternoon, {name}') : t('Good evening, {name}');
  const todo = h ? h.actions.invitations.length + h.actions.offers.length + h.actions.newApplicants.length + (h.actions.connectionRequests ? 1 : 0) + (h.actions.unreadMessages ? 1 : 0) : 0;
  const urgentFirst = h ? [...h.actions.invitations].sort((x, y) => Number(y.opportunity.urgent) - Number(x.opportunity.urgent)) : [];

  return (
    <div className="wrap page home">
      <div className="page__head">
        <div>
          <div className="label">{fmt.long(today())}</div>
          <h1 className="h-page">{greeting.replace('{name}', a?.name.split(' ')[0] ?? '')}</h1>
        </div>
        <div className="row row--wrap">
          <Link to="/search" className="btn btn--primary"><Search size={15} aria-hidden />{t('Find musicians')}</Link>
          {viewer.isMusician ? <Link to="/opportunities" className="btn btn--ghost"><Briefcase size={15} aria-hidden />{t('Browse work')}</Link> : <Link to="/opportunities/new" className="btn btn--ghost">{t('Post an opportunity')}</Link>}
        </div>
      </div>

      {home.isError ? (
        <ErrorState error={home.error} onRetry={() => void home.refetch()} />
      ) : !h ? (
        <div className="cols"><SkeletonList rows={4} height={110} /><SkeletonList rows={2} height={160} /></div>
      ) : (
        <div className="cols">
          <div className="stack stack--lg">
            <section>
              <div className="section__head">
                <h2 className="h-section">{t('Waiting for you')}</h2>
                {todo > 0 && <span className="count">{todo}</span>}
              </div>
              {todo === 0 ? (
                <EmptyState compact title={t('Nothing needs your attention')} text={viewer.isMusician ? t('Invitations, offers and urgent calls will appear here the moment they arrive.') : t('New applicants and answers to your invitations will appear here.')} />
              ) : (
                <ul className="stack">
                  {h.actions.offers.map((v) => <Invitation key={v.application.id} v={v} kind="offer" />)}
                  {urgentFirst.map((v) => <Invitation key={v.application.id} v={v} kind="invitation" />)}
                  {h.actions.newApplicants.map((p) => (
                    <li key={p.opportunity.id} className="todo card">
                      <div className="grow">
                        <span className="tag tag--accent">{plural(p.counts.applied, '{n} applicant to review', '{n} applicants to review')}</span>
                        <Link to={`/hiring/${p.opportunity.id}`} className="h-card todo__title">{p.opportunity.title}</Link>
                        <div className="small soft">{p.organisation?.name ?? t('Posted by you')} · {p.opportunity.place.name}</div>
                      </div>
                      <div className="todo__actions"><Link to={`/hiring/${p.opportunity.id}`} className="btn btn--primary btn--sm">{t('Review')}<ArrowRight size={14} aria-hidden /></Link></div>
                    </li>
                  ))}
                  {h.actions.connectionRequests > 0 && (
                    <li className="todo todo--slim card">
                      <UserPlus size={18} aria-hidden />
                      <span className="grow">{plural(h.actions.connectionRequests, '{n} colleague would like to connect', '{n} colleagues would like to connect')}</span>
                      <Link to="/network" className="btn btn--ghost btn--sm">{t('See requests')}</Link>
                    </li>
                  )}
                  {h.actions.unreadMessages > 0 && (
                    <li className="todo todo--slim card">
                      <MessageSquare size={18} aria-hidden />
                      <span className="grow">{plural(h.actions.unreadMessages, '{n} unread message', '{n} unread messages')}</span>
                      <Link to="/messages" className="btn btn--ghost btn--sm">{t('Read')}</Link>
                    </li>
                  )}
                </ul>
              )}
            </section>

            {viewer.isMusician && (
              <section>
                <div className="section__head">
                  <h2 className="h-section">{t('Work that fits you')}</h2>
                  <Link to="/opportunities" className="link small">{t('All opportunities')}</Link>
                </div>
                {h.opportunities.length === 0 ? (
                  <EmptyState compact icon={<Briefcase size={20} aria-hidden />} title={t('Nothing for your instrument nearby right now')} text={t('Widen your travel radius or look at the whole board.')} action={<Link to="/opportunities" className="btn btn--ghost btn--sm">{t('Open the board')}</Link>} />
                ) : (
                  <div className="stack">{h.opportunities.slice(0, 4).map((v) => <OpportunityCard key={v.opportunity.id} view={v} compact />)}</div>
                )}
              </section>
            )}

            <section>
              <div className="section__head"><h2 className="h-section">{t('In your network')}</h2></div>
              <Activity items={h.activity} />
            </section>
          </div>

          <aside className="stack stack--lg">
            <section className="card card--pad">
              <div className="label" style={{ marginBottom: 12 }}>{t('Concerts coming up')}</div>
              {h.upcomingConcerts.length === 0 ? (
                <p className="small muted">{t('No concerts in your network in the coming weeks.')}</p>
              ) : (
                <ul className="upcoming">
                  {h.upcomingConcerts.map(({ concert: c, people, mine }) => (
                    <li key={c.id}>
                      <div className="upcoming__date"><span className="num">{c.date.slice(8)}</span>{fmt.monthShort(c.date)}</div>
                      <div className="grow">
                        <div className="upcoming__what">{c.programme[0]?.composer}: {c.programme[0]?.work}{c.programme.length > 1 ? ` +${c.programme.length - 1}` : ''}</div>
                        <div className="tiny muted">{c.orgSlug ? <Link className="link" to={`/ensembles/${c.orgSlug}`}>{c.ensembleName}</Link> : (c.ensembleName ?? t('Recital'))} · {c.city}</div>
                        <div className="tiny" style={{ marginTop: 2 }}>
                          {mine ? <span className="tag tag--ok">{viewer.isMusician ? t('you are playing') : t('your concert')}</span> : <span className="muted">{t('with')} {people.slice(0, 2).map((p) => p.name).join(', ')}{people.length > 2 ? ` +${people.length - 2}` : ''}</span>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {viewer.musician && (
              <section className="card card--pad">
                <div className="label" style={{ marginBottom: 10 }}>{t('Your profile')}</div>
                <div className="row" style={{ marginBottom: 12 }}>
                  <Avatar name={viewer.musician.name} tint={viewer.musician.tint} />
                  <div className="grow">
                    <div style={{ fontWeight: 650 }}>{viewer.musician.name}</div>
                    <div className="tiny muted">{plural(viewer.musician.repertoire.length, '{n} work in repertoire', '{n} works in repertoire')} · {t('updated {when}', { when: fmt.ago(viewer.musician.updatedAt) })}</div>
                  </div>
                </div>
                <div className="stack stack--sm">
                  <Link to={`/musicians/${viewer.musician.slug}`} className="icon-line"><FileText size={15} aria-hidden /><span className="link">{t('View my profile')}</span></Link>
                  <Link to="/calendar" className="icon-line"><CalendarDays size={15} aria-hidden /><span className="link">{t('Update my calendar')}</span></Link>
                  <Link to="/applications" className="icon-line"><Briefcase size={15} aria-hidden /><span className="link">{t('Applications and invitations')}</span></Link>
                </div>
              </section>
            )}

            {guide && (
              <section className="card card--pad guide">
                <div className="label label--accent" style={{ marginBottom: 8 }}>{t('Demo guide')}</div>
                <p className="small soft" style={{ marginBottom: 10 }}>{t('You are {name}, {role}. Worth trying:', { name: a?.name.split(' ')[0] ?? '', role: t(guide.role).toLowerCase() })}</p>
                <ul className="stack stack--sm">
                  {guide.tries.map((x) => (
                    <li key={x.label}><Link to={x.to(meta.data?.demoDate ?? today())} className="link small">{t(x.label)}</Link></li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
