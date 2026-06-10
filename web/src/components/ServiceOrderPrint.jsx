import { Modal, Descriptions, Divider } from 'antd'
import { OrderStatusTag } from './StatusTag'

export default function ServiceOrderPrint({ open, order, onClose }) {
  if (!order) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal
      title="安装服务单"
      open={open}
      onCancel={onClose}
      onOk={handlePrint}
      okText="打印"
      width={640}
    >
      <div id="service-order-print" style={{ padding: '16px 0' }}>
        <h3 style={{ textAlign: 'center', marginBottom: 16 }}>基米网安装服务单</h3>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="工单号">{order.orderNo}</Descriptions.Item>
          <Descriptions.Item label="状态"><OrderStatusTag status={order.status} /></Descriptions.Item>
          <Descriptions.Item label="客户名称">{order.customerName}</Descriptions.Item>
          <Descriptions.Item label="店名">{order.storeName}</Descriptions.Item>
          <Descriptions.Item label="安装地址" span={2}>{order.address}</Descriptions.Item>
          <Descriptions.Item label="联系人">{order.contact}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{order.contactPhone}</Descriptions.Item>
          <Descriptions.Item label="预约日期">{order.installDate || '待定'}</Descriptions.Item>
          <Descriptions.Item label="销售人员">{order.salesName}</Descriptions.Item>
          <Descriptions.Item label="安装人员">{order.installer || '待分配'}</Descriptions.Item>
          <Descriptions.Item label="安装备注" span={2}>{order.remark || '-'}</Descriptions.Item>
        </Descriptions>
        {order.mac && (
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
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', color: '#999', fontSize: 12 }}>
          <span>客户签字：____________</span>
          <span>安装人员签字：____________</span>
          <span>日期：____________</span>
        </div>
      </div>
    </Modal>
  )
}
