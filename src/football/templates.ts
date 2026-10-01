import { newFormation, playFromFormation } from './domain';
import { makeRoute } from './routes';
import type { PlayTemplate, RouteType } from './types';

/** Original 7v7 adaptations of common concepts. No external diagrams or datasets. */
const concepts: {
  name: string;
  routes: RouteType[];
  description: string;
  tags: string[];
  action?: 'handoff' | 'pitch';
  motion?: boolean;
}[] = [
  {
    name: 'Four Verticals',
    routes: ['stay', 'seam', 'go', 'go', 'go', 'go', 'flat'],
    description: 'Four wide vertical stems with a releasing snapper and a flat outlet.',
    tags: ['vertical', 'spread'],
  },
  {
    name: 'Mesh',
    routes: ['stay', 'hitch', 'corner', 'drag', 'drag', 'post', 'flat'],
    description:
      'Two shallow crossers at slightly different depths; settle underneath zone coverage.',
    tags: ['crossing', 'short'],
  },
  {
    name: 'Slants',
    routes: ['stay', 'hitch', 'slant', 'slant', 'slant', 'slant', 'flat'],
    description: 'Quick inside breaks with the back as a flat outlet.',
    tags: ['quick'],
  },
  {
    name: 'Smash',
    routes: ['stay', 'block', 'hitch', 'corner', 'corner', 'hitch', 'flat'],
    description: 'Pair a short hitch with a deeper corner on each side.',
    tags: ['high-low'],
  },
  {
    name: 'Flood',
    routes: ['stay', 'flat', 'go', 'cross', 'out', 'go', 'flat'],
    description:
      'Three levels to the right sideline. Flip assignments to attack the opposite side.',
    tags: ['sideline', 'high-low'],
  },
  {
    name: 'Levels',
    routes: ['stay', 'hitch', 'dig', 'drag', 'dig', 'go', 'flat'],
    description: 'Inside breaks at multiple depths stretch underneath defenders.',
    tags: ['middle'],
  },
  {
    name: 'Stick',
    routes: ['stay', 'hitch', 'go', 'hitch', 'flat', 'go', 'flat'],
    description: 'Short settle routes next to flat releases and outside vertical clears.',
    tags: ['quick', 'short'],
  },
  {
    name: 'Drive',
    routes: ['stay', 'block', 'go', 'drag', 'dig', 'go', 'flat'],
    description: 'Shallow drag underneath an intermediate dig.',
    tags: ['crossing', 'high-low'],
  },
  {
    name: 'Shallow Cross',
    routes: ['stay', 'hitch', 'go', 'drag', 'post', 'go', 'flat'],
    description: 'A fast shallow crosser with deep clearing routes.',
    tags: ['crossing'],
  },
  {
    name: 'Curl / Flat',
    routes: ['stay', 'block', 'curl', 'flat', 'flat', 'curl', 'hitch'],
    description: 'Curl receivers settle behind paired flat releases.',
    tags: ['short', 'high-low'],
  },
  {
    name: 'Post / Wheel',
    routes: ['stay', 'block', 'post', 'wheel', 'dig', 'go', 'flat'],
    description: 'An inside post clears room for the adjacent wheel.',
    tags: ['vertical'],
  },
  {
    name: 'Spacing',
    routes: ['stay', 'hitch', 'hitch', 'flat', 'flat', 'hitch', 'hitch'],
    description: 'Distribute short receiving options across the field.',
    tags: ['quick', 'short'],
  },
  {
    name: 'Quick Screen',
    routes: ['stay', 'block', 'hitch', 'block', 'block', 'go', 'flat'],
    description:
      'Quick throw outside with nearby players assigned to block; adapt to your league rules.',
    tags: ['screen'],
  },
  {
    name: 'Jet Motion Handoff',
    routes: ['stay', 'block', 'go', 'custom', 'block', 'go', 'flat'],
    description:
      'Motion a receiver behind the QB and hand off. Verify your league allows this exchange.',
    tags: ['motion', 'run'],
    action: 'handoff',
    motion: true,
  },
  {
    name: 'Basic Pitch',
    routes: ['stay', 'block', 'go', 'block', 'block', 'go', 'flat'],
    description: 'Pitch to the back behind the line of scrimmage.',
    tags: ['run', 'lateral'],
    action: 'pitch',
  },
];
export const PLAY_TEMPLATES: PlayTemplate[] = concepts.map((concept, index) => {
  const formation = newFormation('template');
  // Stable slot IDs make these data definitions portable to future dataset loaders.
  formation.players = formation.players.map((p, i) => ({
    ...p,
    id: `slot-${i}`,
    route: makeRoute(concept.routes[i], i === 3 ? 20 : 30, i < 4 ? 1 : -1),
  }));
  formation.quarterbackId = 'slot-0';
  formation.snapperId = 'slot-1';
  const play = playFromFormation(formation);
  play.ballActions[0].id = 'snap';
  if (concept.name === 'Mesh') {
    play.players[3].route = makeRoute('drag', 37, 1);
    play.players[4].route = makeRoute('drag', 37, -1);
    play.players[4].route.points = play.players[4].route.points.map((p) => ({ ...p, y: p.y - 3 }));
  }
  if (concept.name === 'Levels') play.players[4].route = makeRoute('dig', 40, -1);
  if (concept.motion) {
    play.players[3].motion = [{ x: 12, y: 14 }];
    play.players[3].route = {
      ...makeRoute('custom'),
      points: [
        { x: 20, y: 14 },
        { x: 40, y: 8 },
        { x: 45, y: -15 },
      ],
    };
  }
  if (concept.action)
    play.ballActions.push({
      id: `exchange-${index}`,
      type: concept.action,
      fromPlayerId: 'slot-0',
      toPlayerId: concept.motion ? 'slot-3' : 'slot-6',
      order: 1,
      fake: false,
      target: concept.motion ? { x: 49, y: 87 } : { x: 75, y: 82 },
    });
  return {
    id: `generic-${index}`,
    name: concept.name,
    description: concept.description,
    tags: concept.tags,
    players: play.players,
    quarterbackId: play.quarterbackId,
    snapperId: play.snapperId,
    ballActions: play.ballActions,
  };
});
