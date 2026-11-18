import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MessageSquare } from 'lucide-react';
import { useViewer } from '../../app/session';
import type { ConcertView, PostView } from '../../data/api';
import { api } from '../../data/client';
import { useApiMutation, useApiQuery } from '../../data/hooks';
import type { ID } from '../../domain/types';
import { fmt, t } from '../../i18n';
import { Avatar, SkeletonList } from '../../ui/basics';
import { dotDate, eventTitle } from '../events/Events';

/** Clapping hands. Outline by default; given: orange fill with an ink outline. */
export function BravoIcon({ on, size = 20 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? 'var(--action)' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="8" width="6" height="13" rx="3" transform="rotate(-18 8 14.5)" />
      <rect x="13" y="8" width="6" height="13" rx="3" transform="rotate(18 16 14.5)" />
      <path d="M12 2.5v2.5M8.6 3.4l1.1 2M15.4 3.4l-1.1 2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Person({ a }: { a: { name: string; slug?: string } }) {
  return a.slug ? <Link to={`/musicians/${a.slug}`} className="post__who">{a.name}</Link> : <span className="post__who">{a.name}</span>;
}

export function EventAttachment({ c, playing }: { c: ConcertView; playing?: string }) {
  const seats = c.openSeats ?? [];
  return (
    <div className="attach">
      <Link to={`/events/${c.id}`} className="attach__main">
        <span className="attach__date">{dotDate(c.date)}</span>
        <span className="grow">
          {playing && <span className="label" style={{ marginBottom: 4 }}>{t('I’m playing')} · {playing}</span>}
          <span className="attach__title">{eventTitle(c)}</span>
          <span className="small muted">{c.time ? `${c.time} · ` : ''}{c.venue}, {c.city}</span>
        </span>
        <span className="small">{t('Event')} ▸</span>
      </Link>
      {seats.map((s) => (
        <Link key={s.id} to={s.opportunityId ? `/opportunities/${s.opportunityId}` : `/events/${c.id}`} className="attach__seat">
          <span className="seat__mark" aria-hidden>+</span>
          <span className="seat__label">{t('1 open seat')} · {s.role}</span>
        </Link>
      ))}
    </div>
  );
}

function Comments({ post }: { post: PostView }) {
  const viewer = useViewer();
  const [body, setBody] = useState('');
  const add = useApiMutation(() => api.addComment(post.id, viewer.id, body), { onDone: () => setBody('') });
  return (
    <div className="comments">
      {post.comments.map((c) => (
        <div key={c.id} className="comment">
          <Avatar name={c.author.name} tint={c.author.tint} size="sm" />
          <div className="grow">
            <div className="small"><Person a={c.author} /> <span className="muted">· {fmt.ago(c.createdAt)}</span></div>
            <p className="comment__body">{c.body}</p>
          </div>
        </div>
      ))}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate(undefined);
        }}
      >
        <label htmlFor={`c-${post.id}`} className="sr-only">{t('Write a comment')}</label>
        <input id={`c-${post.id}`} className="input grow" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('Write a comment')} />
        <button type="submit" className="btn btn--ghost btn--sm" disabled={!body.trim() || add.isPending}>{t('Reply')}</button>
      </form>
    </div>
  );
}

