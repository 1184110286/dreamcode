import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { isWindows } from '@/lib/utils/env'
import type { KeyboardGuardConfig, KeyboardGuardStatus } from '../../../shared/settings'

export function KeyboardGuardSettings({
  value,
  onChange
}: {
  value: KeyboardGuardConfig
  onChange: (value: KeyboardGuardConfig) => void | Promise<void>
}) {
  const [status, setStatus] = useState<KeyboardGuardStatus | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!isWindows) return

    let disposed = false
    window.api
      .keyboardGuardGetStatus()
      .then((next) => {
        if (!disposed) setStatus(next)
      })
      .catch(() => undefined)

    const unsubscribe = window.api.onKeyboardGuardStatus((next) => {
      if (!disposed) setStatus(next)
    })

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  if (!isWindows) return null

  const update = async (changes: Partial<KeyboardGuardConfig>) => {
    setUpdating(true)
    try {
      await onChange({ ...value, ...changes })
    } finally {
      setUpdating(false)
    }
  }

  const stateClass =
    status?.state === 'active'
      ? 'border-emerald-300/70 bg-emerald-50/70 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/30 dark:text-emerald-200'
      : status?.state === 'error' || status?.state === 'missing-helper'
        ? 'border-red-300/70 bg-red-50/70 text-red-800 dark:border-red-700/60 dark:bg-red-950/30 dark:text-red-200'
        : 'border-amber-300/70 bg-amber-50/70 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200'

  return (
    <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
      <h2 className="text-lg font-semibold mb-2 flex items-center">
        <Shield className="h-5 w-5 mr-2" />
        Windows 键盘防护
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        开启后会屏蔽选中的 Ctrl 键及其组合键。DreamCode 已配置的 Ctrl 快捷键会在应用内处理，
        其余组合不会继续传给其他应用。开关会立即保存并生效，无需再点页面底部的保存按钮。
      </p>

      <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${stateClass}`}>
        <span className="font-medium">运行状态：</span>
        {status?.message ?? '正在读取键盘防护状态…'}
      </div>

      <div className="flex items-center justify-between py-2">
        <div>
          <div className="font-medium">启用键盘防护</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            开启后会启动 Windows 系统级低级键盘钩子。
          </div>
        </div>
        <Switch
          checked={value.enabled}
          disabled={updating}
          onCheckedChange={(checked) => void update({ enabled: checked })}
          aria-label="启用键盘防护"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-lg border border-gray-200/70 dark:border-gray-700/70 p-4">
          <div>
            <div className="font-medium">屏蔽左 Ctrl</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">只拦截左 Ctrl 及其组合键。</div>
          </div>
          <Switch
            checked={value.blockLeftCtrl}
            disabled={!value.enabled || updating}
            onCheckedChange={(checked) => void update({ blockLeftCtrl: checked })}
            aria-label="屏蔽左 Ctrl"
          />
        </label>

        <label className="flex items-center justify-between rounded-lg border border-gray-200/70 dark:border-gray-700/70 p-4">
          <div>
            <div className="font-medium">屏蔽右 Ctrl</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">只拦截右 Ctrl 及其组合键。</div>
          </div>
          <Switch
            checked={value.blockRightCtrl}
            disabled={!value.enabled || updating}
            onCheckedChange={(checked) => void update({ blockRightCtrl: checked })}
            aria-label="屏蔽右 Ctrl"
          />
        </label>
      </div>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        如果状态显示“系统级键盘防护已生效”，但管理员权限运行的目标程序仍能收到按键，
        请让 DreamCode 与目标程序使用相同的权限级别后再测试。
      </p>
    </div>
  )
}
