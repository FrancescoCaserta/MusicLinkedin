import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check, Quote, UserPlus, Users, X } from 'lucide-react';
import { useViewer } from '../../app/session';
import type { EndorsementView, SuggestionView } from '../../data/api';
import { api } from '../../data/client';
import { useApiMutation, useApiQuery } from '../../data/hooks';
import { normalise } from '../../domain/taxonomy';
import type { ID } from '../../domain/types';
import { fmt, plural, t } from '../../i18n';
import { Avatar, EmptyState, ErrorState, Field, Modal, SkeletonList } from '../../ui/basics';
import { MessageButton, MusicianMini } from '../shared';

/** Write an endorsement for someone you played with — the concert is chosen from those you share. */
function QuickEndorse({ person, onClose }: { person: SuggestionView['account']; onClose: () => void }) {
  const viewer = useViewer();
  const profile = useApiQuery(['profile', person.slug ?? person.id, viewer.id], () => api.getProfile(person.slug ?? person.id, viewer.id));
  const shared = profile.data?.relation.sharedConcerts ?? [];
  const [concertId, setConcertId] = useState('');
  const [text, setText] = useState('');
  const chosen = concertId || shared[0]?.id || '';
  const save = useApiMutation(() => api.endorse(viewer.id, person.id, chosen, text), { success: t('Endorsement published on {name}’s profile.', { name: person.name.split(' ')[0] }), onDone: onClose });
  return (
    <Modal
      title={t('Endorse {name}', { name: person.name })}
      kicker={t('Tied to a concert you shared')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('Cancel')}</button>
          <button type="button" className="btn btn--primary" disabled={text.trim().length < 20 || !chosen || save.isPending} onClick={() => save.mutate(undefined)}>{t('Publish endorsement')}</button>
        </>
      }
    >
      {profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} compact />
      ) : !profile.data ? (
        <SkeletonList rows={2} height={60} />
      ) : (
        <div className="stack stack--lg">
          <Field label={t('Which concert?')} hint={t('Only concerts you both took part in are listed.')}>
            <select className="select" value={chosen} onChange={(e) => setConcertId(e.target.value)}>
              {shared.map((c) => (
                <option key={c.id} value={c.id}>{fmt.date(c.date)} — {c.programme[0]?.composer}: {c.programme[0]?.work} · {c.venue}, {c.city}</option>
              ))}
            </select>
          </Field>
          <Field label={t('What was it like to work together?')} hint={t('A sentence or two a hirer would find useful — preparation, reliability, how they play with others.')}>
            <textarea className="textarea" rows={5} value={text} maxLength={600} onChange={(e) => setText(e.target.value)} data-autofocus />
          </Field>
        </div>
      )}
    </Modal>
  );
}

