// The saved content is the only dirty baseline. Editor newline normalization is not an edit.
export const normalizeEditorText = value => String(value ?? '').replace(/\r\n?/g, '\n');
export const isFileDirty = file => Boolean(file && !['image','binary'].includes(file.lang)
  && normalizeEditorText(file.content) !== normalizeEditorText(file.originalContent));
export const fileLineEnding = value => String(value).includes('\r\n') ? '\r\n' : '\n';
export const serializedFileContent = file => normalizeEditorText(file.content).replace(/\n/g, file.lineEnding || '\n');
