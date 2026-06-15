/** 新增：先清空再写默认值（避免 setFieldsValue 残留上次字段） */
export function openCreateForm(form, defaults = {}) {
  form.resetFields()
  if (Object.keys(defaults).length) {
    form.setFieldsValue(defaults)
  }
}

/** 关闭弹窗时清空表单 */
export function closeFormModal(form, setOpen, extra) {
  setOpen(false)
  form.resetFields()
  extra?.()
}
