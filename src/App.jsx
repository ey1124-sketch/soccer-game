import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import { ref, onValue, set, get, push, runTransaction } from "firebase/database";
import { db } from "./firebase";

const KOREA_LABELS = ["0", "1", "2", "3+"];
const OPP_LABELS = ["0", "1", "2", "3+"];

const KOREA_INFO = { code: "kr", emoji: "🇰🇷" };

const COUNTRY_INFO = {
  체코: { code: "cz", emoji: "🇨🇿" },
  남아공: { code: "za", emoji: "🇿🇦" },
  브라질: { code: "br", emoji: "🇧🇷" },
  일본: { code: "jp", emoji: "🇯🇵" },
  미국: { code: "us", emoji: "🇺🇸" },
  독일: { code: "de", emoji: "🇩🇪" },
  프랑스: { code: "fr", emoji: "🇫🇷" },
  스페인: { code: "es", emoji: "🇪🇸" },
  잉글랜드: { code: "gb-eng", emoji: "🏴" },
  아르헨티나: { code: "ar", emoji: "🇦🇷" },
  우루과이: { code: "uy", emoji: "🇺🇾" },
  포르투갈: { code: "pt", emoji: "🇵🇹" },
  벨기에: { code: "be", emoji: "🇧🇪" },
  네덜란드: { code: "nl", emoji: "🇳🇱" },
  크로아티아: { code: "hr", emoji: "🇭🇷" },
  모로코: { code: "ma", emoji: "🇲🇦" },
  가나: { code: "gh", emoji: "🇬🇭" },
  튀니지: { code: "tn", emoji: "🇹🇳" },
  카메룬: { code: "cm", emoji: "🇨🇲" },
  세네갈: { code: "sn", emoji: "🇸🇳" },
  사우디아라비아: { code: "sa", emoji: "🇸🇦" },
  이란: { code: "ir", emoji: "🇮🇷" },
  호주: { code: "au", emoji: "🇦🇺" },
  캐나다: { code: "ca", emoji: "🇨🇦" },
  멕시코: { code: "mx", emoji: "🇲🇽" },
  콜롬비아: { code: "co", emoji: "🇨🇴" },
  에콰도르: { code: "ec", emoji: "🇪🇨" },
  폴란드: { code: "pl", emoji: "🇵🇱" },
  스위스: { code: "ch", emoji: "🇨🇭" },
  덴마크: { code: "dk", emoji: "🇩🇰" },
  세르비아: { code: "rs", emoji: "🇷🇸" },
  우크라이나: { code: "ua", emoji: "🇺🇦" },
  이탈리아: { code: "it", emoji: "🇮🇹" },
};

function countryInfo(name) {
  const key = (name || "").trim();
  if (key === "한국") return KOREA_INFO;
  return COUNTRY_INFO[key] || null;
}

function scoreToBucket(score) {
  const n = Number(score);
  if (Number.isNaN(n) || n < 0) return 0;
  return n >= 3 ? 3 : n;
}

function cellKeyOf(koreaBucket, oppBucket) {
  return `한국${koreaBucket}-상대${oppBucket}`;
}

function bucketFromKey(key) {
  const m = /^한국(\d)-상대(\d)$/.exec(key || "");
  if (!m) return { k: 0, o: 0 };
  return { k: Number(m[1]), o: Number(m[2]) };
}

function humanCell(key) {
  const { k, o } = bucketFromKey(key);
  return `한국 ${KOREA_LABELS[k]} : 상대 ${OPP_LABELS[o]}`;
}

function emptyCells() {
  const cells = {};
  for (let k = 0; k < 4; k++) {
    for (let o = 0; o < 4; o++) {
      cells[cellKeyOf(k, o)] = [];
    }
  }
  return cells;
}

function findNameCellKey(cells, name) {
  for (const key of Object.keys(cells || {})) {
    if ((cells[key] || []).includes(name)) return key;
  }
  return null;
}

function normalizeGame(g) {
  if (!g) return null;
  return { ...g, cells: { ...emptyCells(), ...(g.cells || {}) } };
}

