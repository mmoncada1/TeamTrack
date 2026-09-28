import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { upsertMatch } from '../db/repository';
import { endMatch, recordGoal, startMatch } from '../lib/matchActions';
import { makeMatch, makePlayer } from '../lib/testHelpers';
import { useMatchStore } from '../state/matchStore';
import { useRosterStore } from '../state/rosterStore';
import { useTeamStore } from '../state/teamStore';
import { MatchSummaryPage } from './MatchSummaryPage';

async function renderSummary() {
  const scorer = makePlayer({ name: 'Forward', jerseyNumber: 9, preferredGroup: 'FWD' });
  const assist = makePlayer({ name: 'Mid', jerseyNumber: 8, preferredGroup: 'MID' });
  let match = makeMatch({
    teamName: 'Us',
    opponentName: 'Them',
    rosterPlayerIds: [scorer.id, assist.id],
  });
  match = startMatch(match, 0);
  match = recordGoal(match, { team: 'us', isOwnGoal: false, scorerId: scorer.id, assisterId: assist.id }, 5 * 60_000);
  match = endMatch(match, 10 * 60_000);

  useRosterStore.setState({ players: [scorer, assist], loaded: true });
  useTeamStore.setState({ teams: [], activeTeamId: null, loaded: true });
  useMatchStore.setState({ match, allMatches: [match], loading: false, saveStatus: 'idle', lastActionError: null });
  await upsertMatch(match);

  render(
    <MemoryRouter initialEntries={[`/match/${match.id}/summary`]}>
      <Routes>
        <Route path="/match/:id/summary" element={<MatchSummaryPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
  return { scorer, assist, match };
}

async function openEditMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Edit' }));
  return screen.getByRole('dialog', { name: 'Edit goals' });
}

describe('MatchSummaryPage goal corrections', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('removes a goal from a finished match and updates the recap', async () => {
    const user = userEvent.setup();
    await renderSummary();

    const menu = await openEditMenu(user);
    await user.click(within(menu).getByRole('button', { name: 'Remove' }));
    await user.click(within(menu).getByRole('button', { name: 'Remove goal' }));

    expect(screen.getByText('No goals or cards.')).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('changes the assist on a finished match', async () => {
    const user = userEvent.setup();
    await renderSummary();

    expect(screen.getByText(/\(Mid\)/)).toBeInTheDocument();
    const menu = await openEditMenu(user);
    await user.click(within(menu).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('dialog', { name: 'Edit goal' });
    await user.selectOptions(within(form).getByLabelText('Assist (optional)'), '');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));

    expect(screen.queryByRole('dialog', { name: 'Edit goal' })).not.toBeInTheDocument();
    expect(screen.queryByText(/\(Mid\)/)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Edit goals' })).toBeInTheDocument();
  });

  it('adds a missed goal to a finished match', async () => {
    const user = userEvent.setup();
    const { scorer } = await renderSummary();
    const menu = await openEditMenu(user);
    await user.click(within(menu).getByRole('button', { name: 'Remove' }));
    await user.click(within(menu).getByRole('button', { name: 'Remove goal' }));

    await user.click(within(menu).getByRole('button', { name: 'Add goal' }));
    const form = screen.getByRole('dialog', { name: 'Add goal' });
    await user.selectOptions(within(form).getByLabelText('Scorer'), scorer.id);
    await user.click(within(form).getByRole('button', { name: 'Save goal' }));

    expect(screen.queryByText('No goals or cards.')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Edit goals' })).toBeInTheDocument();
  });
});
