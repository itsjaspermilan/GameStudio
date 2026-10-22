// First steps: a short checklist on the welcome screen for someone new. Each step ticks itself when the studio sees it happen;
// the list is kept in the browser (localStorage), so it is only a nudge and nothing depends on it.
export const FIRST_STEPS = [
  { id: "make", text: "Make a game", tip: "New game, give it a name, pick a console." },
  { id: "run", text: "Run it", tip: "The Run button, or Ctrl/Cmd+Enter. The game opens in its own window." },
  { id: "live", text: "Change a number and save while it runs", tip: "Open entities/player.lua, change a speed, save: the running game picks it up at once." },
  { id: "sprite", text: "Draw a sprite", tip: "The + beside Sprites, draw, save. Then use its name in an entity: sprite = \"name\"." },
  { id: "tutorial", text: "Follow Your first game in Help", tip: "Help (F1) > Your first game: a few small files and you have something playable." },
];

// The saved text in, the set of done step ids out (anything unreadable counts as nothing done).
export function parseSteps(text) {
  try {
    const v = JSON.parse(text || "{}");
    return { done: new Set(Array.isArray(v.done) ? v.done.filter((id) => FIRST_STEPS.some((s) => s.id === id)) : []), hidden: v.hidden === true };
  } catch { return { done: new Set(), hidden: false }; }
}
export const stringifySteps = (p) => JSON.stringify({ done: [...p.done], hidden: !!p.hidden });
// shown until every step is done or the person hides it
export const showSteps = (p) => !p.hidden && p.done.size < FIRST_STEPS.length;
