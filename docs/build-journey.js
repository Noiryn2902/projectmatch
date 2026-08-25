const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, LevelFormat,
} = require('docx');
const fs = require('fs');

const ACCENT = 'B07A18';
const MUTED = '5A5A5A';
const LINE = 'D8D8D8';

const H = (text, level = HeadingLevel.HEADING_1) =>
  new Paragraph({ text, heading: level, spacing: { before: 320, after: 140 } });

const P = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: 120, line: 276 },
    children: [new TextRun({ text, size: 21, color: opts.muted ? MUTED : '222222', italics: opts.italics })],
  });

const Bullet = (text, bold) =>
  new Paragraph({
    numbering: { reference: 'dots', level: 0 },
    spacing: { after: 80, line: 276 },
    children: bold
      ? [new TextRun({ text: bold, bold: true, size: 21 }), new TextRun({ text: ' ' + text, size: 21 })]
      : [new TextRun({ text, size: 21 })],
  });

const Rule = () =>
  new Paragraph({
    spacing: { before: 60, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE } },
    children: [new TextRun({ text: '', size: 2 })],
  });

const Pull = (text) =>
  new Paragraph({
    spacing: { before: 140, after: 160 },
    indent: { left: 260 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 12 } },
    children: [new TextRun({ text, size: 21, italics: true, color: '333333' })],
  });

const cell = (text, { bold, w, head } = {}) =>
  new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: 'F2EFE9' } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: bold || head, size: 19 })],
      }),
    ],
  });

const table = (widths, rows) =>
  new Table({
    columnWidths: widths,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    rows: rows.map(
      (r, i) =>
        new TableRow({
          tableHeader: i === 0,
          children: r.map((c, j) => cell(c, { w: widths[j], head: i === 0 })),
        }),
    ),
  });

const TW = [1100, 4200, 3700];

