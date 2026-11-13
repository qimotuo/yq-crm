import { message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { Button } from 'antd'

function escapeCsv(value) {
  const s = value == null ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * 真 CSV 导出：传入当前（已按数据权限过滤的）列表与 antd columns，
 * 仅导出带 dataIndex 的列；带 BOM 兼容 Excel 中文。
 */
export default function ExportButton({ filename = 'export.csv', label = '导出', data = [], columns = [] }) {
  const handleExport = () => {
    const rows = Array.isArray(data) ? data : []
    if (!rows.length) {
      message.warning('暂无数据可导出')
      return
    }
    const cols = (columns || []).filter((c) => c && c.dataIndex)
    if (!cols.length) {
      message.warning('未配置导出列')
      return
    }
    const header = cols.map((c) => escapeCsv(c.title)).join(',')
    const lines = rows.map((r) =>
      cols.map((c) => escapeCsv(r?.[c.dataIndex])).join(','),
    )
    const csv = `\ufeff${[header, ...lines].join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    message.success(`已导出 ${rows.length} 条`)
  }
  return <Button icon={<DownloadOutlined />} onClick={handleExport}>{label}</Button>
}
