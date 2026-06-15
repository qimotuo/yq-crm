export const ACCOUNT_SECTIONS = ['基米网', '基米智连']

export const ACCOUNT_IN_CATEGORIES = ['无线网络入账', '其余']

export const ACCOUNT_OUT_CATEGORIES = ['流量账单', '设备账单', '行政费用', '工资费用', '其他账单']

export const TRAFFIC_BILL_OPTIONS = ['光合账单', '瑞集', '黑金卡', '鲲鹏卡']

export const ADMIN_CATEGORIES = ['日常账单', '公司运营账单']

/** 账户账本：分类是否需要备注及备注类型 */
export function getAccountRemarkRule(category, direction) {
  if (direction === 'in') {
    const placeholder = category === '无线网络入账' ? '哪家店' : '备注说明'
    return { required: true, type: 'text', placeholder }
  }
  if (category === '流量账单') return { required: true, type: 'select', options: TRAFFIC_BILL_OPTIONS }
  if (category === '设备账单' || category === '其他账单') return { required: true, type: 'text', placeholder: '费用说明' }
  if (category === '工资费用') return { required: false, type: 'text', placeholder: '备注（可选）' }
  return { required: false, type: 'none' }
}
