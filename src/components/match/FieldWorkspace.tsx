import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Assignment, FormationPosition, Player, PlayerRuntimeState, SlotId } from '../../types';
import { DroppableSlot } from './DroppableSlot';
import { PlayerToken } from './PlayerToken';
import { FieldCanvas } from './FieldCanvas';
import { BenchPanel } from './BenchPanel';
import { MoveDialog } from './MoveDialog';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { POSITION_COLORS, POSITION_COLOR_ORDER } from './positionColors';
import { POSITION_GROUP_LABELS } from '../../types';

interface FieldWorkspaceProps {
  positions: FormationPosition[];
  assignments: Assignment;
  players: Player[];
  rosterPlayerIds: string[];
  unavailablePlayerIds: string[];
  playerStates?: Record<string, PlayerRuntimeState>;
  showTimers?: boolean;
  alertPlayerIds?: Set<string>;
  locked?: boolean;
  onRequestMove: (playerId: string, toSlot: SlotId) => void;
}

export function FieldWorkspace({
  positions,
  assignments,
  players,
  rosterPlayerIds,
  unavailablePlayerIds,
  playerStates,
  showTimers,
  alertPlayerIds,
  locked,
  onRequestMove,
}: FieldWorkspaceProps) {
  const [moveDialogPlayerId, setMoveDialogPlayerId] = useState<string | null>(null);
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const assignedIds = new Set(Object.values(assignments));
  const benchIds = rosterPlayerIds.filter((id) => !assignedIds.has(id) && !unavailablePlayerIds.includes(id));
  const unavailableIds = rosterPlayerIds.filter((id) => unavailablePlayerIds.includes(id));

  // A single PointerSensor (not Pointer+Touch together) is the recommended
  // dnd-kit setup for supporting mouse, touch, AND pen/stylus input without
  // the two sensors double-activating the same tap on touchscreens (an
  // issue commonly seen on Windows touch/stylus laptops). The small delay +
  // tolerance lets a tap/click (e.g. on the "Move…" button) or a light pen
  // touch pass through, while a deliberate press-and-drag starts dragging.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const playerId = event.active.data.current?.playerId as string | undefined;
    setDraggingPlayerId(playerId ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingPlayerId(null);
    const playerId = event.active.data.current?.playerId as string | undefined;
    const toSlot = event.over?.id as SlotId | undefined;
    if (!playerId || !toSlot) return;
    onRequestMove(playerId, toSlot);
  }

  function handleDragCancel() {
    setDraggingPlayerId(null);
  }

  const moveDialogPlayer = moveDialogPlayerId ? playersById.get(moveDialogPlayerId) ?? null : null;
  const draggingPlayer = draggingPlayerId ? playersById.get(draggingPlayerId) ?? null : null;

  return (
    <DndContext
      sensors={locked ? undefined : sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="w-full sm:w-36 sm:flex-shrink-0">
          <BenchPanel count={benchIds.length}>
            {benchIds.map((id) => {
              const player = playersById.get(id);
              if (!player) return null;
              return (
                <PlayerToken
                  key={id}
                  player={player}
                  slotId="BENCH"
                  surface="bench"
                  disabled={locked}
                  state={playerStates?.[id]}
                  showTimer={showTimers}
                  alertActive={alertPlayerIds?.has(id)}
                  onRequestMove={() => setMoveDialogPlayerId(id)}
                />
              );
            })}
          </BenchPanel>

          {unavailableIds.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Unavailable</h3>
              <div className="mt-1 flex flex-col items-center gap-2 opacity-60">
                {unavailableIds.map((id) => {
                  const player = playersById.get(id);
                  if (!player) return null;
                  return <PlayerToken key={id} player={player} slotId="UNAVAILABLE" disabled compact />;
                })}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <ul className="mb-2 flex flex-wrap gap-2" aria-label="Player colors by roster position">
            {POSITION_COLOR_ORDER.map((group) => (
              <li key={group} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className={`h-3 w-3 rounded-full ${POSITION_COLORS[group].swatch}`} aria-hidden />
                {POSITION_COLORS[group].abbr} {POSITION_GROUP_LABELS[group]}
              </li>
            ))}
          </ul>
          <FieldCanvas>
            {positions.map((position) => {
              const playerId = assignments[position.id];
              const player = playerId ? playersById.get(playerId) : undefined;
              return (
                <DroppableSlot key={position.id} position={position} occupied={!!player}>
                  {player && (
                    <PlayerToken
                      player={player}
                      slotId={position.id}
                      surface="field"
                      disabled={locked}
                      state={playerStates?.[player.id]}
                      showTimer={showTimers}
                      alertActive={alertPlayerIds?.has(player.id)}
                      onRequestMove={() => setMoveDialogPlayerId(player.id)}
                    />
                  )}
                </DroppableSlot>
              );
            })}
          </FieldCanvas>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingPlayer ? (
          <div className="flex w-28 flex-col items-center rounded-xl bg-white p-2 shadow-2xl">
            <PlayerAvatar
              player={draggingPlayer}
              size="xl"
              ringClassName={POSITION_COLORS[draggingPlayer.preferredGroup].ring}
            />
            <span
              className={`mt-1 w-full truncate rounded px-1 text-center text-xs font-bold ${POSITION_COLORS[draggingPlayer.preferredGroup].badge}`}
            >
              {draggingPlayer.name} ({POSITION_COLORS[draggingPlayer.preferredGroup].abbr})
            </span>
          </div>
        ) : null}
      </DragOverlay>

      <MoveDialog
        open={!!moveDialogPlayer}
        player={moveDialogPlayer}
        positions={positions}
        assignments={assignments}
        playersById={playersById}
        onClose={() => setMoveDialogPlayerId(null)}
        onConfirm={(toSlot) => {
          if (moveDialogPlayer) onRequestMove(moveDialogPlayer.id, toSlot);
          setMoveDialogPlayerId(null);
        }}
      />
    </DndContext>
  );
}