function EndorsementList({ items, side }: { items: EndorsementView[]; side: 'from' | 'to' }) {
  return (
    <ul className="endorsements">
      {items.map((e) => {
        const who = side === 'from' ? e.from : e.to;
        return (
          <li key={e.id} className="endorsement">
            <p className="endorsement__text">{e.text}</p>
            <div className="endorsement__by">
              <Avatar name={who.name} tint={who.tint} size="sm" />
              <div>
                <div>
                  <span className="muted">{side === 'from' ? t('from') : t('for')} </span>
                  {who.slug ? <Link className="link" to={`/musicians/${who.slug}`}>{who.name}</Link> : <b>{who.name}</b>}
                  <span className="muted"> · {who.title}</span>
                </div>
                <div className="tiny muted">{e.concert.programme[0] ? `${e.concert.programme[0].composer}, ${e.concert.programme[0].work} — ` : ''}{e.concert.venue}, {e.concert.city}, {fmt.date(e.concert.date)}</div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function NetworkPage() {
  const viewer = useViewer();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'endorsements' ? 'endorsements' : params.get('tab') === 'connections' ? 'connections' : 'overview';
  const net = useApiQuery(['network', viewer.id], () => api.getNetwork(viewer.id));
  const [filter, setFilter] = useState('');
  const [endorsing, setEndorsing] = useState<SuggestionView['account'] | null>(null);
  const respond = useApiMutation(({ id, accept }: { id: ID; accept: boolean }) => api.respondToConnection(id, accept, viewer.id), { success: (_r, a) => (a.accept ? t('Connected.') : t('Request ignored.')) });
  const connect = useApiMutation((toId: ID) => api.requestConnection(viewer.id, toId), { success: t('Connection request sent.') });
  const remove = useApiMutation((id: ID) => api.removeConnection(id, viewer.id), { success: t('Connection removed.') });
  const connections = useMemo(() => {
    const q = normalise(filter);
    return (net.data?.connections ?? []).filter((c) => !q || normalise(`${c.account.name} ${c.account.title}`).includes(q));
  }, [net.data, filter]);

  return (
    <div className="wrap page">
      <div className="page__head">
        <div>
          <div className="label">{t('Network')}</div>
          <h1 className="h-page">{t('The people you have played with')}</h1>
          <p className="page__sub">{t('Connections come from concerts, and endorsements cite the concert they are about.')}</p>
        </div>
      </div>
      <div className="tabs" role="tablist" style={{ marginBottom: 24 }}>
        <button type="button" role="tab" aria-selected={tab === 'overview'} className="tab" onClick={() => setParams({}, { replace: true })}>{t('Overview')}{!!net.data?.incoming.length && <span className="count">{net.data.incoming.length}</span>}</button>
        <button type="button" role="tab" aria-selected={tab === 'connections'} className="tab" onClick={() => setParams({ tab: 'connections' }, { replace: true })}>{t('Connections')}{net.data && <span className="muted num"> {net.data.connections.length}</span>}</button>
        <button type="button" role="tab" aria-selected={tab === 'endorsements'} className="tab" onClick={() => setParams({ tab: 'endorsements' }, { replace: true })}>{t('Endorsements')}{net.data && <span className="muted num"> {net.data.received.length}</span>}</button>
      </div>

      {net.isError ? (
        <ErrorState error={net.error} onRetry={() => void net.refetch()} />
      ) : !net.data ? (
        <SkeletonList rows={4} height={84} />
      ) : tab === 'overview' ? (
        <div className="stack stack--lg">
          {net.data.incoming.length > 0 && (
            <section>
              <h2 className="h-section" style={{ marginBottom: 12 }}>{t('Requests to connect')}</h2>
              <ul className="card rows">
                {net.data.incoming.map((c) => (
                  <li key={c.connectionId} className="rows__item">
                    <MusicianMini m={c.account} sub={<>{c.account.title}{c.sharedConcerts > 0 && <> · <b>{plural(c.sharedConcerts, '{n} concert together', '{n} concerts together')}</b></>}</>} />
                    <button type="button" className="btn btn--quiet btn--sm" disabled={respond.isPending} onClick={() => respond.mutate({ id: c.connectionId, accept: false })}><X size={14} aria-hidden />{t('Ignore')}</button>
                    <button type="button" className="btn btn--primary btn--sm" disabled={respond.isPending} onClick={() => respond.mutate({ id: c.connectionId, accept: true })}><Check size={14} aria-hidden />{t('Accept')}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className="section__head">
              <h2 className="h-section">{t('Endorse a colleague')}</h2>
              <span className="small muted">{t('people you are connected to and have shared a stage with')}</span>
            </div>
            {net.data.endorsable.length === 0 ? (
              <EmptyState compact icon={<Quote size={20} aria-hidden />} title={t('Nobody waiting for your words')} text={t('When you share a concert with a connection, you can endorse them here.')} />
            ) : (
              <div className="grid-2">
                {net.data.endorsable.map((s) => (
                  <div key={s.account.id} className="card card--pad endorse-card">
                    <MusicianMini m={s.account} />
                    {s.lastConcert && <p className="small soft">{t('You played together at {venue}, {city}, on {date}', { venue: s.lastConcert.venue, city: s.lastConcert.city, date: fmt.date(s.lastConcert.date) })}{s.sharedConcerts > 1 ? ` — ${plural(s.sharedConcerts, '{n} concert in all', '{n} concerts in all')}.` : '.'}</p>}
                    <div><button type="button" className="btn btn--ghost btn--sm" onClick={() => setEndorsing(s.account)}><Quote size={14} aria-hidden />{t('Write an endorsement')}</button></div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="section__head">
              <h2 className="h-section">{t('You have played together')}</h2>
              <span className="small muted">{t('not yet connected')}</span>
            </div>
            {net.data.suggestions.length === 0 ? (
              <EmptyState compact icon={<Users size={20} aria-hidden />} title={t('No suggestions right now')} text={t('People appear here when you share a concert with them.')} />
            ) : (
              <ul className="card rows">
                {net.data.suggestions.map((s) => (
                  <li key={s.account.id} className="rows__item">
                    <MusicianMini m={s.account} sub={<>{plural(s.sharedConcerts, '{n} concert together', '{n} concerts together')}{s.lastConcert ? ` · ${t('last at {venue}, {date}', { venue: s.lastConcert.venue, date: fmt.date(s.lastConcert.date) })}` : ''}{s.mutuals > 0 ? ` · ${plural(s.mutuals, '{n} in common', '{n} in common')}` : ''}</>} />
                    <button type="button" className="btn btn--ghost btn--sm" disabled={connect.isPending} onClick={() => connect.mutate(s.account.id)}><UserPlus size={14} aria-hidden />{t('Connect')}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {net.data.outgoing.length > 0 && (
            <section>
              <h2 className="h-section" style={{ marginBottom: 12 }}>{t('Requests you have sent')}</h2>
              <ul className="card rows">
                {net.data.outgoing.map((c) => (
                  <li key={c.connectionId} className="rows__item">
                    <MusicianMini m={c.account} />
                    <span className="tag">{t('waiting')}</span>
                    <button type="button" className="btn btn--quiet btn--sm" disabled={remove.isPending} onClick={() => remove.mutate(c.connectionId)}>{t('Cancel request')}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : tab === 'connections' ? (
        <div className="stack">
          <input className="input" style={{ maxWidth: 360 }} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('Search your {n} connections…', { n: net.data.connections.length })} aria-label={t('Search connections')} />
          {net.data.connections.length === 0 ? (
            <EmptyState icon={<Users size={22} aria-hidden />} title={t('No connections yet')} text={t('Connect with the people you have played with — your network helps hirers who know them find you.')} />
          ) : connections.length === 0 ? (
            <EmptyState compact title={t('Nobody by that name')} />
          ) : (
            <ul className="card rows">
              {connections.map((c) => (
                <li key={c.connectionId} className="rows__item">
                  <MusicianMini m={c.account} sub={<>{c.account.title}{c.sharedConcerts > 0 && ` · ${plural(c.sharedConcerts, '{n} concert together', '{n} concerts together')}`}</>} />
                  <MessageButton to={{ id: c.account.id, name: c.account.name }} quiet />
                  <button type="button" className="btn btn--quiet btn--sm" disabled={remove.isPending} onClick={() => window.confirm(t('Remove {name} from your connections?', { name: c.account.name })) && remove.mutate(c.connectionId)} aria-label={t('Remove {name}', { name: c.account.name })}><X size={14} aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="cols cols--even">
          <section>
            <h2 className="h-section" style={{ marginBottom: 14 }}>{t('Received')} <span className="muted num">{net.data.received.length}</span></h2>
            {net.data.received.length ? <EndorsementList items={net.data.received} side="from" /> : <EmptyState compact icon={<Quote size={20} aria-hidden />} title={t('None yet')} text={viewer.isMusician ? t('Endorsements arrive from people who shared a concert with you.') : t('Endorsements are written for musicians.')} />}
          </section>
          <section>
            <h2 className="h-section" style={{ marginBottom: 14 }}>{t('Given')} <span className="muted num">{net.data.given.length}</span></h2>
            {net.data.given.length ? <EndorsementList items={net.data.given} side="to" /> : <EmptyState compact icon={<Quote size={20} aria-hidden />} title={t('You have not endorsed anyone yet')} text={t('A few specific words after a good concert are worth more than any badge.')} />}
          </section>
        </div>
      )}
      {endorsing && <QuickEndorse person={endorsing} onClose={() => setEndorsing(null)} />}
    </div>
  );
}
