-- The score and lives, shared by every file that needs them. A plain module: require "lib.state" gives the same table everywhere.
local S = { score = 0, lives = 3, best = gs.save.get("best", 0) }

function S.reset() S.score, S.lives = 0, 3 end

function S.add_score(points)
  S.score = S.score + points
  if S.score > S.best then S.best = S.score; gs.save.set("best", S.best) end
end

return S
