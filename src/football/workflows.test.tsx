import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { createTeam, upsertPlayer } from '../db/repository';
import { useTeamStore } from '../state/teamStore';
import { useRosterStore } from '../state/rosterStore';
import { makePlayer } from '../lib/testHelpers';
import { TeamSwitcher } from '../components/layout/TeamSwitcher';
import { AppShell } from '../components/layout/AppShell';
import { SportGate } from '../components/layout/SportBoundary';
import { RosterPage } from '../pages/RosterPage';
import { FootballEditor } from './FootballEditor';
import { FootballWhiteboardPage } from './FootballWhiteboardPage';
import { FormationsPage } from './FormationsPage';
import { PlaybookPage } from './PlaybookPage';
import { PlayEditorPage } from './PlayEditorPage';
import { DrivePlansPage } from './DrivePlansPage';
import { instantiateTemplate, newFormation, playFromFormation } from './domain';
import { PLAY_TEMPLATES } from './templates';
import { saveFormation, savePlay } from './repository';

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
  const team = await createTeam('Flag', { sport: 'football' });
  useTeamStore.setState({ teams: [team], activeTeamId: team.id, loaded: true });
  useRosterStore.setState({ players: [], loaded: true });
});
afterEach(cleanup);
const teamId = () => useTeamStore.getState().activeTeamId!;
function router(children: React.ReactNode) {
  return (
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {children}
    </MemoryRouter>
  );
}

