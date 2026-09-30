// The kinds of coursework a task can be. They are stored as plain text in tasks.kind,
// so adding a new kind here needs no database change.
export const KINDS = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'lab_manual', label: 'Lab manual' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'practical_file', label: 'Practical file' },
  { value: 'project', label: 'Project' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'other', label: 'Other' },
]

export const kindLabel = (value) => KINDS.find((k) => k.value === value)?.label ?? value
