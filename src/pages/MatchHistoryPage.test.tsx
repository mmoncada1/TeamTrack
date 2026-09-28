import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { upsertMatch } from '../db/repository';
import { endMatch, startMatch } from '../lib/matchActions';
import { makeMatch } from '../lib/testHelpers';
import { useMatchStore } from '../state/matchStore';
import { useTeamStore } from '../state/teamStore';
import { MatchHistoryPage } from './MatchHistoryPage';

describe('MatchHistoryPage', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    useTeamStore.setState({ teams: [], activeTeamId: null, loaded: true });
  });

  it('asks before deleting a completed match', async () => {
    const user = userEvent.setup();
    let match = makeMatch({ teamName: 'Us', opponentName: 'Them' });
    match = endMatch(startMatch(match, 0), 60_000);
    await upsertMatch(match);
    useMatchStore.setState({ match: null, allMatches: [match], loading: false, saveStatus: 'idle', lastActionError: null });

    render(
      <MemoryRouter>
        <MatchHistoryPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Us vs Them/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('dialog', { name: 'Are you sure you want to delete this?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/Us vs Them/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Are you sure you want to delete this?' })).getByRole('button', { name: 'Delete match' }));

    expect(await screen.findByText('No completed matches yet.')).toBeInTheDocument();
    expect(screen.queryByText(/Us vs Them/)).not.toBeInTheDocument();
  });
});
