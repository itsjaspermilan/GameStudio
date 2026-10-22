-- Void Swarm: survive the swarm! A survivors game for the Dot handheld, written with entities and
-- scenes.
--   entities/       the ship, 24 kinds of enemy and 10 bosses (each a small file), shots, bullets, pickups and effects
--   entities/enemies/, entities/bosses/    numbers and behavior of each kind
--   scenes/         title, hangar, the upgrade screens, sector select, the run itself, results
--   lib/            data (pilots, weapons, sectors), the state of a run, saving, weapons, audio and drawing helpers, a test bot
return gs.game{
  title = "Void Swarm",
  console = "dot",
  start = "scenes.title",
}
