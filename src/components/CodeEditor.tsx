import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, placeholder as ph, Decoration, type DecorationSet } from '@codemirror/view'
import { EditorState, StateEffect, StateField, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import { sql, SQLite } from '@codemirror/lang-sql'
import { tags as t } from '@lezer/highlight'
import { closeBrackets, autocompletion } from '@codemirror/autocomplete'

const hl = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword, t.definitionKeyword], color: 'var(--hl-kw)', fontWeight: '500' },
  { tag: [t.string, t.special(t.string)], color: 'var(--hl-str)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--hl-num)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--hl-com)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--hl-fn)' },
  { tag: [t.typeName, t.className], color: 'var(--hl-type)' },
  { tag: [t.propertyName], color: 'var(--text)' },
])
const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--code-bg)', color: 'var(--text)' },
  '.cm-content': { caretColor: 'var(--accent)', padding: '10px 0' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--text3)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent) 6%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-errline': { backgroundColor: 'color-mix(in srgb, var(--bad) 16%, transparent)' },
  '.cm-tooltip': { backgroundColor: 'var(--panel)', border: '1px solid var(--line2)', color: 'var(--text)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' },
  '.cm-placeholder': { color: 'var(--text3)' },
})

const setErr = StateEffect.define<number | null>()
const errField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(v, tr) {
    for (const e of tr.effects) if (e.is(setErr)) {
      if (e.value == null || e.value < 1 || e.value > tr.state.doc.lines) return Decoration.none
      const line = tr.state.doc.line(e.value)
      return Decoration.set([Decoration.line({ class: 'cm-errline' }).range(line.from)])
    }
    return tr.docChanged ? Decoration.none : v
  },
  provide: (f) => EditorView.decorations.from(f),
})

export interface CodeEditorProps {
  value: string; onChange: (v: string) => void; lang: 'sql' | 'python' | 'text'; onRun?: () => void
  minHeight?: number; maxHeight?: number; errorLine?: number | null; readOnly?: boolean; placeholder?: string; schema?: Record<string, string[]>
  apiRef?: { current: EditorApi | null }
}
export interface EditorApi { insert: (text: string) => void }
export default function CodeEditor({ value, onChange, lang, onRun, minHeight = 180, maxHeight = 520, errorLine, readOnly, placeholder, schema, apiRef }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const runRef = useRef(onRun); runRef.current = onRun
  const changeRef = useRef(onChange); changeRef.current = onChange
  const langComp = useRef(new Compartment())

  useEffect(() => {
    const langExt = lang === 'python' ? python() : lang === 'sql' ? sql({ dialect: SQLite, upperCaseKeywords: true, schema }) : []
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(), history(), indentOnInput(), bracketMatching(), closeBrackets(), autocompletion(),
        syntaxHighlighting(hl), theme, errField, langComp.current.of(langExt),
        EditorState.tabSize.of(4), EditorState.readOnly.of(!!readOnly),
        placeholder ? ph(placeholder) : [],
        keymap.of([{ key: 'Mod-Enter', run: () => { runRef.current?.(); return true } }, { key: 'Shift-Enter', run: () => { runRef.current?.(); return true } }, indentWithTab, ...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((u) => { if (u.docChanged) changeRef.current(u.state.doc.toString()) }),
        EditorView.theme({ '&': { minHeight: minHeight + 'px', maxHeight: maxHeight + 'px' }, '.cm-scroller': { overflow: 'auto' } }),
      ],
    })
    view.current = new EditorView({ state, parent: host.current! })
    if (apiRef) apiRef.current = {
      insert: (text: string) => {
        const v = view.current; if (!v) return
        const { from, to } = v.state.selection.main
        const before = from > 0 ? v.state.sliceDoc(from - 1, from) : ''
        const ins = (before && !/[\s(,.]/.test(before) ? ' ' : '') + text
        v.dispatch({ changes: { from, to, insert: ins }, selection: { anchor: from + ins.length } })
        v.focus()
      },
    }
    return () => { view.current?.destroy(); view.current = null; if (apiRef) apiRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, readOnly])

  useEffect(() => {
    const v = view.current
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
  }, [value])
  useEffect(() => { view.current?.dispatch({ effects: setErr.of(errorLine ?? null) }) }, [errorLine])
  useEffect(() => {
    if (lang === 'sql' && schema && view.current) view.current.dispatch({ effects: langComp.current.reconfigure(sql({ dialect: SQLite, upperCaseKeywords: true, schema })) })
  }, [schema, lang])
  return <div ref={host} />
}
