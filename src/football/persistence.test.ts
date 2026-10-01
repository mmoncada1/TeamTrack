import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import {
  createTeam,
  deletePlayer,
  deleteTeamAndData,
  ensureTeams,
  replaceAllData,
  upsertPlayer,
  upsertTeam,
} from '../db/repository';
import { buildBackup, validateBackup } from '../lib/exportImport';
import { makeMatch, makePlayer } from '../lib/testHelpers';
import { useAppSettingsStore } from '../state/appSettingsStore';
import { teamSport } from '../lib/sports';
import { instantiateTemplate, newFormation, playFromFormation } from './domain';
import { PLAY_TEMPLATES } from './templates';
import { deletePlay, footballBackup, saveDrive, saveFormation, savePlay } from './repository';

beforeEach(async () => {
  await db.delete();
  await db.open();
});
describe('sport compatibility and migrations', () => {
  it('initializes exactly one soccer team when startup requests overlap', async () => {
    const [first, second] = await Promise.all([ensureTeams(), ensureTeams()]);
    expect(first[0].id).toBe(second[0].id);
    expect(await db.teams.count()).toBe(1);
    expect(first[0].sport).toBe('soccer');
  });
  it('defaults new and legacy teams to soccer and keeps sport immutable', async () => {
    expect(teamSport(undefined)).toBe('soccer');
    expect(teamSport({})).toBe('soccer');
    const team = await createTeam('Soccer');
    expect(team.sport).toBe('soccer');
    await expect(upsertTeam({ ...team, sport: 'football' })).rejects.toThrow(
      'sport cannot be changed',
    );
  });
  it('migrates a real version 4 database without losing soccer matches, players, or lineups', async () => {
    await db.delete();
    const old = new Dexie('teamtrack');
    old
      .version(4)
      .stores({
        teams: 'id, name',
        players: 'id, teamId, name, jerseyNumber, availability',
        photos: 'id, playerId',
        teamPhotos: 'id, teamId',
        lineups: 'id, teamId, name',
        matches: 'id, teamId, date, updatedAt',
      });
    await old.open();
    await old.table('teams').add({ id: 'legacy', name: 'FC', createdAt: 1, updatedAt: 1 });
    const player = makePlayer({ teamId: 'legacy', name: 'Soccer player', jerseyNumber: 7 });
    await old.table('players').add(player);
    const match = makeMatch({ teamId: 'legacy' });
    await old.table('matches').add(match);
    const lineup = {
      id: 'lineup',
      teamId: 'legacy',
      name: 'First',
      format: '7v7',
      formationId: '7v7-2-3-1',
      assignments: { GK: player.id },
      createdAt: 1,
      updatedAt: 1,
    };
    await old.table('lineups').add(lineup);
    old.close();
    await db.open();
    expect((await db.teams.get('legacy'))?.sport).toBe('soccer');
    expect(await db.players.get(player.id)).toEqual(player);
    expect(await db.matches.get(match.id)).toEqual(match);
    expect(await db.lineups.get('lineup')).toEqual(lineup);
    expect(await db.footballPlays.count()).toBe(0);
  });
  it('imports older backups as soccer with empty football collections', () => {
    const result = validateBackup({
      version: 4,
      teams: [{ id: 'legacy', name: 'FC' }],
      players: [],
      matches: [],
    });
    expect(result.valid).toBe(true);
    expect(result.backup?.teams[0].sport).toBe('soccer');
    expect(result.backup?.footballPlays).toEqual([]);
  });
});
describe('football persistence and backup', () => {
  it('round-trips routes, motion, ball actions, drawings, formations and repeated drive entries', async () => {
    const team = await createTeam('Flag', { sport: 'football' });
    const formation = newFormation(team.id);
    await saveFormation(formation);
    const play = instantiateTemplate(
      PLAY_TEMPLATES.find((t) => t.name === 'Jet Motion Handoff')!,
      team.id,
    );
    play.drawings = [
      {
        id: 'draw',
        tool: 'arrow',
        color: '#fff',
        width: 1,
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 50 },
        ],
      },
    ];
    await savePlay(play);
    const drive = {
      id: 'drive',
      teamId: team.id,
      name: 'Opening drive',
      entries: [
        { id: 'one', playId: play.id },
        { id: 'two', playId: play.id },
      ],
      createdAt: 1,
      updatedAt: 1,
    };
    await saveDrive(drive);
    await db.footballWhiteboards.put({
      id: team.id,
      teamId: team.id,
      drawings: play.drawings,
      updatedAt: 1,
    });
    const football = await footballBackup();
    const json = await buildBackup(
      [team],
      [],
      [],
      useAppSettingsStore.getState().settings,
      [],
      [],
      [],
      football,
    );
    const result = validateBackup(JSON.parse(JSON.stringify(json)));
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    const backup = result.backup!;
    await replaceAllData(
      backup.teams,
      backup.players,
      backup.matches,
      backup.photos,
      backup.teamPhotos,
      backup.lineups,
      backup,
    );
    expect((await db.footballPlays.get(play.id))?.players).toEqual(play.players);
    expect((await db.footballPlays.get(play.id))?.ballActions).toEqual(play.ballActions);
    expect((await db.footballPlays.get(play.id))?.drawings).toEqual(play.drawings);
    expect((await db.drivePlans.get('drive'))?.entries).toEqual(drive.entries);
    expect(await db.footballFormations.count()).toBe(1);
    expect(await db.footballWhiteboards.count()).toBe(1);
  });
  it('rejects malformed geometry and cross-team backup records before replacing data', async () => {
    const team = await createTeam('Flag', { sport: 'football' });
    const play = playFromFormation(newFormation(team.id));
    const json = await buildBackup(
      [team],
      [],
      [],
      useAppSettingsStore.getState().settings,
      [],
      [],
      [],
      { footballPlays: [play] },
    );
    const corrupt = structuredClone(json);
    (corrupt.footballPlays as (typeof play)[])[0].players[0].route.points = [{ x: NaN, y: 1 }];
    expect(validateBackup(corrupt).valid).toBe(false);
    expect(
      validateBackup({ ...json, footballPlays: [{ ...play, teamId: 'other-team' }] }).valid,
    ).toBe(false);
    expect(
      validateBackup({
        ...json,
        drivePlans: [
          {
            id: 'drive',
            teamId: team.id,
            name: 'Drive',
            entries: [{ id: 'entry', playId: 'missing' }],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }).valid,
    ).toBe(false);
  });
  it('enforces sport and roster ownership when saving', async () => {
    const soccer = await createTeam('FC');
    const flag = await createTeam('Flag', { sport: 'football' });
    await expect(saveFormation(newFormation(soccer.id))).rejects.toThrow('football team');
    const formation = newFormation(flag.id);
    const player = makePlayer({ teamId: soccer.id, name: 'Player', jerseyNumber: 1 });
    await upsertPlayer(player);
    formation.players[0].rosterPlayerId = player.id;
    await expect(saveFormation(formation)).rejects.toThrow('no longer on this team');
  });
  it('unlinking a deleted roster player preserves tactical data', async () => {
    const flag = await createTeam('Flag', { sport: 'football' });
    const player = makePlayer({ teamId: flag.id, name: 'Player', jerseyNumber: 1 });
    await upsertPlayer(player);
    const f = newFormation(flag.id);
    f.players[2].rosterPlayerId = player.id;
    await saveFormation(f);
    const p = playFromFormation(f);
    await savePlay(p);
    await deletePlayer(player.id);
    expect((await db.footballPlays.get(p.id))?.players[2].rosterPlayerId).toBeUndefined();
    expect((await db.footballFormations.get(f.id))?.players[2].position).toEqual(
      f.players[2].position,
    );
  });
  it('removes deleted plays from all drive entries and cascades team data without touching soccer', async () => {
    const flag = await createTeam('Flag', { sport: 'football' });
    const soccer = await createTeam('FC');
    const p = playFromFormation(newFormation(flag.id));
    await savePlay(p);
    await saveDrive({
      id: 'drive',
      teamId: flag.id,
      name: 'Drive',
      entries: [
        { id: 'a', playId: p.id },
        { id: 'b', playId: p.id },
      ],
      createdAt: 1,
      updatedAt: 1,
    });
    await deletePlay(p.id);
    expect((await db.drivePlans.get('drive'))?.entries).toEqual([]);
    await saveFormation(newFormation(flag.id));
    await db.footballWhiteboards.put({ id: flag.id, teamId: flag.id, drawings: [], updatedAt: 1 });
    const match = makeMatch({ teamId: soccer.id });
    await db.matches.put(match);
    await deleteTeamAndData(flag.id);
    expect(await db.footballFormations.count()).toBe(0);
    expect(await db.drivePlans.count()).toBe(0);
    expect(await db.footballWhiteboards.count()).toBe(0);
    expect(await db.matches.get(match.id)).toEqual(match);
    expect(await db.teams.get(soccer.id)).toBeDefined();
  });
});
