import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, CircleDollarSign, Coins, ExternalLink, Gauge, LoaderCircle, Orbit, RefreshCw, ShieldCheck, Sparkles, Wallet } from "lucide-react";
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
    const item = error as { shortMessage?: string; reason?: string; message?: string };
    return item.shortMessage || item.reason || item.message || "Transaction failed.";
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

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="ORBITAL home"><span className="brand-mark"><Orbit size={23}/></span><span>ORBITAL</span><small>NATIVE YIELD ARRAY</small></a>
      <nav><a href="#console">Console</a><a href="#protocol">Protocol</a><a href="#safety">Safety</a></nav>
      <button className="wallet-button" onClick={connect} disabled={busy === "connect"}>
        {busy === "connect" ? <LoaderCircle className="spin" size={18}/> : <Wallet size={18}/>}<span>{account ? short(account) : "Connect wallet"}</span>
      </button>
    </header>

    {!CONTRACT_ADDRESS && <div className="preview-strip"><span>PREVIEW SIGNAL</span> Deploy the vault and set <b>VITE_ORBITAL_ADDRESS</b> to activate live transactions.</div>}

    <main id="top">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">BOT CHAIN / BLOCK 677 / YIELD ONLINE</p>
          <h1>Put idle BOT<br/><em>into motion.</em></h1>
          <p className="lede">A transparent native-token position with rewards measured every second and controlled from one clean console.</p>
          <div className="hero-actions"><a className="button solid" href="#console">Open console <ArrowDownLeft size={18}/></a><a className="text-link" href="#protocol">Read the mechanics <ArrowUpRight size={16}/></a></div>
        </div>
        <div className="orbit-visual" aria-label="ORBITAL yield signal">
          <div className="orbit orbit-a"><span/></div><div className="orbit orbit-b"><span/></div><div className="orbit orbit-c"><span/></div>
          <div className="rate-core"><small>FIXED APR</small><strong>12.80</strong><span>%</span><i>PER SECOND ACCRUAL</i></div>
          <div className="coordinate top">R / 12.80</div><div className="coordinate bottom">T+ {String(tick).padStart(4, "0")} SEC</div>
        </div>
      </section>

      <section className="ticker-grid">
        <article><span>Total principal</span><strong>{bot(snapshot.totalPrincipal)} BOT</strong><small>secured in active positions</small></article>
        <article><span>Reward reserve</span><strong>{bot(snapshot.rewardReserve)} BOT</strong><small>available for claims</small></article>
        <article><span>Rewards routed</span><strong>{bot(snapshot.totalPaid)} BOT</strong><small>claimed or compounded</small></article>
        <article className="signal"><span>Network state</span><strong><i/> ONLINE</strong><small>BOT Chain · 677</small></article>
      </section>

      <section className="console-section" id="console">
        <div className="section-head"><div><p className="eyebrow red">POSITION CONTROL</p><h2>One position.<br/>Five clean moves.</h2></div><p>Principal stays distinct from the funded reward reserve. You choose when value enters, compounds, claims, or returns.</p></div>
        <div className="console-grid">
          <aside className="position-card">
            <div className="card-label">YOUR ORBIT</div>
            <div className="position-number"><span>ACTIVE PRINCIPAL</span><strong>{bot(snapshot.principal, 6)}</strong><i>BOT</i></div>
            <div className="pending-panel"><span>LIVE REWARDS</span><strong>+{bot(livePending, 8)} BOT</strong><small>updates every second</small></div>
            <dl><div><dt>Annual rate</dt><dd>12.80%</dd></div><div><dt>Lock period</dt><dd>None</dd></div><div><dt>Last checkpoint</dt><dd>{snapshot.updatedAt ? new Date(snapshot.updatedAt * 1000).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}) : "—"}</dd></div></dl>
          </aside>

          <div className="control-card">
            <div className="mode-tabs">
              {(["deposit","withdraw","claim","compound","fund"] as Mode[]).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}
            </div>
            <div className="control-body">
              <div className="control-title"><span>SELECTED MANEUVER</span><h3>{mode === "deposit" ? "Add BOT to your position" : mode === "withdraw" ? "Withdraw principal" : mode === "claim" ? "Route rewards to wallet" : mode === "compound" ? "Convert rewards to principal" : "Supply the reward reserve"}</h3></div>
              {mode !== "claim" && mode !== "compound" ? <label className="amount-field"><span>AMOUNT</span><div><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label="BOT amount"/><b>BOT</b></div></label> : <div className="claim-value"><span>AVAILABLE NOW</span><strong>{selectedValue} BOT</strong></div>}
              <div className="route-line"><div/><span>{mode === "fund" ? "PUBLIC RESERVE" : account ? short(account) : "WALLET NOT CONNECTED"}</span><ArrowUpRight size={17}/></div>
              <button className="execute-button" onClick={execute} disabled={!canExecute}>{busy ? <LoaderCircle className="spin" size={19}/> : <Orbit size={19}/>} {primaryLabel}</button>
              <p className="transaction-note">{notice || (mode === "fund" ? "Funding rewards does not create principal or ownership rights." : "Every transaction is executed directly by your connected wallet.")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="protocol-section" id="protocol">
        <div className="protocol-heading"><p className="eyebrow">THE FLIGHT PLAN</p><h2>Yield without<br/><em>the garden metaphor.</em></h2></div>
        <div className="steps">
          <article><span>01</span><Coins/><h3>Enter orbit</h3><p>Deposit native BOT. The contract records principal and starts a personal reward clock.</p></article>
          <article><span>02</span><Gauge/><h3>Accrue</h3><p>A fixed 12.8% annual rate is calculated continuously from your last checkpoint.</p></article>
          <article><span>03</span><Sparkles/><h3>Choose a route</h3><p>Claim rewards to the wallet, compound them into principal, or withdraw principal at any time.</p></article>
        </div>
      </section>

      <section className="safety-section" id="safety">
        <div><ShieldCheck size={34}/><p className="eyebrow red">SOLVENCY, NOT PROMISES</p><h2>Rewards have<br/>a visible fuel tank.</h2></div>
        <div className="safety-copy"><p>The vault cannot mint value. Rewards are paid only from a separately funded on-chain reserve. If the reserve is empty, principal remains withdrawable but claims must wait for new funding.</p><ul><li><Check size={16}/> Principal tracked separately</li><li><Check size={16}/> No owner withdrawal path</li><li><Check size={16}/> No lock period</li><li><Check size={16}/> Non-reentrant transfers</li></ul></div>
      </section>
    </main>

    <footer><div className="brand footer-brand"><span className="brand-mark"><Orbit size={20}/></span><span>ORBITAL</span></div><p>Native BOT yield, measured in motion.</p><div><a href={BOT_CHAIN.explorer} target="_blank">Explorer <ExternalLink size={13}/></a><a href="https://botchain.ai" target="_blank">BOT Chain <ExternalLink size={13}/></a>{CONTRACT_ADDRESS && <a href={`${BOT_CHAIN.explorer}/address/${CONTRACT_ADDRESS}`} target="_blank">Contract <ExternalLink size={13}/></a>}</div><small>UNAUDITED · USE SMALL VALUES</small></footer>
  </div>;
}

export default App;