function formatDate(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function Overlay({ children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-4 w-full max-w-sm">{children}</div>
    </div>
  );
}

function FlagImg({ name, className }) {
  const [failed, setFailed] = useState(false);
  const info = countryInfo(name);
  if (!info) return null;
  if (failed) return <span className={className}>{info.emoji}</span>;
  return (
    <img
      src={`https://flagcdn.com/${info.code}.svg`}
      alt=""
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">불러오는 중...</p>
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() => {
    const colors = ["#f87171", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f472b6"];
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: colors[i % colors.length],
      delay: Math.random() * 0.4,
      duration: 1.6 + Math.random() * 1.2,
      rotate: Math.random() * 360,
    }));
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: "-10%",
            left: `${p.left}%`,
            width: 8,
            height: 8,
            backgroundColor: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(220px) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState(null);
  const [history, setHistory] = useState([]);
  const [myName, setMyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [opponentInput, setOpponentInput] = useState("");
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const [nameModal, setNameModal] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [moveConfirm, setMoveConfirm] = useState(null);
  const [withdrawConfirm, setWithdrawConfirm] = useState(null);
  const [koreaScoreInput, setKoreaScoreInput] = useState("");
  const [opponentScoreInput, setOpponentScoreInput] = useState("");
  const [editingResult, setEditingResult] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);

  const hasLoadedOnceRef = useRef(false);
  const prevLockedRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("my-name");
    if (saved) setMyName(saved);
  }, []);

  useEffect(() => {
    const gameRef = ref(db, "current-game");
    const unsub = onValue(
      gameRef,
      (snap) => {
        const normalized = normalizeGame(snap.val());
        if (
          hasLoadedOnceRef.current &&
          normalized?.locked &&
          !prevLockedRef.current &&
          normalized.lastWinners?.length > 0
        ) {
          setShowConfetti(true);
        }
        prevLockedRef.current = !!(normalized && normalized.locked);
        hasLoadedOnceRef.current = true;
        setGame(normalized);
        setLoading(false);
      },
      () => {
        setErrorMsg("실시간 연결에 문제가 발생했어요.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const historyRef = ref(db, "game-history");
    const unsub = onValue(historyRef, (snap) => {
      const val = snap.val() || {};
      const list = Object.values(val).sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
      setHistory(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(""), 4000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  useEffect(() => {
    if (!showConfetti) return;
    const t = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(t);
  }, [showConfetti]);

  function requestNewGame() {
    const opp = opponentInput.trim();
    if (!opp) {
      setErrorMsg("상대팀 이름을 입력해주세요.");
      return;
    }
    if (game && !game.locked) {
      setConfirmNewGame(true);
      return;
    }
    doStartNewGame();
  }

  const doStartNewGame = useCallback(async () => {
    const opp = opponentInput.trim();
    setConfirmNewGame(false);
    setBusy(true);
    try {
      const snap = await get(ref(db, "current-game"));
      const latest = snap.val();
      if (latest && latest.result) {
        await push(ref(db, "game-history"), {
          opponent: latest.opponent,
          finalScore: `${latest.result.koreaScore}:${latest.result.opponentScore}`,
          winners: latest.lastWinners || [],
          finishedAt: Date.now(),
        });
      }
      await set(ref(db, "current-game"), {
        opponent: opp,
        cells: emptyCells(),
        result: null,
        locked: false,
        lastWinners: null,
        createdAt: Date.now(),
      });
      setOpponentInput("");
      setKoreaScoreInput("");
      setOpponentScoreInput("");
      setEditingResult(false);
      setShowConfetti(false);
    } catch {
      setErrorMsg("저장 중 문제가 발생했어요. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }, [opponentInput]);

  function openNameModal(cellKey) {
    if (!game || game.locked || busy) return;
    const existingKeyForMe = myName ? findNameCellKey(game.cells, myName) : null;
    if (existingKeyForMe === cellKey) {
      setWithdrawConfirm({ cellKey, name: myName });
      return;
    }
    setNameInput(myName || "");
    setNameModal({ cellKey });
  }

  function submitName() {
    const name = nameInput.trim();
    if (!name) {
      setErrorMsg("이름을 입력해주세요.");
      return;
    }
    const cellKey = nameModal.cellKey;
    setNameModal(null);
    setBusy(true);
    let abortReason = null;
    let moveInfo = null;
    runTransaction(ref(db, "current-game"), (latest) => {
      abortReason = null;
      moveInfo = null;
      if (!latest || latest.locked) {
        abortReason = "locked";
        return;
      }
      const cells = { ...emptyCells(), ...(latest.cells || {}) };
      const existingKey = findNameCellKey(cells, name);
      if (existingKey && existingKey !== cellKey) {
        abortReason = "move";
        moveInfo = { name, fromKey: existingKey, toKey: cellKey };
        return;
      }
      const arr = [...(cells[cellKey] || [])];
      if (!arr.includes(name)) arr.push(name);
      cells[cellKey] = arr;
      return { ...latest, cells };
    })
      .then(({ committed }) => {
        if (committed) {
          setMyName(name);
          localStorage.setItem("my-name", name);
        } else if (abortReason === "move") {
          setMoveConfirm(moveInfo);
        } else if (abortReason === "locked") {
          setErrorMsg("이미 결과가 확정된 게임이에요.");
        }
      })
      .catch(() => setErrorMsg("저장 중 문제가 발생했어요. 다시 시도해주세요."))
      .finally(() => setBusy(false));
  }

  function confirmMove() {
    const { name, fromKey, toKey } = moveConfirm;
    setMoveConfirm(null);
    setBusy(true);
    let abortReason = null;
    runTransaction(ref(db, "current-game"), (latest) => {
      abortReason = null;
      if (!latest || latest.locked) {
        abortReason = "locked";
        return;
      }
      const cells = { ...emptyCells(), ...(latest.cells || {}) };
      cells[fromKey] = (cells[fromKey] || []).filter((n) => n !== name);
      const arr = [...(cells[toKey] || [])];
      if (!arr.includes(name)) arr.push(name);
      cells[toKey] = arr;
      return { ...latest, cells };
    })
      .then(({ committed }) => {
        if (committed) {
          setMyName(name);
          localStorage.setItem("my-name", name);
        } else if (abortReason === "locked") {
          setErrorMsg("이미 결과가 확정된 게임이에요.");
        }
      })
      .catch(() => setErrorMsg("저장 중 문제가 발생했어요. 다시 시도해주세요."))
      .finally(() => setBusy(false));
  }

  function confirmWithdraw() {
    const { cellKey, name } = withdrawConfirm;
    setWithdrawConfirm(null);
    setBusy(true);
    runTransaction(ref(db, "current-game"), (latest) => {
      if (!latest || latest.locked) return;
      const cells = { ...emptyCells(), ...(latest.cells || {}) };
      cells[cellKey] = (cells[cellKey] || []).filter((n) => n !== name);
      return { ...latest, cells };
    })
      .catch(() => setErrorMsg("저장 중 문제가 발생했어요. 다시 시도해주세요."))
      .finally(() => setBusy(false));
  }

  function submitResult() {
    const kStr = String(koreaScoreInput).trim();
    const oStr = String(opponentScoreInput).trim();
    const k = Number(kStr);
    const o = Number(oStr);
    if (kStr === "" || oStr === "" || Number.isNaN(k) || Number.isNaN(o) || k < 0 || o < 0) {
      setErrorMsg("올바른 점수를 입력해주세요.");
      return;
    }
    setBusy(true);
    let winnersOut = [];
    runTransaction(ref(db, "current-game"), (latest) => {
      if (!latest) return;
      const cells = { ...emptyCells(), ...(latest.cells || {}) };
      const cellKey = cellKeyOf(scoreToBucket(k), scoreToBucket(o));
      winnersOut = cells[cellKey] || [];
      return {
        ...latest,
        cells,
        result: { koreaScore: k, opponentScore: o },
        locked: true,
        lastWinners: winnersOut,
      };
    })
      .then(({ committed }) => {
        if (committed) {
          setShowConfetti(winnersOut.length > 0);
          setEditingResult(false);
        }
      })
      .catch(() => setErrorMsg("저장 중 문제가 발생했어요. 다시 시도해주세요."))
      .finally(() => setBusy(false));
  }

  function startEditResult() {
    if (!game || !game.result) return;
    setKoreaScoreInput(String(game.result.koreaScore));
    setOpponentScoreInput(String(game.result.opponentScore));
    setEditingResult(true);
    setShowConfetti(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-3 sm:p-6">
      <div className="max-w-md mx-auto">
        <div className="flex justify-end mb-1">
          <button
            onClick={() => setIsAdminMode((v) => !v)}
            className="text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full px-2 py-1"
          >
            ⚙️ {isAdminMode ? "보기 모드로 전환" : "운영자 모드로 전환"}
          </button>
        </div>
        <div className="text-center mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center justify-center gap-1.5 flex-wrap">
            <span>⚽</span>
            {game ? (
              <>
                <FlagImg name="한국" className="h-5 w-auto rounded-sm shadow-sm" />
                <span>한국</span>
                <span className="text-gray-400 text-base">vs</span>
                <FlagImg name={game.opponent} className="h-5 w-auto rounded-sm shadow-sm" />
                <span>{game.opponent}</span>
              </>
            ) : (
              <span>축구 경기 예측 게임</span>
            )}
          </h1>
          {game?.locked && (
            <span className="inline-block mt-1 text-xs font-medium text-white bg-gray-500 rounded-full px-2 py-0.5">
              경기 종료
            </span>
          )}
          <p className="text-[11px] text-gray-400 mt-1">
            🔗 이 게임판은 같은 링크로 접속하는 모든 사람에게 공유됩니다
          </p>
        </div>

        {errorMsg && (
          <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}

        {isAdminMode && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">새 게임 시작</div>
            <div className="flex gap-2">
              <input
                value={opponentInput}
                onChange={(e) => setOpponentInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestNewGame()}
                placeholder="경기 상대 (예: 체코)"
                maxLength={20}
                disabled={busy}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <button
                onClick={requestNewGame}
                disabled={busy}
                className="shrink-0 bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-50 active:scale-95"
              >
                새 게임 시작
              </button>
            </div>
          </div>
        )}

        {isAdminMode && game && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">경기 결과 입력</div>
            {!game.locked || editingResult ? (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">한국 득점</label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={koreaScoreInput}
                    onChange={(e) => setKoreaScoreInput(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm mt-1"
                  />
                </div>
                <span className="pb-2 text-gray-400">:</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">상대 득점</label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={opponentScoreInput}
                    onChange={(e) => setOpponentScoreInput(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm mt-1"
                  />
                </div>
                <button
                  onClick={submitResult}
                  disabled={busy}
                  className="bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-50"
                >
                  결과 확정
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  현재 결과:{" "}
                  <span className="font-semibold">
                    한국 {game.result.koreaScore} : 상대 {game.result.opponentScore}
                  </span>
                </div>
                <button onClick={startEditResult} className="text-xs text-blue-600 font-medium underline">
                  결과 수정
                </button>
              </div>
            )}
          </div>
        )}

        {game?.locked && game?.result && (
          <div
            className={`relative overflow-hidden mb-4 rounded-xl p-4 text-center ${
              game.lastWinners?.length > 0
                ? "bg-yellow-100 border-2 border-yellow-400"
                : "bg-gray-100 border border-gray-300"
            }`}
          >
            {showConfetti && <Confetti />}
            {game.lastWinners?.length > 0 ? (
              <p className="text-lg font-bold text-yellow-800">
                🎉 승자: {game.lastWinners.join(", ")} 🎉
              </p>
            ) : (
              <p className="text-base font-medium text-gray-600">
                이번 경기는 아무도 맞추지 못했어요!
              </p>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-4">
          {!game ? (
            <p className="text-sm text-gray-400 text-center py-8">
              아직 시작된 게임이 없어요.
              <br />
              상대팀을 입력하고 새 게임을 시작해주세요!
            </p>
          ) : (
            <div>
              <div className="flex mb-1">
                <div style={{ width: 28 }} />
                <div className="flex-1 flex items-center justify-center gap-1 text-sm font-bold text-gray-600">
                  <FlagImg name={game.opponent} className="h-4 w-auto rounded-sm" />
                  <span>{game.opponent} 득점 →</span>
                </div>
              </div>
              <div className="flex gap-1">
                <div className="flex flex-col items-center justify-center gap-1" style={{ width: 22 }}>
                  <FlagImg name="한국" className="h-4 w-auto rounded-sm" />
                  <div className="text-sm font-bold text-gray-600" style={{ writingMode: "vertical-rl" }}>
                    한국 득점 ↓
                  </div>
                </div>
                <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: "24px repeat(4, 1fr)" }}>
                  <div />
                  {OPP_LABELS.map((lab, oi) => (
                    <div key={oi} className="text-center text-xs font-semibold text-gray-500 pb-1">
                      {lab}
                    </div>
                  ))}
                  {KOREA_LABELS.map((klab, ki) => (
                    <Fragment key={ki}>
                      <div className="flex items-center justify-center text-xs font-semibold text-gray-500">
                        {klab}
                      </div>
                      {OPP_LABELS.map((_, oi) => {
                        const key = cellKeyOf(ki, oi);
                        const names = game.cells[key] || [];
                        const isMine = !!myName && names.includes(myName);
                        const isWinnerCell =
                          game.locked &&
                          game.result &&
                          scoreToBucket(game.result.koreaScore) === ki &&
                          scoreToBucket(game.result.opponentScore) === oi;
                        return (
                          <button
                            key={oi}
                            disabled={game.locked || busy}
                            onClick={() => openNameModal(key)}
                            className={[
                              "min-h-[52px] rounded-lg border text-[11px] leading-tight p-1 break-words transition",
                              isWinnerCell
                                ? "bg-yellow-300 border-red-500 ring-2 ring-red-500 font-bold"
                                : isMine
                                ? "bg-blue-50 border-blue-400 ring-1 ring-blue-400"
                                : "bg-gray-50 border-gray-200",
                              game.locked ? "cursor-not-allowed opacity-90" : "active:scale-95",
                            ].join(" ")}
                          >
                            {names.length === 0 ? (
                              <span className="text-gray-300">-</span>
                            ) : (
                              names.map((n, i) => <div key={i}>{n}</div>)
                            )}
                          </button>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-1">📌 사용법</p>
          <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-gray-400 leading-relaxed">
            <li>예상하는 스코어 칸을 클릭하고 이름을 입력하면 등록됩니다.</li>
            <li>한 사람은 한 칸에만 참여할 수 있어요. 다른 칸을 클릭하면 기존 참여를 옮길 수 있어요.</li>
            <li>경기가 끝나면 실제 스코어에 해당하는 칸의 참가자들이 승자로 표시됩니다.</li>
            <li>본인이 등록한 칸을 다시 클릭하면 참여를 취소할 수 있어요.</li>
          </ol>
        </div>

        {history.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-4">
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="w-full flex items-center justify-between text-sm font-semibold text-gray-700"
            >
              <span>지난 경기 기록 ({history.length})</span>
              <span>{showHistory ? "▲" : "▼"}</span>
            </button>
            {showHistory && (
              <ul className="mt-2 space-y-2 text-sm text-gray-600">
                {history.map((h, i) => (
                  <li key={i} className="border-t border-gray-100 pt-2">
                    <div className="font-medium text-gray-700">
                      한국 vs {h.opponent} — {h.finalScore}
                    </div>
                    <div className="text-xs text-gray-400">
                      승자: {h.winners?.length ? h.winners.join(", ") : "없음"} · {formatDate(h.finishedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {confirmNewGame && (
        <Overlay>
          <p className="text-sm text-gray-700 mb-4">현재 게임이 아직 끝나지 않았어요. 새로 시작하시겠어요?</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirmNewGame(false)} className="px-3 py-2 text-sm rounded-lg border">
              취소
            </button>
            <button onClick={doStartNewGame} className="px-3 py-2 text-sm rounded-lg bg-green-600 text-white">
              새로 시작
            </button>
          </div>
        </Overlay>
      )}

      {nameModal && (
        <Overlay>
          <p className="text-sm font-semibold text-gray-700 mb-2">{humanCell(nameModal.cellKey)} 칸에 참여</p>
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitName()}
            placeholder="이름을 입력해주세요"
            maxLength={20}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setNameModal(null)} className="px-3 py-2 text-sm rounded-lg border">
              취소
            </button>
            <button onClick={submitName} className="px-3 py-2 text-sm rounded-lg bg-green-600 text-white">
              등록
            </button>
          </div>
        </Overlay>
      )}

      {moveConfirm && (
        <Overlay>
          <p className="text-sm text-gray-700 mb-4">
            이미 <b>{humanCell(moveConfirm.fromKey)}</b> 칸에 참여하셨어요.
            <br />
            <b>{humanCell(moveConfirm.toKey)}</b> 칸으로 옮기시겠어요?
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setMoveConfirm(null)} className="px-3 py-2 text-sm rounded-lg border">
              취소
            </button>
            <button onClick={confirmMove} className="px-3 py-2 text-sm rounded-lg bg-green-600 text-white">
              이 칸으로 옮기기
            </button>
          </div>
        </Overlay>
      )}

      {withdrawConfirm && (
        <Overlay>
          <p className="text-sm text-gray-700 mb-4">
            <b>{humanCell(withdrawConfirm.cellKey)}</b> 참여를 취소하시겠어요?
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setWithdrawConfirm(null)} className="px-3 py-2 text-sm rounded-lg border">
              아니요
            </button>
            <button onClick={confirmWithdraw} className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white">
              참여 취소
            </button>
          </div>
        </Overlay>
      )}

      {loading && <LoadingOverlay />}
    </div>
  );
}
