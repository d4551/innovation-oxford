# AOL Instant Messenger Retro Website

A nostalgic recreation of AOL Instant Messenger (AIM) with authentic sounds, terminal emulator, and dial-up connection intro sequence.

## Features

✅ **Authentic AIM Interface**
- Buddy list with online/away status
- Chat window with instant messaging
- Windows 95-style UI with draggable windows
- Retro scanline and CRT effects

✅ **Real Sound Effects**
- `aim-send.mp3` - Plays when you send a message
- `aim-in.mp3` - Plays when you receive a message
- `dial-up-modem-sound.mp3` - Plays during connection sequence
- `welcome.mp3` - Plays after successful connection
- `you-ve-got-mail.mp3` - Available for mail notifications

✅ **AOL Dial-Up Intro Sequence**
- 3-step connection animation (Initialize → Dial → Authenticate → Connect)
- Authentic dial-up modem sound
- Welcome sound on successful connection
- Shows only once per session (uses SessionStorage)
- Skip button (or press ESC)

✅ **MS-DOS Terminal Emulator**
- Powered by xterm.js
- Available commands: `help`, `dir`, `cls`, `ver`, `time`, `date`, `aim`, `whoami`
- Open with Ctrl+T or click "MS-DOS Prompt" in taskbar
- Fully draggable and minimizable

## Project Structure

```
website/
├── index.html              # Main HTML structure (136 lines)
├── main.css                # All styles including dial-up intro (830+ lines)
├── main.js                 # Application coordinator
├── js/
│   ├── audio-manager.js    # Sound effects with Howler.js
│   ├── chat-manager.js     # Messaging functionality
│   ├── terminal-manager.js # xterm.js terminal emulator
│   ├── dialup-intro.js     # AOL connection sequence
│   └── window-manager.js   # Draggable windows
├── media/
│   └── sounds/
│       ├── aim-send.mp3
│       ├── aim-in.mp3
│       ├── dial-up-modem-sound.mp3
│       ├── welcome.mp3
│       └── you-ve-got-mail.mp3
└── fonts/                  # (if any custom fonts)
```

## Technology Stack

- **Howler.js 2.2.4** - Cross-browser audio library via jsdelivr CDN
- **xterm.js 5.3.0** - Terminal emulator via jsdelivr CDN
- **xterm addon-fit 0.8.0** - Terminal responsive sizing
- **ES6 Classes** - Modern JavaScript modular architecture
- **SessionStorage** - Track dial-up intro shown state
- **Web Audio API** - Fallback audio support

## Module Architecture

### AudioManager (`js/audio-manager.js`)
- Manages all sound effects with Howler.js
- Methods: `init()`, `playSend()`, `playReceive()`, `playDialup(callback)`, `playWelcome(callback)`, `playGotMail()`

### ChatManager (`js/chat-manager.js`)
- Handles instant messaging
- Methods: `sendMessage()`, `receiveMessage()`, `openChat(username)`, `init()`
- Integrates with AudioManager for sounds

### TerminalManager (`js/terminal-manager.js`)
- Manages xterm.js terminal
- Methods: `createTerminal()`, `initializeXterm()`, `handleCommand(cmd)`, `close()`, `minimize()`, `restore()`
- 8 available commands with MS-DOS style output

### DialupIntro (`js/dialup-intro.js`)
- AOL dial-up connection sequence
- Methods: `show()`, `startSequence()`, `skip()`, `reset()`
- 3-step animation with authentic sounds
- Uses SessionStorage to show only once

### WindowManager (`js/window-manager.js`)
- Draggable window functionality
- Methods: `makeWindowDraggable(windowElement, handleElement)`, `init()`, `cleanup()`
- Viewport boundary detection

## Usage

### Basic Setup
1. Open `index.html` in a modern browser
2. Dial-up intro plays automatically on first visit
3. Click any buddy in the list to start chatting
4. Type a message and press Enter or click Send

### Keyboard Shortcuts
- **Ctrl+T** - Open MS-DOS terminal
- **ESC** - Skip dial-up intro
- **Enter** - Send message in chat

### Terminal Commands
```
help    - Show available commands
dir     - List directory contents
cls     - Clear screen
ver     - Show system version
time    - Display current time
date    - Display current date
aim     - Return to AIM
whoami  - Display user information
```

### Developer Options

#### Disable Dial-Up Intro
In `main.js`, comment out:
```javascript
// setTimeout(() => {
//     dialupIntro.show();
// }, 500);
```

#### Reset Dial-Up Intro (for testing)
Open browser console and run:
```javascript
dialupIntro.reset();
location.reload();
```

#### Add New Sound Effects
1. Add MP3 file to `media/sounds/`
2. Add Howl instance in `audio-manager.js`:
```javascript
this.sounds.newSound = new Howl({
    src: ['media/sounds/new-sound.mp3'],
    volume: 0.5
});
```
3. Add playback method:
```javascript
playNewSound() {
    this.sounds.newSound.play();
}
```

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ⚠️ Mobile browsers (limited - designed for desktop)

## Credits

- **Howler.js** by James Simpson (goldfire)
- **xterm.js** by SourceForge/Microsoft
- Sound effects: Classic AOL/AIM sounds
- UI Design: Windows 95 & AIM aesthetic

## License

For educational and nostalgic purposes only. AOL and AIM are trademarks of their respective owners.

---

**Built with ❤️ and nostalgia for the golden age of instant messaging**