export function PostCard({ post }: { post: PostView }) {
  const viewer = useViewer();
  const [open, setOpen] = useState(false);
  const bravo = useApiMutation(() => api.toggleBravo(post.id, viewer.id));
  const others = post.bravos - (post.bravoed ? 1 : 0);
  return (
    <article className="post">
      {post.activity && (
        <p className="post__activity">
          <Avatar name={post.activity.by.name} tint={post.activity.by.tint} size="sm" />
          <span>
            <Person a={post.activity.by} />
            {post.activity.others > 0 && ` ${post.activity.others === 1 ? t('and 1 other') : t('and {n} others', { n: post.activity.others })}`}{' '}
            {post.activity.kind === 'comment' ? t('commented on this') : t('gave a Bravo to this')}
          </span>
        </p>
      )}
      <header className="post__head">
        <Avatar name={post.author.name} tint={post.author.tint} />
        <div className="grow">
          <Person a={post.author} />
          <p className="tiny muted">{post.author.title.slice(0, 70)} · {fmt.ago(post.createdAt)}</p>
        </div>
      </header>
      <p className="post__body">{post.body}</p>
      {post.concert && <EventAttachment c={post.concert} playing={post.playing} />}
      <footer className="post__actions">
        <button type="button" className={`post__act${post.bravoed ? ' is-on' : ''}`} aria-pressed={post.bravoed} disabled={bravo.isPending} onClick={() => bravo.mutate(undefined)}>
          <BravoIcon on={post.bravoed} />
          {post.bravoed ? (others ? t('Bravo · you and {n}', { n: others }) : t('Bravo · you')) : post.bravos ? t('Bravo · {n}', { n: post.bravos }) : t('Bravo')}
        </button>
        <button type="button" className="post__act" aria-expanded={open} onClick={() => setOpen(!open)}>
          <MessageSquare size={17} strokeWidth={1.5} aria-hidden />
          {post.comments.length ? t('Comment {n}', { n: post.comments.length }) : t('Comment')}
        </button>
      </footer>
      {open && <Comments post={post} />}
    </article>
  );
}

/** Write a post; optionally attach one of your events. */
export function Composer({ onPosted, autoFocus = false, full = false }: { onPosted?: () => void; autoFocus?: boolean; full?: boolean }) {
  const viewer = useViewer();
  const [body, setBody] = useState('');
  const [concertId, setConcertId] = useState<ID>('');
  const events = useApiQuery(['my-events', viewer.id], () => api.listMyEvents(viewer.id));
  const create = useApiMutation(() => api.createPost({ authorId: viewer.id, body, concertId: concertId || undefined }), {
    success: t('Posted.'),
    onDone: () => {
      setBody('');
      setConcertId('');
      onPosted?.();
    },
  });
  return (
    <form
      className={`composer${full ? ' composer--full' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) create.mutate(undefined);
      }}
    >
      <label htmlFor="composer" className="sr-only">{t('Write a post')}</label>
      <textarea id="composer" className="composer__text" rows={full ? 6 : 1} autoFocus={autoFocus} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('Share a concert, a recording, a thought')} />
      <div className="composer__bar">
        {!!events.data?.length && (
          <select className="select select--sm composer__event" aria-label={t('Attach an event')} value={concertId} onChange={(e) => setConcertId(e.target.value)}>
            <option value="">{t('Attach an event…')}</option>
            {events.data.map((c) => <option key={c.id} value={c.id}>{dotDate(c.date)} · {eventTitle(c)}</option>)}
          </select>
        )}
        <button type="submit" className="btn btn--accent" disabled={!body.trim() || create.isPending}>{t('Post')}</button>
      </div>
    </form>
  );
}

export function Feed() {
  const viewer = useViewer();
  const feed = useApiQuery(['feed', viewer.id], () => api.listFeed(viewer.id));
  return (
    <section className="feedx">
      <Composer />
      <p className="label feedx__label">{t('Your network')}</p>
      {feed.isLoading && <SkeletonList rows={2} height={180} />}
      {feed.data?.length === 0 && <p className="muted small">{t('Nothing here yet. Posts from the people you are connected to will appear here.')}</p>}
      {feed.data?.map((p) => <PostCard key={p.id} post={p} />)}
    </section>
  );
}

export function ComposePage() {
  const navigate = useNavigate();
  return (
    <div className="wrap wrap--narrow page">
      <header className="page__head">
        <h1 className="h-page">{t('New post')}</h1>
      </header>
      <div className="stack stack--lg" style={{ marginTop: 24 }}>
        <Composer full autoFocus onPosted={() => navigate('/home')} />
        <div className="compose__more">
          <p className="label">{t('Or')}</p>
          <Link to="/opportunities/new" className="compose__link">{t('Post an opportunity')} <span className="muted small">{t('Work with a stated fee')}</span></Link>
          <Link to="/opportunities/urgent" className="compose__link">{t('Find a substitute')} <span className="muted small">{t('Someone dropped out')}</span></Link>
          <Link to="/events/new" className="compose__link">{t('Create an event')} <span className="muted small">{t('A concert, a production, a session')}</span></Link>
        </div>
      </div>
    </div>
  );
}
