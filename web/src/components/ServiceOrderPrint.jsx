import { useEffect, useState } from 'react'
import { Modal, Descriptions, Divider, Spin } from 'antd'
import { OrderStatusTag } from './StatusTag'
import { getServiceOrderPrintTemplate } from '../api/cti'

const DEFAULT_TPL = {
  title: '基米网安装服务单',
  showStatus: true,
  showCustomer: true,
  showStore: true,
  showAddress: true,
  showContact: true,
  showPhone: true,
  showInstallDate: true,
  showSales: true,
  showInstaller: true,
  showRemark: true,
  showDevice: true,
  showSignature: true,
  footerLeft: '客户签字：____________',
  footerCenter: '安装人员签字：____________',
  footerRight: '日期：____________',
  extraNote: '',
}

export default function ServiceOrderPrint({ open, order, onClose }) {
  const [tpl, setTpl] = useState(DEFAULT_TPL)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getServiceOrderPrintTemplate()
      .then((data) => setTpl({ ...DEFAULT_TPL, ...data }))
      .catch(() => setTpl(DEFAULT_TPL))
      .finally(() => setLoading(false))
  }, [open])

  if (!order) return null

  const handlePrint = () => window.print()

  return (
    <Modal
      title="安装服务单"
      open={open}
      onCancel={onClose}
      onOk={handlePrint}
      okText="打印"
      width={640}
    >
      <Spin spinning={loading}>
        <div id="service-order-print" style={{ padding: '16px 0' }}>
          <h3 style={{ textAlign: 'center', marginBottom: 4 }}>{tpl.title}</h3>
          {tpl.companyName ? (
            <div style={{ textAlign: 'center', color: '#666', marginBottom: 16, fontSize: 13 }}>{tpl.companyName}</div>
          ) : null}
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="工单号">{order.orderNo}</Descriptions.Item>
            {tpl.showStatus && (
              <Descriptions.Item label="状态"><OrderStatusTag status={order.status} /></Descriptions.Item>
            )}
            {tpl.showCustomer && <Descriptions.Item label="客户名称">{order.customerName}</Descriptions.Item>}
            {tpl.showStore && <Descriptions.Item label="店名">{order.storeName}</Descriptions.Item>}
            {tpl.showAddress && <Descriptions.Item label="安装地址" span={2}>{order.address}</Descriptions.Item>}
            {tpl.showContact && <Descriptions.Item label="联系人">{order.contact}</Descriptions.Item>}
            {tpl.showPhone && <Descriptions.Item label="联系电话">{order.contactPhone}</Descriptions.Item>}
            {tpl.showInstallDate && <Descriptions.Item label="预约日期">{order.installDate || '待定'}</Descriptions.Item>}
            {tpl.showSales && <Descriptions.Item label="销售人员">{order.salesName}</Descriptions.Item>}
            {tpl.showInstaller && <Descriptions.Item label="安装人员">{order.installer || '待分配'}</Descriptions.Item>}
            {tpl.showRemark && <Descriptions.Item label="安装备注" span={2}>{order.remark || '-'}</Descriptions.Item>}
          </Descriptions>
          {tpl.showDevice && order.mac && (
            <>
              <Divider>设备信息</Divider>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="设备型号">{order.deviceModel}</Descriptions.Item>
                <Descriptions.Item label="供应商">{order.deviceSupplier}</Descriptions.Item>
                <Descriptions.Item label="MAC">{order.mac}</Descriptions.Item>
                <Descriptions.Item label="IMEI">{order.imei}</Descriptions.Item>
                <Descriptions.Item label="ICCID" span={2}>{order.iccid}</Descriptions.Item>
              </Descriptions>
            </>
          )}
          {tpl.extraNote ? (
            <div style={{ marginTop: 16, color: '#666', fontSize: 12, whiteSpace: 'pre-wrap' }}>{tpl.extraNote}</div>
          ) : null}
          {tpl.showSignature && (
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', color: '#999', fontSize: 12, gap: 8 }}>
              <span>{tpl.footerLeft}</span>
              <span>{tpl.footerCenter}</span>
              <span>{tpl.footerRight}</span>
            </div>
          )}
        </div>
      </Spin>
    </Modal>
  )
}
