import { expect, test, type Page } from '@playwright/test';

/**
 * The journeys a visitor walks through in the demo, at desktop and phone
 * widths. Every test starts from fresh demo data (a new browser context)
 * and fails on any console error.
 */

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('console', (m) => m.type() === 'error' && !/tile\.openstreetmap|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors, 'console errors').toEqual([]));

const enter = (page: Page, persona: string, next: string) => page.goto(`/enter/${persona}?next=${encodeURIComponent(next)}`);
const phone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 700;

test('landing: live search answers the headline query and leads into the demo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every stand filled.');
  const live = page.locator('#search');
  await expect(live.getByText('Nicolò Baldini')).toBeVisible({ timeout: 15_000 });
  await expect(live.getByText('Within 50 km of Bologna')).toBeVisible();
  await expect(live.getByText(/Budget €250/)).toBeVisible();
  await expect(live.getByText(/more within 100 km/)).toBeVisible();

  // the visitor can type their own question
  await live.getByRole('textbox').fill('soprano for Mozart Requiem near Modena');
  await expect(live.getByText('Has played: Mozart requiem')).toBeVisible();
  await expect(live.locator('.live__hit').first()).toBeVisible();

  await page.getByRole('link', { name: 'I need a musician' }).click();
  await expect(page).toHaveURL(/\/search\?/);
  await expect(page.getByRole('heading', { name: 'Who do you need?' })).toBeVisible();
  await expect(page.locator('.result').first()).toContainText('Nicolò Baldini');
});

