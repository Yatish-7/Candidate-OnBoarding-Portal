import { useState } from 'react'
import Button from '../ui/Button.jsx'
import { Textarea } from '../ui/Input.jsx'
import { useToast } from '../ui/feedback.jsx'
import { addComment } from '../api/candidates.js'
import { getErrorMessage } from '../utils/errors.js'
import { getCurrentStage, STAGE_LABELS } from '../utils/status.js'

// Lets the user add a comment. It's saved against the candidate's current stage.
// onAdded() is called after saving, so the page can reload the trail.
export default function CommentBox({ candidate, onAdded }) {
  const [text, setText] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const stage = getCurrentStage(candidate)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return setError('Write a comment first')
    setError(null)
    setSaving(true)
    try {
      await addComment(candidate.id, stage, text.trim())
      setText('')
      toast.success('Comment added')
      onAdded()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not add the comment'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Textarea
        rows={3}
        placeholder="Add a comment…"
        maxLength={1000}
        value={text}
        invalid={!!error}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>{error ? <span className="text-danger">{error}</span> : `Will be added at the ${STAGE_LABELS[stage]} stage.`}</span>
        <span>{text.length}/1000</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" loading={saving}>
          Add comment
        </Button>
        <span className="text-sm text-muted">Everyone who can see this candidate will see it.</span>
      </div>
    </form>
  )
}
