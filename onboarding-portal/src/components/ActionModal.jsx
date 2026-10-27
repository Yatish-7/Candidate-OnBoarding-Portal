import { useState } from 'react'
import { App as AntApp, Form, Input, Modal } from 'antd'
import { getErrorMessage, showFieldErrors } from '../utils/errors.js'

// One pop-up used by every workflow action (approve, decline, raise DOJ, override).
//   commentRequired → the comment box must be filled in, or OK is blocked (decline, override)
//   hideComment     → no comment box at all (raise DOJ)
//   children        → extra fields or warnings shown above the comment box
//   onSubmit(values) → does the API call; the modal shows a spinner meanwhile and any error after
export default function ActionModal({
  title,
  okText,
  danger = false,
  commentRequired = false,
  hideComment = false,
  initialValues,
  children,
  onCancel,
  onSubmit,
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const { message } = AntApp.useApp()

  async function handleOk() {
    let values
    try {
      // Checks every field's rules. If something is wrong, antd shows it under the field.
      values = await form.validateFields()
    } catch {
      return
    }

    setSaving(true)
    try {
      await onSubmit(values)
    } catch (error) {
      // Errors about a specific field go under that field; anything else as a pop-up message
      if (!showFieldErrors(form, error)) {
        message.error(getErrorMessage(error))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={title}
      okText={okText}
      okButtonProps={{ danger }}
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onCancel}
    >
      <Form form={form} layout="vertical" initialValues={initialValues}>
        {children}
        {!hideComment && (
          <Form.Item
            name="comment"
            label={commentRequired ? 'Comment (required)' : 'Comment (optional)'}
            rules={
              commentRequired
                ? [{ required: true, whitespace: true, message: 'Please add a comment explaining why' }]
                : []
            }
          >
            <Input.TextArea rows={3} maxLength={1000} showCount />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
