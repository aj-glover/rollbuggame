import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState } from './game/GameEngine';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    time: 0,
    bestTime: null,
    speed: 0,
    currentCheckpoint: 0,
    totalCheckpoints: 8,
    isRunning: false,
    isFinished: false,
    rollCount: 0,
    perfectLandings: 0,
    hulaBoostActive: false,
    perfectRoll: false,
    countdown: 0,
    gyroActive: false,
    enemyHit: false,
  });
  const [screen, setScreen] = useState<'title' | 'playing' | 'finished'>('title');
  const [showControls, setShowControls] = useState(false);

  const startGame = useCallback(async () => {
    if (engineRef.current) {
      try {
        await engineRef.current.requestGyroPermission();
      } catch (e) {
        // Fallback to keyboard controls
      }
      engineRef.current.start();
      setScreen('playing');
    }
  }, []);

  const restartGame = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.restart();
      setScreen('playing');
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Wait for container to have dimensions
    const checkDimensions = () => {
      if (containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
        const engine = new GameEngine(containerRef.current);
        engineRef.current = engine;

        engine.onStateChange = (state) => {
          setGameState(state);
          if (state.isFinished) {
            setScreen('finished');
          }
        };
      } else {
        // Retry after a short delay
        setTimeout(checkDimensions, 100);
      }
    };

    checkDimensions();

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);

  const formatTime = (t: number) => {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const speedPercent = Math.min(100, (gameState.speed / 80) * 100);

  return (
    <div className="w-full h-screen overflow-hidden bg-black relative select-none touch-none">
      {/* Game Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* HUD */}
      {screen === 'playing' && (
        <>
          {/* Countdown */}
          {gameState.countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
              <div className="text-8xl font-black text-white drop-shadow-lg animate-pulse">
                {Math.ceil(gameState.countdown)}
              </div>
            </div>
          )}
          {gameState.countdown <= 0.5 && gameState.countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
              <div className="text-6xl font-black text-emerald-400 drop-shadow-lg animate-bounce">
                GO!
              </div>
            </div>
          )}

          {/* Top HUD - hidden during countdown */}
          <div className={`absolute top-0 left-0 right-0 p-3 pointer-events-none transition-opacity duration-500 ${gameState.countdown > 0 ? 'opacity-0' : 'opacity-100'}`}>
            <div className="flex justify-between items-start max-w-md mx-auto">
              {/* Time */}
              <div className="bg-black/50 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <div className="text-white/50 text-[9px] uppercase tracking-widest font-medium">Time</div>
                <div className="text-white font-mono text-xl font-bold tracking-tight">
                  {formatTime(gameState.time)}
                </div>
              </div>

              {/* Checkpoint */}
              <div className="bg-black/50 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <div className="text-white/50 text-[9px] uppercase tracking-widest font-medium">CP</div>
                <div className="text-white font-mono text-xl font-bold">
                  {gameState.currentCheckpoint}<span className="text-white/40 text-sm">/{gameState.totalCheckpoints}</span>
                </div>
              </div>
            </div>

            {/* Speed Bar */}
            <div className="max-w-md mx-auto mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/30 backdrop-blur-sm rounded-full h-2.5 overflow-hidden border border-white/5">
                  <div
                    className="h-full rounded-full transition-all duration-75"
                    style={{
                      width: `${speedPercent}%`,
                      background: speedPercent < 40
                        ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                        : speedPercent < 70
                        ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                        : 'linear-gradient(90deg, #f87171, #ef4444)',
                    }}
                  />
                </div>
                <span className="text-white/60 font-mono text-xs min-w-[60px] text-right">
                  {Math.round(gameState.speed * 3.6)} km/h
                </span>
              </div>
            </div>
          </div>

          {/* Hula Boost Indicator */}
          {gameState.hulaBoostActive && (
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className={`font-black text-2xl drop-shadow-lg ${gameState.perfectRoll ? 'text-yellow-300' : 'text-cyan-400'}`}>
                {gameState.perfectRoll ? '⚡ PERFECT ROLL ⚡' : '🌀 HULA BOOST 🌀'}
              </div>
            </div>
          )}

          {/* Perfect Landing */}
          {gameState.perfectRoll && !gameState.hulaBoostActive && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none animate-bounce">
              <div className="text-emerald-400 font-bold text-xl drop-shadow-lg">
                ✨ PERFECT LANDING ✨
              </div>
            </div>
          )}

          {/* Enemy Hit */}
          {gameState.enemyHit && (
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 pointer-events-none animate-pulse">
              <div className="bg-red-500/80 backdrop-blur-sm rounded-xl px-6 py-3 border-2 border-red-300">
                <div className="text-white font-bold text-2xl drop-shadow-lg">
                  💥 OUCH! 💥
                </div>
                <div className="text-white/80 text-sm text-center">
                  Jump over enemies!
                </div>
              </div>
            </div>
          )}

          {/* Bottom hint - hidden during countdown */}
          <div className={`absolute bottom-3 left-0 right-0 text-center pointer-events-none transition-opacity duration-500 ${gameState.countdown > 0 ? 'opacity-0' : 'opacity-100'}`}>
            <p className="text-white/25 text-[10px] font-medium">
              {gameState.gyroActive 
                ? '📱 Tilt to balance • Flick to roll • Tap to jump' 
                : '⌨️ A/D to lean • F to roll • Space to jump'}
            </p>
          </div>
        </>
      )}

      {/* Title Screen */}
      {screen === 'title' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Background overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70 backdrop-blur-[2px]" />
          
          <div className="relative text-center px-6 z-10">
            {/* Logo */}
            <div className="mb-2">
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter">
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-amber-300 via-yellow-400 to-orange-500">
                  ROLL
                </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 via-blue-400 to-indigo-500">
                  BUG
                </span>
              </h1>
            </div>
            
            <p className="text-white/60 text-sm md:text-base mb-1 font-light">
              Balance. Roll. Speed.
            </p>
            <p className="text-white/30 text-xs mb-10">
              BACKYARD RUN — Level 01
            </p>

            {/* Bug character */}
            <div className="text-7xl mb-10 animate-bounce" style={{ animationDuration: '2s' }}>
              🪲
            </div>

            {/* Start Button */}
            <button
              onClick={startGame}
              className="group relative bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-xl px-12 py-4 rounded-full shadow-xl shadow-green-500/25 hover:shadow-green-500/40 hover:scale-105 active:scale-95 transition-all duration-200"
            >
              <span className="relative z-10">START ROLLING</span>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Controls toggle */}
            <button
              onClick={() => setShowControls(!showControls)}
              className="block mx-auto mt-6 text-white/40 text-xs hover:text-white/60 transition-colors"
            >
              {showControls ? '▲ Hide Controls' : '▼ Show Controls'}
            </button>

            {showControls && (
              <div className="mt-4 bg-black/70 backdrop-blur-md rounded-2xl p-5 text-left max-w-xs mx-auto border border-white/10">
                <h3 className="text-white/90 font-bold text-sm mb-3">📱 MOBILE</h3>
                <div className="space-y-1.5 text-white/60 text-xs mb-4">
                  <p>• Tilt device to shift weight</p>
                  <p>• <span className="text-yellow-400">Flick phone</span> = Start rolling!</p>
                  <p>• Tap screen to jump</p>
                  <p>• Circular motion = Hula Roll</p>
                </div>
                <h3 className="text-white/90 font-bold text-sm mb-3">⌨️ DESKTOP</h3>
                <div className="space-y-1.5 text-white/60 text-xs mb-4">
                  <p>• A/D or ←/→ = Lean left/right</p>
                  <p>• W/S or ↑/↓ = Speed control</p>
                  <p>• <span className="text-yellow-400">F key</span> = Start rolling</p>
                  <p>• Space = Jump</p>
                  <p>• Mouse circle = Hula Roll</p>
                </div>
                <div className="pt-3 border-t border-white/10 text-white/40 text-[11px] space-y-1">
                  <p>💡 Bug starts walking. Flick to curl into a ball and roll faster!</p>
                  <p>🐜 Jump over enemies (ants, spiders, beetles, ladybugs)!</p>
                  <p>⚡ Lean into turns to maintain traction. 4 loops to conquer!</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Finish Screen */}
      {screen === 'finished' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          
          <div className="relative text-center px-6 max-w-sm z-10">
            <h2 className="text-4xl font-black text-white mb-2">RUN COMPLETE!</h2>
            <p className="text-white/40 text-sm mb-6">Backyard Run finished</p>
            
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 space-y-3 mb-8 border border-white/10">
              <div className="flex justify-between items-center py-1">
                <span className="text-white/50 text-sm font-medium">TIME</span>
                <span className="text-white font-mono font-bold text-xl">{formatTime(gameState.time)}</span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between items-center py-1">
                <span className="text-white/50 text-sm font-medium">BEST</span>
                <span className="text-amber-400 font-mono font-bold text-xl">
                  {gameState.bestTime ? formatTime(gameState.bestTime) : '--:--.--'}
                </span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between items-center py-1">
                <span className="text-white/50 text-sm font-medium">TOP SPEED</span>
                <span className="text-white font-mono font-bold">{Math.round(gameState.speed * 3.6)} km/h</span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between items-center py-1">
                <span className="text-white/50 text-sm font-medium">HULA ROLLS</span>
                <span className="text-cyan-400 font-mono font-bold">{gameState.rollCount}</span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between items-center py-1">
                <span className="text-white/50 text-sm font-medium">PERFECT LANDINGS</span>
                <span className="text-emerald-400 font-mono font-bold">{gameState.perfectLandings}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={restartGame}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-3.5 px-6 rounded-full shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
              >
                RETRY
              </button>
              <button
                onClick={restartGame}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-3.5 px-6 rounded-full shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95 transition-all"
              >
                NEXT RUN →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
