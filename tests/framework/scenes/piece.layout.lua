-- a piece of a level that another scene builds into itself with gs.load_layout (never visited as a scene of its own)
return {
  entities = { { "dummy", 30, 30, { hp = 7 }, name = "gem" } },
  paths = { hop = { { 0, 0 }, { 8, 0 } } },
}
