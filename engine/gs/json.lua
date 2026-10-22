-- A small JSON reader for the files the studio saves (sprites, tilesets, sound). Returns decode(text) -> value.
-- Errors say where in the text they happened.

local function decode(str)
  local pos = 1
  local esc = { ['"'] = '"', ["\\"] = "\\", ["/"] = "/", b = "\b", f = "\f", n = "\n", r = "\r", t = "\t" }
  local parse

  local function skip() pos = str:find("[^ \n\r\t]", pos) or (#str + 1) end

  local function parse_string()
    local out, i = {}, pos + 1
    while true do
      local c = str:sub(i, i)
      if c == "" then error("unterminated string") end
      if c == '"' then pos = i + 1; return table.concat(out) end
      if c == "\\" then
        local n = str:sub(i + 1, i + 1)
        if n == "u" then
          local cp = tonumber(str:sub(i + 2, i + 5), 16) or error("bad \\u escape")
          out[#out + 1] = utf8.char(cp); i = i + 6
        else
          out[#out + 1] = esc[n] or error("bad escape \\" .. n); i = i + 2
        end
      else
        local j = str:find('["\\]', i) or error("unterminated string")
        out[#out + 1] = str:sub(i, j - 1); i = j
      end
    end
  end

  function parse()
    skip()
    local c = str:sub(pos, pos)
    if c == "{" then
      pos = pos + 1
      local t = {}
      skip()
      if str:sub(pos, pos) == "}" then pos = pos + 1; return t end
      while true do
        skip()
        if str:sub(pos, pos) ~= '"' then error("expected a string key at position " .. pos) end
        local k = parse_string()
        skip()
        if str:sub(pos, pos) ~= ":" then error("expected ':' at position " .. pos) end
        pos = pos + 1
        t[k] = parse()
        skip()
        local d = str:sub(pos, pos); pos = pos + 1
        if d == "}" then return t end
        if d ~= "," then error("expected ',' or '}' at position " .. (pos - 1)) end
      end
    elseif c == "[" then
      pos = pos + 1
      local t, n = {}, 0
      skip()
      if str:sub(pos, pos) == "]" then pos = pos + 1; return t end
      while true do
        n = n + 1
        t[n] = parse()
        skip()
        local d = str:sub(pos, pos); pos = pos + 1
        if d == "]" then return t end
        if d ~= "," then error("expected ',' or ']' at position " .. (pos - 1)) end
      end
    elseif c == '"' then
      return parse_string()
    elseif str:sub(pos, pos + 3) == "true" then pos = pos + 4; return true
    elseif str:sub(pos, pos + 4) == "false" then pos = pos + 5; return false
    elseif str:sub(pos, pos + 3) == "null" then pos = pos + 4; return nil
    else
      local lit = str:match("^-?%d+%.?%d*[eE]?[+-]?%d*", pos)
      if not lit or lit == "" then error("unexpected character at position " .. pos) end
      pos = pos + #lit
      return tonumber(lit)
    end
  end

  local v = parse()
  skip()
  if pos <= #str then error("trailing data at position " .. pos) end
  return v
end


return { decode = decode }
