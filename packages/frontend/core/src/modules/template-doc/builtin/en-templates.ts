import type { BuiltinTemplate } from './vi-templates';

export const EN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'en-journal',
    title: 'Daily journal',
    markdown: `## Today
- Mood:
- Energy (1–5):
- Weather:

## Three things I am grateful for
1.
2.
3.

## Priorities for today
- [ ] Most important task
- [ ] Second most important task
- [ ] Third most important task

## Notes of the day

## Looking back
- What went well:
- What to improve:
- Tomorrow I will try:
`,
  },
  {
    id: 'en-expenses',
    title: 'Monthly expenses',
    markdown: `## Month overview
- Income:
- Total spent:
- Left over:
- Savings goal:

## Expense log

| Date | Item | Category | Amount | Notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

## Budget by category

| Category | Budget | Spent | Difference |
| --- | --- | --- | --- |
| Food |  |  |  |
| Transport |  |  |  |
| Housing |  |  |  |
| Leisure |  |  |  |
| Other |  |  |  |

## End-of-month review
- Surprise expenses:
- What could be cut:
`,
  },
  {
    id: 'en-okr',
    title: 'Quarterly OKR',
    markdown: `## Objective
Write one inspiring, qualitative sentence you want to achieve this quarter.

## Key Results

### KR1:
- Metric:
- Current → Target:
- Progress: 0%

### KR2:
- Metric:
- Current → Target:
- Progress: 0%

### KR3:
- Metric:
- Current → Target:
- Progress: 0%

## Key actions
- [ ] Action for KR1
- [ ] Action for KR2
- [ ] Action for KR3

## Mid-quarter review

## End-of-quarter wrap-up
- Self score (0–1.0):
- Lessons learned:
`,
  },
  {
    id: 'en-study',
    title: 'Study notes',
    markdown: `## Lesson info
- Subject / topic:
- Source (book, course, video):
- Date studied:

## Learning goals
-

## Main notes

## Self-test questions
Write each question on one line and the answer on the line below.

1. Question:
   - Answer:
2. Question:
   - Answer:

## Summary in my own words

## Review schedule
- [ ] Review 1 (after 1 day)
- [ ] Review 2 (after 3 days)
- [ ] Review 3 (after 1 week)
- [ ] Review 4 (after 1 month)
`,
  },
  {
    id: 'en-meeting',
    title: 'Meeting minutes',
    markdown: `## Meeting info
- Topic:
- Date and time:
- Place / link:
- Chair:
- Attendees:

## Goals of the meeting
-

## Discussion
1.

## Decisions
-

## Action items
- [ ] Task 1 (owner)
- [ ] Task 2 (owner)

## Open questions
-

## Next meeting
- When:
- What to prepare:
`,
  },
];
