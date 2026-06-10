import { message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { Button } from 'antd'

export default function ExportButton({ filename = 'export.csv', label = '导出' }) {
  const handleExport = () => {
    message.success(`演示：${filename} 导出成功`)
  }
  return <Button icon={<DownloadOutlined />} onClick={handleExport}>{label}</Button>
}
