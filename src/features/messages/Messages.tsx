import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, MessageSquare, PenLine, Send } from 'lucide-react';
import { useViewer } from '../../app/session';
import type { AccountSummary } from '../../data/api';
import { api } from '../../data/client';
import { useApiMutation, useApiQuery } from '../../data/hooks';
import { fmt, t } from '../../i18n';
import { Avatar, EmptyState, ErrorState, Field, Modal, SkeletonList } from '../../ui/basics';
import { Combobox } from '../../ui/pickers';

function NewMessage({ onClose }: { onClose: () => void }) {
  const viewer = useViewer();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [to, setTo] = useState<AccountSummary | null>(null);
  const [body, setBody] = useState('');
  const people = useApiQuery(['people', text], () => api.suggestPeople(text, viewer.id, 10), { enabled: text.trim().length > 1 && !to });
  const send = useApiMutation(() => api.sendMessage({ fromId: viewer.id, toId: to!.id, body }), {
    onDone: (r) => {
      onClose();
      navigate(`/messages/${r.threadId}`);
    },
  });
  return (
    <Modal
      title={t('New message')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('Cancel')}</button>
          <button type="button" className="btn btn--primary" disabled={!to || !body.trim() || send.isPending} onClick={() => send.mutate(undefined)}><Send size={15} aria-hidden />{t('Send')}</button>
        </>
      }
    >
      <div className="stack stack--lg" style={{ minHeight: 280 }}>
        <Field label={t('To')} hint={to?.title}>
          <Combobox
            value={to ? to.name : text}
            onChange={(x) => {
              setTo(null);
              setText(x);
            }}
            placeholder={t('Type a name…')}
            options={() => (people.data ?? []).map((a) => ({ key: a.id, label: a.name, hint: a.title.slice(0, 44), value: a }))}
            onPick={(o) => setTo(o.value)}
          />
        </Field>
        <Field label={t('Message')}>
          <textarea className="textarea" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function Thread({ threadId }: { threadId: string }) {
  const viewer = useViewer();
  const thread = useApiQuery(['thread', threadId, viewer.id], () => api.getThread(threadId, viewer.id), { refetchInterval: 8000 });
  const [body, setBody] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const read = useApiMutation(() => api.markThreadRead(threadId, viewer.id));
  const send = useApiMutation(() => api.sendMessage({ fromId: viewer.id, toId: thread.data!.other.id, body }), { onDone: () => setBody('') });
  const count = thread.data?.messages.length ?? 0;
  const unread = thread.data?.messages.some((m) => m.fromId !== viewer.id && !m.readBy.includes(viewer.id));

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [count, threadId]);
  useEffect(() => {
    if (unread) read.mutate(undefined);
  }, [unread, threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (thread.isError) return <div className="thread"><div style={{ padding: 24 }}><ErrorState error={thread.error} onRetry={() => void thread.refetch()} /></div></div>;
  if (!thread.data) return <div className="thread"><div style={{ padding: 24 }}><SkeletonList rows={4} height={56} /></div></div>;
  const { other, messages, opportunity } = thread.data;
  let lastDay = '';
  const submit = () => body.trim() && !send.isPending && send.mutate(undefined);
  return (
    <div className="thread">
      <header className="thread__head">
        <Link to="/messages" className="btn btn--quiet btn--icon btn--sm thread__back" aria-label={t('All conversations')}><ArrowLeft size={18} aria-hidden /></Link>
        <Avatar name={other.name} tint={other.tint} />
        <div className="grow">
          <div style={{ fontWeight: 650 }}>{other.slug ? <Link to={`/musicians/${other.slug}`}>{other.name}</Link> : other.name}</div>
          <div className="tiny muted thread__title">{other.title}</div>
        </div>
      </header>
      {opportunity && (
        <Link to={`/opportunities/${opportunity.id}`} className="thread__context small">
          <span className="label">{t('About')}</span> {opportunity.title}
        </Link>
      )}
      <div className="thread__body" role="log" aria-live="polite">
        {messages.map((m) => {
          const day = m.sentAt.slice(0, 10);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.fromId === viewer.id;
          return (
            <div key={m.id}>
              {showDay && <div className="thread__day label">{fmt.long(day)}</div>}
              <div className={`bubble${mine ? ' bubble--mine' : ''}`}>
                <p>{m.body}</p>
                <span className="bubble__time">{fmt.time(m.sentAt)}</span>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form
        className="thread__compose"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          className="textarea"
          rows={1}
          value={body}
          placeholder={t('Write to {name}…', { name: other.name.split(' ')[0] })}
          aria-label={t('Message')}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="submit" className="btn btn--primary btn--icon" disabled={!body.trim() || send.isPending} aria-label={t('Send')}><Send size={16} aria-hidden /></button>
      </form>
    </div>
  );
}

export function MessagesPage() {
  const viewer = useViewer();
  const { threadId } = useParams();
  const threads = useApiQuery(['threads', viewer.id], () => api.listThreads(viewer.id), { refetchInterval: 10_000 });
  const [composing, setComposing] = useState(false);
  return (
    <div className={`wrap page inbox${threadId ? ' inbox--open' : ''}`}>
      <aside className="inbox__list">
        <div className="row row--between" style={{ marginBottom: 14 }}>
          <h1 className="h-section">{t('Messages')}</h1>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setComposing(true)}><PenLine size={14} aria-hidden />{t('New')}</button>
        </div>
        {threads.isError ? (
          <ErrorState error={threads.error} onRetry={() => void threads.refetch()} compact />
        ) : !threads.data ? (
          <SkeletonList rows={4} height={64} />
        ) : threads.data.length === 0 ? (
          <EmptyState compact icon={<MessageSquare size={20} aria-hidden />} title={t('No conversations yet')} text={t('Message a musician from their profile or from a search result.')} />
        ) : (
          <ul className="card rows">
            {threads.data.map((x) => (
              <li key={x.thread.id}>
                <Link to={`/messages/${x.thread.id}`} className={`inbox__item${threadId === x.thread.id ? ' is-on' : ''}${x.unread ? ' is-unread' : ''}`}>
                  <Avatar name={x.other.name} tint={x.other.tint} />
                  <span className="grow">
                    <span className="row row--between" style={{ gap: 8 }}>
                      <span className="mini__name">{x.other.name}</span>
                      <span className="tiny muted nowrap">{fmt.ago(x.last.sentAt)}</span>
                    </span>
                    <span className="inbox__snippet">{x.last.fromId === viewer.id ? `${t('You')}: ` : ''}{x.last.body}</span>
                  </span>
                  {x.unread > 0 && <span className="count">{x.unread}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className="inbox__thread">
        {threadId ? <Thread threadId={threadId} key={threadId} /> : <div className="thread thread--empty"><EmptyState icon={<MessageSquare size={22} aria-hidden />} title={t('Choose a conversation')} text={t('Or start a new one. Messages are stored in the demo, so you can switch persona and answer yourself.')} /></div>}
      </section>
      {composing && <NewMessage onClose={() => setComposing(false)} />}
    </div>
  );
}
