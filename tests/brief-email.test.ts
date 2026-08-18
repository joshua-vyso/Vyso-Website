import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRIEF_EMAIL_CARDS,
  SITE_URL,
  briefClock,
  briefDate,
  briefGreeting,
  briefSubject,
  escapeHtml,
  formatRand,
  renderBriefEmail,
  scheduleLine,
  sinceLine,
  type BriefEmailFinding,
} from '../lib/platform/brief-email-shared.ts';

// This email is the one Vyso surface nobody is looking at a screen while it
// goes out. Its failure modes are all quiet: a deep link to a preview
// deployment, an unescaped supplier name, a greeting whose count disagrees with
// the list under it, a "since your last brief" line that claims a time no row
// records. Every one of those is pinned below.

const NOW = new Date('2026-08-18T05:00:00.000Z'); // Tue 18 Aug, 07:00 SAST

function finding(overrides: Partial<BriefEmailFinding> = {}): BriefEmailFinding {
  return {
    id: 'f1',
    observation: 'Karsten is charging 14% more for tomatoes than in July.',
    recommended_action: 'Ask for the July price back.',
    rand_impact: 12480,
    status: 'new',
    created_at: '2026-08-18T02:00:00.000Z',
    evidenceLabel: '3 invoices',
    ...overrides,
  };
}

function base(overrides: Partial<Parameters<typeof renderBriefEmail>[0]> = {}) {
  return {
    orgName: 'Meridian Fresh',
    firstName: 'Marco',
    kind: 'morning' as const,
    now: NOW,
    open: [finding()],
    readCount: 0,
    since: null,
    days: [1, 2, 3, 4, 5],
    localTime: '07:00',
    ...overrides,
  };
}

test('the subject names the org, the kind and the day', () => {
  assert.equal(
    briefSubject({ orgName: 'Meridian Fresh', kind: 'morning', now: NOW }),
    'Meridian Fresh — your morning brief, Tue 18 Aug',
  );
  assert.equal(
    briefSubject({ orgName: 'Meridian Fresh', kind: 'evening', now: NOW }),
    'Meridian Fresh — your evening brief, Tue 18 Aug',
  );
  // 'custom' has no honest adjective, so it simply does not invent one.
  assert.equal(
    briefSubject({ orgName: 'Meridian Fresh', kind: 'custom', now: NOW }),
    'Meridian Fresh — your brief, Tue 18 Aug',
  );
});

test('dates and clocks are read in the owner\'s timezone', () => {
  assert.equal(briefDate(NOW), 'Tue 18 Aug');
  // 22:30 UTC is already the 19th in SAST — the subject must say so.
  assert.equal(briefDate(new Date('2026-08-18T22:30:00.000Z')), 'Wed 19 Aug');
  assert.equal(briefClock('2026-08-18T05:12:00.000Z'), '07:12');
  assert.equal(briefClock('not a date'), '');
});

test('the greeting counts everything open, not the four in the list', () => {
  assert.equal(briefGreeting('Marco', 23, 'morning'), 'Marco, 23 things need your attention.');
  assert.equal(briefGreeting('Marco', 1, 'morning'), 'Marco, 1 thing needs your attention.');
  // No name is better than "Hi there", which is what a mailing list says.
  assert.equal(briefGreeting('', 2, 'morning'), '2 things need your attention.');
  // Zero gets a sentence, not "0 things need your attention", which reads as a bug.
  assert.equal(briefGreeting('Marco', 0, 'morning'), 'Marco, nothing needs your attention this morning.');
  assert.equal(briefGreeting('Marco', 0, 'evening'), 'Marco, nothing needs your attention this evening.');
});

test('the "since" line never claims a time no row records', () => {
  assert.equal(sinceLine(null), '');
  // Nothing happened since the last one — say nothing rather than "0 new".
  assert.equal(sinceLine({ since: '2026-08-18T05:12:00.000Z', raised: 0, read: 0, closed: 0, listed: 4 }), '');

  assert.equal(
    sinceLine({ since: '2026-08-18T05:12:00.000Z', raised: 2, read: 9, closed: 3, listed: 4 }),
    'Since your brief at 07:12: 2 new findings, 9 documents read, 3 of the 4 items in it now closed.',
  );
  // Singulars, and no closed clause when none of them closed.
  assert.equal(
    sinceLine({ since: '2026-08-18T05:12:00.000Z', raised: 1, read: 1, closed: 0, listed: 4 }),
    'Since your brief at 07:12: 1 new finding, 1 document read.',
  );
});

