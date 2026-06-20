#!/usr/bin/env tsx
import { LinearClient } from '@linear/sdk';

const apiKey = process.env.LINEAR_API_KEY;
const teamId = process.env.LINEAR_TEAM_ID;

if (!apiKey || !teamId) {
  console.error('Missing LINEAR_API_KEY or LINEAR_TEAM_ID');
  process.exit(1);
}

const client = new LinearClient({ apiKey });

const title = '[Test] Raise coverage for low-covered OpenSwarm modules';
const description = `## Objective
Increase test coverage for OpenSwarm by adding focused unit tests around currently under-covered code paths.

## Baseline
- Existing Vitest suite passes.
- Recent coverage report shows remaining branch/line gaps in support and notification-related modules (for example \`src/support/planCommand.ts\` and \`src/notifications/notifier.ts\`).

## Scope
- Identify the lowest-risk modules with meaningful uncovered branches.
- Add or extend Vitest tests without requiring real network, Linear, Discord, or provider calls.
- Prefer mocks/fakes for external SDKs and daemon HTTP calls.
- Keep tests deterministic and fast.

## Acceptance Criteria
- [ ] Add tests that exercise at least one meaningful uncovered branch in a low-covered module.
- [ ] \`npm test -- --coverage\` passes locally.
- [ ] \`npm run typecheck\` passes locally.
- [ ] No real credentials or external services are required by the new tests.

## Suggested Planner → Worker → Reviewer Flow
1. Planner: inspect coverage output and choose a small, high-impact target.
2. Worker: implement focused tests.
3. Reviewer: verify isolation, assertions, coverage improvement, and style.
`;

async function getOrCreateLabel(name: string): Promise<string | undefined> {
  const labels = await client.issueLabels({ filter: { name: { eq: name } } });
  const existing = labels.nodes[0];
  if (existing) return existing.id;
  try {
    const created = await client.createIssueLabel({ name });
    const label = await created.issueLabel;
    return label?.id;
  } catch {
    return undefined;
  }
}

async function main() {
  let effectiveTeamId = teamId;
  let teamInfo;
  try {
    teamInfo = await client.team(effectiveTeamId);
  } catch {
    const teams = await client.teams({ first: 50 });
    const fallback = teams.nodes.find(t => /openswarm|int|dev|eng/i.test(t.name)) ?? teams.nodes[0];
    if (!fallback) throw new Error('No Linear teams available for this API key');
    effectiveTeamId = fallback.id;
    teamInfo = fallback;
    console.log(`Configured LINEAR_TEAM_ID was not accessible; using available team ${fallback.name}`);
  }
  console.log(`Team: ${teamInfo.name}`);

  const existing = await client.issues({
    filter: {
      team: { id: { eq: effectiveTeamId } },
      title: { eq: title },
    },
    first: 1,
  });
  if (existing.nodes[0]) {
    console.log(`Existing issue: ${existing.nodes[0].identifier} ${existing.nodes[0].url}`);
    return;
  }

  const projects = await client.projects({ filter: { name: { contains: 'OpenSwarm' } }, first: 10 });
  const project = projects.nodes.find(p => p.name.toLowerCase().includes('openswarm'));

  const labelIds = (await Promise.all(['test', 'coverage', 'quality'].map(getOrCreateLabel))).filter(Boolean) as string[];

  const result = await client.createIssue({
    teamId: effectiveTeamId,
    projectId: project?.id,
    title,
    description,
    priority: 3,
    estimate: 3,
    labelIds,
  });
  const issue = await result.issue;
  if (!issue) throw new Error('Linear issue creation returned no issue');
  console.log(`Created issue: ${issue.identifier} ${issue.url}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
