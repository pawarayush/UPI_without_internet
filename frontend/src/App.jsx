import React, { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [meshState, setMeshState] = useState({ devices: [], idempotencyCacheSize: 0 });
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const [senderVpa, setSenderVpa] = useState('alice@demo');
  const [receiverVpa, setReceiverVpa] = useState('bob@demo');
  const [amount, setAmount] = useState('500');
  const [pin, setPin] = useState('1234');

  const addLog = (msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  };

  const fetchState = async () => {
    try {
      const [m, accs, txs] = await Promise.all([
        fetch('/api/mesh/state').then(r => r.json()),
        fetch('/api/accounts').then(r => r.json()),
        fetch('/api/transactions').then(r => r.json())
      ]);
      setMeshState(m);
      setAccounts(accs);
      setTransactions(txs);
    } catch (e) {
      console.error("Failed to fetch state", e);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSendPacket = async () => {
    const body = {
      senderVpa,
      receiverVpa,
      amount: parseFloat(amount),
      pin,
      ttl: 5,
      startDevice: 'phone-alice'
    };
    try {
      const r = await fetch('/api/demo/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(res => res.json());
      addLog(`📤 Packet ${r.packetId.substring(0,8)} encrypted & injected at ${r.injectedAt} (TTL ${r.ttl})`);
      addLog(`   ciphertext (truncated): ${r.ciphertextPreview}`);
      fetchState();
    } catch (e) {
      addLog(`❌ Failed to send packet: ${e.message}`);
    }
  };

  const handleGossip = async () => {
    try {
      const r = await fetch('/api/mesh/gossip', { method: 'POST' }).then(res => res.json());
      addLog(`🔄 Gossip: ${r.transfers} transfer(s) — ${JSON.stringify(r.deviceCounts)}`);
      fetchState();
    } catch (e) {
      addLog(`❌ Failed to gossip: ${e.message}`);
    }
  };

  const handleFlush = async () => {
    try {
      const r = await fetch('/api/mesh/flush', { method: 'POST' }).then(res => res.json());
      addLog(`📡 ${r.uploadsAttempted} bridge upload(s):`);
      r.results.forEach(res => {
        addLog(`   ${res.bridgeNode} packet ${res.packetId} → ${res.outcome}${res.reason ? ` (${res.reason})` : ''}`);
      });
      fetchState();
    } catch (e) {
      addLog(`❌ Failed to flush bridges: ${e.message}`);
    }
  };

  const handleReset = async () => {
    try {
      await fetch('/api/mesh/reset', { method: 'POST' });
      addLog('🗑 mesh + idempotency cache cleared');
      fetchState();
    } catch (e) {
      addLog(`❌ Failed to reset mesh: ${e.message}`);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>📡 UPI Offline Mesh</h1>
        <div className="subtitle">Live demonstration of zero-internet encrypted payments</div>
      </header>

      <div className="glass-panel">
        <h2>🎬 Control Center</h2>
        <div className="controls-grid">
          
          <div className="control-row">
            <span className="step-badge">1</span>
            <strong>Compose Payment</strong>
            <select value={senderVpa} onChange={e => setSenderVpa(e.target.value)}>
              <option value="alice@demo">alice@demo</option>
              <option value="bob@demo">bob@demo</option>
              <option value="carol@demo">carol@demo</option>
            </select>
            <span>→</span>
            <select value={receiverVpa} onChange={e => setReceiverVpa(e.target.value)}>
              <option value="bob@demo">bob@demo</option>
              <option value="carol@demo">carol@demo</option>
              <option value="alice@demo">alice@demo</option>
              <option value="dave@demo">dave@demo</option>
            </select>
            <span>₹</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '80px' }} />
            <span>PIN</span>
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} style={{ width: '60px' }} maxLength="4" />
            <button onClick={handleSendPacket}>📤 Inject into Mesh</button>
          </div>

          <div className="control-row">
            <span className="step-badge">2</span>
            <strong>Propagate via Gossip</strong>
            <span className="text-muted" style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>(Packets hop device-to-device)</span>
            <button className="secondary" onClick={handleGossip}>🔄 Run Gossip Round</button>
          </div>

          <div className="control-row">
            <span className="step-badge">3</span>
            <strong>Bridge to Network</strong>
            <span className="text-muted" style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>(Bridge node connects to 4G)</span>
            <button className="secondary" onClick={handleFlush}>📡 Upload to Backend</button>
          </div>

          <div className="control-row" style={{ marginTop: '0.5rem' }}>
            <button className="danger" onClick={handleReset}>🗑 Reset Demo</button>
          </div>

        </div>
      </div>

      <div className="grid-2">
        <div className="glass-panel">
          <h2>📱 Mesh Network State</h2>
          <div className="devices-list">
            {meshState.devices.map(d => (
              <div key={d.deviceId} className={`device-card ${d.hasInternet ? 'bridge' : 'offline'}`}>
                <div className="device-header">
                  <strong>{d.deviceId}</strong>
                  <span className={`status-badge ${d.hasInternet ? 'status-online' : 'status-offline'}`}>
                    {d.hasInternet ? '🌐 4G BRIDGE' : '🚫 OFFLINE'}
                  </span>
                </div>
                <div style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem'}}>
                  Holding {d.packetCount} packet(s)
                </div>
                <div className="packet-list">
                  {d.packetIds.map(id => (
                    <span key={id} className="packet-pill">{id}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel">
          <h2>🏦 Accounts & Balance</h2>
          <table>
            <thead>
              <tr>
                <th>VPA</th>
                <th>Holder</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.vpa}>
                  <td>{a.vpa}</td>
                  <td>{a.holderName}</td>
                  <td className="amount positive">₹{parseFloat(a.balance).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Idempotency Cache Size: {meshState.idempotencyCacheSize || 0}
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <h2>📜 Transaction Ledger</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>From</th>
              <th>To</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Bridge</th>
              <th>Hops</th>
              <th>Settled</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id}>
                <td style={{fontFamily: 'monospace', fontSize: '0.85rem'}}>{t.id}</td>
                <td>{t.senderVpa}</td>
                <td>{t.receiverVpa}</td>
                <td className="amount">₹{parseFloat(t.amount).toFixed(2)}</td>
                <td className={`text-${t.status}`}><strong>{t.status}</strong></td>
                <td>{t.bridgeNodeId || '-'}</td>
                <td>{t.hopCount}</td>
                <td style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>
                  {t.settledAt ? new Date(t.settledAt).toLocaleTimeString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-panel">
        <h2>🪵 Activity Log</h2>
        <div className="log-box">
          {logs.map((log, i) => (
            <div key={i} className="log-entry">{log}</div>
          ))}
          {logs.length === 0 && <div style={{opacity: 0.5}}>Awaiting activity...</div>}
        </div>
      </div>

    </div>
  );
}

export default App;
