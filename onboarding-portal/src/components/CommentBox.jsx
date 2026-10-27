import { useState } from 'react'
import { App as AntApp, Button, Form, Input, Typography } from 'antd'
import { addComment } from '../api/candidates.js'
import { getErrorMessage } from '../utils/errors.js'
import { getCurrentStage, STAGE_LABELS } from '../utils/status.js'

// Lets the user add a comment. It's saved against the candidate's current stage.
// onAdded() is called after saving, so the page can reload the trail.
export default function CommentBox({ candidate, onAdded }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const { message } = AntApp.useApp()
  const stage = getCurrentStage(candidate)

  async function handleFinish({ text }) {
    setSaving(true)
    try {
      await addComment(candidate.id, stage, text.trim())
      form.resetFields()
      message.success('Comment added')
      onAdded()
    } catch (error) {
      message.error(getErrorMessage(error, 'Could not add the comment'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form form={form} onFinish={handleFinish}>
      <Form.Item
        name="text"
        rules={[{ required: true, whitespace: true, message: 'Write a comment first' }]}
        extra={`Will be added at the ${STAGE_LABELS[stage]} stage.`}
      >
        <Input.TextArea rows={3} placeholder="Add a comment…" maxLength={1000} showCount />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={saving}>
        Add comment
      </Button>
      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
        Everyone who can see this candidate will see it.
      </Typography.Text>
    </Form>
  )
}
