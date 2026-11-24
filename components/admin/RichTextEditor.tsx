"use client";
import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Extension, type Command } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { OrderedList } from "@tiptap/extension-list";
import StarterKit from "@tiptap/starter-kit";
import {
  legacyDocument,
  richTextPlain,
  type RichNode,
} from "@/lib/content/rich-text";
const NumberedList = OrderedList.extend({ addAttributes: () => ({}) });
const Size = Extension.create({
  name: "paragraphSize",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          size: {
            default: "normal",
            parseHTML: (el) =>
              ["small", "normal", "large"].includes(
                el.getAttribute("data-size") || "",
              )
                ? el.getAttribute("data-size")
                : "normal",
            renderHTML: (attrs) => ({ "data-size": attrs.size }),
          },
        },
      },
    ];
  },
});
const Indentation = Extension.create({
  name: "paragraphIndentation",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const value = Number(el.getAttribute("data-indent"));
              return Number.isInteger(value) && value >= 0 && value <= 6
                ? value
                : 0;
            },
            renderHTML: (attrs) =>
              attrs.indent ? { "data-indent": attrs.indent } : {},
          },
        },
      },
    ];
  },
});
const changeIndent =
  (direction: -1 | 1): Command =>
  ({ tr, state, dispatch }) => {
    let changed = false;
    state.doc.nodesBetween(tr.selection.from, tr.selection.to, (node, pos) => {
      if (node.type.name !== "paragraph") return;
      const indent = Number(node.attrs.indent) || 0;
      const next = Math.max(0, Math.min(6, indent + direction));
      if (next === indent) return;
      changed = true;
      if (dispatch)
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
    });
    return changed;
  };
export default function RichTextEditor({
  initial,
  legacy,
  label = "Content",
  onChange,
  disabled = false,
  required = true,
}: {
  initial?: RichNode;
  legacy: string | string[];
  label?: string;
  onChange: (value: RichNode) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        orderedList: false,
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        link: false,
        trailingNode: false,
      }),
      NumberedList,
      Size,
      Indentation,
    ],
    content: initial || legacyDocument(legacy),
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        "aria-required": String(required),
        class: "rich-text rich-editor-content",
      },
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain");
        if (text === undefined) return false;
        event.preventDefault();
        view.dispatch(view.state.tr.insertText(text));
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichNode),
    onBlur: () => setTouched(true),
  });
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold"),
      italic: editor?.isActive("italic"),
      underline: editor?.isActive("underline"),
      bullet: editor?.isActive("bulletList"),
      ordered: editor?.isActive("orderedList"),
      size: editor?.getAttributes("paragraph").size || "normal",
      empty: editor?.isEmpty,
      undo: editor?.can().undo(),
      redo: editor?.can().redo(),
      indentMore: editor?.isActive("listItem")
        ? editor.can().sinkListItem("listItem")
        : editor?.can().command(changeIndent(1)),
      indentLess: editor?.isActive("listItem")
        ? editor.can().liftListItem("listItem")
        : editor?.can().command(changeIndent(-1)),
    }),
  });
  if (!editor) return <p>Loading editor...</p>;
  const separateEdit = (run: () => void) => {
    editor.view.dispatch(closeHistory(editor.state.tr));
    run();
  };
  return (
    <div className="rich-editor">
      <div
        className="rich-toolbar"
        role="group"
        aria-label={`${label} formatting`}
        onPointerDown={(event) => {
          // Keep the text selection when a formatting button is tapped.
          if ((event.target as HTMLElement).closest("button"))
            event.preventDefault();
        }}
      >
        {(
          [
            ["Bold", "bold", () => editor.chain().focus().toggleBold().run()],
            [
              "Italic",
              "italic",
              () => editor.chain().focus().toggleItalic().run(),
            ],
            [
              "Underline",
              "underline",
              () => editor.chain().focus().toggleUnderline().run(),
            ],
            [
              "Bullet list",
              "bullet",
              () => editor.chain().focus().toggleBulletList().run(),
            ],
            [
              "Numbered list",
              "ordered",
              () => editor.chain().focus().toggleOrderedList().run(),
            ],
          ] as const
        ).map(([name, key, run]) => (
          <button
            type="button"
            key={key}
            disabled={disabled}
            aria-pressed={!!state?.[key]}
            onClick={() => separateEdit(run)}
          >
            {name}
          </button>
        ))}
        {([-1, 1] as const).map((direction) => (
          <button
            type="button"
            key={direction}
            disabled={
              disabled ||
              !(direction === 1 ? state?.indentMore : state?.indentLess)
            }
            onClick={() =>
              separateEdit(() => {
                if (editor.isActive("listItem")) {
                  const chain = editor.chain().focus();
                  if (direction === 1) chain.sinkListItem("listItem").run();
                  else chain.liftListItem("listItem").run();
                } else
                  editor.chain().focus().command(changeIndent(direction)).run();
              })
            }
          >
            {direction === 1 ? "Increase indent" : "Decrease indent"}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            separateEdit(() => {
              editor.chain().focus().clearNodes().setParagraph().run();
            })
          }
        >
          Paragraph
        </button>
        <label>
          Text size
          <select
            disabled={disabled}
            value={state?.size}
            onChange={(e) =>
              separateEdit(() => {
                editor
                  .chain()
                  .focus()
                  .updateAttributes("paragraph", { size: e.target.value })
                  .run();
              })
            }
          >
            {["small", "normal", "large"].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={disabled || !state?.undo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={disabled || !state?.redo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          Redo
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            separateEdit(() => {
              editor
                .chain()
                .focus()
                .unsetAllMarks()
                .clearNodes()
                .updateAttributes("paragraph", { size: "normal", indent: 0 })
                .run();
            })
          }
        >
          Clear formatting
        </button>
      </div>
      <EditorContent editor={editor} />
      {required && touched && state?.empty && (
        <p role="alert">Content is required.</p>
      )}
      <span className="staff-note">
        {richTextPlain(editor.getJSON() as RichNode).length} / 30,000
        characters. Pasted text uses plain formatting.
      </span>
    </div>
  );
}
