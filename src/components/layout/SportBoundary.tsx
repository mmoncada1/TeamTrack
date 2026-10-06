import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useTeamStore } from '../../state/teamStore';
import { teamSport, type Sport } from '../../lib/sports';

export function SportBoundary({ soccer, football }: { soccer: ReactNode; football: ReactNode }) {
  const team = useTeamStore((s) => s.teams.find((t) => t.id === s.activeTeamId));
  return <>{teamSport(team) === 'football' ? football : soccer}</>;
}
export function SportGate({ sport, children }: { sport: Sport; children: ReactNode }) {
  const team = useTeamStore((s) => s.teams.find((t) => t.id === s.activeTeamId));
  const loaded = useTeamStore((s) => s.loaded);
  if (!loaded) return <p className="p-4">Loading team…</p>;
  return teamSport(team) === sport ? <>{children}</> : <Navigate to="/" replace />;
}
