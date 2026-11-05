#!/usr/bin/env node
// Appends every prompt you send to your coding agent to PROMPTS.md.
// Wired to the agent's "user prompt submitted" hook — see README.md.
// It must never break your session: on any error it exits quietly with code 0.

import { appendFileSync, readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const LOG = join(ROOT, 'PROMPTS.md')
// Antigravity only: which transcript entries were already logged. Not committed.
const SEEN = join(ROOT, 'scripts', '.logged-prompts')

const readStdin = async () => {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

const pad = (n) => String(n).padStart(2, '0')

// Antigravity's hooks do not receive the prompt, only the path of the conversation
// transcript. Every message you sent is in there, so we read the new ones from it.
const fromTranscript = (input) => {
  const path = input.transcriptPath.replace(/^~/, homedir())
  const seen = existsSync(SEEN) ? readFileSync(SEEN, 'utf8').split('\n') : []
  const entries = []

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    let step
    try { step = JSON.parse(line) } catch { continue } // blank or half-written line
    if (step.type !== 'USER_INPUT') continue

    const id = `${input.conversationId}:${step.step_index}`
    if (seen.includes(id)) continue

    const request = /<USER_REQUEST>\n?([\s\S]*?)\n?<\/USER_REQUEST>/.exec(step.content)
    entries.push({ id, prompt: request ? request[1] : step.content, at: new Date(step.created_at) })
  }
  return entries
}

try {
  const agent = process.argv[2] || 'agent'
  const input = JSON.parse(await readStdin())
  const entries = input.transcriptPath && input.prompt === undefined
    ? fromTranscript(input)
    : [{ prompt: input.prompt || '', at: new Date() }]

  for (const { id, prompt: rawPrompt, at } of entries) {
    const prompt = rawPrompt.trim()
    if (id) appendFileSync(SEEN, `${id}\n`)

    // Skip empties and agent commands (/clear, /model, ...): they are not part of the work.
    if (!prompt || (prompt.startsWith('/') && !prompt.includes('\n'))) continue

    const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
    const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`

    const previous = existsSync(LOG) ? readFileSync(LOG, 'utf8') : ''
    const dayHeading = previous.includes(`\n## ${day}\n`) ? '' : `\n## ${day}\n`
    const quoted = prompt.split('\n').map((line) => `> ${line}`).join('\n')

    appendFileSync(LOG, `${dayHeading}\n**${time} · ${agent}**\n\n${quoted}\n`)
  }
} catch {
  // A broken log must never block your work.
}

process.exit(0)
