import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Input, Button, Tabs, Tag, Spin, Collapse, message } from 'antd'
import MobileDateField from '../../components/MobileDateField'
import { PlusOutlined, CopyOutlined } from '@ant-design/icons'
import {
  searchInstallations, getMyWorkOrders, getMySalesOrders, getWorkOrders,
} from '../../api/workOrder'
import { formatInstallRecord, formatDispatchRecord, copyText } from '../../utils/mobileFormat'
import {
  hasOperation, isSales, isInstaller, canDispatch, getMobileUser,
} from '../../utils/mobileAuth'
import { h5Path } from '../../utils/basePath'

const DISPATCH_STATUS_COLOR = {
  待派工: 'default', 已派工: 'processing', 安装成功: 'success', 已安装: 'success',
  失败: 'error', 推迟安装: 'warning',
}

export default function MobileOrders() {
  const navigate = useNavigate()
  const user = getMobileUser()
  const [tab, setTab] = useState('dispatch')
  const [dispatchList, setDispatchList] = useState([])
  const [dispatchLoading, setDispatchLoading] = useState(false)
  const [pendingList, setPendingList] = useState([])
  const [pendingLoading, setPendingLoading] = useState(false)

  const [customerName, setCustomerName] = useState('')
  const [mac, setMac] = useState('')
  const [imei, setImei] = useState('')
  const [iccid, setIccid] = useState('')
  const [installDate, setInstallDate] = useState('')
  const [registerList, setRegisterList] = useState([])
  const [registerLoading, setRegisterLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const loadPending = async () => {
    if (!canDispatch()) return
    setPendingLoading(true)
    try {
      const res = await getWorkOrders({ status: '待派工' })
      setPendingList(res.list || [])
    } finally {
      setPendingLoading(false)
    }
  }

  const loadDispatch = async () => {
    setDispatchLoading(true)
    try {
      if (isSales() && hasOperation('workorder:create')) {
        const res = await getMySalesOrders()
        setDispatchList(res.list || [])
      } else if (isInstaller() || hasOperation('workorder:install') || hasOperation('install:view')) {
        const res = await getMyWorkOrders({ installer: user?.name })
        setDispatchList(res.list || [])
      } else {
        const res = await getWorkOrders({})
        setDispatchList(res.list || [])
      }
    } finally {
      setDispatchLoading(false)
    }
  }

  useEffect(() => {
    loadDispatch()
    loadPending()
  }, [])

  const handleSearch = async () => {
    if (!customerName && !mac && !imei && !iccid && !installDate) {
      message.warning('请至少输入一项查询条件')
      return
    }
    setRegisterLoading(true)
    setSearched(true)
    try {
      const res = await searchInstallations({ customerName, installDate, mac, imei, iccid })
      setRegisterList(res.list || [])
    } finally {
      setRegisterLoading(false)
    }
  }

  const handleReset = () => {
    setCustomerName('')
    setMac('')
    setImei('')
    setIccid('')
    setInstallDate('')
    setRegisterList([])
    setSearched(false)
  }

  const isMine = (order) => user?.role === 'admin' || order.installer === user?.name

  const handleCopy = async (text) => {
    if (await copyText(text)) message.success('已复制')
    else message.error('复制失败')
  }

  const tabItems = [
    { key: 'dispatch', label: '安装派单' },
    ...(canDispatch() ? [{ key: 'pending', label: '待派工' }] : []),
    { key: 'register', label: '安装登记' },
  ]

  const emptyDispatchHint = hasOperation('workorder:create')
    ? '暂无派单，点击上方发安装单'
    : '暂无待处理派单'

  return (
    <div className="mobile-tab-panel">
      <Tabs activeKey={tab} onChange={setTab} items={tabItems} size="small" style={{ marginBottom: 8 }} />

      {tab === 'pending' && canDispatch() && (
        pendingLoading ? (
          <div className="mobile-loading"><Spin /></div>
        ) : pendingList.length === 0 ? (
          <div className="mobile-empty mobile-empty--fill">暂无待派工工单</div>
        ) : (
          pendingList.map((order) => (
            <Card key={order.id} className="mobile-card mobile-card--clickable" size="small"
              onClick={() => navigate(`${h5Path('orders/dispatch')}?id=${order.id}`)}>
              <div className="mobile-card__title">
                <strong>{order.orderNo}</strong>
                <Tag color="default">{order.status}</Tag>
              </div>
              <pre className="mobile-preview">{formatDispatchRecord(order)}</pre>
              <div className="mobile-card__row" style={{ fontSize: 12, color: '#999' }}>
                {order.salesName || '-'} · 点击派工
              </div>
            </Card>
          ))
        )
      )}

      {tab === 'dispatch' && (
        <div>
          {hasOperation('workorder:create') && (
            <Button type="primary" block icon={<PlusOutlined />} style={{ marginBottom: 12 }}
              onClick={() => navigate(`${h5Path('orders/dispatch')}?mode=create`)}>
              发安装单
            </Button>
          )}
          {dispatchLoading ? (
            <div className="mobile-loading"><Spin /></div>
          ) : dispatchList.length === 0 ? (
            <div className="mobile-empty mobile-empty--fill">{emptyDispatchHint}</div>
          ) : (
            dispatchList.map((order) => (
              <Card key={order.id} className="mobile-card mobile-card--clickable" size="small"
                onClick={() => navigate(`${h5Path('orders/dispatch')}?id=${order.id}`)}>
                <div className="mobile-card__title">
                  <strong>{order.orderNo}</strong>
                  <Tag color={DISPATCH_STATUS_COLOR[order.status] || 'default'}>{order.status}</Tag>
                </div>
                <pre className="mobile-preview">{formatDispatchRecord(order)}</pre>
                <div className="mobile-card__actions" onClick={(e) => e.stopPropagation()}>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(formatDispatchRecord(order))}>复制</Button>
                  <Button size="small" type="link">查看详情</Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'register' && (
        <div>
          {(hasOperation('workorder:install') || hasOperation('install:register')) && (
            <Button type="primary" block icon={<PlusOutlined />} style={{ marginBottom: 12 }}
              onClick={() => navigate(`${h5Path('orders/detail')}?mode=create`)}>
              新增安装登记
            </Button>
          )}
          <Collapse
            ghost
            items={[{
              key: 'search',
              label: '查询条件',
              children: (
                <div className="mobile-form-stack">
                  <Input placeholder="客户 / 门店名称" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  <MobileDateField value={installDate} onChange={setInstallDate} placeholder="安装日期" />
                  <Input placeholder="MAC" value={mac} onChange={(e) => setMac(e.target.value)} />
                  <Input placeholder="IMEI" value={imei} onChange={(e) => setImei(e.target.value)} />
                  <Input placeholder="主卡 / 备用卡 ICCID" value={iccid} onChange={(e) => setIccid(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button type="primary" loading={registerLoading} onClick={handleSearch}>查询</Button>
                    <Button onClick={handleReset}>清空</Button>
                  </div>
                </div>
              ),
            }]}
            style={{ marginBottom: 12, background: '#fff', borderRadius: 8 }}
          />
          {registerLoading ? (
            <div className="mobile-loading"><Spin /></div>
          ) : searched && registerList.length === 0 ? (
            <div className="mobile-empty mobile-empty--fill">未找到登记记录</div>
          ) : (
            registerList.map((order) => (
              <Card key={order.id} className="mobile-card mobile-card--clickable" size="small"
                onClick={() => isMine(order) && navigate(`${h5Path('orders/detail')}?id=${order.id}`)}>
                <pre className="mobile-preview">{formatInstallRecord(order)}</pre>
                <div className="mobile-card__row" style={{ fontSize: 12, color: '#999' }}>
                  {order.orderNo} · {order.status} · {order.installer || '-'}
                  {isMine(order) ? ' · 点击编辑' : ''}
                </div>
                <div className="mobile-card__actions" onClick={(e) => e.stopPropagation()}>
                  {isMine(order) && (
                    <Button size="small" onClick={() => navigate(`${h5Path('orders/detail')}?id=${order.id}`)}>编辑</Button>
                  )}
                  <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(formatInstallRecord(order))}>复制</Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
