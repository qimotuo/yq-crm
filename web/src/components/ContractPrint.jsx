import { Modal, Button, Descriptions, Divider } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { formatMoney } from '../utils/helpers'

export default function ContractPrint({ contract, onClose }) {
  const handlePrint = () => {
    window.print()
  }

  if (!contract) return null

  return (
    <Modal
      title={`服务合同 — ${contract.contractNo}`}
      open={!!contract}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="close" onClick={onClose}>关闭</Button>,
        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>打印合同</Button>,
      ]}
    >
      <div id="contract-print-area" style={{ padding: '16px 8px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>宽带 / 物联网设备服务合同</h2>
        <p style={{ textAlign: 'right' }}>合同编号：{contract.contractNo}</p>
        <Divider />
        <Descriptions column={1} size="small">
          <Descriptions.Item label="甲方（客户）">{contract.customerName}（{contract.storeName}）</Descriptions.Item>
          <Descriptions.Item label="签署人">{contract.signerName || '-'}</Descriptions.Item>
          <Descriptions.Item label="手机号">{contract.signerPhone || '-'}</Descriptions.Item>
          <Descriptions.Item label="身份证号">{contract.signerIdNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="乙方（服务商）">YQ 宽带物联网科技有限公司</Descriptions.Item>
          <Descriptions.Item label="关联工单">{contract.orderNo}</Descriptions.Item>
          <Descriptions.Item label="合作套餐">{contract.package}</Descriptions.Item>
          <Descriptions.Item label="合同金额">{formatMoney(contract.amount)}</Descriptions.Item>
          <Descriptions.Item label="合同周期">{contract.startDate} 至 {contract.endDate}</Descriptions.Item>
          <Descriptions.Item label="城市代码">{contract.cityCode}</Descriptions.Item>
        </Descriptions>
        <Divider />
        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>
          一、乙方为甲方提供宽带及物联网设备安装、运维服务，套餐内容以工单约定为准。<br />
          二、合同自安装完成之日起生效，周期一年，到期前 30 天双方协商续签。<br />
          三、费用按合同约定金额收取，甲方应在回款计划日前完成付款。<br />
          四、本合同一式两份，甲乙双方各执一份，具有同等法律效力。
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48 }}>
          <span>甲方签章：____________</span>
          <span>乙方签章：____________</span>
        </div>
        <p style={{ textAlign: 'right', marginTop: 24, color: '#999' }}>签订日期：{contract.signDate || contract.startDate}</p>
      </div>
    </Modal>
  )
}
