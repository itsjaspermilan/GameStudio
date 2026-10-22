---
name: game-music
description: Composing songs and sound effects for GameStudio games, fitted to the kind of game and its moods (title, levels, bosses, menus, victory, game over, jumps, hits, pickups). Use when writing or changing music/*.json or sfx/*.json, choosing instruments, or when sound is harsh, shrill, too loud, too quiet, repetitive or clashing.
---

# Game music and sound for GameStudio

Songs are tracker files in `music/`, sound effects step lists in `sfx/` (formats in README.md > Sound). Use the `gamestudio` MCP tools:
`instruments` (what exists), `song_write` (from a generator spec or a full tracker song), `song_check` (reads the notes with music
theory and measures the rendered sound), `sound_write` / `sound_check` for effects. **Always check what you wrote** and act on what the
check says before calling it done.

## Targets the checks measure

- **Loudness about 0.08-0.10** for every song (`song_check` prints it), so moving between screens never jumps in volume. Adjust with the
  generator's `level` (steps of 1.25x) or the track volumes.
- **No clipping.** Peaks under about 0.7.
- **Brightness under about 1200 Hz** for songs (the energy figure). Above that it sounds whistly or harsh: Void Swarm's first chip songs
  read 1400-1500 Hz and were. Sound effects may be brighter (a laser is meant to be).
- **The melody between C4 and C6** (generator `oct: 4`); the check flags anything sitting above C6 as shrill and above C7 as piercing.
- **Melody on the chords** at strong beats (aim for 70%+), mostly moving by step, a span under about an octave and a half, some phrases
  that come back. The accompaniment below the melody, the bass between C1 and C3, no long semitone rubs between parts.

## Instruments

General MIDI instruments (`gm_*`, from the SoundFont) sound like real instruments; chip sounds (`lead`, `pluck`, `flute`, `bell`...) are
tiny wavetables: retro and cheap, but harsh as a lead. Use chip sounds on purpose for a retro game, General MIDI otherwise. On the
handheld the General MIDI player costs roughly a tenth of one core for a 4-track song: fine, but not for many sound effects at once.
`gm_drum_kit` is the drum track (notes C3 kick, D3 snare, F#3 closed hat, A#3 open hat, C#4 crash, A3/D4 toms).

## Songs by mood

| Use | Scale | Tempo | A band that works (melody / harmony / bass) | Generator styles |
| --- | --- | --- | --- | --- |
| Title | minor or dorian | 85-100 | vibraphone / warm pad / fretless bass | harmony pad, bass half, drums soft |
| Menu, hub, shop | dorian or major | 80-95 | electric piano / choir pad / acoustic bass | pad, half, none or soft |
| Calm level, exploring | lydian or major | 95-110 | marimba or kalimba / nylon guitar / finger bass | arp8, half, soft |
| Action level | minor or dorian | 110-130 | clean or overdriven guitar, sax, steel drums / electric piano, pizzicato / pick or slap bass | arp8, eighth or pump, four or drive |
| Dark, cave, space | phrygian | 80-95 | cello or koto / bowed or new-age pad / contrabass | pad, half, none |
| Boss | harmonic minor | 140-160 | brass section / tremolo strings / synth bass | arp8 (arpOct 3), gallop, drive or boss |
| Victory jingle | major | 120-140 | trumpet / strings / acoustic bass | short, no loop |
| Game over | minor | 60-75 | cello / choir aahs / contrabass | short, slow, no loop |

Give each level its own band and key, so places feel different. A generator spec for `song_write`:
`{ seed, root: 4, scale: "dorian", tempo: 108, oct: 4, inst: ["gm_kalimba", "gm_nylon_guitar", "gm_finger_bass", "gm_drum_kit"],
harmony: "arp8", bass: "half", drums: "soft", rhythms: [3, 1, 3, 0], rest: 0.3, calm: true, level: 0,
sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 4, 3, 0] }], order: [0, 1, 0, 1] }`
(`prog` lists scale degrees, one chord a bar, 0 = home; sections are 4 bars; end sections on 0 so it feels home). Change `seed` for
another melody over the same chords.

## Sound effects

Short (0.05-0.4 s), one clear idea each, distinct by kind so the player hears what happened:

| Event | Shape |
| --- | --- |
| Shoot | a quick drop in pitch, square or noise, 1-2 steps |
| Hit taken | noise burst plus a low saw falling, louder than shots |
| Enemy defeated | noise fading with a low triangle drop |
| Pickup, coin | two rising notes, bright (pulse, bell) |
| Jump | a short rising slide |
| Level up, unlock | a rising arpeggio of the home chord |
| Menu move / OK / back | very short, quiet ticks; OK rises, back falls |
| Warning, boss | repeated low notes with hold (effect 7) |

Keep effects quieter than the music's loudest moments except for hits and warnings, and leave frequent effects (shots, footsteps) the
quietest: they repeat hundreds of times.

Further reading in the repo: README.md > Sound (the file formats), `scripts/lib/music.mjs` (the generator), `scripts/void-swarm/audio.mjs`
(sixteen songs and twenty-seven effects as examples), `studio/src/music-core.js` (what the check reads).
