import { Modal, Form, InputNumber, Upload, Switch, message } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { formatMoney } from '../utils/helpers'
import { fileUrl, uploadFile } from '../api/upload'

export default function PaymentModal({ open, record, onCancel, onSubmit, title = '录入回款' }) {
  const [form] = Form.useForm()

  const handleOk = async () => {
    const values = await form.validateFields()
    const file = values.voucher?.[0]
    const voucher = file?.response?.url || file?.url || ''
    await onSubmit({
      paidAmount: values.paidAmount,
      voucher,
      verified: values.verified ?? false,
    })
    form.resetFields()
  }

  const handleCancel = () => {
    form.resetFields()
    onCancel()
  }

  const customRequest = async ({ file, onSuccess, onError }) => {
    try {
      const data = await uploadFile(file, 'voucher')
      onSuccess({ ...data, url: fileUrl(data.url) })
      message.success('凭证已上传')
    } catch (e) {
      onError(e)
      message.error(e.message || '上传失败')
    }
  }

  return (
    <Modal title={title} open={open} onOk={handleOk} onCancel={handleCancel} destroyOnClose>
      {record && (
        <>
          <p>客户：<strong>{record.customerName}</strong> · 应收 {formatMoney(record.totalAmount)} · 未收 {formatMoney(record.unpaidAmount ?? record.totalAmount - (record.paidAmount || 0))}</p>
          <Form form={form} layout="vertical" style={{ marginTop: 16 }} initialValues={{ paidAmount: record.paidAmount, verified: false }}>
            <Form.Item name="paidAmount" label="已收金额" rules={[{ required: true }]}>
              <InputNumber min={0} max={record.totalAmount} style={{ width: '100%' }} addonBefore="¥" />
            </Form.Item>
            <Form.Item name="voucher" label="汇款凭证" valuePropName="fileList" getValueFromEvent={(e) => e?.fileList}>
              <Upload
                maxCount={1}
                accept="image/*,.pdf"
                listType="picture"
                customRequest={customRequest}
                onPreview={(file) => {
                  const url = fileUrl(file.response?.url || file.url)
                  if (url) window.open(url, '_blank')
                }}
              >
                <span style={{ color: '#1677ff', cursor: 'pointer' }}><UploadOutlined /> 上传汇款单</span>
              </Upload>
            </Form.Item>
            <Form.Item name="verified" label="财务核销" valuePropName="checked">
              <Switch checkedChildren="已核销" unCheckedChildren="待核销" />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  )
}
