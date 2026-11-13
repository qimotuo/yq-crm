import { useEffect, useState } from 'react'
import { Card, Tag, Spin, Input, Button, message } from 'antd'
import { getContracts, generateContract } from '../../api'
import { hasOperation } from '../../utils/mobileAuth'
import { formatMoney } from '../../utils/helpers'

const STATUS_COLOR = { 正常: 'green', 一个月到期: 'gold', '30天后到期': 'gold', '10天到期': 'orange', '10天后到期': 'orange', 三天到期: 'red', '3天后到期': 'red', 已到期: 'red', 已逾期: 'red', 即将到期: 'orange', 待生成: 'default' }
const TEMPLATE_LABEL = { zhilian: '基米智连空白协议模板', jimi6: '基米网6%空白合同' }

export default function MobileContracts() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')

  const load = async (kw = keyword) => {
    setLoading(true)
    try {
      const res = await getContracts(kw ? { keyword: kw } : {})
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load('') }, [])

  return (
    <div>
      <div className="mobile-toolbar">
        <Input.Search
          placeholder="合同号 / 客户 / 工单号"
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={(v) => load(v)}
        />
      </div>
      <Spin spinning={loading}>
        {list.length === 0 && !loading && <div className="mobile-empty">暂无合同</div>}
        {list.map((item) => (
          <Card key={item.id} className="mobile-card" size="small">
            <div className="mobile-card__title">
              <strong>{item.contractNo || '待生成'}</strong>
              <Tag color={STATUS_COLOR[item.status] || 'default'}>{item.status}</Tag>
            </div>
            <div className="mobile-card__row"><span className="label">模板</span><span>{TEMPLATE_LABEL[item.templateKey] || item.templateKey || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">客户</span><span>{item.customerName}</span></div>
            <div className="mobile-card__row"><span className="label">签署人</span><span>{item.signerName || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">手机号</span><span>{item.signerPhone || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">身份证</span><span>{item.signerIdNo || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">签署日期</span><span>{item.signDate || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">门店</span><span>{item.storeName || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">套餐</span><span>{item.package || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">金额</span><span>{formatMoney(item.amount)}</span></div>
            <div className="mobile-card__row"><span className="label">周期</span><span>{item.startDate || '-'} 至 {item.endDate || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">工单</span><span>{item.orderNo || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">城市代码</span><span>{item.cityCode || '-'}</span></div>
            {item.status === '待生成' && hasOperation('contract:generate') && (
              <Button type="primary" size="small" block style={{ marginTop: 8 }} onClick={async () => {
                await generateContract(item.orderNo)
                message.success('合同已生成')
                load()
              }}>生成合同</Button>
            )}
          </Card>
        ))}
      </Spin>
    </div>
  )
}
