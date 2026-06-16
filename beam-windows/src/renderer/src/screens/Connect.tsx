import React, { useEffect, useState } from 'react'
import { GradientButton } from '../components/GradientButton'
import { DEFAULT_PORT } from '../../../shared/protocol'
import type { ConnectOptions } from '../../../shared/protocol'
import { loadRecents } from '../connect-store'
import { AGENT_PROMPT } from '../../../shared/agent-prompt'
import { QRCodeSVG } from 'qrcode.react'
import logo from '../assets/logo.png'

// Stable GitHub URL that 302-redirects to the latest release's Beam.apk asset, so the
// QR keeps working across future releases without regenerating it.
const APK_QR_URL = 'https://github.com/LioMatthys/Beam/releases/latest/download/Beam.apk'

interface Props {
  onConnect: (opts: ConnectOptions) => void
  error?: string
}

export function Connect({ onConnect, error }: Props): React.JSX.Element {
  const [host, setHost] = useState('')
  const [port, setPort] = useState(String(DEFAULT_PORT))
  const [code, setCode] = useState('')
  const recents = loadRecents()

  const [installMsg, setInstallMsg] = useState('')
  const [installing, setInstalling] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pcNet, setPcNet] = useState({ ip: '', ssid: '' })

  useEffect(() => {
    void window.beam.netInfo().then(setPcNet)
  }, [])

  const installAndroid = async (): Promise<void> => {
    setInstalling(true)
    setInstallMsg('Starting…')
    const off = window.beam.android.onProgress((p) =>
      setInstallMsg(p.percent != null ? `${p.message} ${p.percent}%` : p.message)
    )
    const r = await window.beam.android.install()
    off()
    setInstalling(false)
    if (!r.ok) setInstallMsg(`⚠ ${r.error}`)
  }

  const copyAgentPrompt = async (): Promise<void> => {
    await window.beam.copyText(AGENT_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const portNum = Number(port)
  const valid = host.trim().length > 0 && Number.isInteger(portNum) && portNum > 0 && portNum < 65536

  const submit = (): void => {
    if (!valid) return
    onConnect({ host: host.trim(), port: portNum, code: code.trim() })
  }

  return (
    <div className="screen">
      {/* Top-right hamburger menu. Fixed to the viewport so it stays put while scrolling. */}
      <button
        className="tbtn"
        aria-label="Menu"
        onClick={() => setMenuOpen((v) => !v)}
        style={{
          position: 'fixed',
          top: 14,
          right: 22,
          zIndex: 20,
          width: 40,
          height: 40,
          padding: 0,
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
        ☰
      </button>
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 19 }}
          />
          <div
            className="card"
            style={{ position: 'fixed', top: 60, right: 22, zIndex: 21, width: 280, padding: 16 }}>
            <label className="field-label">Install via USB</label>
            <p className="hint" style={{ margin: '6px 0 10px' }}>
              Connect the phone by USB (USB debugging on) — Beam installs and opens it
              automatically.
            </p>
            <button
              className="tbtn"
              style={{ width: '100%' }}
              onClick={installAndroid}
              disabled={installing}>
              {installing ? 'Working…' : 'Install on Android (USB)'}
            </button>
            {installMsg && (
              <div className="hint" style={{ marginTop: 10 }}>
                {installMsg}
              </div>
            )}

            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
            <label className="field-label">AI agent</label>
            <p className="hint" style={{ margin: '6px 0 10px' }}>
              Copy a ready-made prompt that teaches an AI agent to read and drive the phone
              over Beam.
            </p>
            <button className="tbtn" style={{ width: '100%' }} onClick={copyAgentPrompt}>
              {copied ? '✓ Copied!' : 'Copy instruction for agent'}
            </button>
          </div>
        </>
      )}

      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <img src={logo} width={72} height={72} alt="Beam" style={{ marginBottom: 8 }} />
        <div className="eyebrow">Receiver</div>
        <div className="title">
          <span className="brand-mark">Beam</span>
        </div>
        {pcNet.ip && (
          <div className="hint" style={{ marginTop: 8 }}>
            This PC{pcNet.ssid ? ` · ${pcNet.ssid}` : ''} · {pcNet.ip}
          </div>
        )}
      </div>

      <div className="card">
        <label className="field-label">Phone address (IP)</label>
        <input
          className="input"
          inputMode="decimal"
          placeholder="192.168.1.42"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />

        <div className="spacer-sm" />
        <div className="row">
          <div style={{ width: 120 }}>
            <label className="field-label">Port</label>
            <input className="input" value={port} onChange={(e) => setPort(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Code (6 digits)</label>
            <input
              className="input mono"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        </div>

        <div className="spacer-md" />
        <GradientButton label="Connect" onClick={submit} disabled={!valid} />

        {error && (
          <>
            <div className="spacer-sm" />
            <div className="error-text">{error}</div>
          </>
        )}

        {recents.length > 0 && (
          <>
            <div className="spacer-md" />
            <label className="field-label">Paired devices</label>
            {recents.map((r) => (
              <button
                key={`${r.host}:${r.port}`}
                className="tbtn"
                style={{ width: '100%', textAlign: 'left', marginBottom: 6 }}
                title={r.code ? 'Reconnect (code remembered)' : 'Fill address'}
                onClick={() => {
                  if (r.code) {
                    // Known device — reconnect in one click, no code typing.
                    onConnect({ host: r.host, port: r.port, code: r.code })
                  } else {
                    setHost(r.host)
                    setPort(String(r.port))
                  }
                }}
              >
                {r.device ? `${r.device} — ` : ''}
                {r.host}:{r.port}
                {r.code ? '  ·  ↻' : ''}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="spacer-md" />
      <div className="card" style={{ maxWidth: 420 }}>
        <button className="tbtn" style={{ width: '100%' }} onClick={() => setShowQr(true)}>
          Download the Android app
        </button>
      </div>

      {/* QR install popup. Click the backdrop (or Close) to dismiss. */}
      {showQr && (
        <div
          onClick={() => setShowQr(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 30,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'auto', maxWidth: 320, textAlign: 'center', padding: 24 }}>
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 20,
                display: 'flex',
                justifyContent: 'center'
              }}>
              <QRCodeSVG value={APK_QR_URL} size={200} bgColor="#ffffff" fgColor="#0f0f14" level="M" />
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Scan with your phone’s camera to install.
            </p>
            <div className="spacer-sm" />
            <button className="tbtn" style={{ width: '100%' }} onClick={() => setShowQr(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      <div className="spacer-md" />
      <p className="hint" style={{ maxWidth: 420, textAlign: 'center' }}>
        On the phone, open Beam and tap “Start sharing.” The IP address and code to enter here
        will appear on its screen.
      </p>
    </div>
  )
}