test('the footer quotes a schedule only when there is one', () => {
  assert.equal(scheduleLine('07:00', [1, 2, 3, 4, 5]), 'You asked for this brief at 07:00, Mon–Fri.');
  // A test send has no saved slot behind it; quoting one would be the email
  // telling the reader about a setting that does not exist.
  assert.equal(scheduleLine('', [1]), '');
  assert.equal(scheduleLine('07:00', []), '');
});

test('the body lists four findings and links the rest through', () => {
  const open = Array.from({ length: 7 }, (_, i) =>
    finding({ id: `f${i}`, rand_impact: 1000 * (7 - i), observation: `Finding ${i}` }),
  );
  const html = renderBriefEmail(base({ open }));

  assert.equal(BRIEF_EMAIL_CARDS, 4);
  // The four biggest rand figures, in order — money before recency, the same
  // rule the Brief's own cards use (rankFindings is imported, not re-derived).
  assert.match(html, /1\. Finding 0/);
  assert.match(html, /4\. Finding 3/);
  assert.doesNotMatch(html, /5\. Finding 4/);
  // The greeting keeps the TRUE total, and the overflow line accounts for the
  // difference — the two can never quietly disagree.
  assert.match(html, /7 things need your attention/);
  assert.match(html, /3 other items — read the full briefing/);
  assert.match(html, new RegExp(`${SITE_URL}/app\\?view=all`));
});

test('nothing open still produces a real email', () => {
  // Deliberately unlike the Monday digest, which sends nothing: this one
  // arrives at a time the reader chose, and silence would be indistinguishable
  // from a cron that has stopped.
  const html = renderBriefEmail(base({ open: [] }));
  assert.match(html, /nothing needs your attention this morning/);
  assert.doesNotMatch(html, /other item/);
});

test('every link points at production, and the deep link at the finding', () => {
  const html = renderBriefEmail(base());
  assert.match(html, new RegExp(`${SITE_URL}/app/finding/f1`));
  assert.match(html, new RegExp(`${SITE_URL}/app/settings#brief-notifications`));
  // Hardcoded, never derived from VERCEL_URL — a preview deployment's link
  // would send the owner to a preview build's data.
  assert.equal(SITE_URL, 'https://vyso.co.za');
});

test('clauses whose input is empty are dropped, not printed as zero', () => {
  const html = renderBriefEmail(
    base({ open: [finding({ rand_impact: null, recommended_action: null, evidenceLabel: null })] }),
  );
  assert.doesNotMatch(html, /Worth:/);
  assert.doesNotMatch(html, /Suggested next step:/);
  assert.doesNotMatch(html, /Based on/);
  // readCount 0 drops the sentence rather than saying "read 0 documents".
  assert.doesNotMatch(html, /Vyso read/);

  const withRead = renderBriefEmail(base({ readCount: 1 }));
  assert.match(withRead, /Vyso read 1 document for you today/);
});

test('anything a supplier or an agent wrote is escaped', () => {
  const html = renderBriefEmail(
    base({
      orgName: '<script>alert(1)</script>',
      open: [finding({ observation: 'Karsten & Sons "raised" <b>prices</b>' })],
    }),
  );
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Karsten &amp; Sons &quot;raised&quot; &lt;b&gt;prices&lt;\/b&gt;/);
});

test('the two shared formatters the digest also uses', () => {
  assert.equal(escapeHtml('a & b < c > d "e"'), 'a &amp; b &lt; c &gt; d &quot;e&quot;');
  // Whole rand: a brief is a prompt to look, not a ledger.
  //
  // en-ZA groups thousands with a SPACE, not a comma — which the comment this
  // function arrived with in the digest route got wrong. Whitespace is
  // normalised here because ICU builds disagree about which space (U+0020,
  // U+00A0, U+202F); the grouping and the rounding are what matter.
  assert.equal(formatRand(12480.49).replace(/\s/g, ' '), 'R 12 480');
  assert.equal(formatRand(999), 'R 999');
  assert.equal(formatRand(0), 'R 0');
});
