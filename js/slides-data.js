// ============================================
// SLIDES LIBRARY
// Centralized slide decks for reuse
// ============================================

(function () {
  const innovation = [
    {
      title: 'Slide 1: This Is The Worst It Will Ever Be',
      subtitle: 'Let That Sink In',
      clipart: { kind: 'faucet' },
      mediaLinks: [
        { label: '► Watch Introduction', path: 'media/intro.mp4', type: 'video' }
      ],
      paragraphs: [
        "Right now, at this very moment, you're experiencing technology at its absolute worst.",
        "ChatGPT making mistakes? It'll only get smarter.",
        "AI generating wonky images? They'll only get better.",
        "That clunky VR headset? Next year's will be lighter.",
        "The Uncomfortable Truth: Every app, every tool, every innovation you're struggling with today is the worst version you'll ever use. Tomorrow's tech makes today look like a flip phone at a smartphone convention.",
        "So stop waiting for the 'perfect' moment to adopt new tech. That moment is always tomorrow, which means the best time is always NOW."
      ]
    },
    {
      title: 'Slide 2: Invention vs Innovation',
      subtitle: "(Or: Why Your Garage Prototype Doesn't Matter Yet)",
      clipart: { kind: 'book' },
      mediaLinks: [
        { label: '► Watch Invention vs Innovation', path: 'media/innovation.mp4', type: 'video' }
      ],
      paragraphs: [
        'INVENTION = Creating something new',
        'INNOVATION = Making that something useful and adopted',
        "Thomas Edison didn't invent the lightbulb—he made it practical and marketable",
        "Apple didn't invent smartphones—they made them irresistible",
        "Netflix didn't invent streaming—they made it kill Blockbuster",
        'The Graveyard of History: Thousands of brilliant inventions that nobody used, nobody bought, and nobody remembers.',
        "Innovation is invention that actually changes the game. Be the person who gets it into people's hands, not just into existence."
      ]
    },
    {
      title: 'Slide 3: Hand Grenades of Innovation',
      subtitle: 'The Individual vs Goliath (Now With Better Tech)',
      clipart: { kind: 'bolt' },
      paragraphs: [
        '2005: One person with an idea needed millions in funding',
        '2025: One person with an idea needs a laptop and WiFi',
        'Real Examples:',
        '• A solo developer can build apps that compete with corporate teams',
        '• YouTubers disrupt entire media companies from their bedrooms',
        '• Newsletter writers replace traditional journalists with Substack',
        '• Indie game developers create hits that outperform AAA studios',
        "The Equalizer: Cloud computing, AI assistance, no-code tools, and open-source everything mean you have the same weapons as the big guys. You're not David with a slingshot anymore—you're David with a tank.",
        "The question isn't 'Can I compete?' It's 'What excuse do I have left?'"
      ]
    },
    {
      title: "Slide 4: It's Not All About AI",
      subtitle: '(Quantum, XR, and the Unknown Unknowns)',
      paragraphs: [
        "Yes, AI is flashy. But while everyone's obsessing over ChatGPT:",
        '• Quantum Computing is preparing to break all encryption (hope you like your passwords)',
        '• XR (Extended Reality) is merging digital and physical worlds in ways that make smartphones look quaint',
        "• Biotech is editing genes like it's a Word document",
        '• Fusion Energy might actually work this time (no, really!)',
        "And The Big One: The technologies we don't even have names for yet. In 2005, nobody was Googling 'how to become a TikTok influencer' because TikTok didn't exist. What's the 2035 equivalent?",
        "Don't get tunnel vision. The next revolution might not be the one everyone's talking about."
      ]
    },
    {
      title: 'Slide 5: Taking On Dinosaurs',
      subtitle: 'Foe or Friend? (Spoiler: Ride the Rex)',
      paragraphs: [
        'The Paradox: Big, slow organizations are simultaneously your:',
        'Biggest competition', 'Biggest opportunity',
        'Why Partner With Dinosaurs:',
        '✓ They have customers you want',
        '✓ They have budgets you need',
        '✓ They have distribution channels you lack',
        "✓ They're terrified of becoming irrelevant",
        "Your Play: Position yourself as their innovation lifeline. You get their resources, they get your agility. You're the remora fish on the shark—thriving because the shark can't reach its own back.",
        'Real Talk: Disruption is sexy in TED talks. Revenue is sexy in bank accounts. Sometimes the smartest move is helping the dinosaur evolve rather than waiting for the meteor.'
      ]
    },
    {
      title: 'Slide 6: None Of This Is New',
      subtitle: '(Your Grandpa Has Seen This Movie Before)',
      imageToggle: {
        label: 'Show Exhibit A Image',
        hideLabel: 'Hide Exhibit A Image',
        src: 'media/virtualboy.png'
      },
      mediaLinks: [
        { label: '► Exhibit A: Watch X-Files Clip', path: 'media/xfiles.mp4', type: 'video' }
      ],
      paragraphs: [
        'Surprise: AI, ML, Cloud, XR have been around for decades.',
        "Exhibit A - AI: The X-Files (1999) had an episode about AI achieving consciousness ('Kill Switch'). We've been dreaming about this since the 1950s.",
        "Exhibit B - XR: Nintendo Virtual Boy (1995) tried VR and failed spectacularly because the tech wasn't ready. Now it is.",
        'The Pattern:',
        '• Concept invented (often decades ago)',
        '• Tech too expensive/clunky (nobody cares)',
        "• Tech becomes affordable/practical (suddenly it's 'revolutionary')",
        '• Everyone acts like it just materialized from thin air',
        "What's 'new' is rarely new—it's just finally ready for prime time. The future has been sitting in labs waiting for its moment."
      ]
    },
    {
      title: 'Slide 7: Adapt or Die',
      subtitle: "(Spoiler: It's Not About The Technology)",
      paragraphs: [
        "The Uncomfortable Truth: Technology isn't hard. People are hard.",
        'The Real Barriers to Innovation:',
        '❌ Not the tech stack', '❌ Not the budget', '❌ Not the algorithms',
        'The Actual Barriers:',
        "✓ 'We've always done it this way'",
        '✓ Fear of looking stupid learning something new',
        '✓ Waiting for permission that will never come',
        '✓ Culture that punishes failure instead of celebrates learning',
        'Mindset Shifts That Matter:',
        'Curiosity > Expertise', 'Questions > Answers', 'Experiments > Plans', "'What if?' > 'That won't work'",
        "The organizations that thrive aren't the ones with the best technology. They're the ones where people are allowed to experiment, fail, learn, and try again."
      ]
    },
    {
      title: 'Slide 8: Learn to Ask Better Questions',
      subtitle: '(In a World Full of Questions)',
      paragraphs: [
        "Bad Question: 'Will AI take my job?'",
        "Better Question: 'How can I use AI to do my job better than anyone else?'",
        "Bad Question: 'What's the next big thing?'",
        "Better Question: 'What problem am I uniquely positioned to solve?'",
        "Bad Question: 'Should we adopt this technology?'",
        "Better Question: 'What happens if our competitors adopt it and we don't?'",
        'The Skill Nobody Teaches: We spend years learning answers in school. Nobody teaches us how to ask questions that unlock possibilities instead of shutting them down.',
        'Framework for Better Questions:',
        "Replace 'Can we?' with 'How might we?'",
        "Replace 'Why didn't it work?' with 'What did we learn?'",
        "Replace 'Who's responsible?' with 'What's next?'",
        'The quality of your questions determines the quality of your innovation.'
      ]
    },
    {
      title: 'Slide 9: Conflusions',
      subtitle: '(Confusing Conclusions? Conclusive Confusion? Yes.)',
      paragraphs: [
        "What We've Learned:",
        "• The future is now, and it's only getting future-ier",
        '• Innovation beats invention every time',
        "• You're more powerful than you think (and corporations know it)",
        '• AI is loud, but other revolutions are brewing quietly',
        '• Sometimes you ride the dinosaur instead of fighting it',
        '• "New" technology is often old ideas finally having their moment',
        '• Culture and mindset trump technology every time',
        '• Questions > Answers',
        "The Meta-Point: This entire presentation will be outdated soon. That's not a bug, it's a feature. Stay curious. Stay adaptable. Stay ready to be wrong.",
        "If you're not confused, you're not paying attention. If you're not innovating, you're already behind."
      ]
    },
    {
      title: 'Slide 10: Questions?',
      subtitle: '(Please Have Some)',
      mediaLinks: [
        { label: '► Watch Closing Remarks', path: 'media/end.mp4', type: 'video' }
      ],
      paragraphs: [
        "Because if you don't have questions, you haven't been paying attention.",
        'Ask me anything about:',
        '• How to start innovating (today, not tomorrow)',
        "• Specific technologies you're curious/terrified about",
        '• How to convince your dinosaur organization to evolve',
        '• What to focus on when everything feels important',
        '• How to fail faster and better',
        "Remember: The best innovations start with someone raising their hand and asking, 'What if we tried...?'",
        'Your turn. What question will you ask that changes everything?',
        'Thank You! Now go break something (responsibly).'
      ]
    }
  ];

  window.SlidesLibrary = { innovation };
})();
