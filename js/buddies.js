// ============================================
// BUDDY DATA
// One source of truth for the buddy list: the roster rendered into the window,
// the per-buddy reply personality, the colour assigned to each name and the
// "real" link each online buddy eventually shares. Previously this lived in
// three places (hand-written HTML, a filler map and an alias map) that could
// drift apart.
// ============================================

(function () {
  /** Normalise a screen name so lookups never depend on case or stray spaces. */
  const key = (name) => (name || '').trim().toLowerCase();

  const ONLINE = [
    {
      name: 'Sepinator',
      status: 'online',
      color: '#d00000',
      link: 'https://www.linkedin.com/in/sepi-chakaveh/',
      filler: [
        'my AIM away msg is fire rn',
        'zerg rush? kekeke',
        'LAN party later — bring your CRT',
        'installing Diablo II again lol',
        'BRB mom needs the phone line 😭',
        'custom Winamp skin looks so sick',
      ],
    },
    {
      name: 'xMarkTheNeil99x',
      status: 'online',
      color: '#0040c0',
      link: 'https://www.linkedin.com/in/mhneill/',
      aliases: ['xMarkTheNeill99x'],
      filler: [
        'top 8 drama on Myspace again 😂',
        'new Geocities page — lots of iframes',
        'blink tag is a vibe',
        'switching my AIM font to Comic Sans',
        'Napster queue at 97%... for the last hour',
        'Winamp just “whips the llama’s…” you know the rest',
      ],
    },
    {
      name: 'SelvaTron',
      status: 'online',
      color: '#008000',
      link: 'https://www.linkedin.com/in/rrselvakumar/',
      filler: [
        'writing a bot for mIRC channels',
        'charged my PalmPilot, stylus ready',
        'TI-83 graphing weird art again lol',
        'dot-com bubble memes are back',
        'ICQ number memorized like a phone #',
        'configuring RSS in my reader',
      ],
    },
    {
      name: 'RandoBrando',
      status: 'away',
      color: '#800080',
      link: 'https://www.linkedin.com/in/stracos/',
      aliases: ['RandoBrandon'],
      filler: [
        'AOL keywords still slap',
        'can’t stop hearing the dial-up tone',
        'tamagotchi survived the day, barely',
        'burning a new mix CD',
        '3.5” floppies for the win',
        'sharing pics on Photobucket like it’s 1999',
      ],
    },
  ];

  const OFFLINE = [
    'RetroGamer', 'Y2KPrincess', 'Douglas_SpiderManFan88', 'NicholasDaPokeCEO',
    'josh95mx', 'VinoTheWiz', 'RachelZStarrrrr', 'Michael_Dad_Rock', 'LordEmperorElliot',
  ].map((name) => ({ name, status: 'offline' }));

  // Every alias resolves to its canonical buddy record.
  const byKey = new Map();
  ONLINE.forEach((b) => {
    byKey.set(key(b.name), b);
    (b.aliases || []).forEach((a) => byKey.set(key(a), b));
  });

  const GENERIC_REPLIES = [
    'lol nice!', 'yeah totally!', 'omg really??', 'brb mom calling', 'a/s/l? jk jk',
    'check out my away message!', 'cool cool', 'haha for real', 'ttyl gotta go', 'sweet!',
    'hold up, dial-up is lagging 😅', "napster's taking forever to download this track",
    'just burned a mix CD lol', 'be right back — feeding my Tamagotchi',
    'my AIM away msg is fire rn', 'new Geocities page just dropped 💾',
    'ICQ went bloop bloop again 😂', 'Y2K bug? more like Y2-ok',
    'BRB mom needs the phone line 😭', 'this Winamp skin slaps',
  ];

  window.Buddies = {
    key,
    online: ONLINE,
    offline: OFFLINE,
    all: [...ONLINE, ...OFFLINE],
    genericReplies: GENERIC_REPLIES,
    /** Canonical record for a screen name or alias, or null. */
    find(name) { return byKey.get(key(name)) || null; },
    /** Colour for a buddy; falls back to the classic AIM blue. */
    colorFor(name) { return this.find(name)?.color || '#0000ff'; },
    /** Reply pool for a buddy, falling back to the generic 90s chatter. */
    fillerFor(name) {
      const b = this.find(name);
      return b && b.filler && b.filler.length ? b.filler : GENERIC_REPLIES;
    },
    /** The link a buddy shares once you've traded a few messages. */
    linkFor(name) { return this.find(name)?.link || null; },
  };
})();
