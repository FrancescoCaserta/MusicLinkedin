import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Building2, CalendarDays, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useViewer } from '../../app/session';
import type { AccountSummary, OrganisationView } from '../../data/api';
import { api } from '../../data/client';
import { useApiMutation, useApiQuery } from '../../data/hooks';
import { COUNTRY_NAMES } from '../../domain/cities';
import { ORG_KIND_LABELS } from '../../domain/taxonomy';
import { plural, t } from '../../i18n';
import { Async, Avatar, EmptyState, ErrorState, FeeBlock, Field, Modal, SkeletonList } from '../../ui/basics';
import { Combobox } from '../../ui/pickers';
import { ConcertItem, datesSummary, MessageButton, MusicianMini, TypeTag } from '../shared';

export function OrganisationsPage() {
  const [text, setText] = useState('');
  const list = useApiQuery(['organisations', text], () => api.listOrganisations(text), { placeholderData: (p) => p });
  return (
    <div className="wrap page">
      <div className="page__head">
        <div>
          <div className="label">{t('Ensembles and organisations')}</div>
          <h1 className="h-page">{t('Who is making music, and where')}</h1>
          <p className="page__sub">{t('Orchestras, ensembles, choirs, festivals, churches, schools and agencies — with the people who play for them and the concerts they have given.')}</p>
        </div>
        <input className="input" style={{ maxWidth: 300 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Search by name, city or kind…')} aria-label={t('Search organisations')} />
      </div>
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <div className="grid-3">{[0, 1, 2, 3, 4, 5].map((k) => <SkeletonList key={k} rows={1} height={150} />)}</div>
      ) : list.data.length === 0 ? (
        <EmptyState icon={<Building2 size={22} aria-hidden />} title={t('No organisation by that name')} text={t('Try a city or a kind of ensemble — “choir”, “baroque”, “festival”.')} />
      ) : (
        <div className="grid-3">
          {list.data.map((o) => (
            <Link key={o.id} to={`/ensembles/${o.slug}`} className="card orgcard">
              <Avatar name={o.name} org />
              <div className="label" style={{ marginTop: 14 }}>{t(ORG_KIND_LABELS[o.kind])}</div>
              <h3 className="h-card" style={{ margin: '4px 0' }}>{o.name}</h3>
              <div className="small muted">{o.base.name}, {t(COUNTRY_NAMES[o.base.country] ?? o.base.country)} · {t('since {year}', { year: o.founded })}</div>
              <div className="orgcard__stats small">
                <span><Users size={14} aria-hidden />{o.members}</span>
                <span><CalendarDays size={14} aria-hidden />{plural(o.concerts, '{n} concert', '{n} concerts')}</span>
                {o.openOpportunities > 0 && <span className="tag tag--accent">{plural(o.openOpportunities, '{n} open opportunity', '{n} open opportunities')}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AddMember({ org, onClose }: { org: OrganisationView; onClose: () => void }) {
  const viewer = useViewer();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<AccountSummary | null>(null);
  const [role, setRole] = useState('');
  const people = useApiQuery(['people', text], () => api.suggestPeople(text, viewer.id, 12), { enabled: text.trim().length > 1 && !picked });
  const add = useApiMutation(() => api.addMember(org.organisation.id, picked!.id, role, viewer.id), { success: t('{name} added as a member.', { name: picked?.name ?? '' }), onDone: onClose });
  const options = (people.data ?? []).filter((a) => a.kind === 'musician' && !org.members.some((m) => m.musician.id === a.id));
  return (
    <Modal
      title={t('Add a member')}
      kicker={org.organisation.name}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('Cancel')}</button>
          <button type="button" className="btn btn--primary" disabled={!picked || add.isPending} onClick={() => add.mutate(undefined)}>{t('Add member')}</button>
        </>
      }
    >
      <div className="stack stack--lg" style={{ minHeight: 240 }}>
        <Field label={t('Musician')} hint={picked ? picked.title : t('Type a name — only musicians on Leggio can be added.')}>
          <Combobox
            value={picked ? picked.name : text}
            onChange={(x) => {
              setPicked(null);
              setText(x);
            }}
            placeholder={t('Start typing a name…')}
            options={() => options.map((a) => ({ key: a.id, label: a.name, hint: a.title.slice(0, 44), value: a }))}
            onPick={(o) => setPicked(o.value)}
          />
        </Field>
        <Field label={t('Role in the ensemble')}>
          <input className="input" value={role} placeholder={t('e.g. Violin I, Continuo, Principal oboe')} onChange={(e) => setRole(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function OrgBody({ view }: { view: OrganisationView }) {
  const viewer = useViewer();
  const o = view.organisation;
  const [editing, setEditing] = useState(false);
  const [about, setAbout] = useState(o.about);
  const [adding, setAdding] = useState(false);
  const [allPast, setAllPast] = useState(false);
  const save = useApiMutation(() => api.updateOrganisation(o.id, { about }, viewer.id), { success: t('Page updated.'), onDone: () => setEditing(false) });
  const remove = useApiMutation((id: string) => api.removeMember(o.id, id, viewer.id), { success: t('Member removed.') });
  const admin = view.admins[0];
  return (
    <div className="wrap page">
      <header className="profile__head">
        <Avatar name={o.name} size="xl" org />
        <div className="grow">
          <div className="label label--accent">{t(ORG_KIND_LABELS[o.kind])}</div>
          <h1 className="display profile__name" style={{ fontSize: 'clamp(32px, 5vw, 54px)' }}>{o.name}</h1>
          <div className="meta profile__meta">
            <span><MapPin size={15} aria-hidden />{o.base.name}, {t(COUNTRY_NAMES[o.base.country] ?? o.base.country)}</span>
            <span>{t('Founded {year}', { year: o.founded })}</span>
            <span><Users size={15} aria-hidden />{plural(view.members.length, '{n} member on Leggio', '{n} members on Leggio')}</span>
            <span><CalendarDays size={15} aria-hidden />{plural(view.past.length, '{n} concert listed', '{n} concerts listed')}</span>
          </div>
          <div className="profile__actions">
            {view.isAdmin ? (
              <>
                <button type="button" className="btn btn--primary" onClick={() => setEditing(true)}><Pencil size={15} aria-hidden />{t('Edit page')}</button>
                <Link to="/opportunities/new" className="btn btn--ghost"><Plus size={15} aria-hidden />{t('Post an opportunity')}</Link>
                <Link to="/hiring" className="btn btn--ghost">{t('Review applicants')}</Link>
              </>
            ) : (
              admin && <MessageButton to={{ id: admin.id, name: admin.name }} small={false} />
            )}
          </div>
        </div>
      </header>

      <div className="cols profile__cols">
        <div>
          <section className="section">
            <div className="section__head"><h2 className="h-section">{t('About')}</h2></div>
            {editing ? (
              <div className="stack">
                <textarea className="textarea" rows={8} value={about} onChange={(e) => setAbout(e.target.value)} aria-label={t('About')} />
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn--ghost" onClick={() => { setEditing(false); setAbout(o.about); }}>{t('Cancel')}</button>
                  <button type="button" className="btn btn--primary" disabled={save.isPending || !about.trim()} onClick={() => save.mutate(undefined)}>{t('Save')}</button>
                </div>
              </div>
            ) : (
              <div className="prose">{o.about.split('\n').map((p, k) => <p key={k}>{p}</p>)}</div>
            )}
          </section>

          {view.opportunities.length > 0 && (
            <section className="section">
              <div className="section__head"><h2 className="h-section">{t('Open opportunities')}</h2></div>
              <div className="stack">
                {view.opportunities.map((op) => (
                  <Link key={op.id} to={`/opportunities/${op.id}`} className={`opp${op.urgent ? ' opp--urgent' : ''}`}>
                    <div className="opp__main">
                      <TypeTag o={op} />
                      <h3 className="h-card opp__title">{op.title}</h3>
                      <div className="small soft">{datesSummary(op)} · {op.place.name}</div>
                    </div>
                    <div className="opp__fee"><FeeBlock fee={op.fee} /></div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {view.upcoming.length > 0 && (
            <section className="section">
              <div className="section__head"><h2 className="h-section">{t('Coming up')}</h2></div>
              <ul>{view.upcoming.map((c) => <ConcertItem key={c.id} c={c} showPeople />)}</ul>
            </section>
          )}

          <section className="section">
            <div className="section__head">
              <h2 className="h-section">{t('Past concerts')}</h2>
              <span className="small muted">{plural(view.past.length, '{n} concert', '{n} concerts')}</span>
            </div>
            {view.past.length === 0 ? (
              <EmptyState compact icon={<CalendarDays size={20} aria-hidden />} title={t('No concerts listed')} text={o.kind === 'music-school' || o.kind === 'events' ? t('This organisation engages musicians rather than presenting public concerts.') : undefined} />
            ) : (
              <>
                <ul>{(allPast ? view.past : view.past.slice(0, 6)).map((c) => <ConcertItem key={c.id} c={c} showPeople />)}</ul>
                {view.past.length > 6 && <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} onClick={() => setAllPast(!allPast)}>{allPast ? t('Show fewer') : t('Show all {n} concerts', { n: view.past.length })}</button>}
              </>
            )}
          </section>
        </div>

        <aside className="profile__side" style={{ position: 'static' }}>
          <section className="card card--pad">
            <div className="row row--between" style={{ marginBottom: 12 }}>
              <span className="label">{t('Members on Leggio')}</span>
              {view.isAdmin && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(true)}><Plus size={14} aria-hidden />{t('Add')}</button>}
            </div>
            {view.members.length === 0 ? (
              <p className="small muted">{o.kind === 'festival' || o.kind === 'concert-society' ? t('No fixed members — this organisation invites guests for each programme.') : t('No members listed yet.')}</p>
            ) : (
              <ul className="stack">
                {view.members.map((m) => (
                  <li key={m.musician.id}>
                    <MusicianMini
                      m={m.musician}
                      sub={<>{m.role}{m.since ? ` · ${t('since {year}', { year: m.since })}` : ''}</>}
                      right={view.isAdmin ? <button type="button" className="btn btn--quiet btn--icon btn--sm" disabled={remove.isPending} onClick={() => window.confirm(t('Remove {name} from the members?', { name: m.musician.name })) && remove.mutate(m.musician.id)} aria-label={t('Remove {name}', { name: m.musician.name })}><Trash2 size={14} aria-hidden /></button> : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {view.guests.length > 0 && (
            <section className="card card--pad">
              <div className="label" style={{ marginBottom: 12 }}>{t('Regular guests')}</div>
              <ul className="stack">
                {view.guests.slice(0, 8).map((g) => (
                  <li key={g.musician.id}><MusicianMini m={g.musician} sub={<>{g.musician.headline.split(' · ')[0]} · {plural(g.concerts, '{n} concert', '{n} concerts')}</>} /></li>
                ))}
              </ul>
            </section>
          )}
          <section className="card card--pad">
            <div className="label" style={{ marginBottom: 12 }}>{t('Contact')}</div>
            {view.admins.map((a) => <MusicianMini key={a.id} m={a} />)}
          </section>
        </aside>
      </div>
      {adding && <AddMember org={view} onClose={() => setAdding(false)} />}
    </div>
  );
}

export function OrganisationPage() {
  const { slug = '' } = useParams();
  const viewer = useViewer();
  const view = useApiQuery(['organisation', slug, viewer.id], () => api.getOrganisation(slug, viewer.id));
  return <Async query={view} page>{(v) => <OrgBody view={v} key={v.organisation.id} />}</Async>;
}
