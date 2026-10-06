import { CATEGORIES, Category } from './agentBench.cases';

export type Outcome =
  | { kind: 'pass' }
  | { kind: 'fail'; problems: string[] }
  | { kind: 'error'; message: string };

export type CaseResult = {
  id: string;
  category: Category;
  outcome: Outcome;
  turns: number | null;
  calls: number;
  /** Distinct sections, note parts and lab histories the run opened, and how many of them its case accepts. */
  opened: { opened: number; accepted: number } | null;
  /** Context window the app detected from the model server, if it reported one. */
  windowTokens: number | null;
};

export type CategoryScore = {
  category: Category;
  passed: number;
  total: number;
};

export function scoreByCategory(results: CaseResult[]): CategoryScore[] {
  return CATEGORIES.map((category) => {
    const inCategory = results.filter((r) => r.category === category);
    return {
      category,
      passed: inCategory.filter((r) => r.outcome.kind === 'pass').length,
      total: inCategory.length,
    };
  }).filter((score) => score.total > 0);
}

function caseLines(result: CaseResult): string[] {
  const opened = result.opened
    ? `, ${result.opened.accepted} of ${result.opened.opened} opened accepted`
    : '';
  const stats = `(${result.turns} turns, ${result.calls} calls${opened})`;
  switch (result.outcome.kind) {
    case 'pass':
      return [`  PASS  ${result.id}  ${stats}`];
    case 'fail':
      return [
        `  FAIL  ${result.id}  ${stats}`,
        ...result.outcome.problems.map((problem) => `          ${problem}`),
      ];
    case 'error':
      return [`  ERROR ${result.id}`, `          ${result.outcome.message}`];
  }
}

export function formatReport(results: CaseResult[]): string {
  const scores = scoreByCategory(results);
  const sections = scores.map((score) => [
    `${score.category}  ${score.passed}/${score.total}`,
    ...results.filter((r) => r.category === score.category).flatMap(caseLines),
    '',
  ]);
  const passed = scores.reduce((sum, s) => sum + s.passed, 0);
  return [...sections.flat(), `total  ${passed}/${results.length}`].join('\n');
}
