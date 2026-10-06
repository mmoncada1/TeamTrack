import { useNavigate, useParams } from 'react-router-dom';
import { FootballEditor } from './FootballEditor';
import { useFootballData } from './useFootballData';

export function PlayEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { plays = [], players = [], loaded } = useFootballData();
  if (!loaded) return <p className="p-4">Loading play…</p>;
  const play = plays.find((p) => p.id === id);
  if (!play) return <p className="p-4">Play not found for this team.</p>;
  return (
    <FootballEditor
      key={play.id}
      initial={play}
      roster={players}
      onClose={() => navigate('/football/playbook')}
    />
  );
}
