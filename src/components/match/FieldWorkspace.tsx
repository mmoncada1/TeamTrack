import { useMemo, useState, type ReactNode } from 'react';
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
import { positionAbbreviations, primaryPositionGroup } from '../../lib/playerPositions';
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
  injuredPlayerIds?: string[];
  sentOffPlayerIds?: string[];
  cardsByPlayer?: Record<string, { yellow: number; red: number }>;
  locked?: boolean;
  onRequestMove: (playerId: string, toSlot: SlotId) => void;
  onEditPlayer?: (playerId: string) => void;
  onAddPlayer?: () => void;
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
  injuredPlayerIds,
  sentOffPlayerIds,
  cardsByPlayer,
  locked,
  onRequestMove,
  onEditPlayer,
  onAddPlayer,
}: FieldWorkspaceProps) {
  const [moveDialogPlayerId, setMoveDialogPlayerId] = useState<string | null>(null);
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const assignedIds = new Set(Object.values(assignments));
  const injured = new Set(injuredPlayerIds ?? []);
  const sentOff = new Set(sentOffPlayerIds ?? []);
  const isUnavailable = (id: string) =>
    playerStates ? playerStates[id]?.status === 'unavailable' : unavailablePlayerIds.includes(id);
  const benchIds = rosterPlayerIds
    .filter((id) => !assignedIds.has(id) && !isUnavailable(id))
    // Longest current bench stint first, so the coach can spot who's been
    // waiting longest for their next turn on the field.
    .sort((a, b) => (playerStates?.[b]?.currentStintMs ?? 0) - (playerStates?.[a]?.currentStintMs ?? 0));
  const unavailableIds = rosterPlayerIds.filter((id) => isUnavailable(id));
  const sentOffIds = unavailableIds.filter((id) => sentOff.has(id));
  const injuredIds = unavailableIds.filter((id) => injured.has(id) && !sentOff.has(id));
  const otherUnavailableIds = unavailableIds.filter((id) => !injured.has(id) && !sentOff.has(id));

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
      <div className="flex flex-col gap-4 sm:h-full sm:min-h-0 sm:flex-row sm:items-start sm:gap-2">
        <div className="flex w-full flex-col sm:h-full sm:min-h-0 sm:w-48 sm:flex-shrink-0">
          <div className="sm:min-h-0 sm:flex-1">
            <BenchPanel count={benchIds.length} onAddPlayer={onAddPlayer}>
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
                    onEdit={onEditPlayer}
                    yellowCards={cardsByPlayer?.[id]?.yellow}
                    redCards={cardsByPlayer?.[id]?.red}
                  />
                );
              })}
            </BenchPanel>
          </div>

          {sentOffIds.length > 0 && (
            <OutSection label="Sent off">
              {sentOffIds.map((id) => (
                <OutToken key={id} id={id} playersById={playersById} onEdit={onEditPlayer} cardsByPlayer={cardsByPlayer} />
              ))}
            </OutSection>
          )}
          {injuredIds.length > 0 && (
            <OutSection label="Injured">
              {injuredIds.map((id) => (
                <OutToken key={id} id={id} playersById={playersById} onEdit={onEditPlayer} cardsByPlayer={cardsByPlayer} />
              ))}
            </OutSection>
          )}
          {otherUnavailableIds.length > 0 && (
            <OutSection label="Unavailable">
              {otherUnavailableIds.map((id) => (
                <OutToken key={id} id={id} playersById={playersById} onEdit={onEditPlayer} cardsByPlayer={cardsByPlayer} />
              ))}
            </OutSection>
          )}
        </div>

        <div className="flex flex-col sm:h-full sm:min-h-0">
          <ul className="flex h-7 shrink-0 items-center gap-2" aria-label="Player colors by roster position">
            {POSITION_COLOR_ORDER.map((group) => (
              <li key={group} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className={`h-3 w-3 rounded-full ${POSITION_COLORS[group].swatch}`} aria-hidden />
                {POSITION_COLORS[group].abbr} {POSITION_GROUP_LABELS[group]}
              </li>
            ))}
          </ul>
          <div className="sm:min-h-0 sm:flex-1">
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
                        onEdit={onEditPlayer}
                        yellowCards={cardsByPlayer?.[player.id]?.yellow}
                        redCards={cardsByPlayer?.[player.id]?.red}
                      />
                    )}
                  </DroppableSlot>
                );
              })}
            </FieldCanvas>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingPlayer ? (
          <div className="flex w-28 flex-col items-center rounded-xl bg-white p-2 shadow-2xl">
            <PlayerAvatar
              player={draggingPlayer}
              size="xl"
              ringClassName={POSITION_COLORS[primaryPositionGroup(draggingPlayer)].ring}
            />
            <span
              className={`mt-1 w-full truncate rounded px-1 text-center text-xs font-bold ${POSITION_COLORS[primaryPositionGroup(draggingPlayer)].badge}`}
            >
              {draggingPlayer.name} ({positionAbbreviations(draggingPlayer)})
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

function OutSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-3 shrink-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</h3>
      <div className="mt-1 flex flex-col items-center gap-2 opacity-60">{children}</div>
    </div>
  );
}

function OutToken({
  id,
  playersById,
  onEdit,
  cardsByPlayer,
}: {
  id: string;
  playersById: Map<string, Player>;
  onEdit?: (playerId: string) => void;
  cardsByPlayer?: Record<string, { yellow: number; red: number }>;
}) {
  const player = playersById.get(id);
  if (!player) return null;
  return (
    <PlayerToken
      player={player}
      slotId="UNAVAILABLE"
      disabled
      compact
      onEdit={onEdit}
      yellowCards={cardsByPlayer?.[id]?.yellow}
      redCards={cardsByPlayer?.[id]?.red}
    />
  );
}
