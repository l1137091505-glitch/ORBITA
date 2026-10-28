import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowUpRight, BarChart3, Check, CircleGauge, Coins, ExternalLink, Gauge, Layers3, LoaderCircle, Orbit, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { BOT_CHAIN, CONTRACT_ADDRESS, bot, connectWallet, injected, parseEther, readContract, short, writeContract } from "./chain";
import type { JsonRpcSigner } from "ethers";

type Mode = "deposit" | "withdraw" | "claim" | "compound" | "fund";
type Snapshot = { totalPrincipal: bigint; rewardReserve: bigint; totalPaid: bigint; principal: bigint; pending: bigint; updatedAt: number };

const PREVIEW: Snapshot = {
  totalPrincipal: parseEther("148240.75"),
  rewardReserve: parseEther("18240.42"),
  totalPaid: parseEther("7340.18"),
  principal: parseEther("24.5"),
  pending: parseEther("0.17382"),
  updatedAt: Math.floor(Date.now() / 1000) - 42,
};

const initialSnapshot: Snapshot = CONTRACT_ADDRESS ? {
  totalPrincipal: 0n, rewardReserve: 0n, totalPaid: 0n, principal: 0n, pending: 0n, updatedAt: 0,
} : PREVIEW;

function messageOf(error: unknown) {
  if (error && typeof error === "object") {
    const item = error as { code?: number; shortMessage?: string; reason?: string; message?: string };
    const message = item.shortMessage || item.reason || item.message || "Transaction failed.";
    if (item.code === 4001 || /user rejected|user denied/i.test(message)) return "Wallet request cancelled. Approve the connection in your wallet and try again.";
    if (item.code === 4100 || /not been authorized|unauthorized/i.test(message)) return "This site is not authorized yet. Open your wallet, approve this site, then connect again.";
    return message;
  }
  return String(error || "Transaction failed.");
}

