import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, message, Descriptions, Tag, Upload, Tabs, Space, Card, DatePicker, Image } from 'antd'
import { ListToolbar, FilterInput, QueryButton, ResetButton } from '../components/ListToolbar'
import { FormOutlined, CameraOutlined, PlayCircleOutlined, CloseCircleOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons'
import { getMyWorkOrders, installRegister, updateWorkOrderStatusWithReason } from '../api/workOrder'
import { fileUrl, uploadFile } from '../api/upload'
import { OrderStatusTag } from '../components/StatusTag'
import { Permission } from '../components/RequireAuth'
import ExportButton from '../components/ExportButton'
import { useAuth } from '../hooks/useAuth'
import WorkOrderFormModal, { useWorkOrderForm } from '../components/WorkOrderFormModal'
import FormColumnLayout, { modalFormWidth } from '../components/FormColumnLayout'
import { useTablePagination } from '../hooks/useTablePagination'

const TAB_STATUS = { all: null, assigned: '已派工', installing: '安装中', done: '已安装' }
const EMPTY_COUNTS = { all: 0, assigned: 0, installing: 0, done: 0 }

function toPhotoFileList(urls = []) {
  return (urls || []).filter(Boolean).map((url, i) => ({
    uid: `photo-${i}-${url}`,
    name: `photo-${i + 1}`,
    status: 'done',
    url: fileUrl(url),
    response: { url },
  }))
}

export default function InstallRegister() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const { pagination } = useTablePagination(10, data.length)
  const [statusCounts, setStatusCounts] = useState(EMPTY_COUNTS)
  const [keyword, setKeyword] = useState('')
  const [installDate, setInstallDate] = useState(null)
  const [tab, setTab] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [failModal, setFailModal] = useState(false)
  const [current, setCurrent] = useState(null)
  const [form] = Form.useForm()
  const [failForm] = Form.useForm()
  const { user } = useAuth()
  const { modalOpen: formModalOpen, editing, openCreate, openEdit, closeModal } = useWorkOrderForm()

  const buildParams = (opts = {}) => {
    const kw = opts.keyword ?? keyword
    const date = opts.installDate !== undefined ? opts.installDate : installDate
    const activeTab = opts.tab ?? tab
    const params = { installer: user.name }
    if (kw) params.keyword = kw
    if (date) params.installDate = date.format('YYYY-MM-DD')
    const status = TAB_STATUS[activeTab]
    if (status) params.status = status
    return params
  }

  const load = async (opts = {}) => {
    setLoading(true)
    try {
      const res = await getMyWorkOrders(buildParams(opts))
      setData(res.list)
      setStatusCounts(res.statusCounts || EMPTY_COUNTS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onTabChange = (key) => {
    setTab(key)
    load({ tab: key })
  }

  const handleReset = () => {
    setKeyword('')
    setInstallDate(null)
    load({ keyword: '', installDate: null })
  }

  const openRegister = (record) => {
    setCurrent(record)
    form.setFieldsValue({
      deviceSupplier: record.deviceSupplier || '鲲鹏',
      deviceModel: record.deviceModel || '618',
      mac: record.mac,
      imei: record.imei,
      simSupplier: record.simSupplier || '光和',
      operator: record.operator || '移动',
      iccid: record.iccid,
      backupIccid: record.backupIccid,
      installRemark: record.installRemark || '',
      installPhotos: toPhotoFileList(record.installPhotos),
    })
    setModalOpen(true)
  }

  const handleStart = async (record) => {
    await updateWorkOrderStatusWithReason(record.id, '安装中')
    message.success('已开始安装')
    load()
  }

  const handleFail = async () => {
    const values = await failForm.validateFields()
    await updateWorkOrderStatusWithReason(current.id, '失败', values.failReason)
    message.warning('已标记安装失败')
    setFailModal(false)
    failForm.resetFields()
    load()
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const installPhotos = (values.installPhotos || [])
      .map((f) => f.response?.url || f.url)
      .filter(Boolean)
      .map((u) => (String(u).startsWith('http') ? String(u).replace(/^https?:\/\/[^/]+/, '') : u))
    const { installPhotos: _ignored, ...rest } = values
    await installRegister(current.id, { ...rest, installPhotos })
    message.success('安装登记已提交')
    setModalOpen(false)
    load()
  }

  const customRequest = async ({ file, onSuccess, onError }) => {
    try {
      const data = await uploadFile(file, 'install')
      onSuccess({ ...data, url: fileUrl(data.url) })
    } catch (e) {
      onError(e)
      message.error(e.message || '上传失败')
    }
  }

  const text = (v) => v || '-'

  const doneColumns = [
    { title: '工单号', dataIndex: 'orderNo', width: 120, fixed: 'left' },
    { title: '安装人', dataIndex: 'installer', width: 90, render: text },
    { title: '安装时间', dataIndex: 'installDate', width: 110, render: text },
    { title: '设备商', dataIndex: 'deviceSupplier', width: 90, render: text },
    { title: '设备型号', dataIndex: 'deviceModel', width: 110, render: text },
    { title: 'mac地址', dataIndex: 'mac', width: 140, render: text },
    { title: 'IMEI', dataIndex: 'imei', width: 150, render: text },
    { title: '卡商', dataIndex: 'simSupplier', width: 90, render: text },
    { title: '电信卡号', dataIndex: 'telecomNo', width: 180, render: text },
    { title: '移动卡号', dataIndex: 'mobileNo', width: 180, render: text },
    { title: '更换前旧卡号', dataIndex: 'oldCardNo', width: 160, render: text },
    { title: '卡套餐', dataIndex: 'cardPackage', width: 100, render: text },
    { title: '卡到期日', dataIndex: 'cardExpireDate', width: 110, render: text },
  ]

  const columns = [
    { title: '工单号', dataIndex: 'orderNo', width: 150, fixed: 'left' },
    { title: '客户', dataIndex: 'customerName', width: 120, ellipsis: true },
    { title: '安装地址', dataIndex: 'address', width: 200, ellipsis: true },
    {
      title: '联系信息', width: 150, ellipsis: true,
      render: (_, r) => (r.contact || r.contactPhone) ? `${r.contact || '-'} / ${r.contactPhone || '-'}` : '-',
    },
    { title: '预约日期', dataIndex: 'installDate', width: 100 },
    { title: '状态', dataIndex: 'status', width: 90, render: (s) => <OrderStatusTag status={s} /> },
    {
      title: '操作', width: 220, fixed: 'right',
      render: (_, r) => (
        <Space size="small" wrap>
          {r.status === '待派工' && (
            <Permission code="install:edit">
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
            </Permission>
          )}
          {['已派工', '推迟安装'].includes(r.status) && (
            <Permission code="install:start">
              <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleStart(r)}>开始安装</Button>
            </Permission>
          )}
          {['安装中', '安装成功'].includes(r.status) && (
            <>
              <Permission code="install:register">
                <Button type="link" size="small" icon={<FormOutlined />} onClick={() => openRegister(r)}>安装登记</Button>
              </Permission>
              <Permission code="install:fail">
                <Button type="link" size="small" danger icon={<CloseCircleOutlined />}
                  onClick={() => { setCurrent(r); setFailModal(true) }}>失败</Button>
              </Permission>
            </>
          )}
          {r.status === '已安装' && (
            <Space>
              <Tag color="success">已登记</Tag>
              {(r.installPhotos || []).length > 0 && (
                <Image.PreviewGroup items={(r.installPhotos || []).map((u) => fileUrl(u))}>
                  <Image width={28} height={28} src={fileUrl(r.installPhotos[0])} style={{ objectFit: 'cover', borderRadius: 4 }} />
                </Image.PreviewGroup>
              )}
            </Space>
          )}
          {r.status === '失败' && <Tag color="error">{r.failReason || '安装失败'}</Tag>}
        </Space>
      ),
    },
  ]

  const tabItems = [
    { key: 'all', label: `全部 (${statusCounts.all})` },
    { key: 'assigned', label: `待安装 (${statusCounts.assigned})` },
    { key: 'installing', label: `安装中 (${statusCounts.installing})` },
    { key: 'done', label: `已安装 (${statusCounts.done})` },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>我的工单 / 安装登记</h2>
        <p>查看派单、现场登记设备信息（Web 模拟小程序端）</p>
      </div>
      <ListToolbar
        filters={(
          <Tabs activeKey={tab} onChange={onTabChange} items={tabItems} className="toolbar-tabs" />
        )}
        actions={(
          <>
            <Permission code="install:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建工单</Button>
            </Permission>
            <Permission code="install:export">
              <ExportButton filename="install-orders.csv" label="导出" data={data} columns={columns} />
            </Permission>
          </>
        )}
      />
      <ListToolbar
        filters={(
          <>
            <FilterInput
              placeholder={tab === 'done' ? '工单号 / 安装人 / MAC / IMEI / 卡号' : '工单号 / 客户 / 地址 / 联系人'}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={() => load()}
            />
            <DatePicker
              className="stock-filter-date"
              placeholder="预约日期"
              value={installDate}
              onChange={setInstallDate}
              allowClear
            />
            <QueryButton loading={loading} onClick={() => load()} />
            <ResetButton onClick={handleReset} />
          </>
        )}
      />
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={tab === 'done' ? [...doneColumns, columns[columns.length - 1]] : columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: tab === 'done' ? 2100 : 1000 }}
          tableLayout={tab === 'done' ? 'auto' : 'fixed'}
          pagination={{ ...pagination, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Modal title={`安装登记 — ${current?.orderNo}`} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)} width={modalFormWidth(9)} destroyOnClose>
        <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="客户">{current?.customerName}</Descriptions.Item>
          <Descriptions.Item label="联系人">{current?.contact} {current?.contactPhone}</Descriptions.Item>
          <Descriptions.Item label="地址" span={2}>{current?.address}</Descriptions.Item>
          <Descriptions.Item label="销售备注" span={2}>{current?.remark || '-'}</Descriptions.Item>
        </Descriptions>
        <Form form={form} layout="vertical">
          <FormColumnLayout>
          <Form.Item name="deviceSupplier" label="设备供应商" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="deviceModel" label="设备型号" rules={[{ required: true }]}><Input placeholder="如 618、华为" /></Form.Item>
          <Form.Item name="mac" label="MAC 地址" rules={[{ required: true }]}><Input placeholder="AA:BB:CC:DD:EE:01" /></Form.Item>
          <Form.Item name="imei" label="IMEI" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="simSupplier" label="卡供应商"><Input /></Form.Item>
          <Form.Item name="operator" label="运营商">
            <Select options={['移动', '电信', '联通'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="iccid" label="ICCID"><Input /></Form.Item>
          <Form.Item name="backupIccid" label="备用卡 ICCID"><Input /></Form.Item>
          <Form.Item name="installRemark" label="安装备注"><Input.TextArea rows={2} placeholder="网络情况、是否加路由器等" /></Form.Item>
          <Form.Item
            name="installPhotos"
            label="现场照片"
            valuePropName="fileList"
            getValueFromEvent={(e) => e?.fileList}
            extra="最多 3 张，保存到服务器本地目录"
          >
            <Upload listType="picture-card" maxCount={3} accept="image/*" customRequest={customRequest}>
              <div><CameraOutlined /><div style={{ fontSize: 12 }}>拍照上传</div></div>
            </Upload>
          </Form.Item>
          </FormColumnLayout>
        </Form>
      </Modal>

      <Modal title="安装失败" open={failModal} onOk={handleFail} onCancel={() => setFailModal(false)} destroyOnClose>
        <p>工单：<strong>{current?.orderNo}</strong></p>
        <Form form={failForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="failReason" label="失败原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="如：客户不在场、线路不通" />
          </Form.Item>
        </Form>
      </Modal>

      <WorkOrderFormModal open={formModalOpen} editing={editing} onCancel={closeModal} onSuccess={load} />
    </div>
  )
}
