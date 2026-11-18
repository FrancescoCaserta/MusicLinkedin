import { beforeEach, describe, expect, it } from 'vitest';
import { MockApi, memoryStore } from '../src/data/mock/mockApi';
import { PERSONA_IDS as P } from '../src/data/mock/seed';

let api: MockApi;
beforeEach(() => {
  const clock = new Date(2026, 10, 16, 10, 0, 0);
  api = new MockApi({ store: memoryStore(), now: () => clock, simulation: false });
});

describe('posts', () => {
  it('seeds a feed for every persona, with an activity line on at least one post', async () => {
    for (const id of [P.nicolo, P.giulia, P.hannah]) {
      const feed = await api.listFeed(id);
      expect(feed.length).toBeGreaterThan(0);
    }
    const feed = await api.listFeed(P.nicolo);
    expect(feed.some((p) => p.bravoBy)).toBe(true);
  });

  it('a Bravo toggles, counts and tells the author', async () => {
    const post = await api.createPost({ authorId: P.giulia, body: 'Op. 132 tonight.' });
    expect(await api.toggleBravo(post.id, P.nicolo)).toBe(true);
    let mine = (await api.listFeed(P.giulia)).find((p) => p.id === post.id)!;
    expect(mine.bravos).toBe(1);
    expect((await api.listNotifications(P.giulia))[0].notification.kind).toBe('bravo');
    expect(await api.toggleBravo(post.id, P.nicolo)).toBe(false);
    mine = (await api.listFeed(P.giulia)).find((p) => p.id === post.id)!;
    expect(mine.bravos).toBe(0);
  });

  it('an attached event shows "I’m playing" when the author is on the lineup', async () => {
    const c = await api.createEvent(
      { format: 'concert', title: 'Tango nights', venue: 'Castello', city: 'Modena', country: 'IT', visibility: 'public', sessions: [{ date: '2027-06-14', kind: 'performance' }], programme: [], myRole: 'Violin', invite: [], openSeats: [{ role: 'Double bass' }] },
      P.giulia,
    );
    const post = await api.createPost({ authorId: P.giulia, body: 'Come along.', concertId: c.id });
    expect(post.playing).toBe('Violin');
    expect(post.concert?.openSeats?.[0].role).toBe('Double bass');
  });

  it('rejects empty posts and comments', async () => {
    await expect(api.createPost({ authorId: P.giulia, body: '  ' })).rejects.toThrow();
    const post = await api.createPost({ authorId: P.giulia, body: 'Hello' });
    await expect(api.addComment(post.id, P.nicolo, '')).rejects.toThrow();
    await api.addComment(post.id, P.nicolo, 'Bravissima');
    expect((await api.listFeed(P.giulia)).find((p) => p.id === post.id)!.comments[0].body).toBe('Bravissima');
  });
});
