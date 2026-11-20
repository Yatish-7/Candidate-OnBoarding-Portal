import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Field from '../ui/Field.jsx'
import { Textarea } from '../ui/Input.jsx'
import { useToast } from '../ui/feedback.jsx'
import { fieldErrorMap, getErrorMessage } from '../utils/errors.js'

// One pop-up used by every workflow action (approve, decline, raise DOJ, override).
//   commentRequired → the comment box must be filled in, or OK is blocked (decline, override)
//   hideComment     → no comment box at all (raise DOJ)
//   children        → a render function (form) => fields, where form = { values, set, errors }
//   validate(values)→ optional, returns a { field: message } map for the custom fields
//   onSubmit(values)→ does the API call; the modal shows a spinner meanwhile and any error after
export default function ActionModal({
  title,
  okText,
  danger = false,
  commentRequired = false,
  hideComment = false,
  initialValues,
  validate,
  children,
  onCancel,
  onSubmit,
}) {
  const [values, setValues] = useState({ comment: '', ...initialValues })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  function set(name, value) {
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((e) => ({ ...e, [name]: undefined }))
  }
  const form = { values, set, errors }

  async function handleOk() {
    const found = validate ? validate(values) : {}
    if (commentRequired && !String(values.comment ?? '').trim()) found.comment = 'Please add a comment explaining why'
    setErrors(found)
    if (Object.values(found).some(Boolean)) return

    setSaving(true)
    try {
      await onSubmit(values)
    } catch (error) {
      const map = fieldErrorMap(error)
      if (map) setErrors(map)
      else toast.error(getErrorMessage(error))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={saving} onClick={handleOk}>
            {okText}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {typeof children === 'function' ? children(form) : children}
        {!hideComment && (
          <Field label={commentRequired ? 'Comment (required)' : 'Comment (optional)'} required={commentRequired} error={errors.comment}>
            <Textarea
              rows={3}
              maxLength={1000}
              value={values.comment ?? ''}
              invalid={!!errors.comment}
              onChange={(e) => set('comment', e.target.value)}
            />
          </Field>
        )}
      </div>
    </Modal>
  )
}
