import { Children, Fragment, isValidElement } from 'react'
import { Row, Col, Input } from 'antd'

export const FORM_COLUMN_THRESHOLD = 6
const WIDE = 720
const NARROW = 560

export function modalFormWidth(count) {
  return count > FORM_COLUMN_THRESHOLD ? WIDE : NARROW
}

function flattenChildren(children) {
  const items = []
  Children.forEach(children, (child) => {
    if (!child) return
    if (isValidElement(child) && child.type === Fragment) {
      items.push(...flattenChildren(child.props.children))
    } else {
      items.push(child)
    }
  })
  return items
}

function isFullWidthField(item) {
  if (!isValidElement(item)) return false
  const inner = item.props?.children
  if (!inner) return false

  const check = (node) => {
    if (!isValidElement(node)) return false
    if (node.type === Input.TextArea) return true
    const name = node.type?.displayName || node.type?.name || ''
    return /TextArea|Upload|RadioGroup|CheckboxGroup/.test(name)
  }

  if (check(inner)) return true
  return Children.toArray(inner).some(check)
}

export default function FormColumnLayout({ children, threshold = FORM_COLUMN_THRESHOLD }) {
  const items = flattenChildren(children)
  if (items.length <= threshold) return <>{children}</>

  return (
    <Row gutter={[16, 0]}>
      {items.map((child, index) => (
        <Col key={child.key ?? index} span={isFullWidthField(child) ? 24 : 12}>
          {child}
        </Col>
      ))}
    </Row>
  )
}
