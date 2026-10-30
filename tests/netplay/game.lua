return gs.game{ title = os.getenv("GS_NET_GAME") or "Netplay test", console = "glow43", players = 4,
  start = "scenes.menu", preload = false }