describe('sport separation and roster UX', () => {
  it('creates a football team with a fixed sport choice', async () => {
    const user = userEvent.setup();
    render(<TeamSwitcher />);
    await user.click(screen.getByRole('button', { name: 'New team' }));
    await user.type(screen.getByLabelText('Team name'), 'New flag team');
    await user.selectOptions(screen.getByLabelText('Sport'), 'football');
    expect(screen.queryByText('Co-ed team')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create team' }));
    await waitFor(() =>
      expect(useTeamStore.getState().teams.find((t) => t.name === 'New flag team')?.sport).toBe(
        'football',
      ),
    );
    expect((await db.teams.get(useTeamStore.getState().activeTeamId!))?.sport).toBe('football');
  });
  it('shows football navigation and switches back to legacy soccer navigation', async () => {
    render(router(<AppShell />));
    expect(screen.getByRole('link', { name: 'Playbook' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Matches' })).not.toBeInTheDocument();
    const soccer = await createTeam('FC');
    act(() => useTeamStore.setState({ teams: [soccer], activeTeamId: soccer.id }));
    expect(screen.getByRole('link', { name: 'Lineups' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Playbook' })).not.toBeInTheDocument();
  });
  it('guards direct soccer URLs for a football team', async () => {
    render(
      <MemoryRouter
        initialEntries={['/lineups']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/lineups"
            element={
              <SportGate sport="soccer">
                <p>Soccer lineup editor</p>
              </SportGate>
            }
          />
          <Route path="/" element={<p>Football dashboard</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Football dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Soccer lineup editor')).not.toBeInTheDocument();
  });
  it('creates roster players without soccer position controls', async () => {
    const user = userEvent.setup();
    render(router(<RosterPage />));
    await user.click(screen.getByRole('button', { name: '+ Add player' }));
    expect(screen.queryByText('Goalkeeper')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Display name'), 'Receiver One');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Add player' }),
    );
    expect(await screen.findByText('Receiver One')).toBeInTheDocument();
    expect(await db.players.count()).toBe(1);
  });
});
describe('formation and play editor workflows', () => {
  it('prompts for a saved formation when creating a new play and copies its lineup', async () => {
    const player = makePlayer({ teamId: teamId(), name: 'Starting QB', jerseyNumber: 10 });
    await upsertPlayer(player);
    const formation = newFormation(teamId());
    formation.name = 'Trips right';
    formation.players[0].rosterPlayerId = player.id;
    formation.players[2].position = { x: 70, y: 75 };
    await saveFormation(formation);
    const user = userEvent.setup();
    render(
      router(
        <Routes>
          <Route path="/" element={<PlaybookPage />} />
          <Route path="/football/plays/:id" element={<PlayEditorPage />} />
        </Routes>,
      ),
    );
    await user.click(await screen.findByRole('button', { name: 'New play' }));
    const dialog = screen.getByRole('dialog', { name: 'Create a play' });
    expect(within(dialog).getByLabelText('Starting formation')).toHaveValue(formation.id);
    await user.clear(within(dialog).getByLabelText('Play name'));
    await user.type(within(dialog).getByLabelText('Play name'), 'Trips slants');
    await user.click(within(dialog).getByRole('button', { name: 'Create play' }));
    expect(await screen.findByLabelText('Play name')).toHaveValue('Trips slants');
    const [play] = await db.footballPlays.toArray();
    expect(play.formationId).toBe(formation.id);
    expect(play.players[0].rosterPlayerId).toBe(player.id);
    expect(play.players[2].position).toEqual({ x: 70, y: 75 });
    expect(play.quarterbackId).toBe(formation.quarterbackId);
    expect(play.snapperId).toBe(formation.snapperId);
  });
  it('autofills available roster players, supports undo, and saves all assignments', async () => {
    const roster = Array.from({ length: 8 }, (_, i) =>
      makePlayer({
        teamId: teamId(),
        name: `Flag Player ${i + 1}`,
        jerseyNumber: i + 1,
        availability: i === 7 ? 'unavailable' : 'active',
      }),
    );
    await db.players.bulkPut(roster);
    const user = userEvent.setup();
    render(router(<FormationsPage />));
    await user.click(await screen.findByRole('button', { name: 'New formation' }));
    await user.selectOptions(screen.getByLabelText('Roster player'), roster[4].id);
    await user.click(screen.getByRole('button', { name: 'Autofill from roster' }));
    expect(screen.getByText('7 / 7 assigned')).toBeInTheDocument();
    expect(screen.getByLabelText('Roster player')).toHaveValue(roster[4].id);
    expect(screen.getByRole('button', { name: 'Autofill from roster' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('1 / 7 assigned')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    await user.click(screen.getByRole('button', { name: 'Save formation' }));
    expect(await screen.findByText('Saved on this device.')).toBeInTheDocument();
    const [formation] = await db.footballFormations.toArray();
    expect(new Set(formation.players.map((p) => p.rosterPlayerId))).toEqual(
      new Set(roster.slice(0, 7).map((p) => p.id)),
    );
    expect(formation.players[2].rosterPlayerId).toBe(roster[4].id);
  });
  it('saves a roster-assigned seven-player formation through the UI', async () => {
    const user = userEvent.setup();
    const player = makePlayer({ teamId: teamId(), name: 'Receiver', jerseyNumber: 8 });
    await upsertPlayer(player);
    render(router(<FormationsPage />));
    await user.click(await screen.findByRole('button', { name: 'New formation' }));
    await user.clear(screen.getByLabelText('Formation name'));
    await user.type(screen.getByLabelText('Formation name'), 'Trips right');
    await user.selectOptions(screen.getByLabelText('Roster player'), player.id);
    await user.click(screen.getByRole('button', { name: 'Save formation' }));
    expect(await screen.findByText('Saved on this device.')).toBeInTheDocument();
    const [formation] = await db.footballFormations.toArray();
    expect(formation.name).toBe('Trips right');
    expect(formation.players[2].rosterPlayerId).toBe(player.id);
  });
  it('edits a template, changes snapper behavior, adds motion and a fake exchange, saves and reloads', async () => {
    const user = userEvent.setup();
    const play = instantiateTemplate(
      PLAY_TEMPLATES.find((t) => t.name === 'Mesh')!,
      teamId(),
    );
    const view = render(<FootballEditor initial={play} roster={[]} onClose={() => {}} />);
    await user.clear(screen.getByLabelText('Play name'));
    await user.type(screen.getByLabelText('Play name'), 'My mesh');
    await user.selectOptions(screen.getByLabelText('Route / assignment'), 'post');
    await user.click(screen.getByRole('button', { name: 'Flip left/right' }));
    fireEvent.change(screen.getByLabelText('Route depth'), { target: { value: '40' } });
    await user.click(screen.getByRole('button', { name: 'Add / edit motion' }));
    fireEvent.pointerDown(screen.getByLabelText('7v7 football field and play art'), {
      clientX: 40,
      clientY: 70,
    });
    await user.click(screen.getByRole('button', { name: 'Add handoff' }));
    await user.click(screen.getByLabelText('Fake'));
    await user.selectOptions(screen.getByLabelText('Selected player'), play.snapperId);
    await user.selectOptions(screen.getByLabelText('Route / assignment'), 'block');
    await user.click(screen.getByRole('button', { name: 'Save play' }));
    expect(await screen.findByText('Saved on this device.')).toBeInTheDocument();
    const saved = (await db.footballPlays.get(play.id))!;
    expect(saved.name).toBe('My mesh');
    expect(saved.players[2].route.type).toBe('post');
    expect(saved.players[2].route.depth).toBe(40);
    expect(saved.players[2].motion).toHaveLength(1);
    expect(saved.players[1].route.type).toBe('block');
    expect(saved.ballActions[1].fake).toBe(true);
    view.unmount();
    render(<FootballEditor initial={saved} roster={[]} onClose={() => {}} />);
    expect(screen.getByLabelText('Play name')).toHaveValue('My mesh');
    expect(screen.getByLabelText('Route / assignment')).toHaveValue('post');
  });
  it('loads a starter as data, duplicates it, and deletes the copy', async () => {
    const user = userEvent.setup();
    render(
      router(
        <Routes>
          <Route path="/" element={<PlaybookPage />} />
          <Route path="/football/plays/:id" element={<PlayEditorPage />} />
          <Route path="/football/playbook" element={<PlaybookPage />} />
        </Routes>,
      ),
    );
    await user.click(await screen.findByRole('button', { name: 'Use Mesh' }));
    expect(await screen.findByLabelText('Play name')).toHaveValue('Mesh');
    expect(await db.footballPlays.count()).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: 'Duplicate' }));
    expect(await screen.findByLabelText('Play name')).toHaveValue('Mesh (copy)');
    expect(await db.footballPlays.count()).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.type(await screen.findByLabelText('Search plays'), '(copy)');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete play' }),
    );
    await waitFor(async () => expect(await db.footballPlays.count()).toBe(1));
  });
});
describe('drive planner and whiteboard', () => {
  it('adds, repeats, reorders, previews and persists a drive sequence', async () => {
    const a = playFromFormation(newFormation(teamId()));
    a.name = 'First play';
    const b = playFromFormation(newFormation(teamId()));
    b.name = 'Second play';
    await savePlay(a);
    await savePlay(b);
    const user = userEvent.setup();
    render(router(<DrivePlansPage />));
    await user.click(await screen.findByRole('button', { name: 'New drive plan' }));
    await user.selectOptions(screen.getByLabelText('Play to add'), a.id);
    await user.click(screen.getByRole('button', { name: 'Add play' }));
    await user.selectOptions(screen.getByLabelText('Play to add'), b.id);
    await user.click(screen.getByRole('button', { name: 'Add play' }));
    await user.click(screen.getByRole('button', { name: 'Move play 2 up' }));
    await user.click(screen.getAllByRole('button', { name: 'Repeat' })[0]);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Save drive' }));
    expect(await screen.findByText('Drive saved.')).toBeInTheDocument();
    await act(async () => {
      const [drive] = await db.drivePlans.toArray();
      expect(drive.entries.map((e) => e.playId)).toEqual([b.id, b.id, a.id]);
      expect(new Set(drive.entries.map((e) => e.id)).size).toBe(3);
    });
    expect(screen.getByRole('link', { name: 'Open play editor' })).toHaveAttribute(
      'href',
      `/football/plays/${b.id}`,
    );
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[2]);
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });
  it('clears, undoes and redoes football whiteboard drawings with persistence', async () => {
    const drawings = [
      {
        id: 'ink',
        tool: 'line' as const,
        color: '#ffffff',
        width: 1,
        points: [
          { x: 5, y: 5 },
          { x: 10, y: 10 },
        ],
      },
    ];
    await db.footballWhiteboards.put({ id: teamId(), teamId: teamId(), drawings, updatedAt: 1 });
    const user = userEvent.setup();
    render(<FootballWhiteboardPage />);
    await user.click(await screen.findByRole('button', { name: 'Clear drawings' }));
    await waitFor(async () =>
      expect((await db.footballWhiteboards.get(teamId()))?.drawings).toEqual([]),
    );
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () =>
      expect((await db.footballWhiteboards.get(teamId()))?.drawings).toEqual(drawings),
    );
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(async () =>
      expect((await db.footballWhiteboards.get(teamId()))?.drawings).toEqual([]),
    );
  });
});
