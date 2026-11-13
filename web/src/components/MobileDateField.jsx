import { DatePicker } from 'antd'
import dayjs from 'dayjs'

export function parseDateValue(str) {
  if (!str) return null
  const direct = dayjs(str)
  if (direct.isValid()) return direct
  const match = String(str).match(/\d{4}-\d{2}-\d{2}/)
  if (match) {
    const parsed = dayjs(match[0])
    if (parsed.isValid()) return parsed
  }
  return null
}

export function formatDateValue(value) {
  if (!value) return ''
  return value.format('YYYY-MM-DD')
}

/** 移动端日期选择，禁止手输 */
export default function MobileDateField({
  value,
  onChange,
  disabled,
  placeholder = '选择日期',
  allowClear = true,
  ...rest
}) {
  return (
    <DatePicker
      className="mobile-date-field"
      style={{ width: '100%' }}
      value={parseDateValue(value)}
      onChange={(d) => onChange?.(formatDateValue(d))}
      disabled={disabled}
      placeholder={placeholder}
      allowClear={allowClear}
      inputReadOnly
      {...rest}
    />
  )
}
