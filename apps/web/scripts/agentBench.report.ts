import { CATEGORIES, Category } from './agentBench.cases';

export type Outcome =
  | { kind: 'scored'; score: number; problems: string[] }
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
  mean: number;
  total: number;
};

function scoreOf(result: CaseResult): number {
  return result.outcome.kind === 'scored' ? result.outcome.score : 0;
}

function mean(results: CaseResult[]): number {
  return results.reduce((sum, r) => sum + scoreOf(r), 0) / results.length;
}

function cases(total: number): string {
  return `${total} ${total === 1 ? 'case' : 'cases'}`;
}

export function scoreByCategory(results: CaseResult[]): CategoryScore[] {
  return CATEGORIES.map((category) => {
    const inCategory = results.filter((r) => r.category === category);
    return {
      category,
      mean: inCategory.length > 0 ? mean(inCategory) : 0,
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
    case 'scored':
      return [
        `  ${result.outcome.score.toFixed(2)}  ${result.id}  ${stats}`,
        ...result.outcome.problems.map((problem) => `          ${problem}`),
      ];
    case 'error':
      return [`  ERROR ${result.id}`, `          ${result.outcome.message}`];
  }
}

export function formatReport(results: CaseResult[]): string {
  const sections = scoreByCategory(results).map((score) => [
    `${score.category}  mean ${score.mean.toFixed(2)} over ${cases(score.total)}`,
    ...results.filter((r) => r.category === score.category).flatMap(caseLines),
    '',
  ]);
  return [
    ...sections.flat(),
    `total  mean ${mean(results).toFixed(2)} over ${cases(results.length)}`,
  ].join('\n');
}
