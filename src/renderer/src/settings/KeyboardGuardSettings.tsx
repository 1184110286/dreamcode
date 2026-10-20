import { Shield } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import type { KeyboardGuardConfig } from '@/lib/store/settings'
import { isWindows } from '@/lib/utils/env'

export function KeyboardGuardSettings({
  value,
  onChange
}: {
  value: KeyboardGuardConfig
  onChange: (value: KeyboardGuardConfig) => void
}) {
  if (!isWindows) return null

  const update = (changes: Partial<KeyboardGuardConfig>) => {
    onChange({ ...value, ...changes })
  }

  return (
    <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
      <h2 className="text-lg font-semibold mb-2 flex items-center">
        <Shield className="h-5 w-5 mr-2" />
        Windows 键盘防护
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
        开启后会屏蔽选中的 Ctrl 键及其组合键。DreamCode 已配置的 Ctrl 快捷键会在应用内处理，
        其余组合不会继续传给其他应用。编辑 DreamCode 输入框时会临时暂停防护。
      </p>

      <div className="flex items-center justify-between py-2">
        <div>
          <div className="font-medium">启用键盘防护</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            关闭时不拦截任何按键；开启后下面的左右 Ctrl 配置生效。
          </div>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(checked) => update({ enabled: checked })}
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
            disabled={!value.enabled}
            onCheckedChange={(checked) => update({ blockLeftCtrl: checked })}
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
            disabled={!value.enabled}
            onCheckedChange={(checked) => update({ blockRightCtrl: checked })}
            aria-label="屏蔽右 Ctrl"
          />
        </label>
      </div>
    </div>
  )
}
