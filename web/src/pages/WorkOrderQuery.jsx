import { useEffect, useState } from 'react'
import { Table, Button, Modal, Descriptions, Timeline, Tag, Space, DatePicker } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import { queryWorkOrders } from '../api/workOrder'
import { OrderStatusTag } from '../components/StatusTag'
import { Permission } from '../components/RequireAuth'
import ExportButton from '../components/ExportButton'
import { FilterInput, FilterField, FilterSelect, QueryButton, ResetButton, applyFilterPatch } from '../components/ListToolbar'
import WorkOrderFormModal, { useWorkOrderForm } from '../components/WorkOrderFormModal'
import { useTablePagination } from '../hooks/useTablePagination'

const STATUSES = ['待派工', '已派工', '推迟安装', '安装中', '安装成功', '已安装', '失败', '已完成', '已取消']

const EMPTY_FILTERS = {
  keyword: '',
  status: '',
  installer: '',
  installDate: null,
  mac: '',
  iccid: '',
  deviceModel: '',
  contractNo: '',
}

function toParams(filters) {
  const params = {}
  for (const key of ['keyword', 'status', 'installer', 'mac', 'iccid', 'deviceModel', 'contractNo']) {
    const value = (filters[key] || '').trim()
    if (value) params[key] = value
  }
  if (filters.installDate?.[0]) params.installDateFrom = filters.installDate[0].format('YYYY-MM-DD')
  if (filters.installDate?.[1]) params.installDateTo = filters.installDate[1].format('YYYY-MM-DD')
  return params
}

