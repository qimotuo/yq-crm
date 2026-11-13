import { useEffect, useState } from 'react'
import { Alert, Button, Form, Modal, Select, Table, message } from 'antd'
import { getOwnerReview, getSalesOptions, transferCustomer } from '../api'
import { canManageCustomerOwner } from '../rbac/utils'

export default function OwnerReviewPanel({ onChanged }) {
  const [rows, setRows] = useState([])
  const [sales, setSales] = useState([])
  const [current, setCurrent] = useState(null)
  const [form] = Form.useForm()

  const load = async () => {
    if (!canManageCustomerOwner()) return
    const [review, options] = await Promise.all([getOwnerReview(), getSalesOptions()])
    setRows(review.list || [])
    setSales(options.list || [])
  }

  useEffect(() => { load() }, [])

  if (!canManageCustomerOwner() || !rows.length) return null

  const assign = async () => {
    const values = await form.validateFields()
    await transferCustomer({ id: current.id, salesName: values.salesName, reason: '确认归属' })
    message.success('已指定负责销售')
    setCurrent(null)
    await load()
    onChanged?.()
  }

  return (
    <>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message={`待确认归属 ${rows.length} 条`}
        description="这些客户对不上现有销售、负责销售为空，或对应多名销售。未指定前不会归到任何人名下。"
      />
      <Table
        style={{ marginBottom: 16 }}
        size="small"
        rowKey="id"
        pagination={{ pageSize: 8, showSizeChanger: false }}
        dataSource={rows}
        scroll={{ x: 860 }}
        columns={[
          { title: '店名', dataIndex: 'storeName', width: 120 },
          { title: '客户', dataIndex: 'customerName', width: 160 },
          { title: '手机号', dataIndex: 'phone', width: 120, render: (v) => v || '-' },
          { title: '当前负责销售', dataIndex: 'salesName', width: 120, render: (v) => v || '-' },
          { title: '原因', dataIndex: 'ownerNote' },
          {
            title: '操作',
            width: 110,
            render: (_, row) => (
              <Button type="link" size="small" onClick={() => { setCurrent(row); form.setFieldsValue({ salesName: row.salesName || undefined }) }}>
                指定销售
              </Button>
            ),
          },
        ]}
      />
      <Modal title={`指定负责销售 — ${current?.customerName || ''}`} open={!!current} onOk={assign} onCancel={() => setCurrent(null)} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="salesName" label="负责销售" rules={[{ required: true, message: '请选择负责销售' }]}>
            <Select showSearch optionFilterProp="label" options={sales.map((item) => ({ value: item.name, label: item.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
