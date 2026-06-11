import { View, Text } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import './protocol.scss'

const CONTENT: Record<string, { title: string; body: string[] }> = {
  user: {
    title: '用户服务协议',
    body: [
      '欢迎使用基米网小程序。本协议是您与基米网之间关于使用本服务所订立的协议。',
      '1. 您应保证注册信息真实、准确，并对账号下的操作负责。',
      '2. 本服务用于宽带业务销售、安装、客户跟进等内部工作场景，请勿用于违法违规用途。',
      '3. 您应妥善保管账号密码，因保管不善导致的损失由您自行承担。',
      '4. 我们有权根据业务需要调整服务内容，并将通过适当方式通知您。',
      '5. 继续使用本服务即表示您接受修订后的协议内容。',
    ],
  },
  privacy: {
    title: '隐私政策',
    body: [
      '基米网重视您的隐私保护。本政策说明我们如何收集、使用与保护您的信息。',
      '1. 为完成登录与身份识别，我们可能收集微信 open_id、账号信息及设备基础信息。',
      '2. 业务使用过程中产生的客户、工单、跟进记录等数据仅用于 CRM 业务流转。',
      '3. 未经您同意，我们不会向第三方出售您的个人信息。',
      '4. 我们采取合理安全措施保护数据，但无法保证绝对安全。',
      '5. 您可通过管理员渠道申请查阅、更正或删除相关个人信息。',
    ],
  },
}

export default function ProtocolPage() {
  const router = useRouter()
  const type = router.params.type === 'privacy' ? 'privacy' : 'user'
  const doc = CONTENT[type]

  return (
    <View className='protocol-page'>
      <Text className='protocol-title'>{doc.title}</Text>
      {doc.body.map((p, i) => (
        <Text key={i} className='protocol-p'>{p}</Text>
      ))}
    </View>
  )
}
