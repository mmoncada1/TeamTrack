import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { makePlayer } from '../lib/testHelpers';
import { newFormation } from './domain';
import { FootballField } from './FootballField';

const createObjectURL = vi.fn(() => 'blob:roster-photo');
const revokeObjectURL = vi.fn();
beforeEach(async () => {
  await db.delete();
  await db.open();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('football player portraits', () => {
  it('drags assigned players through a dedicated hit area above the portrait', () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const formation = newFormation('flag');
    const player = makePlayer({ teamId: 'flag', name: 'Ava Smith' });
    formation.players[0].rosterPlayerId = player.id;
    const onPlayers = vi.fn();
    const onSelect = vi.fn();
    const view = render(
      <FootballField {...formation} roster={[player]} onPlayers={onPlayers} onSelect={onSelect} />,
    );
    const field = screen.getByRole('group', { name: '7v7 football field and play art' });
    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 100, height: 100,
    } as DOMRect);
    const slot = formation.players[0];
    const handle = view.container.querySelector(`[data-player-handle="${slot.id}"]`)!;
    expect(handle).toHaveAttribute('pointer-events', 'all');
    expect(handle.previousElementSibling).toHaveAttribute('pointer-events', 'none');
    fireEvent.pointerDown(handle, { clientX: slot.position.x, clientY: slot.position.y });
    fireEvent.pointerMove(field, { clientX: 60, clientY: 80 });
    expect(onSelect).toHaveBeenCalledWith(slot.id);
    expect(onPlayers.mock.lastCall?.[0][0].position).toEqual({ x: 60, y: 80 });
    fireEvent.pointerUp(field);
    onPlayers.mockClear();
    fireEvent.pointerMove(field, { clientX: 65, clientY: 85 });
    expect(onPlayers).not.toHaveBeenCalled();
  });
  it('uses stored roster photos in editable fields and previews while retaining role labels', async () => {
    const player = makePlayer({
      teamId: 'flag',
      name: 'Ava Smith',
      jerseyNumber: 7,
      photoId: 'photo',
    });
    await db.photos.put({
      id: 'photo',
      playerId: player.id,
      blob: new Blob(['image'], { type: 'image/png' }),
      mimeType: 'image/png',
      width: 40,
      height: 40,
      createdAt: 1,
    });
    const formation = newFormation('flag');
    formation.players[0].rosterPlayerId = player.id;
    const view = render(<FootballField {...formation} roster={[player]} />);
    const image = await screen.findByRole('img', { name: 'Photo of Ava Smith' });
    expect(image).toHaveAttribute('href', 'blob:roster-photo');
    expect(image).toHaveAttribute('clip-path');
    expect(
      screen.getByRole('button', { name: 'Select QB, Ava Smith, quarterback' }),
    ).toBeInTheDocument();
    expect(screen.getByText('QB')).toBeInTheDocument();
    expect(screen.getByText('Ava Smith')).toBeInTheDocument();
    view.rerender(<FootballField {...formation} roster={[player]} preview />);
    expect(await screen.findByRole('img', { name: 'Photo of Ava Smith' })).toBeInTheDocument();
    await act(async () => {
      await db.photos.delete('photo');
    });
    await waitFor(() =>
      expect(screen.queryByRole('img', { name: 'Photo of Ava Smith' })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('AS')).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:roster-photo');
  });
  it('shows initials for assigned players without photos and labels for unassigned slots', () => {
    const formation = newFormation('flag');
    const player = makePlayer({ teamId: 'flag', name: 'Ben Jones', jerseyNumber: 4 });
    formation.players[2].rosterPlayerId = player.id;
    render(<FootballField {...formation} roster={[player]} />);
    expect(screen.getByText('BJ')).toBeInTheDocument();
    expect(screen.getByText('Ben Jones')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('QB')).toBeInTheDocument();
  });
});
