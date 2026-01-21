"use client";

import { useState, useMemo, useEffect, useCallback, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Network = "testnet" | "mainnet";
type TokenType = "erc721" | "erc20" | "erc1155";

// ERC721 snapshot data
interface ERC721SnapshotData {
  contract: string;
  tokenType: "erc721";
  network: Network;
  snapshotBlock: number;
  analytics: {
    totalNfts: number;
    uniqueOwners: number;
  };
  data: { tokenId: string; owner: string }[];
}

// ERC20 snapshot data
interface ERC20SnapshotData {
  contract: string;
  tokenType: "erc20";
  network: Network;
  snapshotBlock: number;
  analytics: {
    totalSupply: string;
    holders: number;
  };
  data: { address: string; balance: string }[];
}

// ERC1155 snapshot data
interface ERC1155SnapshotData {
  contract: string;
  tokenType: "erc1155";
  network: Network;
  snapshotBlock: number;
  analytics: {
    totalHoldings: number;
    uniqueOwners: number;
    uniqueTokenIds: number;
  };
  data: { address: string; tokenId: string; balance: string }[];
}

type SnapshotData = ERC721SnapshotData | ERC20SnapshotData | ERC1155SnapshotData;

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyableText({
  text,
  truncate = true,
  className = "",
}: {
  text: string;
  truncate?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayed = truncate
    ? `${text.slice(0, 6)}...${text.slice(-4)}`
    : text;

  return (
    <div className="relative inline-block">
      <button
        onClick={handleCopy}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`group flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${className}`}
      >
        <span>{displayed}</span>
        {copied ? (
          <CheckIcon className="text-green-500" />
        ) : (
          <CopyIcon className="opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && !copied && truncate && (
        <div className="absolute bottom-full left-0 z-10 mb-2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-zinc-700">
          {text}
          <div className="absolute left-4 top-full border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-700" />
        </div>
      )}

      {/* Copied toast */}
      {copied && (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-green-600 px-2 py-1 text-xs text-white shadow-lg">
          Copied!
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-green-600" />
        </div>
      )}
    </div>
  );
}

function CopyableAddress({ address }: { address: string }) {
  return <CopyableText text={address} truncate />;
}

// Format large numbers with commas for readability
function formatWithCommas(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Monad facts with links to documentation
const MONAD_FACTS = [
  {
    fact: "Monad blocks are produced every 400ms - that's 2.5x faster than Ethereum!",
    link: "https://docs.monad.xyz/developer-essentials/summary#timing-considerations",
    linkText: "Learn about timing",
  },
  {
    fact: "Monad achieves 10,000 TPS with 500M gas/sec - 33x more than Ethereum's 15M gas/sec.",
    link: "https://docs.monad.xyz/developer-essentials/summary#gas-limits",
    linkText: "Gas limits explained",
  },
  {
    fact: "Smart contracts on Monad can be up to 128KB - 5x larger than Ethereum's 24.5KB limit!",
    link: "https://docs.monad.xyz/developer-essentials/summary#smart-contracts",
    linkText: "Contract limits",
  },
  {
    fact: "Monad uses parallel execution with optimistic concurrency - transactions run concurrently but appear sequential.",
    link: "https://docs.monad.xyz/monad-arch/execution/parallel-execution",
    linkText: "Parallel execution",
  },
  {
    fact: "Blocks are finalized in just 800ms (2 slots) - speculative finality in just 400ms!",
    link: "https://docs.monad.xyz/monad-arch/consensus/monad-bft",
    linkText: "MonadBFT consensus",
  },
  {
    fact: "Monad supports EIP-7702 for smart account delegation from EOAs.",
    link: "https://docs.monad.xyz/developer-essentials/eip-7702",
    linkText: "EIP-7702 guide",
  },
  {
    fact: "All your favorite tools work: Foundry, Viem, Hardhat, Safe, Tenderly, and more!",
    link: "https://docs.monad.xyz/developer-essentials/tooling-and-infra",
    linkText: "Supported tooling",
  },
  {
    fact: "Monad's JIT compiler tracks hot contracts by gas usage and compiles them to native x86-64 machine code.",
    link: "https://docs.monad.xyz/monad-arch/execution/native-compilation",
    linkText: "JIT compilation",
  },
  {
    fact: "MonadDb operates directly on block devices, bypassing the filesystem entirely for maximum SSD performance.",
    link: "https://docs.monad.xyz/monad-arch/execution/monaddb",
    linkText: "MonadDb architecture",
  },
  {
    fact: "Asynchronous execution expands the execution budget by 12x compared to Ethereum's sync model.",
    link: "https://docs.monad.xyz/monad-arch/consensus/asynchronous-execution",
    linkText: "Async execution",
  },
  {
    fact: "MonadDb implements Patricia Tries natively on-disk - no generic B-Trees or LSM-Trees needed!",
    link: "https://docs.monad.xyz/monad-arch/execution/monaddb",
    linkText: "Native Patricia Tries",
  },
  {
    fact: "RaptorCast uses erasure coding to deliver blocks in one round-trip, even with 20% packet loss.",
    link: "https://docs.monad.xyz/monad-arch/consensus/raptorcast",
    linkText: "RaptorCast protocol",
  },
  {
    fact: "No global mempool - transactions go directly to the next 3 leaders for lower latency.",
    link: "https://docs.monad.xyz/monad-arch/consensus/local-mempool",
    linkText: "Local mempool",
  },
  {
    fact: "Sequential writes to MonadDb improve SSD lifespan by reducing write amplification.",
    link: "https://docs.monad.xyz/monad-arch/execution/monaddb",
    linkText: "SSD optimization",
  },
  {
    fact: "Monad re-executes only conflicting transactions - signature recovery is cached from first run!",
    link: "https://docs.monad.xyz/monad-arch/execution/parallel-execution",
    linkText: "Smart re-execution",
  },
];

// Simple jumping game component
function JumpingGame({ autoPlay = false }: { autoPlay?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(autoPlay);

  useEffect(() => {
    // Auto-start if autoPlay is enabled
    if (autoPlay) {
      setGameStarted(true);
      setGameOver(false);
      setScore(0);
    }
  }, [autoPlay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let playerY = 150;
    let velocity = 0;
    let isJumping = false;
    let obstacles: { x: number; width: number; height: number; passed?: boolean }[] = [];
    let frameCount = 0;
    let currentScore = 0;
    const gravity = 0.8;
    const jumpForce = -14;
    const groundY = 150;
    const playerSize = 30;

    const jump = () => {
      if (!isJumping && (gameStarted || autoPlay) && !gameOver) {
        velocity = jumpForce;
        isJumping = true;
      }
      if (!gameStarted && !autoPlay) {
        setGameStarted(true);
        setGameOver(false);
        setScore(0);
        currentScore = 0;
        obstacles = [];
      }
      if (gameOver && !autoPlay) {
        setGameOver(false);
        setGameStarted(true);
        setScore(0);
        currentScore = 0;
        obstacles = [];
        playerY = groundY;
        velocity = 0;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };

    const handleClick = () => jump();

    if (!autoPlay) {
      canvas.addEventListener("click", handleClick);
      window.addEventListener("keydown", handleKeyDown);
    }

    const gameLoop = () => {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Ground
      ctx.fillStyle = "#3f3f46";
      ctx.fillRect(0, groundY + playerSize, canvas.width, 2);

      if (!gameStarted && !autoPlay) {
        ctx.fillStyle = "#a1a1aa";
        ctx.font = "14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Click or press Space to start!", canvas.width / 2, 100);
        ctx.fillStyle = "#836EF9";
        ctx.fillRect(50, playerY, playerSize, playerSize);
        animationId = requestAnimationFrame(gameLoop);
        return;
      }

      if (gameOver) {
        if (autoPlay) {
          // Auto-restart in autoPlay mode
          setGameOver(false);
          currentScore = 0;
          setScore(0);
          obstacles = [];
          playerY = groundY;
          velocity = 0;
          isJumping = false;
        } else {
          ctx.fillStyle = "#ef4444";
          ctx.font = "bold 18px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(`Game Over! Score: ${currentScore}`, canvas.width / 2, 80);
          ctx.fillStyle = "#a1a1aa";
          ctx.font = "14px system-ui";
          ctx.fillText("Click or press Space to restart", canvas.width / 2, 105);
          animationId = requestAnimationFrame(gameLoop);
          return;
        }
      }

      // Auto-play AI: jump when obstacle is approaching
      if (autoPlay && !isJumping) {
        const nearestObstacle = obstacles.find((obs) => obs.x > 30 && obs.x < 120);
        if (nearestObstacle) {
          velocity = jumpForce;
          isJumping = true;
        }
      }

      // Physics
      velocity += gravity;
      playerY += velocity;

      if (playerY >= groundY) {
        playerY = groundY;
        velocity = 0;
        isJumping = false;
      }

      // Player (purple square - Monad themed!)
      ctx.fillStyle = "#836EF9";
      ctx.fillRect(50, playerY, playerSize, playerSize);

      // Auto-play indicator
      if (autoPlay) {
        ctx.fillStyle = "#836EF9";
        ctx.font = "10px system-ui";
        ctx.textAlign = "right";
        ctx.fillText("AUTO", canvas.width - 10, 20);
      }

      // Spawn obstacles
      frameCount++;
      if (frameCount % 90 === 0) {
        obstacles.push({
          x: canvas.width,
          width: 20 + Math.random() * 15,
          height: 25 + Math.random() * 20,
        });
      }

      // Update and draw obstacles
      ctx.fillStyle = "#f97316";
      obstacles = obstacles.filter((obs) => {
        obs.x -= 5;
        ctx.fillRect(obs.x, groundY + playerSize - obs.height, obs.width, obs.height);

        // Collision detection
        if (
          50 < obs.x + obs.width &&
          50 + playerSize > obs.x &&
          playerY + playerSize > groundY + playerSize - obs.height
        ) {
          setGameOver(true);
        }

        // Score
        if (obs.x + obs.width < 50 && !obs.passed) {
          obs.passed = true;
          currentScore++;
          setScore(currentScore);
        }

        return obs.x > -obs.width;
      });

      // Score display
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "14px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`Score: ${currentScore}`, 10, 25);

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gameStarted, gameOver]);

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="w-full max-w-[400px] rounded-lg border border-zinc-700 bg-zinc-900"
      />
      <p className="mt-2 text-xs text-zinc-500">Press Space or click to jump!</p>
    </div>
  );
}

// Simple clicker game component
function ClickerGame() {
  const [clicks, setClicks] = useState(0);

  const handleClick = () => {
    setClicks((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col items-center">
      <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
        Click to increase your meaningless score
      </p>
      <button
        onClick={handleClick}
        className="h-24 w-24 cursor-pointer rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-4xl shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        💎
      </button>
      <p className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {clicks.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-zinc-400">
        {clicks >= 100 ? "This accomplishes nothing 🎉" : clicks >= 50 ? "Still meaningless 💪" : clicks >= 10 ? "Why are you doing this" : ""}
      </p>
    </div>
  );
}

// Loading entertainment component
function LoadingEntertainment({ elapsedTime }: { elapsedTime: number }) {
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [achievementShown, setAchievementShown] = useState(false);
  const showExtended = elapsedTime >= 20;
  const showGrass = elapsedTime >= 200;
  const showAchievement = elapsedTime >= 250;
  const showClickerGame = elapsedTime >= 300;

  // Rotate facts every 10 seconds
  useEffect(() => {
    if (!showExtended) return;
    const interval = setInterval(() => {
      setCurrentFactIndex((prev) => (prev + 1) % MONAD_FACTS.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [showExtended]);

  // Show achievement popup at 250 seconds
  useEffect(() => {
    if (showAchievement && !achievementShown) {
      setAchievementShown(true);
    }
  }, [showAchievement, achievementShown]);

  const goToPrevFact = () => {
    setCurrentFactIndex((prev) => (prev - 1 + MONAD_FACTS.length) % MONAD_FACTS.length);
  };

  const goToNextFact = () => {
    setCurrentFactIndex((prev) => (prev + 1) % MONAD_FACTS.length);
  };

  return (
    <div className="mt-8">
      <p className="mb-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {elapsedTime > 0 ? `Fetching... ${elapsedTime}s` : "Fetching..."}
      </p>

      {!showExtended && (
        <div className="overflow-hidden rounded-xl">
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="aspect-video w-full object-cover"
            src="/loading.mp4"
          />
        </div>
      )}

      {showExtended && (
        <>
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This collection has a lot of data! It might take 2-4 minutes to fetch everything.
            </p>
          </div>

          {/* Facts section */}
          <div className="mb-4 rounded-xl bg-zinc-100 p-6 dark:bg-zinc-800">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  Did you know?
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevFact}
                  className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={goToNextFact}
                  className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">
              {MONAD_FACTS[currentFactIndex].fact}
            </p>
            <a
              href={MONAD_FACTS[currentFactIndex].link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
            >
              {MONAD_FACTS[currentFactIndex].linkText}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <div className="mt-4 flex justify-center gap-1.5">
              {MONAD_FACTS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentFactIndex(i)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i === currentFactIndex
                      ? "bg-purple-600 dark:bg-purple-400"
                      : "bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Game section - show jumping game or clicker game */}
          <div className="rounded-xl bg-zinc-100 p-6 dark:bg-zinc-800">
            {showClickerGame ? (
              <>
                <div className="mb-4 text-center">
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                    New game unlocked! 🎮
                  </span>
                </div>
                <ClickerGame />
              </>
            ) : (
              <>
                <div className="mb-4 text-center">
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                    {elapsedTime >= 50
                      ? "The AI is playing now... just relax!"
                      : "Jump over the obstacles while you wait!"}
                  </span>
                </div>
                <JumpingGame autoPlay={elapsedTime >= 50} />
              </>
            )}
          </div>

          {/* Touch grass message at 200s */}
          {showGrass && (
            <div className="mt-4 rounded-xl bg-green-100 p-4 text-center dark:bg-green-900/30">
              <p className="text-lg font-medium text-green-800 dark:text-green-200">
                Still loading? Maybe touch some grass 🌱
              </p>
            </div>
          )}

          {/* Achievement popup at 250s - Steam style */}
          {achievementShown && (
            <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-sm bg-gradient-to-r from-zinc-800 to-zinc-900 px-4 py-3 shadow-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-zinc-700 text-2xl">
                🏆
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Achievement Unlocked
                </p>
                <p className="text-sm font-bold text-white">
                  Patience Master
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Grass at bottom of screen at 200s */}
      {showGrass && (
        <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center overflow-hidden text-4xl">
          <div className="flex">
            {Array.from({ length: 30 }).map((_, i) => (
              <span key={i} className="inline-block">
                {["🌱", "🌿", "☘️", "🍀"][i % 4]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const NETWORK_KEY = "nft-snapshot-network";
const TOKEN_TYPE_KEY = "nft-snapshot-token-type";
const API_KEY_KEY = "nft-snapshot-api-key";

function getSavedNetwork(): Network {
  if (typeof window === "undefined") return "testnet";
  try {
    const stored = localStorage.getItem(NETWORK_KEY);
    return stored === "mainnet" ? "mainnet" : "testnet";
  } catch {
    return "testnet";
  }
}

function saveNetwork(network: Network): void {
  localStorage.setItem(NETWORK_KEY, network);
}

function getSavedTokenType(): TokenType {
  if (typeof window === "undefined") return "erc721";
  try {
    const stored = localStorage.getItem(TOKEN_TYPE_KEY);
    if (stored === "erc20") return "erc20";
    if (stored === "erc1155") return "erc1155";
    return "erc721";
  } catch {
    return "erc721";
  }
}

function saveTokenType(tokenType: TokenType): void {
  localStorage.setItem(TOKEN_TYPE_KEY, tokenType);
}

function getSavedApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(API_KEY_KEY) || "";
  } catch {
    return "";
  }
}

function saveApiKey(apiKey: string): void {
  if (apiKey) {
    localStorage.setItem(API_KEY_KEY, apiKey);
  } else {
    localStorage.removeItem(API_KEY_KEY);
  }
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contractAddress, setContractAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [initialLoad, setInitialLoad] = useState(true);
  const [network, setNetwork] = useState<Network>("testnet");
  const [tokenType, setTokenType] = useState<TokenType>("erc721");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; y: number; emoji: string }[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Console easter egg
  useEffect(() => {
    console.log(
      "%c gm from Monad! ",
      "background: #836EF9; color: white; font-size: 24px; font-weight: bold; padding: 10px 20px; border-radius: 8px;"
    );
    console.log(
      "%c Want to build on the fastest EVM? Check out https://docs.monad.xyz ",
      "color: #836EF9; font-size: 14px;"
    );
  }, []);

  // Title click spawns floating heart
  const handleTitleClick = (e: React.MouseEvent) => {
    const hearts = ["💜", "💖", "💗", "💝", "🩷", "❤️", "🧡", "💛"];
    const newHeart = {
      id: Date.now(),
      x: e.clientX,
      y: e.clientY,
      emoji: hearts[Math.floor(Math.random() * hearts.length)],
    };
    setFloatingHearts((prev) => [...prev, newHeart]);
    // Remove heart after animation
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 2000);
  };

  // Load settings from localStorage on mount (URL params handled in contract loading effect)
  useEffect(() => {
    setNetwork(getSavedNetwork());
    setTokenType(getSavedTokenType());
    const savedKey = getSavedApiKey();
    setApiKey(savedKey);
    if (savedKey) setShowAdvanced(true);
  }, []);

  // Timer for elapsed time during loading
  useEffect(() => {
    if (!loading) {
      setElapsedTime(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  // Save network to localStorage when it changes
  const handleNetworkChange = (newNetwork: Network) => {
    setNetwork(newNetwork);
    saveNetwork(newNetwork);
    setSnapshot(null); // Clear current snapshot when switching networks
  };

  // Save token type to localStorage when it changes
  const handleTokenTypeChange = (newTokenType: TokenType) => {
    setTokenType(newTokenType);
    saveTokenType(newTokenType);
    setSnapshot(null); // Clear current snapshot when switching token types
  };

  // Save API key to localStorage when it changes
  const handleApiKeyChange = (newApiKey: string) => {
    setApiKey(newApiKey);
    saveApiKey(newApiKey);
  };

  const filteredData = useMemo(() => {
    if (!snapshot) return [];
    if (!searchQuery.trim()) return snapshot.data;

    const query = searchQuery.toLowerCase().trim();

    if (snapshot.tokenType === "erc721") {
      return (snapshot.data as { tokenId: string; owner: string }[]).filter(
        (item) =>
          item.tokenId.includes(query) ||
          item.owner.toLowerCase().includes(query)
      );
    } else if (snapshot.tokenType === "erc1155") {
      return (snapshot.data as { address: string; tokenId: string; balance: string }[]).filter(
        (item) =>
          item.address.toLowerCase().includes(query) ||
          item.tokenId.includes(query) ||
          item.balance.includes(query)
      );
    } else {
      return (snapshot.data as { address: string; balance: string }[]).filter(
        (item) =>
          item.address.toLowerCase().includes(query) ||
          item.balance.includes(query)
      );
    }
  }, [snapshot, searchQuery]);

  const handleFetch = useCallback(async (addressOverride?: string, networkOverride?: Network, tokenTypeOverride?: TokenType) => {
    const address = addressOverride || contractAddress;
    const effectiveNetwork = networkOverride || network;
    const effectiveTokenType = tokenTypeOverride || tokenType;

    if (!address) {
      setError("Please enter a contract address");
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError("Invalid contract address format");
      return;
    }

    if (addressOverride) {
      setContractAddress(addressOverride);
    }
    if (networkOverride) {
      setNetwork(networkOverride);
      saveNetwork(networkOverride);
    }
    if (tokenTypeOverride) {
      setTokenType(tokenTypeOverride);
      saveTokenType(tokenTypeOverride);
    }

    // Update URL with contract address, network, and token type
    router.push(`/?contract=${address}&network=${effectiveNetwork}&type=${effectiveTokenType}`, { scroll: false });

    setError("");
    setLoading(true);
    setSnapshot(null);
    setSearchQuery("");

    try {
      const url = `/api/snapshot?contract=${address}&network=${effectiveNetwork}&type=${effectiveTokenType}`;
      const headers: HeadersInit = {};
      if (apiKey) {
        headers["x-api-key"] = apiKey;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch snapshot");
      }

      const data: SnapshotData = await response.json();
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [contractAddress, router, network, tokenType, apiKey]);

  // Load contract from URL on initial mount
  useEffect(() => {
    if (initialLoad) {
      const contractFromUrl = searchParams.get("contract");
      const networkFromUrl = searchParams.get("network");
      const typeFromUrl = searchParams.get("type");

      if (contractFromUrl && /^0x[a-fA-F0-9]{40}$/.test(contractFromUrl)) {
        const urlNetwork = (networkFromUrl === "mainnet" || networkFromUrl === "testnet") ? networkFromUrl : undefined;
        const urlTokenType = (typeFromUrl === "erc721" || typeFromUrl === "erc20" || typeFromUrl === "erc1155") ? typeFromUrl : undefined;
        handleFetch(contractFromUrl, urlNetwork, urlTokenType);
      }
      setInitialLoad(false);
    }
  }, [initialLoad, searchParams, handleFetch]);

  const handleDownloadCSV = async () => {
    if (!snapshot) return;
    const url = `/api/snapshot?contract=${snapshot.contract}&network=${network}&type=${snapshot.tokenType}&format=csv`;
    const headers: HeadersInit = {};
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error("Failed to download");
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${snapshot.contract}-${snapshot.tokenType}-snapshot.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError("Failed to download CSV");
    }
  };


  // Soft pastel colors that cycle every 30 seconds starting at 70s
  const softColors = [
    "bg-purple-100 dark:bg-purple-900/30",
    "bg-pink-100 dark:bg-pink-900/30",
    "bg-blue-100 dark:bg-blue-900/30",
    "bg-green-100 dark:bg-green-900/30",
    "bg-yellow-100 dark:bg-yellow-900/30",
    "bg-orange-100 dark:bg-orange-900/30",
    "bg-rose-100 dark:bg-rose-900/30",
    "bg-cyan-100 dark:bg-cyan-900/30",
  ];

  const getBackgroundClass = () => {
    if (elapsedTime < 70) return "bg-zinc-50 dark:bg-zinc-950";
    const colorIndex = Math.floor((elapsedTime - 70) / 30) % softColors.length;
    return softColors[colorIndex];
  };

  return (
    <div className={`relative flex min-h-screen items-center justify-center px-4 py-12 transition-all duration-1000 ${getBackgroundClass()}`}>
      {/* Minecraft video background after 150 seconds */}
      {elapsedTime >= 150 && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="pointer-events-none fixed inset-0 z-0 h-full w-full object-cover opacity-30"
          src="/minecraft.mp4"
        />
      )}
      {/* Floating hearts from title clicks */}
      {floatingHearts.map((heart) => (
        <div
          key={heart.id}
          className="pointer-events-none fixed z-50 animate-ping text-2xl"
          style={{
            left: heart.x,
            top: heart.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          {heart.emoji}
        </div>
      ))}
      <main className="relative z-10 w-full max-w-3xl">
        <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1
                onClick={handleTitleClick}
                className="mb-2 cursor-pointer select-none text-2xl font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {tokenType === "erc721" ? "NFT Snapshot" : tokenType === "erc1155" ? "Multi-Token Snapshot" : "Token Snapshot"}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {tokenType === "erc721"
                  ? "Get a snapshot of all NFT holders for any collection on Monad"
                  : tokenType === "erc1155"
                  ? "Get a snapshot of all ERC-1155 multi-token holders on Monad"
                  : "Get a snapshot of all token holders for any ERC20 on Monad"}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              <button
                onClick={() => handleNetworkChange("testnet")}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  network === "testnet"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Testnet
              </button>
              <button
                onClick={() => handleNetworkChange("mainnet")}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  network === "mainnet"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Mainnet
              </button>
            </div>
          </div>

          {/* Token Type Toggle */}
          <div className="mb-6">
            <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              <button
                onClick={() => handleTokenTypeChange("erc721")}
                className={`flex-1 cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  tokenType === "erc721"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                ERC-721
              </button>
              <button
                onClick={() => handleTokenTypeChange("erc1155")}
                className={`flex-1 cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  tokenType === "erc1155"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                ERC-1155
              </button>
              <button
                onClick={() => handleTokenTypeChange("erc20")}
                className={`flex-1 cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  tokenType === "erc20"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                ERC-20
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="contract"
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Contract Address
              </label>
              <div className="flex gap-3">
                <input
                  id="contract"
                  type="text"
                  placeholder="0x..."
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && handleFetch()}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
                />
                <button
                  onClick={() => handleFetch()}
                  disabled={loading}
                  className="min-w-[100px] cursor-pointer rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {loading ? "Loading..." : "Fetch"}
                </button>
              </div>
            </div>

            {/* Advanced Options */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex cursor-pointer items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                <svg
                  className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Advanced options
              </button>
              {showAdvanced && (
                <div className="mt-3 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
                  <label
                    htmlFor="apiKey"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    HyperSync API Key{" "}
                    <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
                  </label>
                  <input
                    id="apiKey"
                    type="password"
                    placeholder="Enter your HyperSync API key"
                    value={apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
                  />
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Skip the queue by using your own API key.{" "}
                    <a
                      href="https://envio.dev/app/api-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-700 dark:decoration-zinc-600 dark:hover:text-zinc-300"
                    >
                      Get one free from Envio
                    </a>
                  </p>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            {/* Example contract - only show for ERC721 */}
            {!snapshot && !loading && tokenType === "erc721" && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>Try it out:</span>
                <button
                  onClick={() => handleFetch(network === "mainnet"
                    ? "0x9f8514cebee138b61806d4651f51d26c8098b463"
                    : "0x78eD9A576519024357aB06D9834266a04c9634b7"
                  )}
                  className="cursor-pointer font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-900 hover:decoration-zinc-500 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-zinc-100 dark:hover:decoration-zinc-400"
                >
                  The Daks
                </button>
              </div>
            )}

            {/* ERC20 info notice */}
            {!snapshot && !loading && tokenType === "erc20" && (
              <div className="rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Balances are shown as raw values (without decimal adjustment).
                </p>
              </div>
            )}
          </div>

          {loading && (
            <LoadingEntertainment elapsedTime={elapsedTime} />
          )}

          {snapshot && !loading && (
            <div className="mt-8 space-y-6">
              {/* Analytics Cards - conditional based on token type */}
              {snapshot.tokenType === "erc721" ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Total NFTs
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {snapshot.analytics.totalNfts.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Unique Owners
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {snapshot.analytics.uniqueOwners.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Snapshot Block
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {snapshot.snapshotBlock.toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : snapshot.tokenType === "erc1155" ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Total Holdings
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {snapshot.analytics.totalHoldings.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Unique Owners
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {snapshot.analytics.uniqueOwners.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Token Types
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {snapshot.analytics.uniqueTokenIds.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Snapshot Block
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {snapshot.snapshotBlock.toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Total Supply
                    </p>
                    <p className="mt-1 overflow-x-auto whitespace-nowrap font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatWithCommas(snapshot.analytics.totalSupply)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Holders
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                        {snapshot.analytics.holders.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Snapshot Block
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                        {snapshot.snapshotBlock.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Search and Preview */}
              <div>
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Preview
                  </h2>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder={
                        snapshot.tokenType === "erc721"
                          ? "Search by token ID or owner..."
                          : snapshot.tokenType === "erc1155"
                          ? "Search by address, token ID or balance..."
                          : "Search by address or balance..."
                      }
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500 sm:w-64"
                    />
                  </div>
                </div>

                <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {searchQuery ? (
                    <>
                      Found {filteredData.length.toLocaleString()} results
                      {filteredData.length > 50 && " (showing first 50)"}
                    </>
                  ) : (
                    <>
                      Showing first 50 of{" "}
                      {snapshot.data.length.toLocaleString()}
                    </>
                  )}
                </div>

                <div className="max-h-[500px] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-800">
                      <tr>
                        {snapshot.tokenType === "erc721" ? (
                          <>
                            <th className="px-4 py-2.5 text-left font-medium text-zinc-600 dark:text-zinc-400">
                              Token ID
                            </th>
                            <th className="px-4 py-2.5 text-left font-medium text-zinc-600 dark:text-zinc-400">
                              Owner
                            </th>
                          </>
                        ) : snapshot.tokenType === "erc1155" ? (
                          <>
                            <th className="px-4 py-2.5 text-left font-medium text-zinc-600 dark:text-zinc-400">
                              Address
                            </th>
                            <th className="px-4 py-2.5 text-left font-medium text-zinc-600 dark:text-zinc-400">
                              Token ID
                            </th>
                            <th className="px-4 py-2.5 text-right font-medium text-zinc-600 dark:text-zinc-400">
                              Balance
                            </th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-2.5 text-left font-medium text-zinc-600 dark:text-zinc-400">
                              Address
                            </th>
                            <th className="px-4 py-2.5 text-right font-medium text-zinc-600 dark:text-zinc-400">
                              Balance
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {filteredData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={snapshot.tokenType === "erc1155" ? 3 : 2}
                            className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                          >
                            No results found
                          </td>
                        </tr>
                      ) : snapshot.tokenType === "erc721" ? (
                        (filteredData as { tokenId: string; owner: string }[]).slice(0, 50).map((item) => (
                          <tr
                            key={item.tokenId}
                            className="bg-white dark:bg-zinc-900"
                          >
                            <td className="px-4 py-2.5 font-mono text-zinc-900 dark:text-zinc-100">
                              {item.tokenId}
                            </td>
                            <td className="px-4 py-2">
                              <CopyableAddress address={item.owner} />
                            </td>
                          </tr>
                        ))
                      ) : snapshot.tokenType === "erc1155" ? (
                        (filteredData as { address: string; tokenId: string; balance: string }[]).slice(0, 50).map((item, index) => (
                          <tr
                            key={`${item.address}-${item.tokenId}-${index}`}
                            className="bg-white dark:bg-zinc-900"
                          >
                            <td className="px-4 py-2">
                              <CopyableAddress address={item.address} />
                            </td>
                            <td className="px-4 py-2.5 font-mono text-zinc-900 dark:text-zinc-100">
                              {item.tokenId}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-zinc-900 dark:text-zinc-100">
                              {item.balance}
                            </td>
                          </tr>
                        ))
                      ) : (
                        (filteredData as { address: string; balance: string }[]).slice(0, 50).map((item) => (
                          <tr
                            key={item.address}
                            className="bg-white dark:bg-zinc-900"
                          >
                            <td className="px-4 py-2">
                              <CopyableAddress address={item.address} />
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-zinc-900 dark:text-zinc-100">
                              {item.balance}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={handleDownloadCSV}
                className="w-full cursor-pointer rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Download CSV
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-6 flex items-center justify-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
          <Link
            href="/about"
            className="transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            How it works
          </Link>
          <span>·</span>
          <span>
            Powered by{" "}
            <a
              href="https://envio.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-600 dark:decoration-zinc-600 dark:hover:text-zinc-300"
            >
              Envio HyperSync
            </a>
          </span>
        </footer>

      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-3xl">
          <div className="overflow-hidden rounded-2xl bg-zinc-900">
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="aspect-video w-full object-cover"
              src="/loading.mp4"
            />
          </div>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