test('logged-out visitors are sent to the persona chooser and then on to the page they wanted', async ({ page }) => {
  await page.goto('/opportunities');
  await expect(page.getByRole('heading', { name: 'Who would you like to be?' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue as Giulia' }).click();
  await expect(page.getByRole('heading', { name: 'Work, with the fee on the first line' })).toBeVisible();
});

test('hirer: search in a sentence, refine, invite; the musician accepts; the hirer offers; the musician confirms', async ({ page }) => {
  await enter(page, 'acc-lorenzo', '/search');
  await page.getByLabel('Describe the musician you are looking for').fill('accordionist within 50 km of Bologna, free on 14 March, budget €250');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('2 musicians match')).toBeVisible();
  const first = page.locator('.result').first();
  await expect(first).toContainText('Nicolò Baldini');
  await expect(first).toContainText('37 km from Bologna');
  await expect(first).toContainText('within budget');
  await expect(first).toContainText(/Free Sun 14 Mar/);

  // a near-miss suggestion widens the search
  await page.getByRole('button', { name: /more within 100 km/ }).click();
  await expect(page.getByText('4 musicians match')).toBeVisible();
  await page.getByRole('button', { name: 'Remove filter: Within 100 km of Bologna' }).click();
  await expect(page.getByText(/musicians match/)).not.toContainText('4 musicians');
  // the browser's back button undoes the suggestion
  await page.goBack();
  await expect(page.getByText('2 musicians match')).toBeVisible();

  // invite to the existing posting
  await first.getByRole('button', { name: 'Invite' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('“Crinale d’Inverno”', { exact: false }).click();
  await dialog.getByRole('textbox').fill('Nicolò, this programme has your name on it.');
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByText('Invitation sent to 1 musician.')).toBeVisible();

  // the musician sees it and says yes
  await enter(page, 'm-nicolo-baldini', '/applications');
  const invitation = page.locator('.opp', { hasText: 'Crinale d’Inverno' });
  await expect(invitation).toContainText('Invited');
  await invitation.click();
  await expect(page.getByText('this programme has your name on it')).toBeVisible();
  await expect(page.getByText('You are free on every date')).toBeVisible();
  await page.getByRole('button', { name: 'I’m interested' }).click();
  await expect(page.getByText(/knows you are available/)).toBeVisible();

  // the hirer reviews and offers
  await enter(page, 'acc-lorenzo', '/hiring/opp-crinale-inverno');
  const applicant = page.locator('.applicant', { hasText: 'Nicolò Baldini' });
  await expect(applicant).toContainText('answered your invitation');
  await applicant.getByRole('button', { name: 'Make an offer' }).click();
  await expect(applicant).toContainText('Offer sent');

  // the musician confirms; the date is blocked in the calendar
  await enter(page, 'm-nicolo-baldini', '/home');
  const offer = page.locator('.todo', { hasText: 'Crinale d’Inverno' });
  await offer.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Confirmed. The dates are now in your calendar.')).toBeVisible();
  await page.goto('/calendar');
  await expect(page.getByText('confirmed on Leggio').first()).toBeVisible();
});

test('hirer: post an opportunity (a fee is required), it appears on the board, a musician applies, the hirer sees it', async ({ page }) => {
  await enter(page, 'acc-beatrice', '/opportunities/new');
  await page.getByRole('button', { name: 'Publish opportunity' }).click();
  await expect(page.getByText('State the fee. No posting goes live on Leggio without one.')).toBeVisible();

  await page.getByLabel('Title').fill('Accordion continuo — a Piazzolla and Vivaldi evening');
  await page.getByPlaceholder('Instrument or voice').fill('accord');
  await page.getByRole('option', { name: 'Accordion' }).click();
  await page.getByLabel('Amount').fill('320');
  await page.getByLabel('City').fill('Bolo');
  await page.getByRole('option', { name: /Bologna/ }).click();
  await page.getByLabel('Date', { exact: true }).fill('2027-05-08');
  await page.getByLabel('Description').fill('An evening for strings and accordion in the cloister. Two rehearsals the days before.');
  await page.getByRole('button', { name: 'Publish opportunity' }).click();
  await expect(page.getByRole('heading', { name: 'Accordion continuo — a Piazzolla and Vivaldi evening' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Suggested musicians' })).toBeVisible();
  await expect(page.locator('.suggest').first()).toBeVisible();

  // a musician finds it on the board and applies
  await enter(page, 'm-nicolo-baldini', '/opportunities');
  const card = page.locator('.opp', { hasText: 'a Piazzolla and Vivaldi evening' });
  await expect(card).toContainText('€320');
  await card.click();
  await page.getByPlaceholder(/Have you played the piece/).fill('Free that day and close by.');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('Application sent to Beatrice Fontana.')).toBeVisible();
  await expect(page.locator('.applybox')).toContainText('Applied');

  // the hirer sees the application, with the note
  await enter(page, 'acc-beatrice', '/hiring');
  const posting = page.locator('.opp', { hasText: 'a Piazzolla and Vivaldi evening' });
  await expect(posting).toContainText('1 to review');
  await posting.click();
  await expect(page.locator('.applicant', { hasText: 'Nicolò Baldini' })).toContainText('Free that day and close by.');
});

test('urgent substitution: call the players who are free, answers arrive, confirm one', async ({ page }) => {
  await enter(page, 'm-giulia-santoro', '/opportunities/urgent');
  await page.getByPlaceholder('Instrument or voice').fill('cello');
  await page.getByRole('option', { name: 'Cello', exact: true }).click();
  await page.getByLabel('Fee, in total').fill('220');
  await expect(page.locator('.urgent__count')).not.toHaveText('0', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Choose who to call' }).click();
  await expect(page.getByRole('heading', { name: 'Who to call' })).toBeVisible();
  await page.getByRole('button', { name: /^Call \d+ musicians?$/ }).click();
  await expect(page.getByText(/Call sent to \d+ musician/)).toBeVisible();
  // simulated colleagues answer within half a minute
  const yes = page.getByRole('button', { name: /^Confirm / }).first();
  await expect(yes).toBeVisible({ timeout: 45_000 });
  await yes.click();
  await expect(page.locator('.filledbar')).toContainText('confirmed');
  await expect(page.getByText('Filled', { exact: true })).toBeVisible();
});

test('musician: the urgent call banner can be answered from anywhere', async ({ page }) => {
  await enter(page, 'm-nicolo-baldini', '/network');
  const bar = page.locator('.urgent-bar');
  await expect(bar).toContainText('Urgent call');
  await bar.getByRole('button', { name: 'I can do it' }).click();
  await expect(page.getByText(/knows you can do it/)).toBeVisible();
  await expect(bar).toHaveCount(0);
});

test('musician: edit the profile and the calendar; changes survive a reload and reach search', async ({ page }) => {
  await enter(page, 'm-nicolo-baldini', '/profile/edit');
  await page.getByLabel('Headline').fill('Accordionist — Bach to Berio, and everything orchestras need');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('All changes saved.')).toBeVisible();

  await page.getByRole('tab', { name: 'Fee and practicalities' }).click();
  await page.getByLabel('From', { exact: true }).fill('260');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('All changes saved.')).toBeVisible();

  await page.getByRole('tab', { name: 'Repertoire' }).click();
  await page.getByRole('button', { name: 'Add a work' }).click();
  await page.getByLabel('Composer').first().fill('Pärt');
  await page.getByLabel('Work', { exact: true }).first().fill('Pari intervallo');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('All changes saved.')).toBeVisible();

  await page.reload();
  await page.goto('/musicians/nicolo-baldini');
  await expect(page.getByText('Accordionist — Bach to Berio, and everything orchestras need')).toBeVisible();
  await expect(page.locator('.side-card__fee')).toContainText('€260');
  await page.getByPlaceholder('Search this repertoire…').fill('intervallo');
  await expect(page.locator('.rep__row')).toContainText('Pari intervallo');

  // with a lower fee of €260 he no longer fits a €250 budget
  await enter(page, 'acc-lorenzo', '/search?i=accordion&near=bologna&r=50&b=250');
  await expect(page.getByText(/musicians? match/)).toBeVisible();
  await expect(page.locator('.result', { hasText: 'Nicolò Baldini' })).toHaveCount(0);
});

test('messages are stored and reach the other person', async ({ page }) => {
  await enter(page, 'acc-beatrice', '/musicians/nicolo-baldini');
  await page.getByRole('button', { name: 'Message' }).first().click();
  await page.getByRole('dialog').getByRole('textbox').fill('Nicolò, would you play continuo on accordion for us in May? Fee €320.');
  await page.getByRole('dialog').getByRole('button', { name: 'Send' }).click();
  await expect(page).toHaveURL(/\/messages\/th-/);
  await expect(page.locator('.bubble--mine')).toContainText('continuo on accordion');

  await enter(page, 'm-nicolo-baldini', '/messages');
  const item = page.locator('.inbox__item', { hasText: 'Beatrice Fontana' });
  await expect(item).toContainText('would you play continuo');
  await item.click();
  await page.getByLabel('Message').fill('With pleasure — which dates?');
  await page.getByLabel('Message').press('Enter');
  await expect(page.locator('.bubble--mine')).toContainText('which dates?');
  await page.reload();
  await expect(page.locator('.bubble').last()).toContainText('which dates?');
});

test('network: accept a request, connect, and endorse a colleague for a shared concert', async ({ page }) => {
  await enter(page, 'm-giulia-santoro', '/network');
  await page.getByRole('button', { name: 'Accept' }).first().click();
  await expect(page.getByText('Connected.')).toBeVisible();
  await page.getByRole('button', { name: 'Connect' }).first().click();
  await expect(page.getByText('Connection request sent.')).toBeVisible();

  await page.getByRole('button', { name: 'Write an endorsement' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Which concert?')).not.toBeEmpty();
  const text = 'Marked every bowing before the first rehearsal and never once came in early.';
  await dialog.getByRole('textbox').fill(text);
  await dialog.getByRole('button', { name: 'Publish endorsement' }).click();
  await expect(page.getByText(/Endorsement published/)).toBeVisible();
  await page.getByRole('tab', { name: /Endorsements/ }).click();
  await expect(page.getByText(text)).toBeVisible();
});

test('ensemble page: an admin edits the description and adds a member', async ({ page }) => {
  await enter(page, 'acc-beatrice', '/ensembles/accademia-del-naviglio');
  await page.getByRole('button', { name: 'Edit page' }).click();
  await page.getByLabel('About').fill('A period-instrument orchestra in Bologna, playing one to a part since 2009.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('playing one to a part since 2009')).toBeVisible();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Start typing a name…').fill('Marta Gh');
  await dialog.getByRole('option', { name: /Marta Ghidoni/ }).click();
  await dialog.getByPlaceholder(/Violin I/).fill('Guest accordion');
  await dialog.getByRole('button', { name: 'Add member' }).click();
  await expect(page.locator('.profile__side')).toContainText('Marta Ghidoni');
  await expect(page.locator('.profile__side')).toContainText('Guest accordion');
});

test('error and empty states are designed, and recover', async ({ page }) => {
  await enter(page, 'acc-lorenzo', '/musicians/nobody-by-this-name');
  await expect(page.getByText('That did not load')).toBeVisible();
  await expect(page.getByText('This musician could not be found.')).toBeVisible();

  await page.goto('/search?i=cornetto&near=palermo&r=10');
  await expect(page.getByText('No one fits all of that')).toBeVisible();

  await page.goto('/no/such/page');
  await expect(page.getByText('Tacet.')).toBeVisible();

  // simulate the backend going away, then coming back
  await page.goto('/ensembles');
  await expect(page.locator('.orgcard').first()).toBeVisible();
  await page.evaluate(() => localStorage.setItem('leggio:simulate-failure', '1'));
  errors = [];
  await page.goto('/opportunities');
  await expect(page.getByText('The server could not be reached.', { exact: false })).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => localStorage.removeItem('leggio:simulate-failure'));
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.opp').first()).toBeVisible();
  errors = [];
});

test('navigation works at this width, and no page scrolls sideways', async ({ page }) => {
  await enter(page, 'm-hannah-lindner', '/home');
  const nav = page.getByRole('navigation', { name: 'Main' }).locator(phone(page) ? '.tabbar__link' : '.top__link');
  for (const [name, heading] of [
    [/Search|Find musicians/, 'Who do you need?'],
    [/Work|Opportunities/, 'Work, with the fee on the first line'],
    ['Network', 'The people you have played with'],
    ['Messages', 'Messages'],
  ] as const) {
    await nav.filter({ hasText: name }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${heading}`).toBeLessThanOrEqual(1);
  }
  for (const path of ['/', '/demo', '/musicians/hannah-lindner', '/opportunities/opp-heures-nisi', '/calendar', '/profile/edit', '/hiring', '/ensembles/accademia-del-naviglio', '/opportunities/new']) {
    await page.goto(path);
    await page.waitForTimeout(700);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
});
