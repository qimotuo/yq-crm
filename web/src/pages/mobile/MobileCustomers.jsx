import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Input, Button, Tabs, Tag, Spin, Collapse, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getCustomers, createCustomer, getPublicPool, claimCustomer } from '../../api'
import { Permission } from '../../components/RequireAuth'
import { hasOperation, isInstaller, hasMenu, getMobileUser } from '../../utils/mobileAuth'
import { h5Path } from '../../utils/basePath'

const STATUS_COLOR = { 正常: 'success', 中断合作: 'error', 待跟进: 'warning' }

export default function MobileCustomers() {
  const navigate = useNavigate()
  const user = getMobileUser()
  const [tab, setTab] = useState('mine')
  const [keyword, setKeyword] = useState('')
  const [mac, setMac] = useState('')
  const [imei, setImei] = useState('')
  const [iccid, setIccid] = useState('')
  const [poolKeyword, setPoolKeyword] = useState('')
  const [list, setList] = useState([])
  const [poolList, setPoolList] = useState([])
  const [loading, setLoading] = useState(false)
  const [poolLoading, setPoolLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    storeName: '', customerName: '', contact: '', phone: '', address: '',
  })

  useEffect(() => {
    if (isInstaller() || !hasMenu('/my-customers')) {
      message.warning('当前角色无客户权限')
      navigate(h5Path('orders'), { replace: true })
      return
    }
    load({})
  }, [])

  const load = async (search = {}) => {
    const kw = search.keyword ?? keyword
    const m = search.mac ?? mac
    const im = search.imei ?? imei
    const ic = search.iccid ?? iccid
    const hasFilter = kw || m || im || ic
    setLoading(true)
    setSearched(!!hasFilter)
    try {
      const params = {}
      if (kw) params.keyword = kw
      if (m) params.mac = m
      if (im) params.imei = im
      if (ic) params.iccid = ic
      const res = await getCustomers(params)
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }

  const loadPool = async (kw = poolKeyword) => {
    setPoolLoading(true)
    try {
      const res = await getPublicPool(kw ? { keyword: kw } : {})
      setPoolList(res.list || [])
    } finally {
      setPoolLoading(false)
    }
  }

  const handleSearch = () => {
    if (!keyword && !mac && !imei && !iccid) return message.warning('请至少输入一项查询条件')
    load({})
  }

  const handleReset = () => {
    setKeyword('')
    setMac('')
    setImei('')
    setIccid('')
    setSearched(false)
    load({ keyword: '', mac: '', imei: '', iccid: '' })
  }

  const handleClaim = async (id, e) => {
    e?.stopPropagation?.()
    if (!hasOperation('public-pool:claim')) return message.warning('无领取权限')
    await claimCustomer(id)
    message.success('领取成功')
    loadPool()
  }

  const handleCreate = async () => {
    if (!createForm.storeName.trim() || !createForm.customerName.trim()) {
      return message.warning('请填写店名和客户名称')
    }
    await createCustomer({ ...createForm, salesName: user.name, source: '自建' })
    message.success('客户已创建')
    setShowCreate(false)
    setCreateForm({ storeName: '', customerName: '', contact: '', phone: '', address: '' })
    setTab('mine')
    load({})
  }

  const goDetail = (c) => {
    if (c.workOrderId) {
      navigate(`${h5Path('customers/detail')}?workOrderId=${c.workOrderId}`)
      return
    }
    navigate(`${h5Path('customers/detail')}?id=${c.id}`)
  }

  const showDeviceInfo = searched && (keyword || mac || imei || iccid)
  const tabItems = [
    { key: 'mine', label: '我的客户' },
    ...(hasOperation('public-pool:claim') ? [{ key: 'pool', label: '公海池' }] : []),
  ]

  return (
    <div>
      <Tabs activeKey={tab} onChange={(k) => { setTab(k); if (k === 'pool') loadPool(); else load({}) }}
        items={tabItems} size="small" style={{ marginBottom: 8 }} />

      {tab === 'mine' && (
        <div>
          <Permission code="my-customer:create">
            <Button block icon={<PlusOutlined />} style={{ marginBottom: 12 }}
              onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? '取消新建' : '新建客户'}
            </Button>
          </Permission>

          {showCreate && (
            <Card className="mobile-card" size="small" style={{ marginBottom: 12 }}>
              <div className="mobile-form-stack">
                <Input placeholder="店名 *" value={createForm.storeName} onChange={(e) => setCreateForm({ ...createForm, storeName: e.target.value })} />
                <Input placeholder="客户名称 *" value={createForm.customerName} onChange={(e) => setCreateForm({ ...createForm, customerName: e.target.value })} />
                <Input placeholder="联系人" value={createForm.contact} onChange={(e) => setCreateForm({ ...createForm, contact: e.target.value })} />
                <Input placeholder="电话" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
                <Input placeholder="地址" value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} />
                <Button type="primary" block onClick={handleCreate}>保存</Button>
              </div>
            </Card>
          )}

          <Collapse ghost items={[{
            key: 'search',
            label: '客户查询',
            children: (
              <div className="mobile-form-stack">
                <Input placeholder="客户 / 门店名称" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                <Input placeholder="MAC" value={mac} onChange={(e) => setMac(e.target.value)} />
                <Input placeholder="IMEI" value={imei} onChange={(e) => setImei(e.target.value)} />
                <Input placeholder="主卡 / 备用卡 ICCID" value={iccid} onChange={(e) => setIccid(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button type="primary" loading={loading} onClick={handleSearch}>查询</Button>
                  <Button onClick={handleReset}>清空</Button>
                </div>
              </div>
            ),
          }]} style={{ marginBottom: 12, background: '#fff', borderRadius: 8 }} />

          <Spin spinning={loading}>
            {searched && list.length === 0 && <div className="mobile-empty">未找到客户</div>}
            {!searched && list.length === 0 && <div className="mobile-empty">暂无客户</div>}
            {list.map((c) => (
              <Card key={c.workOrderId ? `wo-${c.workOrderId}` : c.id} className="mobile-card mobile-card--clickable" size="small" onClick={() => goDetail(c)}>
                <div className="mobile-card__title">
                  <strong>{c.customerName}</strong>
                  {c.contactStatus ? (
                    <Tag color={STATUS_COLOR[c.contactStatus]}>{c.contactStatus}</Tag>
                  ) : c.workOrderId ? (
                    <Tag color="processing">安装登记</Tag>
                  ) : null}
                </div>
                {c.storeName && <div className="mobile-card__row"><span className="label">店名</span><span>{c.storeName}</span></div>}
                <div className="mobile-card__row"><span className="label">联系人</span><span>{c.contact || '-'}</span></div>
                <div className="mobile-card__row"><span className="label">电话</span><span>{c.phone || '-'}</span></div>
                <div className="mobile-card__row"><span className="label">销售</span><span>{c.salesName || '-'}</span></div>
                <div className="mobile-card__row"><span className="label">工单号</span><span>{c.orderNo || '-'}</span></div>
                {c.address && <div className="mobile-card__row"><span className="label">地址</span><span>{c.address}</span></div>}
                {c.claimTime && <div className="mobile-card__row"><span className="label">领取时间</span><span>{c.claimTime}</span></div>}
                {(showDeviceInfo || c.mac) && <div className="mobile-card__row"><span className="label">MAC</span><span>{c.mac || '-'}</span></div>}
                {(showDeviceInfo || c.imei) && c.imei && <div className="mobile-card__row"><span className="label">IMEI</span><span>{c.imei}</span></div>}
                {c.price && <div className="mobile-card__row"><span className="label">价格</span><span>{c.price}</span></div>}
                {c.lastFollowTime && <div className="mobile-card__row"><span className="label">最近跟进</span><span>{c.lastFollowTime}</span></div>}
              </Card>
            ))}
          </Spin>
        </div>
      )}

      {tab === 'pool' && (
        <div>
          <div className="mobile-form-stack" style={{ marginBottom: 12 }}>
            <Input placeholder="搜索公海客户" value={poolKeyword} onChange={(e) => setPoolKeyword(e.target.value)} />
            <Button type="primary" loading={poolLoading} onClick={() => loadPool()}>查询</Button>
          </div>
          <Spin spinning={poolLoading}>
            {poolList.length === 0 && <div className="mobile-empty">公海暂无客户</div>}
            {poolList.map((c) => (
              <Card key={c.id} className="mobile-card" size="small">
                <div className="mobile-card__title">
                  <strong>{c.customerName}</strong>
                  <Tag color="processing">在公海</Tag>
                </div>
                {c.storeName && <div className="mobile-card__row"><span className="label">店名</span><span>{c.storeName}</span></div>}
                <div className="mobile-card__row"><span className="label">联系人</span><span>{c.contact || '-'}</span></div>
                <div className="mobile-card__row"><span className="label">电话</span><span>{c.phone || '-'}</span></div>
                <div className="mobile-card__row"><span className="label">地址</span><span>{c.address || '-'}</span></div>
                <div className="mobile-card__row"><span className="label">来源</span><span>{c.source || '-'}</span></div>
                {hasOperation('public-pool:claim') && (
                  <Button type="primary" size="small" block style={{ marginTop: 8 }} onClick={(e) => handleClaim(c.id, e)}>领取</Button>
                )}
              </Card>
            ))}
          </Spin>
        </div>
      )}
    </div>
  )
}
