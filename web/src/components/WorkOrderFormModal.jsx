import { useEffect, useState } from 'react'
import { Modal, Form, Input, DatePicker, message } from 'antd'
import dayjs from 'dayjs'
import { createWorkOrder, updateWorkOrder } from '../api/workOrder'
import FormColumnLayout, { modalFormWidth } from './FormColumnLayout'

export function useWorkOrderForm() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (record) => { setEditing(record); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }
  return { modalOpen, editing, openCreate, openEdit, closeModal, setModalOpen }
}

export default function WorkOrderFormModal({ open, editing, onCancel, onSuccess }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        ...editing,
        installDate: editing.installDate ? dayjs(editing.installDate) : undefined,
      })
    } else {
      form.resetFields()
    }
  }, [open, editing, form])

  const handleSave = async () => {
    const values = await form.validateFields()
    if (values.installDate?.format) values.installDate = values.installDate.format('YYYY-MM-DD')
    if (values.installDate && !values.installTimeSlot) values.installTimeSlot = values.installDate
    setSaving(true)
    try {
      if (editing) {
        await updateWorkOrder(editing.id, values)
        message.success('工单已更新')
      } else {
        await createWorkOrder(values)
        message.success('工单创建成功')
      }
      onSuccess?.()
      onCancel?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? '编辑工单' : '新建安装工单'}
      open={open}
      onOk={handleSave}
      onCancel={onCancel}
      confirmLoading={saving}
      width={modalFormWidth(7)}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <FormColumnLayout>
        <Form.Item name="storeName" label="店名" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="address" label="安装地址" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="contact" label="联系人" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="installDate" label="预约安装日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="remark" label="安装备注"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="price" label="价格"><Input placeholder="2880 或 2880x2=5760" /></Form.Item>
        </FormColumnLayout>
      </Form>
    </Modal>
  )
}
