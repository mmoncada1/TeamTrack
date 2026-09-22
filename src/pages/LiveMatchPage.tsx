import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMatchStore } from '../state/matchStore';
import { useRosterStore } from '../state/rosterStore';
import { useAppSettingsStore } from '../state/appSettingsStore';
import { useNow } from '../hooks/useNow';
import { deriveMatchState } from '../lib/matchEngine';
import { getFormationById } from '../formations/definitions';
import { MatchActionError, type RecordGoalInput } from '../lib/matchActions';
import { MatchClock } from '../components/match/MatchClock';
import { ScoreBoard } from '../components/match/ScoreBoard';
import { GoalDialog } from '../components/match/GoalDialog';
import { AlertsPanel } from '../components/match/AlertsPanel';
import { FieldWorkspace } from '../components/match/FieldWorkspace';
import { SubstitutionConfirmDialog } from '../components/match/SubstitutionConfirmDialog';
import { EventLog } from '../components/match/EventLog';
import { PlayingTimePanel } from '../components/match/PlayingTimePanel';
import { FormationSwitcher } from '../components/match/FormationSwitcher';
import { ThresholdSliders } from '../components/setup/ThresholdSliders';
import { Dialog } from '../components/common/Dialog';
import { Button } from '../components/common/Button';
import type { Alert, SlotId } from '../types';
import { canUndo as canUndoFn } from '../lib/matchActions';

interface PendingSub {
  playerInId: string;
  playerOutId: string;
  positionId: string;
}

