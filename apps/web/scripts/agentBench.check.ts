import {
  NO_SECTION_PREFIX,
  UNAVAILABLE,
} from '../src/features/patient-context/agent/referenceTools';
import { BenchCase, SectionRead } from './agentBench.cases';
import { AgentRun } from './agentHarness';

function failedRead(output: string): boolean {
  return output.startsWith(NO_SECTION_PREFIX) || output.startsWith(UNAVAILABLE);
}

export function check(bench: BenchCase, run: AgentRun): string[] {
  if (run.result.kind === 'failed') {
    return [run.result.message];
  }
  if (run.result.kind === 'aborted') {
    return ['run aborted'];
  }
  const answer = run.result.answer;
  const called = new Set(run.calls.map((call) => call.name));
  const reads = run.calls
    .filter((call) => call.name === 'read_section' && !failedRead(call.output))
    .map((call) => ({
      reference: String(call.args['reference']),
      section: String(call.args['section']),
    }));
  const satisfies = (expected: SectionRead) =>
    reads.some(
      (read) =>
        read.reference === expected.reference &&
        (expected.sections === undefined ||
          expected.sections.includes(read.section)),
    );
  const describe = (expected: SectionRead) =>
    expected.sections
      ? `${expected.reference} (${expected.sections.join(' | ')})`
      : expected.reference;
  return [
    ...bench.mustCall
      .filter((tool) => !called.has(tool))
      .map((tool) => `never called ${tool}`),
    ...bench.mustNotCall
      .filter((tool) => called.has(tool))
      .map((tool) => `called ${tool}`),
    ...bench.mustRead
      .filter((anyOf) => !anyOf.some(satisfies))
      .map((anyOf) => `never read ${anyOf.map(describe).join(' or ')}`),
    ...bench.mustNotRead
      .filter((reference) => reads.some((read) => read.reference === reference))
      .map((reference) => `read ${reference}`),
    ...bench.answerMentions
      .filter((pattern) => !new RegExp(pattern, 'i').test(answer))
      .map((pattern) => `answer lacks /${pattern}/`),
    ...bench.answerNeverMentions
      .filter((pattern) => new RegExp(pattern, 'i').test(answer))
      .map((pattern) => `answer claims /${pattern}/`),
  ];
}