export default function WorkOrderQuery() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const { pagination } = useTablePagination(10, data.length)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [query, setQuery] = useState(EMPTY_FILTERS)
  const [detail, setDetail] = useState(null)
  const { modalOpen, editing, openCreate, openEdit, closeModal } = useWorkOrderForm()

  const load = async (params = query) => {
    setLoading(true)
    try {
      const res = await queryWorkOrders(toParams(params))
      setData(res.list || [])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => setQuery({ ...filters })
  const handleReset = () => {
    setFilters(EMPTY_FILTERS)
    setQuery(EMPTY_FILTERS)
  }
  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))
  const onSelectFilter = (key) => (value) => applyFilterPatch({ [key]: value || '' }, setFilters, setQuery)

  useEffect(() => { load() }, [query])

  const text = (v) => v || '-'

  const columns = [
    { title: '工单号', dataIndex: 'orderNo', width: 150, fixed: 'left' },
    { title: '客户', dataIndex: 'customerName', width: 180, ellipsis: true, fixed: 'left' },
    { title: '店名', dataIndex: 'storeName', width: 140, ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 90, render: (s) => <OrderStatusTag status={s} /> },
    { title: '安装人', dataIndex: 'installer', width: 90, render: (v) => v || <Tag>未分配</Tag> },
    { title: '安装时间', dataIndex: 'installDate', width: 110, render: text },
    { title: '设备商', dataIndex: 'deviceSupplier', width: 90, render: text },
    { title: '设备型号', dataIndex: 'deviceModel', width: 110, render: text },
    { title: '设备成本', dataIndex: 'deviceCost', width: 90, render: text },
    { title: 'mac地址', dataIndex: 'mac', width: 150, render: text },
    { title: 'IMEI', dataIndex: 'imei', width: 160, render: text },
    { title: '卡商', dataIndex: 'simSupplier', width: 90, render: text },
    { title: '电信卡号', dataIndex: 'telecomNo', width: 180, render: text },
    { title: '移动卡号', dataIndex: 'mobileNo', width: 180, render: text },
    { title: '更换前旧卡号', dataIndex: 'oldCardNo', width: 160, render: text },
    { title: '卡套餐', dataIndex: 'cardPackage', width: 100, render: text },
    { title: '卡成本', dataIndex: 'cardCost', width: 90, render: text },
    { title: '卡到期日', dataIndex: 'cardExpireDate', width: 110, render: text },
    {
      title: '操作', width: 120, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => setDetail(r)}>详情</Button>
          {r.status === '待派工' && (
            <Permission code="workorder-query:edit">
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
            </Permission>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>工单查询</h2>
        <p>关键词模糊查客户、工单、店名、电话、地址、设备，其余条件可叠加</p>
      </div>
      <div className="order-query-bar">
        <div className="order-query-bar__row">
          <FilterInput placeholder="客户/店名/工单号/电话/地址/设备" value={filters.keyword} onChange={(e) => setFilter('keyword', e.target.value)} onPressEnter={handleSearch} />
          <FilterSelect wide placeholder="状态" value={filters.status || undefined} onChange={onSelectFilter('status')} options={STATUSES.map((s) => ({ value: s, label: s }))} />
          <FilterField className="stock-filter-field order-query-bar__installer" placeholder="安装人" value={filters.installer} onChange={(e) => setFilter('installer', e.target.value)} onPressEnter={handleSearch} />
          <DatePicker.RangePicker className="stock-filter-date" value={filters.installDate} onChange={(v) => applyFilterPatch({ installDate: v }, setFilters, setQuery)} placeholder={['安装开始', '安装结束']} allowClear />
          <div className="order-query-bar__actions">
            <QueryButton loading={loading} onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
            <Permission code="workorder-query:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建工单</Button>
            </Permission>
            <Permission code="workorder-query:export">
              <ExportButton filename="work-order-query.csv" label="导出" data={data} columns={columns} />
            </Permission>
          </div>
        </div>
        <div className="order-query-bar__row order-query-bar__row--equal">
          <FilterField placeholder="MAC" value={filters.mac} onChange={(e) => setFilter('mac', e.target.value)} onPressEnter={handleSearch} />
          <FilterField placeholder="卡号" value={filters.iccid} onChange={(e) => setFilter('iccid', e.target.value)} onPressEnter={handleSearch} />
          <FilterField placeholder="设备型号" value={filters.deviceModel} onChange={(e) => setFilter('deviceModel', e.target.value)} onPressEnter={handleSearch} />
          <FilterField placeholder="合同号" value={filters.contractNo} onChange={(e) => setFilter('contractNo', e.target.value)} onPressEnter={handleSearch} />
        </div>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        locale={{ emptyText: '暂无工单' }} scroll={{ x: 2600 }} pagination={{ ...pagination, showTotal: (t) => `共 ${t} 条` }} />

      <Modal title={`工单详情 — ${detail?.orderNo}`} open={!!detail} onCancel={() => setDetail(null)} footer={null} width={680}>
        {detail && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="状态"><OrderStatusTag status={detail.status} /></Descriptions.Item>
              <Descriptions.Item label="销售">{detail.salesName}</Descriptions.Item>
              <Descriptions.Item label="客户">{detail.customerName}</Descriptions.Item>
              <Descriptions.Item label="安装人">{detail.installer || '-'}</Descriptions.Item>
              <Descriptions.Item label="安装时间">{detail.installDate || '-'}</Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>{detail.address}</Descriptions.Item>
              <Descriptions.Item label="设备商">{detail.deviceSupplier || '-'}</Descriptions.Item>
              <Descriptions.Item label="设备型号">{detail.deviceModel || '-'}</Descriptions.Item>
              <Descriptions.Item label="设备成本">{detail.deviceCost || '-'}</Descriptions.Item>
              <Descriptions.Item label="mac地址">{detail.mac || '-'}</Descriptions.Item>
              <Descriptions.Item label="IMEI">{detail.imei || '-'}</Descriptions.Item>
              <Descriptions.Item label="卡商">{detail.simSupplier || '-'}</Descriptions.Item>
              <Descriptions.Item label="电信卡号">{detail.telecomNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="移动卡号">{detail.mobileNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="更换前旧卡号">{detail.oldCardNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="卡套餐">{detail.cardPackage || '-'}</Descriptions.Item>
              <Descriptions.Item label="卡成本">{detail.cardCost || '-'}</Descriptions.Item>
              <Descriptions.Item label="卡到期日">{detail.cardExpireDate || '-'}</Descriptions.Item>
            </Descriptions>
            {(detail.flowLogs?.length > 0) && (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>流转记录</div>
                <Timeline items={detail.flowLogs.map((log) => ({
                  children: (
                    <div>
                      <strong>{log.action}</strong> <span style={{ color: '#999', fontSize: 12 }}>{log.time}</span>
                      <div style={{ color: '#666' }}>{log.operator} — {log.detail}</div>
                    </div>
                  ),
                }))} />
              </>
            )}
          </>
        )}
      </Modal>

      <WorkOrderFormModal
        open={modalOpen}
        editing={editing}
        onCancel={closeModal}
        onSuccess={() => load()}
      />
    </div>
  )
}