export function LiveMatchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useMatchStore();
  const roster = useRosterStore();
  const appSettings = useAppSettingsStore((s) => s.settings);
  const now = useNow(500);

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [pendingSub, setPendingSub] = useState<PendingSub | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [formationSummary, setFormationSummary] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!roster.loaded) roster.load();
  }, [roster.loaded, roster.load]);

  useEffect(() => {
    if (id) store.loadMatch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Ignore a match left in the store from another screen (for example a history
  // summary). Otherwise an ended match is treated as this route and we redirect
  // to its summary before the requested match has loaded.
  const match = store.match?.id === id ? store.match : null;
  const derived = useMemo(() => (match ? deriveMatchState(match, now) : null), [match, now]);

  useEffect(() => {
    if (match && derived?.status === 'in_progress' && roster.players.length > 0) {
      store.tick(roster.players);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, match?.id, derived?.status, roster.players.length]);

  if (!match || !derived) {
    return <div className="p-8 text-center text-slate-500">Loading match…</div>;
  }

  if (derived.status === 'ended') {
    navigate(`/match/${match.id}/summary`, { replace: true });
    return null;
  }

  const formation = getFormationById(derived.formationId);
  const playersById = new Map(roster.players.map((p) => [p.id, p]));
  const matchPlayers = roster.players.filter((p) => match.rosterPlayerIds.includes(p.id));
  const activePlayers = matchPlayers.filter((p) => derived.playerStates[p.id]?.status === 'field');
  const benchPlayers = matchPlayers.filter((p) => derived.playerStates[p.id]?.status === 'bench');
  const alertPlayerIds = new Set(match.activeAlerts.filter((a) => a.status === 'active').map((a) => a.playerId));

  function runAction(fn: () => void) {
    try {
      setActionError(null);
      fn();
    } catch (err) {
      setActionError(err instanceof MatchActionError ? err.message : 'Something went wrong.');
    }
  }

  function handleRequestMove(playerId: string, toSlot: SlotId) {
    const state = derived!.playerStates[playerId];
    const fromSlot: SlotId = state?.positionId ?? 'BENCH';
    if (fromSlot === toSlot) return;
    const occupant = toSlot !== 'BENCH' ? derived!.assignments[toSlot] : undefined;

    if (!occupant || occupant === playerId) {
      runAction(() => store.movePlayer(playerId, toSlot));
      return;
    }
    if (fromSlot === 'BENCH') {
      setPendingSub({ playerInId: playerId, playerOutId: occupant, positionId: toSlot as string });
      return;
    }
    runAction(() => store.swapPlayers(fromSlot as string, toSlot as string));
  }

  function handleAcceptAlert(alert: Alert) {
    if (!alert.recommendation) return;
    const state = derived!.playerStates[alert.playerId];
    if (!state?.positionId) return;
    setPendingSub({ playerInId: alert.recommendation.inPlayerId, playerOutId: alert.playerId, positionId: state.positionId });
  }

  function handleGoal(input: RecordGoalInput) {
    runAction(() => store.recordGoal(input));
  }

  const pendingSubPositionLabel = pendingSub
    ? formation?.positions.find((p) => p.id === pendingSub.positionId)?.label ?? pendingSub.positionId
    : '';

  const alertsPanel = (
    <AlertsPanel
      alerts={match.activeAlerts}
      playersById={playersById}
      onAccept={handleAcceptAlert}
      onDismiss={(alertId) => runAction(() => store.dismissAlert(alertId, 'dismiss'))}
    />
  );

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-[1600px] flex-col p-3 sm:p-4">
      <div className="flex shrink-0 items-center justify-between">
        <h1 className="text-base font-bold">
          {match.teamName || 'Us'} vs {match.opponentName || 'Opponent'}
        </h1>
        <SaveIndicator status={store.saveStatus} />
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-2 shrink-0 rounded bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {actionError}
        </p>
      )}

      {/* Mobile: alerts shown full-width above the workspace. sm+: they become the left sidebar column below. */}
      <div className="mt-3 shrink-0 sm:hidden">{alertsPanel}</div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
        <div className="hidden w-52 shrink-0 flex-col gap-2 overflow-y-auto sm:flex sm:h-full">{alertsPanel}</div>

        <div className="min-w-0 flex-1 sm:h-full sm:min-h-0">
          {formation && (
            <FieldWorkspace
              positions={formation.positions}
              assignments={derived.assignments}
              players={matchPlayers}
              rosterPlayerIds={match.rosterPlayerIds}
              unavailablePlayerIds={match.unavailablePlayerIds}
              playerStates={derived.playerStates}
              showTimers
              alertPlayerIds={alertPlayerIds}
              locked={appSettings.fieldLocked}
              onRequestMove={handleRequestMove}
            />
          )}
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto sm:h-full sm:w-72">
          <MatchClock
            matchClockMs={derived.displayClockMs}
            status={derived.status}
            currentHalf={derived.currentHalf}
            halfLengthMinutes={match.settings.halfLengthMinutes}
            numberOfHalves={match.settings.numberOfHalves}
            onStart={() => runAction(() => store.start())}
            onPause={() => runAction(() => store.pause())}
            onResume={() => runAction(() => store.resume())}
            onHalfTime={() => runAction(() => store.goToHalfTime())}
            onEnd={() => setConfirmEnd(true)}
          />
          <ScoreBoard
            teamName={match.teamName}
            opponentName={match.opponentName}
            teamScore={derived.teamScore}
            opponentScore={derived.opponentScore}
            onRecordGoal={() => setGoalDialogOpen(true)}
            disabled={derived.status === 'setup'}
          />
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
            <FormationSwitcher
              format={match.settings.format}
              formationId={derived.formationId}
              disabled={appSettings.fieldLocked}
              onChange={(fid) => setFormationSummary(store.changeFormation(fid))}
            />
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={appSettings.fieldLocked}
                onChange={(e) => useAppSettingsStore.getState().setFieldLocked(e.target.checked)}
              />
              Lock field layout
            </label>
            {formationSummary && <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">{formationSummary}</p>}
          </div>

          <details className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
            <summary className="cursor-pointer text-xs font-semibold">Substitution timers</summary>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Changes apply immediately to who gets an alert. A player already on the field keeps their current stint.
            </p>
            <div className="mt-3">
              <ThresholdSliders
                thresholds={match.settings.thresholds}
                onChange={(group, next) =>
                  store.updateLiveSettings({ thresholds: { ...match.settings.thresholds, [group]: next } })
                }
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={match.settings.goalkeeperRotationEnabled}
                onChange={(e) => store.updateLiveSettings({ goalkeeperRotationEnabled: e.target.checked })}
              />
              Enable goalkeeper rotation alerts
            </label>
          </details>

          <PlayingTimePanel
            players={matchPlayers}
            playerStates={derived.playerStates}
            thresholds={match.settings.thresholds}
            goalkeeperRotationEnabled={match.settings.goalkeeperRotationEnabled}
          />
          <EventLog
            events={match.events}
            playersById={playersById}
            formationId={derived.formationId}
            canUndo={canUndoFn(match)}
            onUndo={() => runAction(() => store.undoLastAction())}
            onDeleteEvent={(eventId) => runAction(() => store.deleteEvent(eventId))}
          />
        </div>
      </div>

      <div className="mt-3 flex shrink-0 justify-end">
        <Button variant="ghost" onClick={() => setConfirmReset(true)}>
          Reset match…
        </Button>
      </div>

      <GoalDialog
        open={goalDialogOpen}
        onClose={() => setGoalDialogOpen(false)}
        onSubmit={handleGoal}
        activePlayers={activePlayers}
        benchPlayers={benchPlayers}
      />

      <SubstitutionConfirmDialog
        open={!!pendingSub}
        playerIn={pendingSub ? playersById.get(pendingSub.playerInId) ?? null : null}
        playerOut={pendingSub ? playersById.get(pendingSub.playerOutId) ?? null : null}
        positionLabel={pendingSubPositionLabel}
        matchClockMs={derived.displayClockMs}
        onCancel={() => setPendingSub(null)}
        onConfirm={() => {
          if (pendingSub) runAction(() => store.substitutePlayer(pendingSub.playerInId, pendingSub.positionId));
          setPendingSub(null);
        }}
      />

      <Dialog
        open={confirmEnd}
        title="End match?"
        description="This stops the clock permanently. You can review the summary afterward."
        onClose={() => setConfirmEnd(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                runAction(() => store.endMatch());
                setConfirmEnd(false);
              }}
            >
              End match
            </Button>
          </>
        }
      >
        <p className="text-sm">The match clock will stop and the summary will be available.</p>
      </Dialog>

      <Dialog
        open={confirmReset}
        title="Reset this match?"
        description="This clears every event (goals, substitutions, timers) and returns to the pre-kickoff setup. This cannot be undone."
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                runAction(() => store.resetMatch());
                setConfirmReset(false);
              }}
            >
              Reset match
            </Button>
          </>
        }
      >
        <p className="text-sm">Type nothing needed — just confirm to reset.</p>
      </Dialog>
    </div>
  );
}

function SaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  const label = { idle: 'Idle', saving: 'Saving…', saved: 'Saved', error: 'Save failed' }[status];
  const color = status === 'error' ? 'text-red-600' : status === 'saving' ? 'text-amber-600' : 'text-emerald-600';
  return (
    <span className={`text-xs font-medium ${color}`} role="status">
      {label}
    </span>
  );
}
