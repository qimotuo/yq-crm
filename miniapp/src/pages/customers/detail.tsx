import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { getCustomerDetail, type Customer } from '@/api/customer'
import { getInstallationDetail } from '@/api/workOrder'
import { getFinanceByOrder, type FinanceRecord } from '@/api/finance'
import { getContractByOrder, type ContractRecord } from '@/api/contract'
import { hasOperation, canTrace, canViewFinance, canViewContract } from '@/utils/auth'
import './detail.scss'

function orderToCustomer(order: Awaited<ReturnType<typeof getInstallationDetail>>): Customer {
  return {
    id: order.customerId || 0,
    workOrderId: order.id,
    customerName: order.customerName,
    storeName: order.storeName,
    contact: order.contact,
    phone: order.contactPhone,
    address: order.address,
    salesName: order.salesName,
    orderNo: order.orderNo,
    installDate: order.installDate,
    deviceSupplier: order.deviceSupplier,
    deviceModel: order.deviceModel,
    mac: order.mac,
    imei: order.imei,
    simSupplier: order.simSupplier,
    operator: order.operator,
    iccid: order.iccid,
    backupIccid: order.backupIccid,
  }
}

export default function CustomerDetailPage() {
  const router = useRouter()
  const id = router.params.id ? Number(router.params.id) : 0
  const workOrderId = router.params.workOrderId ? Number(router.params.workOrderId) : 0
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [finance, setFinance] = useState<FinanceRecord | null>(null)
  const [contract, setContract] = useState<ContractRecord | null>(null)

  useDidShow(async () => {
    try {
      let c: Customer | null = null
      if (workOrderId) {
        c = orderToCustomer(await getInstallationDetail(workOrderId))
      } else if (id) {
        c = await getCustomerDetail(id)
      }
      setCustomer(c)
      setFinance(null)
      setContract(null)
      if (c?.orderNo) {
        if (canViewFinance()) {
          try {
            const fin = await getFinanceByOrder(c.orderNo)
            setFinance(fin.list[0] || null)
          } catch { /* ignore */ }
        }
        if (canViewContract()) {
          try {
            const con = await getContractByOrder(c.orderNo)
            setContract(con.list[0] || null)
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  })

  const callPhone = () => {
    if (!customer?.phone) {
      Taro.showToast({ title: '暂无电话', icon: 'none' })
      return
    }
    Taro.makePhoneCall({ phoneNumber: customer.phone })
  }

  const goFollowUps = () => {
    if (!customer?.id) {
      Taro.showToast({ title: '该客户暂无跟进记录', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: `/pages/follow-ups/index?customerId=${customer.id}&customerName=${encodeURIComponent(customer.customerName)}`,
    })
  }

  const goTrace = () => {
    if (!customer?.orderNo) {
      Taro.showToast({ title: '暂无工单号', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: `/pages/trace/index?type=orderNo&value=${encodeURIComponent(customer.orderNo)}`,
    })
  }

  if (!customer) {
    return <View className='container'><Text className='empty'>加载中...</Text></View>
  }

  return (
    <View className='detail-page container'>
      <View className='card'>
        <Text className='card-title'>{customer.customerName}</Text>
        {customer.storeName && <View className='card-row'><Text className='label'>店名</Text><Text>{customer.storeName}</Text></View>}
        <View className='card-row'><Text className='label'>联系人</Text><Text>{customer.contact || '-'}</Text></View>
        <View className='card-row'><Text className='label'>电话</Text><Text className='phone'>{customer.phone || '-'}</Text></View>
        <View className='card-row'><Text className='label'>销售</Text><Text>{customer.salesName || '-'}</Text></View>
        {customer.orderNo && (
          <View className='card-row'><Text className='label'>工单号</Text><Text>{customer.orderNo}</Text></View>
        )}
        {customer.contactStatus && (
          <View className='card-row'><Text className='label'>状态</Text><Text>{customer.contactStatus}</Text></View>
        )}
        {customer.wechatId && <View className='card-row'><Text className='label'>微信</Text><Text>{customer.wechatId}</Text></View>}
        {customer.address && <View className='card-row'><Text className='label'>地址</Text><Text>{customer.address}</Text></View>}
        {customer.installDate && (
          <View className='card-row'><Text className='label'>安装日期</Text><Text>{customer.installDate}</Text></View>
        )}
        {customer.deviceModel && (
          <View className='card-row'><Text className='label'>设备型号</Text><Text>{customer.deviceModel}</Text></View>
        )}
        {customer.mac && <View className='card-row'><Text className='label'>MAC</Text><Text>{customer.mac}</Text></View>}
        {customer.imei && <View className='card-row'><Text className='label'>IMEI</Text><Text>{customer.imei}</Text></View>}
        {customer.iccid && <View className='card-row'><Text className='label'>主卡</Text><Text>{customer.iccid}</Text></View>}
        {customer.backupIccid && (
          <View className='card-row'><Text className='label'>备用卡</Text><Text>{customer.backupIccid}</Text></View>
        )}
        {customer.operator && (
          <View className='card-row'><Text className='label'>运营商</Text><Text>{customer.operator}</Text></View>
        )}
        {customer.lastFollowTime && (
          <View className='card-row'><Text className='label'>最近跟进</Text><Text>{customer.lastFollowTime}</Text></View>
        )}
      </View>

      {finance && (
        <View className='card section-card'>
          <Text className='section-title'>财务（只读）</Text>
          <View className='card-row'><Text className='label'>回款状态</Text><Text className='highlight'>{finance.paymentStatus}</Text></View>
          <View className='card-row'><Text className='label'>应收</Text><Text>¥{finance.totalAmount}</Text></View>
          <View className='card-row'><Text className='label'>已收</Text><Text>¥{finance.paidAmount}</Text></View>
          <View className='card-row'><Text className='label'>未收</Text><Text>¥{finance.unpaidAmount}</Text></View>
          {finance.paymentPlanDate && (
            <View className='card-row'><Text className='label'>计划回款</Text><Text>{finance.paymentPlanDate}</Text></View>
          )}
        </View>
      )}

      {contract && (
        <View className='card section-card'>
          <Text className='section-title'>合同（只读）</Text>
          <View className='card-row'><Text className='label'>合同号</Text><Text>{contract.contractNo}</Text></View>
          <View className='card-row'><Text className='label'>状态</Text><Text>{contract.status}</Text></View>
          <View className='card-row'><Text className='label'>金额</Text><Text>¥{contract.amount}</Text></View>
          <View className='card-row'><Text className='label'>周期</Text><Text>{contract.startDate} ~ {contract.endDate}</Text></View>
        </View>
      )}

      <View className='action-bar'>
        {hasOperation('customer:call') && customer.phone && (
          <Button className='btn-primary' onClick={callPhone}>一键外呼</Button>
        )}
        {customer.id > 0 && hasOperation('customer:follow') && (
          <Button className='btn-ghost' onClick={goFollowUps}>跟进记录</Button>
        )}
        {canTrace() && customer.orderNo && (
          <Button className='btn-ghost' onClick={goTrace}>全链路追溯</Button>
        )}
      </View>
    </View>
  )
}