const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'dots',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 340, hanging: 200 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
      children: [
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: 'PROMPTWARS  ·  PROBLEM STATEMENT 2', size: 17, color: ACCENT, bold: true, characterSpacing: 40 })],
        }),
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: 'ProjectMatch', size: 44, bold: true })],
        }),
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: 'A team formation platform. Describe your project in two lines, get a full team back.', size: 22, color: MUTED })],
        }),
        new Paragraph({
          spacing: { after: 240 },
          children: [
            new TextRun({ text: 'Live: ', size: 19, color: MUTED }),
            new TextRun({ text: 'projectmatch-noiryn.vercel.app', size: 19, color: ACCENT }),
            new TextRun({ text: '     Code: ', size: 19, color: MUTED }),
            new TextRun({ text: 'github.com/Noiryn2902/projectmatch', size: 19, color: ACCENT }),
          ],
        }),
        Rule(),

        H('1. The problem I was given'),
        P('People form teams from whoever they already know. A developer who needs a designer simply never finds one, because the designer is not in their contacts. The brief named hackathons, research groups and startups, and all three cross organisational lines.'),
        P('The obvious build is a searchable directory of people. I decided early that this answer does not actually work, and that became the whole project.'),
        Pull('Search "React" and you get four React developers. Every match is correct, and the team is useless: no designer, no domain expert, nobody who can ship it. A directory scores people one at a time, so it cannot know what you already have.'),

        H('2. How I ideated'),
        P('I started from the phrase in the problem statement that most teams would read past: complementary skills. Complementary is not a property of a person. It only exists relative to a team, so it cannot be expressed as a filter.'),
        Bullet('that scores what a person adds to the team being built, not how good they look alone.', 'The idea:'),
        Bullet('score contribution, not similarity, so the maths itself produces complementary teams.', 'The method:'),
        Bullet('AI reads the brief and writes explanations. It never chooses, so results stay reproducible.', 'The constraint:'),
        P('I also chose the harder framing on purpose: an open cross-company platform rather than a single-company tool, because hackathons and startups are exactly the cases that cross company boundaries. The private company workspace became the business model instead of the product.'),

        H('3. What I actually built, in order'),
        P('Engine first, before any interface. If the scoring was going to fail, I wanted to know at hour one while I could still cut screens, not at hour three when the only thing left to cut was the idea.', { muted: true }),
        table(TW, [
          ['Time', 'What happened', 'Why it mattered'],
          ['10:22', 'Matching engine, seeded directory of 60 people, deterministic fallback', 'Pure TypeScript, verifiable from a terminal with no UI at all'],
          ['10:33', 'Team builder screen, Gemini brief reader, single API route', 'First end-to-end run: plain English in, a team out'],
          ['10:38', 'Rebuilt the layout around a filter rail', 'First version threw six rows of controls at you before any content'],
          ['10:53', 'Landing reduced to the input alone', 'Nothing appears until you have actually asked for something'],
          ['11:01', 'Fixed candidate ordering, rewrote all copy', 'The list was sorted on one number and displaying another'],
          ['11:21', 'Cinematic hero, generated video and portraits', 'Warm amber on near-black, 32 generated faces'],
          ['12:13', 'Full landing: stats, how it works, differentiator, proof', 'Every number read from the real data, not typed in'],
          ['12:48', 'Category browser opens real people', 'Browsing the directory without writing a brief'],
          ['13:23', 'Assembling the team became an explicit action', 'The team arriving pre-filled threw away the only moment worth watching'],
          ['14:09', 'Sign-in identity, team workspace, live chat layer', 'Chat, People, Kickoff and Setup over the matched team'],
          ['14:14', 'Sorting restored, tiles stopped truncating', 'Final polish pass'],
        ]),
        P('31 commits, 84 files, roughly 5,200 lines of TypeScript, of which the engine is 443.', { muted: true }),

        H('4. Problems I hit, and what I did'),
        Bullet('The optimiser seated a frontend engineer in the platform chair, because it maximised total coverage and did not care which seat anyone sat in. Fixed by weighting seat fit alongside contribution, and giving swaps a hard role-match floor.', 'Scrambled seats.'),
        Bullet('Coverage read 100% with four people, which made the honest-gaps idea meaningless. An adjacent skill was getting full credit. Capping satisfaction by skill similarity brought it to a believable 91%.', 'Coverage was too generous.'),
        Bullet('The list sorted on a blended score but displayed only one part of it, so 36% appeared above 45% and looked broken. Now it shortlists to people who can hold the seat, then ranks purely on gap closed, so the number shown is the number it sorted by.', 'Ordering looked wrong.'),
        Bullet('The AI hero clip did not loop: its first and last frames were different places in the room. Reversing it was visible, crossfading it went soft. The real fix was regenerating it as a locked-off shot, where the two ends already match.', 'The hero video jumped.'),
        Bullet('I replaced the band images at higher resolution but kept the filenames, so every browser kept serving the old blurry ones. Versioning the filenames fixed it.', 'Images stayed blurry.'),
        Bullet('The kickoff view computed Bengaluru at UTC+5:30 as 15:15 instead of 15:45, because fractional offsets were dropping the half hour.', 'Timezone maths.'),
        Bullet('Auto-fill yielded through requestAnimationFrame, which browsers throttle to nothing in a background tab. Switching tabs mid-click would have hung the button on stage. Now a timeout, which always fires.', 'A bug that would have shown live.'),
        Bullet('The first deploy returned a login wall in front of the app, so any judge opening the link would have seen a Vercel sign-in page instead of the product.', 'Deployment protection.'),

        H('5. What makes it different'),
        Bullet('Every other tool ranks people individually, which structurally cannot build a team. Add a frontend developer and the next frontend developer drops to 0%, while a junior designer rises to 12%. The senior engineer is the better candidate and the worse choice.', 'It solves a set problem, not a search problem.'),
        Bullet('React to Next.js scores 0.70, React to Vue 0.45, React to UI design 0.00. Someone who wrote Next.js still counts when the brief says React. A keyword filter loses them.', 'Skills are a graph, not tags.'),
        Bullet('Every profile carries hours and a timezone, and the whole team gets intersected, so it can warn that four people share only three hours a week. Nothing else surfaces that.', 'Availability is a real input.'),
        Bullet('It reports 91% covered and then names what is missing, including gaps it could not fill. That is more useful and more credible than a confident green number.', 'It is honest about its own weaknesses.'),
        Bullet('Gemini reads the brief into requirements and writes the reasoning. The choosing is deterministic code, so the same brief always produces the same team. Ask why her and not him twice, get the same answer twice.', 'The AI never picks the team.'),
        Pull('If your skills are strings, you can filter. If they are levelled and graphed with hours and timezones, you can optimise. That is the difference between a directory and a team builder.'),

        H('6. Where it stands'),
        P('Live on Vercel, opens cold with no login wall, and the Gemini route is answering in production. All matching runs in the browser on plain arithmetic, so it works with the network unplugged; every AI call has a deterministic fallback behind it.'),
        P('Every person in the directory is generated and fictional. Nothing is scraped, and the app says so on the page.', { muted: true }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((b) => {
  fs.writeFileSync(process.argv[2] || 'ProjectMatch-Journey.docx', b);
  console.log('written');
});
