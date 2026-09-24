# 🪲 ROLLBUG

A fast-paced 3D physics platformer where you control a tiny pill bug navigating a giant backyard world.

![ROLLBUG](https://img.shields.io/badge/Game-3D%20Platformer-blue) ![React](https://img.shields.io/badge/React-18-61dafb) ![Three.js](https://img.shields.io/badge/Three.js-0.160-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

## 🎮 About

ROLLBUG is a mobile-first arcade-style physics platformer inspired by the momentum and speed of classic platformers. You control a tiny pill bug navigating enormous everyday objects from an insect's perspective.

**The core fantasy:** You're physically balancing a living creature around a track using momentum and weight shifting.

**The vibe:** Sonic-style speed + Marble Madness physics + roller coaster movement + hula-hoop balance.

## ✨ Features

### 🎯 Core Gameplay
- **Physics-based movement** - Tilt to shift weight, manage momentum and centrifugal force
- **Walking to rolling transition** - Start walking, then flick to curl into a ball for speed
- **4 challenging loops** - Vertical loops, corkscrews, and banked turns
- **13 enemies to avoid** - Ants, spiders, beetles, and ladybugs patrol the track
- **3-life system** - Hit enemies 3 times and it's game over!
- **Hula Roll mechanic** - Circular motion for speed boosts
- **Spray can rattling effect** - Constant vibration for intense game feel

### 🎨 Visual Design
- **Giant world perspective** - Grass blades like trees, pebbles like boulders
- **Stylized 3D graphics** - Colorful, chunky, toy-like aesthetic
- **Dynamic camera** - Follows closely, pulls back at high speed, increases FOV
- **Particle effects** - Speed particles and visual feedback
- **Animated pill bug** - Legs scramble, body wobbles, shell compresses on landing

### 🎮 Controls
**Mobile (Primary):**
- **Tilt device** - Lean left/right to balance, forward/back to control speed
- **Flick phone** - Transition from walking to rolling mode
- **Tap screen** - Jump over enemies
- **Circular motion** - Perform Hula Roll for speed boost

**Desktop (Testing):**
- **A/D or ←/→** - Lean left/right
- **W/S or ↑/↓** - Speed control
- **F key** - Start rolling
- **Space** - Jump
- **Mouse circle** - Hula Roll

## 🏁 Track Design: Backyard Run

The first level takes approximately 60-90 seconds to complete and includes:

1. **Wide start section** - Learn basic movement
2. **Loop 1** - Small vertical loop
3. **Loop 2** - Medium tilted loop
4. **Wide hula roll zone** - Perform circular motion for boost
5. **Loop 3** - Large challenging loop
6. **Loop 4** - Corkscrew loop
7. **Narrow bridge** - Precision required
8. **Final downhill** - High-speed finish

**Checkpoints:** 8 checkpoints throughout the track for respawning

**Enemies:** 13 creatures placed strategically to challenge your jumping skills

## 🎯 Game Mechanics

### Balance & Momentum
The pill bug automatically moves forward. You control:
- **Lateral balance** - Lean into turns to counteract centrifugal force
- **Speed** - Lean forward to accelerate, back to brake
- **Traction** - Too much tilt at high speed = spin out!

### Walking vs Rolling
- **Walking mode** - Slower, more control, legs visible
- **Rolling mode** - Faster, less control, bug curls into ball
- **Transition** - Flick your phone (or press F on desktop) to switch

### Jumping
- Tap screen or press Space to jump
- Essential for avoiding enemies
- Perfect landings give visual feedback

### Hula Roll
- Perform circular motion with phone (or mouse circle on desktop)
- Bug curls into ball and spins
- Grants speed boost
- Can be chained: turn → jump → hula roll → landing → boost

### Enemy System
- **Ants** - Small, fast, 5 on track
- **Spiders** - Medium, 8 legs, 3 on track
- **Beetles** - Large, shiny shell, 2 on track
- **Ladybugs** - Red with spots, 3 on track
- Enemies patrol back and forth
- Jump over them or lose a life
- Hit = 50% speed loss + knockback + wobble

## 🛠️ Technical Details

### Built With
- **React 18** - UI framework
- **Three.js** - 3D rendering
- **Cannon-es** - Physics engine
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vite** - Build tool

### Architecture
```
src/
├── App.tsx              # Main React component with HUD
├── game/
│   ├── GameEngine.ts    # Core game loop, physics, rendering
│   ├── Controls.ts      # Input handling (gyro, keyboard, touch)
│   └── Enemy.ts         # Enemy class and AI
```

### Physics System
- Custom track-following physics (not free-form)
- Tilt-based weight shifting affects center of mass
- Centrifugal force in curves
- Traction model based on speed and tilt
- Collision detection with enemies

### Mobile Optimization
- Gyroscope/accelerometer support
- iOS permission handling
- Touch controls with swipe detection
- Passive event listeners for performance
- Responsive design for all screen sizes

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd rollbug

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Mobile Testing
For gyroscope controls on mobile:
1. Build the production version: `npm run build`
2. Serve the `dist` folder on a local network
3. Access from your phone's browser
4. Grant motion sensor permissions when prompted

**Note:** Gyroscope requires HTTPS or localhost to work on iOS devices.

## 🎮 How to Play

### Objective
Navigate the pill bug through the backyard track, avoid enemies, and reach the finish line as fast as possible.

### Tips
1. **Start slow** - Learn the controls in walking mode
2. **Lean into turns** - Counteract centrifugal force
3. **Time your jumps** - Watch enemy patrol patterns
4. **Use rolling wisely** - Faster but harder to control
5. **Master the Hula Roll** - Circular motion for speed boosts
6. **Watch the speed bar** - Green = safe, yellow = caution, red = danger

### Scoring
- **Time** - Complete the track as fast as possible
- **Best Time** - Your personal record
- **Perfect Landings** - Land smoothly after jumps
- **Hula Rolls** - Successful circular motions

## 🐛 Known Issues

- Gyroscope sensitivity varies by device
- Some older browsers may not support WebGL 2.0
- Performance may vary on low-end mobile devices

## 🔮 Future Plans

- [ ] Additional levels (Kitchen, Garden, Pool Area)
- [ ] Power-ups (speed boost, shield, magnet)
- [ ] Boss enemies
- [ ] Time trial mode with ghosts
- [ ] Multiplayer races
- [ ] Customizable pill bug skins
- [ ] More enemy types
- [ ] Weather effects (rain = slippery)

## 📱 Browser Support

- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Safari (Desktop & iOS)
- ✅ Firefox (Desktop)
- ✅ Samsung Internet

**Minimum requirements:** WebGL 2.0, Device Orientation API (for mobile)

## 🤝 Contributing

This is a demonstration project. Feel free to fork and experiment!

## 📄 License

MIT License - feel free to use this as inspiration for your own projects!

## 🙏 Acknowledgments

Inspired by:
- Sonic the Hedgehog (momentum platforming)
- Marble Madness (physics-based movement)
- Super Monkey Ball (tilt controls)
- Roll with It (rolling mechanics)

## 📞 Contact

Questions or feedback? Open an issue on GitHub!

---

**Made with 🪲 and lots of coffee**

*Remember: You're not just playing a game, you're experiencing the world from a bug's perspective!*