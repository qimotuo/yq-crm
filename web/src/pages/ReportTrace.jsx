import { useState } from 'react'
import { Card, Steps, Empty, message } from 'antd'
import { traceQuery } from '../api'
import { ListToolbar, FilterInput, FilterSelect, QueryButton, ResetButton } from '../components/ListToolbar'

const traceTypes = [
  { value: 'mac', label: 'MAC 地址', placeholder: 'AA:BB:CC:DD:EE:01' },
  { value: 'iccid', label: 'SIM 卡号(ICCID)', placeholder: '89860123456789012345' },
  { value: 'customer', label: '客户名称', placeholder: '智慧社区A区物业' },
  { value: 'orderNo', label: '工单号', placeholder: 'GD-20261025-088' },
  { value: 'contractNo', label: '合同号', placeholder: 'SH20261105001' },
]

export default function ReportTrace() {
  const [type, setType] = useState('orderNo')
  const [value, setValue] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const runSearch = async (traceType, kw) => {
    if (!kw.trim()) return
    setLoading(true)
    try {
      const res = await traceQuery(traceType, kw.trim())
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!value.trim()) return message.warning('请输入查询值')
    await runSearch(type, value)
  }

  const onTypeChange = (traceType) => {
    setType(traceType)
    runSearch(traceType, value)
  }

  const handleReset = () => {
    setType('orderNo')
    setValue('')
    setResult(null)
  }

  const current = traceTypes.find((t) => t.value === type)

  return (
    <div>
      <div className="page-header">
        <h2>全链路追溯</h2>
        <p>输入 MAC / SIM / 客户 / 工单号 / 合同号，查看完整业务链路</p>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <ListToolbar
          nested
          filters={(
            <>
              <FilterSelect wide value={type} onChange={onTypeChange}
                options={traceTypes.map((t) => ({ value: t.value, label: t.label }))} />
              <FilterInput placeholder={current?.placeholder} value={value} onChange={(e) => setValue(e.target.value)} onPressEnter={handleSearch} />
              <QueryButton loading={loading} onClick={handleSearch}>追溯查询</QueryButton>
              <ResetButton onClick={handleReset} />
            </>
          )}
        />
        <div style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
          演示快捷输入：智慧社区 / GD-20261025-088 / AA:BB:CC / 898601 / SH20261105001
        </div>
      </Card>

      {result ? (
        <Card title={`链路结果：${result.key}`}>
          <Steps direction="vertical" current={result.steps.length - 1}
            items={result.steps.map((s) => ({ title: s, status: 'finish' }))} />
        </Card>
      ) : (
        <Empty description="输入关键字开始追溯" />
      )}
    </div>
  )
}