function App() {
  const [account, setAccount] = useState("");
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("1");
  const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async (address = account) => {
    const contract = readContract();
    if (!contract) { setSnapshot(PREVIEW); return; }
    try {
      const [totalPrincipal, rewardReserve, totalPaid] = await Promise.all([
        contract.totalPrincipal(), contract.rewardReserve(), contract.totalRewardsPaid(),
      ]) as [bigint, bigint, bigint];
      let principal = 0n, pending = 0n, updatedAt = 0;
      if (address) {
        const position = await contract.getPosition(address) as [bigint, bigint, bigint];
        principal = position[0]; pending = position[1]; updatedAt = Number(position[2]);
      }
      setSnapshot({ totalPrincipal, rewardReserve, totalPaid, principal, pending, updatedAt });
    } catch (error) { setNotice(messageOf(error)); }
  }, [account]);

  const connect = useCallback(async () => {
    setBusy("connect"); setNotice("");
    try {
      const wallet = await connectWallet();
      setAccount(wallet.address); setSigner(wallet.signer);
      await refresh(wallet.address);
    } catch (error) { setNotice(messageOf(error)); }
    finally { setBusy(""); }
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const provider = injected();
    if (!provider?.on) return;
    const accountsChanged = (...args: unknown[]) => {
      const accounts = Array.isArray(args[0]) ? args[0] as string[] : [];
      if (!accounts[0]) { setAccount(""); setSigner(null); setSnapshot((s) => ({ ...s, principal: 0n, pending: 0n })); return; }
      void connect();
    };
    const chainChanged = () => { void connect(); };
    provider.on("accountsChanged", accountsChanged);
    provider.on("chainChanged", chainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
    };
  }, [connect]);

  const livePending = useMemo(() => {
    void tick;
    if (CONTRACT_ADDRESS || snapshot.principal === 0n) return snapshot.pending;
    const elapsed = BigInt(Math.max(0, Math.floor(Date.now() / 1000) - snapshot.updatedAt));
    return snapshot.pending + snapshot.principal * 1280n * elapsed / (10000n * 365n * 86400n);
  }, [snapshot, tick]);

  async function execute() {
    if (!signer) { await connect(); return; }
    if (!CONTRACT_ADDRESS) { setNotice("Preview mode is read-only. Deploy the contract and configure VITE_ORBITAL_ADDRESS first."); return; }
    setBusy(mode); setNotice("");
    try {
      const contract = writeContract(signer);
      let tx;
      if (mode === "deposit") tx = await contract.deposit({ value: parseEther(amount || "0") });
      else if (mode === "withdraw") tx = await contract.withdraw(parseEther(amount || "0"));
      else if (mode === "claim") tx = await contract.claim();
      else if (mode === "compound") tx = await contract.compound();
      else tx = await contract.fundRewards({ value: parseEther(amount || "0") });
      setNotice("Transaction submitted. Waiting for confirmation…");
      await tx.wait();
      setNotice("Confirmed on-chain.");
      await refresh(account);
    } catch (error) { setNotice(messageOf(error)); }
    finally { setBusy(""); }
  }

  const selectedValue = mode === "claim" || mode === "compound" ? bot(livePending, 6) : amount || "0";
  const primaryLabel = mode === "deposit" ? "ENTER ORBIT" : mode === "withdraw" ? "RETURN PRINCIPAL" : mode === "claim" ? "CLAIM REWARDS" : mode === "compound" ? "BOOST POSITION" : "FUND REWARD RESERVE";
  const canExecute = !busy && ((mode === "claim" || mode === "compound") ? livePending > 0n : Number(amount) > 0);

  return <div className="terminal-shell">
    <aside className="side-rail">
      <a className="rail-logo" href="#overview" aria-label="ORBITAL overview"><Orbit size={25}/><span>O</span></a>
      <nav>
        <a className="active" href="#overview"><CircleGauge size={20}/><span>Overview</span></a>
        <a href="#position"><Layers3 size={20}/><span>Position</span></a>
        <a href="#system"><BarChart3 size={20}/><span>System</span></a>
        <a href="#security"><ShieldCheck size={20}/><span>Security</span></a>
      </nav>
      <div className="rail-status"><i/><span>677</span></div>
    </aside>

    <div className="workspace">
      <header className="workspace-header">
        <div><small>ORBITAL / BOT YIELD TERMINAL</small><h1>Position overview</h1></div>
        <div className="header-actions"><span className="live-pill"><i/> BOT CHAIN LIVE</span><button onClick={connect} disabled={busy === "connect"}>{busy === "connect" ? <LoaderCircle className="spin" size={17}/> : <Wallet size={17}/>} {account ? short(account) : "Connect wallet"}</button></div>
      </header>

      {!CONTRACT_ADDRESS && <div className="terminal-alert"><strong>DEMO DATA</strong><span>Set VITE_ORBITAL_ADDRESS after contract deployment to enable transactions.</span></div>}

      <main className="dashboard" id="overview">
        <section className="balance-panel panel">
          <div className="panel-kicker"><span>MY ACTIVE PRINCIPAL</span><span>BOT / NATIVE</span></div>
          <div className="balance-row"><strong>{bot(snapshot.principal, 6)}</strong><b>BOT</b></div>
          <div className="delta"><ArrowUpRight size={15}/> 12.80% fixed APR <span>·</span> no lockup</div>
          <div className="chart" aria-label="decorative position chart"><svg viewBox="0 0 700 160" preserveAspectRatio="none"><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6b35" stopOpacity=".35"/><stop offset="1" stopColor="#ff6b35" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0,142 C70,125 92,132 145,108 C210,78 245,102 305,78 C370,52 410,65 462,40 C520,13 565,43 615,25 C652,12 680,17 700,5 L700,160 L0,160 Z"/><path className="line" d="M0,142 C70,125 92,132 145,108 C210,78 245,102 305,78 C370,52 410,65 462,40 C520,13 565,43 615,25 C652,12 680,17 700,5"/></svg><div className="chart-axis"><span>ENTRY</span><span>NOW</span></div></div>
        </section>

        <section className="reward-panel panel">
          <div className="panel-kicker"><span>LIVE REWARDS</span><Activity size={17}/></div>
          <strong className="reward-number">+{bot(livePending, 8)}</strong><span className="reward-unit">BOT</span>
          <div className="pulse-line"><i/><i/><i/><i/><i/><i/><i/><i/></div>
          <p>Accruing every second</p>
          <button onClick={() => setMode("claim")}>Prepare claim <ArrowUpRight size={16}/></button>
        </section>

        <section className="stats-stack" id="system">
          <article className="panel stat-card"><span>TOTAL PRINCIPAL</span><strong>{bot(snapshot.totalPrincipal)}</strong><small>BOT across all positions</small></article>
          <article className="panel stat-card reserve"><span>REWARD RESERVE</span><strong>{bot(snapshot.rewardReserve)}</strong><small>BOT currently claimable</small></article>
          <article className="panel stat-card"><span>REWARDS ROUTED</span><strong>{bot(snapshot.totalPaid)}</strong><small>BOT claimed + compounded</small></article>
        </section>

        <section className="action-panel panel" id="position">
          <div className="action-head"><div><span>ACTION DOCK</span><h2>{mode === "deposit" ? "Deposit BOT" : mode === "withdraw" ? "Withdraw principal" : mode === "claim" ? "Claim rewards" : mode === "compound" ? "Compound rewards" : "Fund reserve"}</h2></div><div className="mode-switch">{(["deposit","withdraw","claim","compound","fund"] as Mode[]).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div></div>
          <div className="action-grid">
            <div className="amount-module">
              <span>{mode === "claim" || mode === "compound" ? "AVAILABLE REWARD" : "AMOUNT"}</span>
              <div>{mode === "claim" || mode === "compound" ? <strong>{selectedValue}</strong> : <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label="BOT amount"/>}<b>BOT</b></div>
              <small>{mode === "fund" ? "Adds liquidity only to the reward reserve" : mode === "withdraw" ? `Available: ${bot(snapshot.principal, 6)} BOT` : "Native token · BOT Chain"}</small>
            </div>
            <div className="route-module"><span>ROUTE</span><div className="route-node"><i/><p>{mode === "fund" ? "PUBLIC REWARD RESERVE" : account ? short(account) : "WALLET NOT CONNECTED"}</p><ArrowDown size={16}/></div><div className="route-node destination"><i/><p>{mode === "withdraw" || mode === "claim" ? "CONNECTED WALLET" : mode === "fund" ? "ORBITAL RESERVE" : "ACTIVE POSITION"}</p><Check size={16}/></div></div>
            <div className="confirm-module"><CircleGauge size={25}/><p>{mode === "fund" ? "Reserve funding creates no ownership rights." : "Your wallet executes this transaction directly."}</p><button onClick={execute} disabled={!canExecute}>{busy ? <LoaderCircle className="spin" size={18}/> : <ArrowUpRight size={18}/>} {primaryLabel}</button><small>{notice || "Review the amount before confirming in your wallet."}</small></div>
          </div>
        </section>

        <section className="system-panel panel" id="security">
          <div className="system-title"><span>VAULT ARCHITECTURE</span><h2>Visible reserves.<br/>Withdrawable principal.</h2><p>The contract does not mint rewards. Claims are paid only from the public reserve, while principal remains separately accounted.</p></div>
          <div className="system-list"><div><Coins/><span><b>PRINCIPAL</b>Tracked per wallet</span><strong>{bot(snapshot.totalPrincipal)} BOT</strong></div><div><Gauge/><span><b>REWARD RATE</b>Constant annual rate</span><strong>12.80%</strong></div><div><Sparkles/><span><b>CHECKPOINT</b>Calculated on every action</span><strong>{snapshot.updatedAt ? new Date(snapshot.updatedAt * 1000).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "—"}</strong></div><div><ShieldCheck/><span><b>TRANSFER GUARD</b>Reentrancy protected</span><strong>ACTIVE</strong></div></div>
        </section>
      </main>

      <footer className="terminal-footer"><span>ORBITAL / NATIVE YIELD ARRAY</span><div><a href={BOT_CHAIN.explorer} target="_blank">Explorer <ExternalLink size={12}/></a><a href="https://botchain.ai" target="_blank">BOT Chain <ExternalLink size={12}/></a>{CONTRACT_ADDRESS && <a href={`${BOT_CHAIN.explorer}/address/${CONTRACT_ADDRESS}`} target="_blank">Contract <ExternalLink size={12}/></a>}</div><b>UNAUDITED · USE SMALL VALUES</b></footer>
    </div>
  </div>;
}

export default App;
