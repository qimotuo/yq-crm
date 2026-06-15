import { Input, Button, Select } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'

export function ListToolbar({ filters, actions, nested }) {
  return (
    <div className={nested ? 'stock-toolbar stock-toolbar--nested' : 'stock-toolbar'}>
      {filters != null && <div className="stock-toolbar__filters">{filters}</div>}
      {actions != null && <div className="stock-toolbar__actions">{actions}</div>}
    </div>
  )
}

export function FilterInput({ value, onChange, onPressEnter, placeholder, className, ...rest }) {
  return (
    <Input
      className={className || 'stock-filter-input'}
      placeholder={placeholder}
      prefix={<SearchOutlined />}
      value={value}
      onChange={onChange}
      onPressEnter={onPressEnter}
      allowClear
      {...rest}
    />
  )
}

export function FilterField({ value, onChange, onPressEnter, placeholder, className, ...rest }) {
  return (
    <Input
      className={className || 'stock-filter-field'}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onPressEnter={onPressEnter}
      allowClear
      {...rest}
    />
  )
}

export function FilterSelect({ wide, className, onChange, onSearch, ...rest }) {
  const cls = className || (wide ? 'stock-filter-select--wide' : 'stock-filter-select')
  const handleChange = (value, option) => {
    onChange?.(value, option)
    onSearch?.(value)
  }
  return <Select className={cls} allowClear onChange={handleChange} {...rest} />
}

/** 下拉筛选：合并 patch 并应用查询（filters + query 双状态页面） */
export function applyFilterPatch(patch, setFilters, applyQuery) {
  setFilters((prev) => {
    const next = { ...prev, ...patch }
    applyQuery(next)
    return next
  })
}

export function QueryButton({ loading, onClick, children = '查询' }) {
  return (
    <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={onClick}>
      {children}
    </Button>
  )
}

export function ResetButton({ onClick, children = '重置' }) {
  return (
    <Button icon={<ReloadOutlined />} onClick={onClick}>
      {children}
    </Button>
  )
}
