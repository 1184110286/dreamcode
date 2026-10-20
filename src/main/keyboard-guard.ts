import { app, ipcMain } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { KeyboardGuardConfig, KeyboardGuardStatus } from '../shared/settings'

type ShortcutEntry = { action: string; key: string }

let config: KeyboardGuardConfig = {
  enabled: false,
  blockLeftCtrl: true,
  blockRightCtrl: false
}
let inputPaused = false
let shortcuts: ShortcutEntry[] = []
let helper: ChildProcess | null = null
let actionHandler: ((action: string) => void) | null = null
let restartTimer: NodeJS.Timeout | null = null
let status: KeyboardGuardStatus = {
  state: process.platform === 'win32' ? 'disabled' : 'unsupported',
  message: process.platform === 'win32' ? '键盘防护未启用' : '当前系统不支持 Windows 键盘防护',
  updatedAt: Date.now()
}

function helperPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'bin', 'windows-keyboard-guard.exe')
  }
  return join(app.getAppPath(), 'resources', 'bin', 'windows-keyboard-guard.exe')
}

function publishStatus(next: Omit<KeyboardGuardStatus, 'updatedAt'>): void {
  status = { ...next, updatedAt: Date.now() }
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('keyboard-guard-status', status)
}

function shouldRun(): boolean {
  return (
    process.platform === 'win32' &&
    config.enabled &&
    !inputPaused &&
    (config.blockLeftCtrl || config.blockRightCtrl)
  )
}

function stopHelper(): void {
  if (!helper) return
  helper.removeAllListeners()
  helper.kill()
  helper = null
}

function buildArgs(): string[] {
  const args = [
    config.blockLeftCtrl ? '--left' : '--no-left',
    config.blockRightCtrl ? '--right' : '--no-right'
  ]
  for (const shortcut of shortcuts) {
    if (!/(^|\+)(CommandOrControl|Control)(\+|$)/.test(shortcut.key)) continue
    args.push(
      '--shortcut',
      Buffer.from(`${shortcut.action}\t${shortcut.key}`, 'utf8').toString('base64')
    )
  }
  return args
}

function startHelper(): void {
  stopHelper()

  if (process.platform !== 'win32') {
    publishStatus({
      state: 'unsupported',
      message: '当前系统不支持 Windows 键盘防护'
    })
    return
  }
  if (!config.enabled) {
    publishStatus({
      state: 'disabled',
      message: '键盘防护未启用'
    })
    return
  }
  if (inputPaused) {
    publishStatus({
      state: 'paused',
      message: '正在编辑 DreamCode 输入框，键盘防护已临时暂停'
    })
    return
  }
  if (!config.blockLeftCtrl && !config.blockRightCtrl) {
    publishStatus({
      state: 'idle',
      message: '请至少选择左 Ctrl 或右 Ctrl'
    })
    return
  }

  const executable = helperPath()
  if (!existsSync(executable)) {
    const message = `找不到键盘防护辅助程序：${executable}`
    console.warn(message)
    publishStatus({
      state: 'missing-helper',
      message,
      helperPath: executable
    })
    return
  }

  try {
    publishStatus({
      state: 'starting',
      message: '正在启动系统级键盘防护…',
      helperPath: executable
    })

    const child = spawn(executable, buildArgs(), {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    helper = child

    let stdoutBuffer = ''
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdoutBuffer += chunk
      while (true) {
        const newline = stdoutBuffer.indexOf('\n')
        if (newline < 0) break
        const line = stdoutBuffer.slice(0, newline).trim()
        stdoutBuffer = stdoutBuffer.slice(newline + 1)

        if (line === 'READY') {
          publishStatus({
            state: 'active',
            message: '系统级键盘防护已生效',
            helperPath: executable
          })
          continue
        }
        if (!line.startsWith('ACTION\t')) continue
        const action = line.slice('ACTION\t'.length)
        if (action) actionHandler?.(action)
      }
    })

    let stderrBuffer = ''
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      stderrBuffer += chunk
      const message = chunk.trim()
      if (message) console.error(`keyboard-guard: ${message}`)
    })

    child.on('exit', (code) => {
      if (helper !== child) return
      helper = null
      if (!shouldRun()) return
      const detail = stderrBuffer.trim()
      const message =
        detail ||
        `键盘防护辅助程序意外退出（code=${code ?? 'unknown'}），请重新编译辅助程序后重试`
      console.warn(message)
      publishStatus({
        state: 'error',
        message,
        helperPath: executable
      })
    })

    child.on('error', (error) => {
      if (helper === child) helper = null
      const message = `无法启动键盘防护辅助程序：${error.message}`
      console.error(message)
      publishStatus({
        state: 'error',
        message,
        helperPath: executable
      })
    })
  } catch (error) {
    const message = `无法启动键盘防护辅助程序：${error instanceof Error ? error.message : String(error)}`
    console.error(message)
    publishStatus({
      state: 'error',
      message,
      helperPath: executable
    })
  }
}

function scheduleRestart(): void {
  if (restartTimer) clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    restartTimer = null
    startHelper()
  }, 40)
}

export function setKeyboardGuardConfig(next: KeyboardGuardConfig): void {
  config = { ...next }
  scheduleRestart()
}

export function setKeyboardGuardShortcuts(next: ShortcutEntry[]): void {
  shortcuts = next.map((shortcut) => ({ ...shortcut }))
  if (config.enabled) scheduleRestart()
}

export function setKeyboardGuardActionHandler(handler: (action: string) => void): void {
  actionHandler = handler
}

export function disposeKeyboardGuard(): void {
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
  stopHelper()
}

ipcMain.handle('keyboardGuard:getStatus', () => status)

ipcMain.handle('keyboardGuard:setInputPaused', (_event, paused: boolean) => {
  const next = Boolean(paused)
  if (inputPaused === next) return status
  inputPaused = next
  scheduleRestart()
  return status
})
