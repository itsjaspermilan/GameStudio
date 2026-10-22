-- Sound: instruments, sound effects and songs are read from the project's instruments/, sfx/ and music/ folders (the formats the studio's
-- sound editors save; see README.md) and handed to the runtime's synth once, at start. Names are the file names without ".json".
-- Music tracks and sound effect channels are separate pools: an effect never takes a voice from the music.
local json = require("gs.json")
local gs = gs.raw -- the runtime's own calls (the framework replaces a few names on the public gs table)

local M = {}
local sfx_handles, music_handles = {}, {} -- synth handles by name (a sound effect with several tracks has a list of handles)

local function load_json(path)
  local text = gs.load(path)
  if not text then error("missing file: " .. path, 0) end
  local ok, res = pcall(json.decode, text)
  if not ok then error(path .. ": " .. tostring(res), 0) end
  return res
end
-- the names of the .json files in a folder, in alphabetical order
local function names(folder)
  local out = {}
  for _, path in ipairs(gs.list(folder)) do
    local name = path:match("^" .. folder .. "/([^/]+)%.json$")
    if name then out[#out + 1] = name end
  end
  table.sort(out)
  return out
end

function M.load(audio)
  audio = audio or {}
  gs.synth_config(audio.music_tracks or 4, audio.sfx_channels or 4, audio.style == "gba")
  -- The six original waves are always there, by number or by these names. The ready-made instruments (engine/instruments.json)
  -- are loaded the first time something uses them, then any of the project's own.
  local inst_handles = { tri = 0, saw = 1, square = 2, pulse = 3, sine = 4, noise = 5 }
  local sample_handles = {}
  local function define_instrument(d, where)
    local vib = d.vibrato or {}
    local t = {
      type = d.type or "pulse", duty = d.duty, wave = d.wave, noise_short = d.noise == "metallic" and 1 or 0, root = d.root,
      volume = (d.volume or 100) / 100, pan = (d.pan or 0) / 100, sustain = (d.sustain or 100) / 100,
      attack = d.attack, decay = d.decay, release = d.release,
      vib_depth = vib.depth, vib_rate = vib.rate, vib_delay = vib.delay,
      fixed_note = d.fixed_note, sweep = d.sweep and d.sweep.semitones, sweep_ms = d.sweep and d.sweep.ms,
      program = d.program, drum = d.drum and 1 or 0,
    }
    if t.type == "gm" then gs.soundfont_load() end -- the General MIDI sounds come from the SoundFont beside the runtime
    if t.type == "sample" then
      if not d.sample then error(where .. " is a sample instrument with no sample", 0) end
      sample_handles[d.sample] = sample_handles[d.sample] or gs.sample_load("sounds/" .. d.sample .. ".wav")
      t.sample = sample_handles[d.sample]
      if d.loop then t.loop_start, t.loop_end = d.loop.start, d.loop["end"] end
    end
    return gs.inst_load(t)
  end
  local builtin_defs = {}
  for _, d in ipairs(json.decode(require("gs.instruments_data")).instruments) do builtin_defs[d.name] = d end
  local function instrument(ref, where)
    if type(ref) == "number" then return ref end
    local h = inst_handles[ref]
    if not h and builtin_defs[ref] then h = define_instrument(builtin_defs[ref], "instrument " .. ref); inst_handles[ref] = h end
    if not h then error(where .. " uses an unknown instrument: " .. tostring(ref), 0) end
    return h
  end

  for _, n in ipairs(names("instruments")) do
    inst_handles[n] = define_instrument(load_json("instruments/" .. n .. ".json"), "instruments/" .. n .. ".json")
  end

  for _, n in ipairs(names("sfx")) do
    local d = load_json("sfx/" .. n .. ".json")
    local where = "sfx/" .. n .. ".json"
    local lp = d.loop
    local function load_track(steps, inst_of, vol)
      local flat = {}
      for i, st in ipairs(steps) do -- the older form of a step is [pitch, instrument, volume, effect]; a track's steps are [pitch, volume, effect]
        if inst_of then flat[#flat + 1], flat[#flat + 2], flat[#flat + 3], flat[#flat + 4] = st[1] or 0, inst_of, st[2] or 0, st[3] or 0
        else flat[#flat + 1], flat[#flat + 2], flat[#flat + 3], flat[#flat + 4] = st[1] or 0, instrument(st[2] or 0, where), st[3] or 0, st[4] or 0 end
      end
      return gs.sfx_load(d.speed or 8, #steps, flat, lp and lp.start or -1, lp and lp["end"] or -1, vol or 0)
    end
    if d.tracks then -- a sound effect with up to two tracks, one instrument each, played together; a track's "layers" are more voices (chords) on its instrument
      local hs, more = {}, {}
      for _, tr in ipairs(d.tracks) do
        local inst = instrument(tr.instrument or "square", where)
        hs[#hs + 1] = load_track(tr.steps or {}, inst, tr.vol)
        for _, layer in ipairs(tr.layers or {}) do more[#more + 1] = load_track(layer, inst, tr.vol) end
      end
      for _, h in ipairs(more) do hs[#hs + 1] = h end -- layers last: if the channels run out, they are the first to go
      if #hs == 0 then error(where .. " has no tracks", 0) end
      sfx_handles[n] = hs
    else
      sfx_handles[n] = load_track(d.steps or {})
    end
  end

  -- Tracker cells are written as words: NOTE[,INSTRUMENT[,VOLUME[,EFFECT[,PARAMETER]]]] with NOTE like C4, F#3, OFF or --.
  local NOTE_BASE = { C = 0, D = 2, E = 4, F = 5, G = 7, A = 9, B = 11 }
  local function note_number(nt, where)
    local letter, acc, oct = nt:match("^([A-G])([#b%-]?)(%d)$")
    if not letter then error(where .. ": '" .. tostring(nt) .. "' is not a note", 0) end
    local n = NOTE_BASE[letter] + (acc == "#" and 1 or acc == "b" and -1 or 0) + tonumber(oct) * 12
    if n < 0 or n > 95 then error(where .. ": the note " .. nt .. " is out of range", 0) end
    return n
  end
  local function parse_cell(tok, where, with_inst)
    local fields = {}
    for part in (tok .. ","):gmatch("([^,]*),") do fields[#fields + 1] = part end
    local nt, note, extras = fields[1], -2, {}
    if nt == "OFF" then note = -1
    elseif nt ~= "--" and nt ~= "" then -- several notes struck together are joined with +, like C2+F#2
      local first = true
      for part in (nt .. "+"):gmatch("([^+]*)%+") do
        if first then note = note_number(part, where); first = false else extras[#extras + 1] = note_number(part, where) end
      end
    end
    if with_inst == false then -- newer songs: the track has the instrument, so a cell is NOTE[,VOLUME[,EFFECT[,PARAMETER]]]
      return note, 0, tonumber(fields[2]) or -1, tonumber(fields[3]) or 0, tonumber(fields[4]) or 0, extras
    end
    return note, tonumber(fields[2]) or 0, tonumber(fields[3]) or -1, tonumber(fields[4]) or 0, tonumber(fields[5]) or 0, extras
  end

  for _, n in ipairs(names("music")) do
    local d = load_json("music/" .. n .. ".json")
    local where = "music/" .. n .. ".json"
    if d.format == "tracker" then
      local slots = {}
      local per_track = d.track_instruments ~= nil -- newer songs: one instrument for each track
      for i, name in ipairs(d.track_instruments or d.instruments or {}) do
        if name ~= "" then slots[i] = instrument(name, where) end -- an empty name is a track with no instrument
      end
      local rows, cells, order, chords = {}, {}, {}, {}
      local tracks = 1
      local function add_voice(pi, track, voice, slot) -- voice: 1-based voice number; slot: the track number (0-based) whose instrument it plays
        local r = 0
        for tok in track:gmatch("%S+") do
          local note, inst, vol, fx, fxp, extras = parse_cell(tok, where, not per_track)
          if per_track then inst = slot end -- slot number = track number (a layer plays its track's instrument)
          if note ~= -2 or vol ~= -1 or fx ~= 0 then
            local c = #cells
            cells[c + 1], cells[c + 2], cells[c + 3], cells[c + 4] = pi - 1, voice - 1, r, note
            cells[c + 5], cells[c + 6], cells[c + 7], cells[c + 8] = inst, vol, fx, fxp
            for _, extra in ipairs(extras) do
              local k = #chords
              chords[k + 1], chords[k + 2], chords[k + 3], chords[k + 4] = pi - 1, voice - 1, r, extra
            end
          end
          r = r + 1
        end
      end
      for pi, pat in ipairs(d.patterns or {}) do
        rows[pi] = pat.rows or 32
        tracks = math.max(tracks, #(pat.tracks or {}))
        for ti, track in ipairs(pat.tracks or {}) do add_voice(pi, track, ti, ti - 1) end
        for k, track in ipairs(pat.layers or {}) do -- more voices on a track's instrument: voice 4 + k, which plays track (3 + k) % 4
          add_voice(pi, track, 4 + k, (3 + k) % 4)
          tracks = math.max(tracks, 4 + k)
        end
      end
      for i, p in ipairs(d.order or { 0 }) do order[i] = p end
      music_handles[n] = { song = true, handle = gs.song_load{
        bpm = d.tempo or 120, rows_per_beat = d.rows_per_beat or 4, tracks = tracks, loop_to = d.loop_to or -1,
        reverb = d.reverb or 0, tvol = d.track_vol or {}, slots = slots, order = order, rows = rows, cells = cells, chords = chords } }
    else -- the older music: patterns of sound effects
      local flat = {}
      for pi, pat in ipairs(d.patterns or {}) do
        for c = 1, 4 do
          local name = pat[c]
          if name and not sfx_handles[name] then error(where .. " uses an unknown sound effect: " .. tostring(name), 0) end
          local h = name and sfx_handles[name]
          flat[(pi - 1) * 4 + c] = type(h) == "table" and h[1] or h or -1
        end
      end
      local lp = d.loop
      music_handles[n] = { handle = gs.music_load(#d.patterns, flat, lp and lp.from or -1, lp and lp.to or -1) }
    end
  end
end

function M.sfx(name, volume)
  local h = sfx_handles[name] -- a handle, or a list of handles for a sound effect with several tracks
  if not h then error("unknown sound effect '" .. tostring(name) .. "' (looked for sfx/" .. tostring(name) .. ".json)", 2) end
  gs.sfx_play(h, volume or 1)
end
function M.sfx_stop() gs.sfx_stop() end
function M.music(name)
  local m = music_handles[name]
  if not m then error("unknown music '" .. tostring(name) .. "' (looked for music/" .. tostring(name) .. ".json)", 2) end
  if m.song then gs.song_play(m.handle) else gs.music_play(m.handle) end
end
function M.music_stop(fade_seconds) gs.music_stop(math.floor((fade_seconds or 0) * 1000)) end
function M.has_sfx(name) return sfx_handles[name] ~= nil end
function M.has_music(name) return music_handles[name] ~= nil end

return M
