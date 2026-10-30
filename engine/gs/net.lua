-- Local Wi-Fi lockstep. Only buttons travel during play; the host relays up to four players.
local transport = require("gs.transport")
local input, save = require("gs.input"), require("gs.save")
local world, deterministic = require("gs.world"), require("gs.determinism")
local N = { state = "off", me = 1, count = 1, delay = 2 }
local clock = gs.raw.time
local pack, unpack = string.pack, string.unpack
local game, maximum, first_scene, remembered
local opened, host, address, session = false, false, nil, 0
local peers, found, buffers, hashes = {}, {}, {}, {}
local transfer, tick, waiting_since, last_send, last_find, last_warn = nil, 0, nil, -1, -1, -1
local last_heard, born, return_scene
local generation = 0
local port = tonumber(os.getenv("GS_NET_PORT") or "45843")
local discovery = os.getenv("GS_NET_DISCOVERY") or "255.255.255.255"
local send, finish

local function warn(message)
  local now = clock()
  if now - last_warn >= 1 then io.stderr:write("Wi-Fi: " .. message .. "\n"); last_warn = now end
end
local function playing() return N.state == "playing" or N.state == "waiting" end
function N.active() return opened end
function N.playing() return playing() end
function N.generation() return generation end

local function open(bind_port)
  if not opened then transport.open(bind_port); opened = true; born = clock() end
end
local function name(value)
  if type(value) ~= "string" or #value < 1 or #value > 32 or value:find("%c") then
    error("choose a player name of 1 to 32 bytes, without control characters", 3)
  end
  remembered = value
  save.set("_net_name", value); save.flush()
  return value
end
function N.configure(spec, console_name)
  maximum = spec.players or 1
  if math.type(maximum) ~= "integer" or maximum < 1 or maximum > 4 then error("game.lua: players must be 1 to 4", 0) end
  game = (spec.title or "Game") .. "\0" .. console_name
  if maximum > 1 and #game > 180 then error("Wi-Fi: the game title and console name must fit in 180 bytes", 0) end
  first_scene, remembered = spec.start or "scenes.main", save.get("_net_name", "")
end
function N.name() return remembered end
function N.peers()
  local out = {}
  for i, peer in ipairs(peers) do out[i] = { player = i, name = peer.name } end
  return out
end

send = function(to, command, body, sid)
  if not transport.send(to, "GSN1" .. pack("<s1I4c1", game, sid or session, command) .. (body or "")) then
    warn("the send buffer is busy; retrying")
  end
end
local function broadcast(command, body)
  for i = 2, #peers do send(peers[i].address, command, body) end
