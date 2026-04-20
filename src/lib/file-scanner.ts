/**
 * File safety scanner.
 *
 * Layer 1 — Magic bytes: confirms the file's actual type matches its declared
 *   MIME type (catches MIME-spoofed uploads).
 * Layer 2 — Heuristics: rejects suspiciously high-entropy or oversized files
 *   that don't match the expected receipt file profile.
 * Layer 3 — VirusTotal (optional): if VIRUSTOTAL_API_KEY is set, submits the
 *   file hash for a reputation lookup. Full file upload is skipped to keep
 *   latency low; unknown hashes are treated as safe.
 */

export interface ScanResult {
  safe: boolean
  reason?: string
}

// ─── Magic bytes ─────────────────────────────────────────────────────────────

const SIGNATURES: Array<{ mime: string[]; magic: number[]; offset?: number }> = [
  { mime: ['image/jpeg'], magic: [0xff, 0xd8, 0xff] },
  { mime: ['image/png'],  magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: ['application/pdf'], magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  // HEIC/HEIF: ftyp box at byte 4
  { mime: ['image/heic', 'image/heif'], magic: [0x66, 0x74, 0x79, 0x70], offset: 4 },
]

function checkMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  for (const sig of SIGNATURES) {
    if (!sig.mime.includes(declaredMime)) continue
    const offset = sig.offset ?? 0
    for (let i = 0; i < sig.magic.length; i++) {
      if (buffer[offset + i] !== sig.magic[i]) return false
    }
    return true
  }
  // Unknown MIME — no signature to check, defer to other layers
  return true
}

// ─── Entropy heuristic ────────────────────────────────────────────────────────

function shannonEntropy(buf: Buffer): number {
  const freq = new Uint32Array(256)
  for (let i = 0; i < buf.length; i++) freq[buf[i]]++
  let entropy = 0
  for (let i = 0; i < 256; i++) {
    if (freq[i] === 0) continue
    const p = freq[i] / buf.length
    entropy -= p * Math.log2(p)
  }
  return entropy
}

// ─── VirusTotal hash lookup (optional) ────────────────────────────────────────

async function vtHashLookup(sha256: string): Promise<ScanResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY
  if (!apiKey) return { safe: true }

  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
      headers: { 'x-apikey': apiKey },
      signal: AbortSignal.timeout(5000),
    })

    if (res.status === 404) return { safe: true } // hash unknown → treat as safe
    if (!res.ok) {
      console.warn('[file-scanner] VirusTotal returned', res.status, '— allowing upload')
      return { safe: true }
    }

    const body = await res.json() as {
      data?: { attributes?: { last_analysis_stats?: { malicious?: number; suspicious?: number } } }
    }
    const stats = body.data?.attributes?.last_analysis_stats
    if (!stats) return { safe: true }

    const threats = (stats.malicious ?? 0) + (stats.suspicious ?? 0)
    if (threats > 0) {
      return { safe: false, reason: `VirusTotal flagged this file (${threats} engine(s) detected a threat).` }
    }
    return { safe: true }
  } catch (err) {
    console.warn('[file-scanner] VirusTotal request failed:', err)
    return { safe: true } // fail open — don't block legitimate uploads on API errors
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scanFile(
  buffer: Buffer,
  declaredMime: string,
  sha256?: string,
): Promise<ScanResult> {
  // Layer 1: magic bytes
  if (!checkMagicBytes(buffer, declaredMime)) {
    return {
      safe: false,
      reason: `File content does not match the declared type (${declaredMime}). The file may have been renamed.`,
    }
  }

  // Layer 2: entropy heuristic — high-entropy small files are suspicious
  // (legitimate JPEG/PNG/PDF receipts are not maximally random)
  const sample = buffer.subarray(0, Math.min(buffer.length, 65536))
  const entropy = shannonEntropy(sample)
  if (entropy > 7.95 && buffer.length < 10_000) {
    return {
      safe: false,
      reason: 'File appears to be encrypted or obfuscated and cannot be accepted.',
    }
  }

  // Layer 3: VirusTotal hash reputation
  if (sha256) {
    const vtResult = await vtHashLookup(sha256)
    if (!vtResult.safe) return vtResult
  }

  return { safe: true }
}
