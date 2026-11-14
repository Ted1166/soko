import { useState } from "react";

import { RadioSheet } from "./components/RadioSheet";
import { TabBar, type Tab } from "./components/TabBar";
import { Toasts } from "./components/Toasts";
import { useGame } from "./game";
import { coins } from "./lib/format";
import { Ledger } from "./screens/Ledger";
import { Limits } from "./screens/Limits";
import { Stall } from "./screens/Stall";
import { Town } from "./screens/Town";
import { Welcome } from "./screens/Welcome";

export function App() {
  const { token, snapshot, activeCall, decide, deciding, live, error, blocks, leave } = useGame();
  const [tab, setTab] = useState<Tab>("town");

  if (!token) {
    return (
      <div className="frame">
        <Welcome />
        <Toasts />
      </div>
    );
  }

  return (
    <div className="frame">
      <header className="top">
        <div className="top-main">
          <h1 className="top-name">{snapshot?.stall?.name ?? "Soko"}</h1>
          <p className="top-worth">{snapshot ? coins(snapshot.netWorth) : "Loading your stall…"}</p>
        </div>
        <div className="top-side">
          <span className={`live${live ? " is-live" : ""}`}>{live ? "Live" : "Reconnecting"}</span>
          <button type="button" className="btn btn-quiet" onClick={leave}>
            Leave
          </button>
        </div>
      </header>

      {error ? (
        <p className="banner" role="alert">
          {error}
        </p>
      ) : null}

      <main className="page">
        {!snapshot ? (
          <p className="empty">Walking to your stall…</p>
        ) : tab === "town" ? (
          <Town />
        ) : tab === "stall" ? (
          <Stall />
        ) : tab === "limits" ? (
          <Limits />
        ) : (
          <Ledger />
        )}
      </main>

      <TabBar tab={tab} onChange={setTab} badge={blocks.length} />

      {activeCall ? (
        <RadioSheet call={activeCall.call} endsAt={activeCall.endsAt} busy={deciding} onDecide={(d) => void decide(d)} />
      ) : null}
      <Toasts />
    </div>
  );
}
