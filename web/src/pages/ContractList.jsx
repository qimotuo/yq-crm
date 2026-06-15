import { useEffect, useState } from 'react'
import { Table, Button, Space, Input, Select, Tag, Modal, Descriptions, Form, InputNumber, message, Upload } from 'antd'
import { PrinterOutlined, FileAddOutlined, PlusOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import { getContracts, createContract, importContracts, generateContract } from '../api'
import { formatMoney } from '../utils/helpers'
import ContractPrint from '../components/ContractPrint'
import { Permission } from '../components/RequireAuth'
import { openCreateForm, closeFormModal } from '../utils/formModal'
import { downloadCsvTemplate, parseCsvFile } from '../utils/csvImport'
import { ListToolbar, FilterInput, FilterSelect, QueryButton, ResetButton } from '../components/ListToolbar'

const CONTRACT_TEMPLATE = {
  filename: '合同导入模板.csv',
  headers: ['工单号', '客户名称', '门店', '套餐', '金额', '起始日期', '截止日期', '城市代码', '状态'],
  keys: ['orderNo', 'customerName', 'storeName', 'package', 'amount', 'startDate', 'endDate', 'cityCode', 'status'],
  sample: ['GD-20261025-088', '智慧社区A区物业', '红渡小香', '企业旗舰版(5账号)', '12000', '2026-11-02', '2027-11-01', 'SH', '待生成'],
  required: ['orderNo', 'customerName', 'storeName', 'amount', 'startDate', 'endDate'],
}

const CONTRACT_STATUSES = ['正常', '即将到期', '待生成']

export default function ContractList() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detail, setDetail] = useState(null)
  const [printContract, setPrintContract] = useState(null)
  const [createModal, setCreateModal] = useState(false)
  const [form] = Form.useForm()

  const load = async (opts = {}) => {
    const kw = opts.keyword ?? keyword
    const status = opts.status ?? statusFilter
    setLoading(true)
    try {
      const params = {}
      if (kw) params.keyword = kw
      if (status) params.status = status
      const res = await getContracts(params)
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  const onStatusChange = (v) => {
    const status = v || ''
    setStatusFilter(status)
    load({ keyword, status })
  }

  const handleReset = () => {
    setKeyword('')
    setStatusFilter('')
    load({ keyword: '', status: '' })
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async (orderNo) => {
    await generateContract(orderNo)
    message.success('合同已生成')
    load()
  }

  const openCreate = () => {
    openCreateForm(form, {
      orderNo: '', customerName: '', storeName: '', package: '',
      amount: 0, startDate: '', endDate: '', cityCode: 'SH', status: '待生成',
    })
    setCreateModal(true)
  }

  const handleCreate = async () => {
    const values = await form.validateFields()
    await createContract(values)
    message.success('合同已新增')
    closeFormModal(form, setCreateModal)
    load()
  }

  const handleImport = async (file) => {
    try {
      const text = await file.text()
      const rows = parseCsvFile(text, CONTRACT_TEMPLATE).map((row) => ({
        ...row,
        amount: Number(row.amount) || 0,
        cityCode: row.cityCode || 'SH',
        status: row.status || '待生成',
      }))
      const res = await importContracts(rows)
      message.success(`成功导入 ${res.count} 条合同`)
      load()
    } catch (e) {
      message.error(e.message || '导入失败')
    }
    return false
  }

  const statusColor = { 正常: 'success', 即将到期: 'warning', 待生成: 'default' }

  const columns = [
    { title: '合同编号', dataIndex: 'contractNo', width: 150 },
    { title: '工单号', dataIndex: 'orderNo', width: 160 },
    { title: '客户', dataIndex: 'customerName', width: 160 },
    { title: '门店', dataIndex: 'storeName', width: 120 },
    { title: '套餐', dataIndex: 'package', width: 160 },
    { title: '金额', dataIndex: 'amount', width: 100, render: formatMoney },
    { title: '合同周期', width: 200, render: (_, r) => `${r.startDate} ~ ${r.endDate}` },
    { title: '状态', dataIndex: 'status', width: 100, render: (s) => <Tag color={statusColor[s]}>{s}</Tag> },
    {
      title: '操作', width: 200, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => setDetail(r)}>查看</Button>
          {r.status === '待生成' && (
            <Permission code="contract:generate">
              <Button type="link" size="small" icon={<FileAddOutlined />} onClick={() => handleGenerate(r.orderNo)}>生成合同</Button>
            </Permission>
          )}
          {r.status !== '待生成' && (
            <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => setPrintContract(r)}>打印</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>合同管理</h2>
        <p>安装完成第 8 天自动生成合同，支持手动补录与打印</p>
      </div>
      <ListToolbar
        filters={(
          <>
            <FilterInput placeholder="搜索合同号/工单/客户" value={keyword} onChange={(e) => setKeyword(e.target.value)} onPressEnter={() => load()} />
            <FilterSelect placeholder="合同状态" value={statusFilter || undefined} onChange={onStatusChange}
              options={CONTRACT_STATUSES.map((s) => ({ value: s, label: s }))} />
            <QueryButton loading={loading} onClick={() => load()} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <Space>
            <Permission code="contract:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增合同</Button>
            </Permission>
            <Permission code="contract:import">
              <Button icon={<DownloadOutlined />} onClick={() => downloadCsvTemplate(CONTRACT_TEMPLATE)}>下载模板</Button>
              <Upload accept=".csv" showUploadList={false} beforeUpload={handleImport}>
                <Button icon={<UploadOutlined />}>批量导入</Button>
              </Upload>
            </Permission>
          </Space>
        )}
      />
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1400 }} pagination={{ pageSize: 10 }} />

      <Modal title="新增合同" open={createModal} onOk={handleCreate} onCancel={() => closeFormModal(form, setCreateModal)} width={560} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="orderNo" label="工单号" rules={[{ required: true }]}><Input placeholder="GD-20261025-088" /></Form.Item>
          <Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="storeName" label="门店" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="package" label="套餐"><Input /></Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="startDate" label="起始日期" rules={[{ required: true }]}><Input placeholder="2026-11-02" /></Form.Item>
          <Form.Item name="endDate" label="截止日期" rules={[{ required: true }]}><Input placeholder="2027-11-01" /></Form.Item>
          <Form.Item name="cityCode" label="城市代码"><Input placeholder="SH" /></Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={CONTRACT_STATUSES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`合同详情 — ${detail?.contractNo}`} open={!!detail} onCancel={() => setDetail(null)} footer={null} width={560}>
        {detail && (
          <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="合同编号">{detail.contractNo}</Descriptions.Item>
            <Descriptions.Item label="工单号">{detail.orderNo}</Descriptions.Item>
            <Descriptions.Item label="客户">{detail.customerName}</Descriptions.Item>
            <Descriptions.Item label="门店">{detail.storeName}</Descriptions.Item>
            <Descriptions.Item label="套餐">{detail.package}</Descriptions.Item>
            <Descriptions.Item label="金额">{formatMoney(detail.amount)}</Descriptions.Item>
            <Descriptions.Item label="起始">{detail.startDate}</Descriptions.Item>
            <Descriptions.Item label="截止">{detail.endDate}</Descriptions.Item>
            <Descriptions.Item label="城市代码">{detail.cityCode}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColor[detail.status]}>{detail.status}</Tag></Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <ContractPrint contract={printContract} onClose={() => setPrintContract(null)} />
    </div>
  )
}