end
local function lobby()
  for i = 2, #peers do
    local names = {}
    for _, peer in ipairs(peers) do names[#names + 1] = pack("<s1", peer.name) end
    send(peers[i].address, "H", pack("<BBB", i, maximum, #peers) .. table.concat(names))
  end
end

function N.host(player_name)
  if maximum < 2 then error("game.lua needs players = 2, 3 or 4 for Wi-Fi play", 2) end
  if opened then N.leave() end
  if math.type(port) ~= "integer" or port < 1 or port > 65535 then error("GS_NET_PORT must be 1 to 65535", 2) end
  local value = name(player_name)
  open(port)
  host, session, N.me, N.count, N.state, N.error = true, math.random(1, 0x7fffffff), 1, 1, "hosting", nil
  peers, found, transfer, last_send = { { name = value, heard = clock() } }, {}, nil, -1
end
function N.find()
  if maximum < 2 then error("game.lua needs players = 2, 3 or 4 for Wi-Fi play", 2) end
  if host or N.state ~= "off" then error("leave the current session before looking for another", 2) end
  if math.type(port) ~= "integer" or port < 1 or port > 65535 then error("GS_NET_PORT must be 1 to 65535", 2) end
  open(0)
  local now = clock()
  if now - last_find >= 0.5 then
    send(discovery .. ":" .. port, "?", nil, 0)
    last_find = now
  end
  local out = {}
  for id, item in pairs(found) do
    if now - item.seen > 2 then found[id] = nil
    else out[#out + 1] = { id = id, name = item.name, players = item.players, max = item.max } end
  end
  table.sort(out, function(a, b) return a.id < b.id end)
  return out
end
function N.join(id, player_name)
  if N.state ~= "off" then error("leave the current session before joining another", 2) end
  local item = found[id]
  if not item or clock() - item.seen > 2 then error("choose a current session from gs.net.find()", 2) end
  local value = name(player_name)
  open(0)
  host, address, session, peers, transfer = false, item.address, item.session, {}, nil
  N.state, N.error, last_send, last_heard, born = "joining", nil, -1, clock(), clock()
  send(address, "J", pack("<s1", value))
end

local function snapshot()
  save.flush()
  local data, keys, out = transport.saves(), {}, {}
  for key in pairs(data) do keys[#keys + 1] = key end
  table.sort(keys)
  out[1] = pack("<I2", #keys)
  for _, key in ipairs(keys) do out[#out + 1] = pack("<s1s4", key, data[key]) end
  local blob = table.concat(out)
  if #blob > 65536 then error("Wi-Fi: this game's saves are larger than the current 64 KB session limit", 2) end
  return blob
end
local function read_snapshot(blob)
  local n, pos = unpack("<I2", blob)
  local data = {}
  for i = 1, n do
    local key, value
    key, value, pos = unpack("<s1s4", blob, pos)
    assert(#key > 0 and #key <= 64 and key:sub(1, 1) ~= "." and key:match("^[%w_%.%-]+$"), "invalid save key")
    assert(data[key] == nil, "duplicate save key")
    data[key] = value
  end
  assert(pos == #blob + 1, "extra save data")
  return data
end
function N.start(scene)
  if not host or N.state ~= "lobby" or #peers < 2 then error("only the host can start, with at least two players in the lobby", 2) end
  if transfer then error("the session is already starting", 2) end
  if type(scene) ~= "string" or #scene > 180 or not scene:match("^[%w_%.]+$") then error("choose a scene module to start", 2) end
  if not gs.raw.load((scene:gsub("%.", "/")) .. ".lua") and not world.layout_of(scene) then error("the starting scene does not exist: " .. scene, 2) end
  local blob = snapshot()
  transfer = { scene = scene, seed = math.random(1, 0x7fffffff), blob = blob, size = #blob, since = clock() }
  for i = 2, #peers do peers[i].acks, peers[i].ready, peers[i].cursor = {}, false, 1 end
  last_send = -1
end

local function begin()
  local data = read_snapshot(transfer.blob)
  return_scene = world.scene_name or first_scene
  world.reset_session()
  input.reset()
  save.begin_session(data, host)
  deterministic.seed(transfer.seed)
  world.goto_scene(transfer.scene)
  tick, buffers, hashes, waiting_since = 0, {}, {}, nil
  for p = 1, N.count do buffers[p] = { [1] = 0, [2] = 0 }; hashes[p] = {} end
  N.state, N.waiting_for = "playing", nil
  generation = generation + 1
  last_heard = clock()
end

finish = function(reason, notify)
  reason = reason:gsub("%c", " "):sub(1, 180)
  local was_playing, old_scene = playing(), world.scene
  if notify and opened and N.state ~= "off" then
    local ok, err = pcall(function()
      for i = 1, 3 do
        if host then broadcast("L", pack("<s1", reason)) else send(address, "L", pack("<s1", reason)) end
      end
    end)
    if not ok then io.stderr:write("Wi-Fi: could not notify peers while leaving: " .. tostring(err) .. "\n") end
  end
  transport.close()
  opened, host, address, session, transfer = false, false, nil, 0, nil
  peers, found, buffers, hashes = {}, {}, {}, {}
  N.state, N.me, N.count, N.waiting_for, waiting_since = "off", 1, 1, nil, nil
  generation = generation + 1
  input.reset(); save.end_session(); deterministic.stop()
  if reason ~= "left the session" then N.error = reason; io.stderr:write("Wi-Fi: " .. reason .. "\n") end
  if was_playing then
    if old_scene and old_scene.on_net_end then old_scene.on_net_end(old_scene, reason)
    else world.goto_scene(return_scene or first_scene) end
  end
end
function N.leave() if opened then finish("left the session", true) end end
function N.abort(reason) if opened then finish(reason, true) end end

-- Decode only bounded binary fields; malformed UDP is not Lua code and cannot allocate an unbounded table.
local function decode(data)
  if data:sub(1, 4) ~= "GSN1" then return nil end
  local key, sid, command, pos = unpack("<s1I4c1", data, 5)
  if key ~= game then return nil end
  local m = { sid = sid, command = command }
  local function take(fmt)
    local values = table.pack(unpack(fmt, data, pos))
    pos = values[values.n]; values[values.n] = nil
    return table.unpack(values, 1, values.n - 1)
  end
  if command == "!" then m.name, m.count, m.max = take("<s1BB"); assert(#m.name <= 32 and m.count >= 1 and m.count <= m.max and m.max <= 4)
  elseif command == "J" then m.name = take("<s1"); assert(#m.name > 0 and #m.name <= 32 and not m.name:find("%c"))
  elseif command == "H" then
    m.me, m.max, m.count = take("<BBB")
    assert(m.count >= 2 and m.count <= m.max and m.max <= maximum and m.me >= 2 and m.me <= m.count)
    m.peers = {}
    for i = 1, m.count do local value = take("<s1"); assert(#value > 0 and #value <= 32); m.peers[i] = { name = value } end
  elseif command == "S" then
    m.seed, m.size, m.scene = take("<I4I4s1")
    assert(m.size >= 2 and m.size <= 65536 and #m.scene > 0 and #m.scene <= 180 and m.scene:match("^[%w_%.]+$"))
  elseif command == "B" then m.index, m.data = take("<I2s2"); assert(#m.data <= 800)
  elseif command == "R" then m.index = take("<I2")
  elseif command == "I" then
    m.player, m.count = take("<BB")
    assert(m.player >= 1 and m.player <= 4 and m.count >= 1 and m.count <= 8)
    m.inputs = {}
    for i = 1, m.count do local step, mask = take("<I4I2"); m.inputs[i] = { step, mask } end
  elseif command == "K" then m.step, m.hash = take("<I4c16"); assert(m.step % 60 == 0 and m.hash:match("^%x+$"))
  elseif command == "E" or command == "L" then m.reason = take("<s1"); assert(#m.reason > 0 and #m.reason <= 180 and not m.reason:find("%c"))
  else assert(command == "?" or command == "F" or command == "G", "unknown packet") end
  assert(pos == #data + 1, "extra packet data")
  return m
end
local function player_at(from)
  for p = 2, #peers do if peers[p].address == from then return p end end
end
local function accept_inputs(m, p)
  if not buffers[p] then return end
  for _, entry in ipairs(m.inputs) do
    local step, mask = entry[1], entry[2]
    if step >= math.max(1, tick - 16) and step <= tick + 64 then
      if buffers[p][step] ~= nil and buffers[p][step] ~= mask then finish("a player's buttons changed after being sent", true); return end
      buffers[p][step] = mask
    end
  end
end
local function receive(m, from)
  local command, now = m.command, clock()
  if command == "?" then
    if host and not transfer and not playing() then send(from, "!", pack("<s1BB", peers[1].name, #peers, maximum)) end
    return
  end
  if command == "!" then
    if N.state == "off" then
      local count = 0
      for _ in pairs(found) do count = count + 1 end
      if count >= 32 and not found[from .. "/" .. m.sid] then return end
      found[from .. "/" .. m.sid] = { address = from, session = m.sid, name = m.name, players = m.count, max = m.max, seen = now }
    end
    return
  end
  if m.sid ~= session or N.state == "off" then return end
  local p = host and player_at(from)
  if command == "J" and host then
    if playing() or transfer then
      if not p then send(from, "E", pack("<s1", "this session has already started"))
      elseif transfer and not playing() then lobby() end
      return
    end
    if not p then
      if #peers >= maximum then send(from, "E", pack("<s1", "this session is full")); return end
      peers[#peers + 1] = { name = m.name, address = from, heard = now }; p = #peers
    end
    peers[p].heard = now
    N.count, N.state = #peers, "lobby"
    lobby()
    return
  end
  if host then
    if not p then return end
    peers[p].heard = now
  else
    if from ~= address then return end
    last_heard = now
  end
  if command == "L" or command == "E" then
    if host and not playing() and not transfer and command == "L" then
      table.remove(peers, p); N.count = #peers; N.state = #peers > 1 and "lobby" or "hosting"; lobby()
    else finish(m.reason, host) end
  elseif command == "H" and not host and not playing() and not transfer then
    peers, N.me, N.count, N.state = m.peers, m.me, m.count, "lobby"
  elseif command == "S" and not host and N.state == "lobby" then
    if not transfer then transfer = { scene = m.scene, seed = m.seed, size = m.size, parts = {}, received = 0, since = now }
    elseif transfer.scene ~= m.scene or transfer.seed ~= m.seed or transfer.size ~= m.size then error("Wi-Fi: conflicting start messages", 0) end
  elseif command == "B" and not host and transfer and not playing() then
    local chunks = math.ceil(transfer.size / 800)
    if m.index < 1 or m.index > chunks then return end
    local expected = math.min(800, transfer.size - (m.index - 1) * 800)
    if #m.data ~= expected then return end
    if not transfer.parts[m.index] then transfer.parts[m.index] = m.data; transfer.received = transfer.received + 1 end
    send(address, "R", pack("<I2", m.index))
    if transfer.received == chunks and not transfer.blob then
      transfer.blob = table.concat(transfer.parts)
      local ok, err = pcall(read_snapshot, transfer.blob)
      if not ok then finish("the host's save data is invalid: " .. tostring(err):sub(1, 100), true); return end
      send(address, "F")
    end
  elseif command == "R" and host and transfer and not playing() then
    if m.index >= 1 and m.index <= math.ceil(transfer.size / 800) then peers[p].acks[m.index] = true end
  elseif command == "F" and host and transfer then peers[p].ready = true
  elseif command == "G" and not host and transfer and transfer.blob and not playing() then begin()
  elseif command == "I" and playing() then
    if host and m.player ~= p then return end
    if m.player > N.count then return end
    if host then peers[p].begun = true end
    accept_inputs(m, m.player)
    if host and playing() then
      local entries = {}
      for _, entry in ipairs(m.inputs) do entries[#entries + 1] = pack("<I4I2", entry[1], entry[2]) end
      broadcast("I", pack("<BB", m.player, #entries) .. table.concat(entries))
    end
  elseif command == "K" and playing() then
    local player = host and p or 1
    if m.step < tick - 120 or m.step > tick + 120 then return end
    hashes[player][m.step] = m.hash
    if hashes[N.me][m.step] and hashes[N.me][m.step] ~= m.hash then finish("the games went out of step at " .. m.step .. " steps", true) end
  end
end

local function send_inputs()
  local own = buffers[N.me]
  if not own then return end
  local last = tick + N.delay + 1
  local entries = {}
  for step = math.max(1, last - 7), last do if own[step] ~= nil then entries[#entries + 1] = pack("<I4I2", step, own[step]) end end
  if #entries == 0 then return end
  local body = pack("<BB", N.me, #entries) .. table.concat(entries)
  if host then broadcast("I", body) else send(address, "I", body) end
end
function N.poll()
  if not opened then return end
  for i = 1, 64 do
    local data, from = transport.receive()
    if not data then break end
    local ok, m = pcall(decode, data)
    if not ok or from == "oversized" then warn("ignored a malformed packet")
    elseif m then receive(m, from) end
    if not opened then return end
  end
  local now = clock()
  if N.state ~= "off" and not playing() and not host and now - (last_heard or born) > 30 then finish("the host stopped responding", false); return end
  if transfer and not playing() and now - transfer.since > 30 then finish("starting the session took too long", true); return end
  if now - last_send < 0.05 then return end
  last_send = now
  if playing() then
    send_inputs()
    if host then
      for p = 2, #peers do if not peers[p].begun then send(peers[p].address, "G") end end
    end
    local own = hashes[N.me][(tick // 60) * 60]
    if own then
      local body = pack("<I4c16", (tick // 60) * 60, own)
      if host then broadcast("K", body) else send(address, "K", body) end
    end
  elseif host and transfer then
    lobby()
    local ready = true
    for p = 2, #peers do
      local peer = peers[p]
      if not peer.ready then
        ready = false
        send(peer.address, "S", pack("<I4I4s1", transfer.seed, transfer.size, transfer.scene))
        local chunks = math.ceil(transfer.size / 800)
        for i = 1, math.min(8, chunks) do
          local index = peer.cursor
          peer.cursor = index % chunks + 1
          if not peer.acks[index] then send(peer.address, "B", pack("<I2s2", index, transfer.blob:sub((index - 1) * 800 + 1, index * 800))) end
        end
      end
    end
    if ready then begin(); broadcast("G") end
  elseif not host and transfer then
    if transfer.blob then send(address, "F") end
  elseif host then
    for p = #peers, 2, -1 do if now - peers[p].heard > 10 then table.remove(peers, p) end end
    N.count, N.state = #peers, #peers > 1 and "lobby" or "hosting"
    lobby()
  elseif N.state == "joining" or N.state == "lobby" then send(address, "J", pack("<s1", remembered)) end
end

function N.before_step()
  if not playing() then return true end
  local target = tick + N.delay + 1
  if buffers[N.me][target] == nil then buffers[N.me][target] = input.local_mask() end
  send_inputs()
  local masks = {}
  for p = 1, N.count do
    if buffers[p][tick + 1] == nil then
      waiting_since = waiting_since or clock()
      if clock() - waiting_since >= 0.5 then N.state, N.waiting_for = "waiting", peers[p].name end
      if clock() - waiting_since >= 30 and (input.local_mask() & (1 << 5)) ~= 0 then finish("left the session", true) end
      return false
    end
    masks[p] = buffers[p][tick + 1]
  end
  N.state, N.waiting_for, waiting_since = "playing", nil, nil
  tick = tick + 1
  input.network(masks)
  for p = 1, N.count do buffers[p][tick - 16], hashes[p][tick - 180] = nil, nil end
  return true
end
function N.after_step()
  if playing() and tick % 60 == 0 then
    local hash = deterministic.checksum(world)
    hashes[N.me][tick] = hash
    for p = 1, N.count do
      if hashes[p][tick] and hashes[p][tick] ~= hash then finish("the games went out of step at " .. tick .. " steps", true); return end
    end
  end
end
function N.end_hint() return waiting_since and clock() - waiting_since >= 30 end

return N
