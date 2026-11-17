// Validation layers 3–4 (PLAN.md Module C): capability warnings, recommendations, and structural
// information. These never block computation — reducible or periodic chains are valid.
import type { StructureResult } from './structure';
import type { ChainDocumentV1, CompiledChain, ValidationIssue } from './types';

export const LARGE_MODEL_STATES = 50;

export function structuralIssues(doc: ChainDocumentV1, chain: CompiledChain, s: StructureResult): ValidationIssue[] {
  const name = (i: number) => doc.states.find((x) => x.id === chain.stateIds[i])?.label || 'Unnamed';
  const list = (idx: number[]) => idx.map(name).join(', ');
  const out: ValidationIssue[] = [];
  const closed = s.classes.filter((c) => c.closed);

  if (!s.irreducible) {
    out.push({
      code: 'info.reducible', severity: 'info', target: { kind: 'document' },
      title: `Reducible chain: ${s.classes.length} communicating classes`,
      explanation: `Not every state can reach every other state.${s.transient.length ? ` Transient states (eventually left for good): ${list(s.transient)}.` : ''} This is a valid model.`,
    });
  }
  if (closed.length > 1) {
    out.push({
      code: 'info.multiple-closed', severity: 'info', target: { kind: 'document' },
      title: `${closed.length} closed classes`,
      explanation: `The chain eventually stays in one of: ${closed.map((c) => `{${list(c.states)}}`).join(', ')}. Long-run outcomes depend on the starting distribution, and the stationary distribution is not unique.`,
    });
  }
  for (const c of closed) {
    if (c.period !== null && c.period > 1) {
      out.push({
        code: 'info.periodic', severity: 'info', target: { kind: 'document' },
        title: `Periodic class {${list(c.states)}} (period ${c.period})`,
        explanation: `Returns happen only at multiples of ${c.period} steps, so μₜ may oscillate instead of converging. A stationary distribution still exists.`,
      });
    }
  }
  const unreachable = s.reachableFromInitial.flatMap((r, i) => (r ? [] : [i]));
  if (unreachable.length) {
    out.push({
      code: 'info.unreachable', severity: 'info', target: { kind: 'document' },
      title: `${unreachable.length} state${unreachable.length > 1 ? 's' : ''} unreachable from the start`,
      explanation: `${list(unreachable)} can never be visited from the current starting distribution. That is allowed; results for them describe what would happen if the chain started there.`,
    });
  }
  if (s.absorbing.length) {
    out.push({
      code: 'info.absorbing', severity: 'info', target: { kind: 'document' },
      title: `Absorbing: ${list(s.absorbing)}`,
      explanation: 'Once entered, these states are never left (self-loop probability 1).',
    });
  }
  if (chain.stateIds.length > LARGE_MODEL_STATES) {
    out.push({
      code: 'cap.large-model', severity: 'warning', target: { kind: 'document' },
      title: `Large model (${chain.stateIds.length} states)`,
      explanation: 'All analyses still run, but graph rendering and the matrix editor may feel slower. Results are not approximated.',
    });
  }
  if (!doc.metadata.stepLabel) {
    out.push({
      code: 'rec.step-label', severity: 'recommendation', target: { kind: 'document' },
      title: 'Say what one step means',
      explanation: 'Charts and explanations are clearer when a step has a meaning such as “day” or “round”. Set “One step means” in the Matrix tab.',
    });
  }
  return out;
}
