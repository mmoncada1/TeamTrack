import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { upsertMatch } from '../db/repository';
import { recordGoal, startMatch } from '../lib/matchActions';
import { makeMatch, makePlayer } from '../lib/testHelpers';
import { useMatchStore } from '../state/matchStore';
import { useRosterStore } from '../state/rosterStore';
import { useTeamStore } from '../state/teamStore';
import { LiveMatchPage } from './LiveMatchPage';

async function renderLive() {
  const scorer = makePlayer({ name: 'Forward', jerseyNumber: 9, preferredGroup: 'FWD' });
  const assist = makePlayer({ name: 'Mid', jerseyNumber: 8, preferredGroup: 'MID' });
  let match = makeMatch({
    teamName: 'Us',
    opponentName: 'Them',
    rosterPlayerIds: [scorer.id, assist.id],
  });
  match = startMatch(match, Date.now());
  match = recordGoal(match, { team: 'us', isOwnGoal: false, scorerId: scorer.id, assisterId: assist.id });

  useRosterStore.setState({ players: [scorer, assist], loaded: true });
  useTeamStore.setState({ teams: [], activeTeamId: null, loaded: true });
  useMatchStore.setState({ match, allMatches: [match], loading: false, saveStatus: 'idle', lastActionError: null });
  await upsertMatch(match);

  render(
    <MemoryRouter initialEntries={[`/match/${match.id}/live`]}>
      <Routes>
        <Route path="/match/:id/live" element={<LiveMatchPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: 'Goals' })).toBeInTheDocument();
  return { scorer };
}

describe('LiveMatchPage goal corrections', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('changes the scorer of a goal without leaving the match', async () => {
    const user = userEvent.setup();
    const { scorer } = await renderLive();

    expect(screen.getAllByText(/Goal: Forward \(assist: Mid\)/).length).toBeGreaterThan(0);
    const goals = screen.getByRole('heading', { name: 'Goals' }).parentElement;
    if (!goals) throw new Error('Goals list was not rendered.');
    await user.click(within(goals).getByRole('button', { name: 'Edit' }));
    const menu = screen.getByRole('dialog', { name: 'Edit goals' });
    await user.click(within(menu).getByRole('button', { name: 'Edit' }));
    const editDialog = screen.getByRole('dialog', { name: 'Edit goal' });
    await user.selectOptions(within(editDialog).getByLabelText('Scorer'), scorer.id);
    await user.selectOptions(within(editDialog).getByLabelText('Assist (optional)'), '');
    await user.click(within(editDialog).getByRole('button', { name: 'Save changes' }));

    expect(screen.queryByRole('dialog', { name: 'Edit goal' })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Goal: Forward\./).length).toBeGreaterThan(0);
    expect(screen.queryByText(/assist: Mid/)).not.toBeInTheDocument();
  });

  it('removes a goal and updates the score', async () => {
    const user = userEvent.setup();
    await renderLive();

    const goals = screen.getByRole('heading', { name: 'Goals' }).parentElement;
    if (!goals) throw new Error('Goals list was not rendered.');
    await user.click(within(goals).getByRole('button', { name: 'Edit' }));
    const menu = screen.getByRole('dialog', { name: 'Edit goals' });
    await user.click(within(menu).getByRole('button', { name: 'Remove' }));
    await user.click(within(menu).getByRole('button', { name: 'Remove goal' }));

    expect(screen.queryByRole('heading', { name: 'Goals' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Goal: Forward/)).not.toBeInTheDocument();
  });
});
