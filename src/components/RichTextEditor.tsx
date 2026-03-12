/**
 * RichTextEditor — Tiptap-based WYSIWYG editor for exercise descriptions
 *
 * LEARNING NOTES - HEADLESS UI LIBRARIES:
 *
 * 1. WHAT IS "HEADLESS"?
 *    A headless library provides functionality without UI. You get the logic
 *    (cursor management, formatting commands, undo/redo) but build your own
 *    buttons and styling. This is the opposite of "batteries-included" editors
 *    like TinyMCE or CKEditor that come with pre-built toolbars.
 *
 * 2. WHY HEADLESS?
 *    - Full control over UI/UX (matches your design system)
 *    - Smaller bundle (only include what you use)
 *    - Educational (you understand how it works)
 *    - No fighting against pre-built styles
 *
 * 3. TIPTAP ARCHITECTURE:
 *    - Built on ProseMirror (same foundation as Google Docs, Notion)
 *    - useEditor() hook creates the editor instance
 *    - EditorContent renders the editable area
 *    - Extensions add features (bold, lists, etc.)
 *    - StarterKit bundles common extensions
 *
 * 4. ANGULAR COMPARISON:
 *    Angular has ngx-editor (also ProseMirror-based) or ngx-quill.
 *    The concepts are similar: create an editor instance, bind to a component,
 *    call methods to format. React's hook-based API feels more natural for
 *    managing the editor lifecycle.
 */

import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, List, ListOrdered } from 'lucide-react';

interface RichTextEditorProps {
  /** Initial HTML content */
  content: string;
  /** Called when content changes (returns HTML string) */
  onChange: (html: string) => void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Label content (passed as children for cleaner API) */
  children?: React.ReactNode;
}

/**
 * Toolbar button component — consistent styling for editor controls.
 * Uses the same pattern as the previous manual toolbar but now actually
 * triggers real formatting commands.
 */
function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded p-1.5 transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function RichTextEditor({ content, onChange, placeholder, children }: RichTextEditorProps) {
  // Generate a stable ID for accessibility linking
  const labelId = children ? 'rich-text-editor-label' : undefined;

  /**
   * useEditor hook — creates and manages the Tiptap editor instance.
   *
   * LEARNING NOTES - EDITOR LIFECYCLE:
   * - The editor is created once when the component mounts
   * - Extensions define what features are available
   * - onUpdate fires whenever content changes
   * - The hook handles cleanup on unmount
   *
   * StarterKit includes: Document, Paragraph, Text, Bold, Italic, Strike,
   * Code, History (undo/redo), BulletList, OrderedList, ListItem, and more.
   * We disable features we don't need (italic, strike, code, etc.) to keep
   * the mental model simple for improv exercise descriptions.
   */
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable features we don't need for exercise descriptions
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        heading: false,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        // Apply Tailwind classes to the editable area
        class:
          'min-h-[100px] w-full bg-secondary border border-input rounded-lg px-3 py-2 ' +
          'text-foreground text-sm focus:outline-none focus:border-primary transition-colors ' +
          // Style text formatting and lists
          '[&_strong]:font-bold ' +
          '[&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 ' +
          '[&_li]:my-0.5 [&_p]:my-1',
        // Accessibility: role="textbox" per Tiptap docs, link to label via aria-labelledby
        role: 'textbox',
        ...(labelId ? { 'aria-labelledby': labelId } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      // Emit HTML whenever content changes
      onChange(editor.getHTML());
    },
  });

  /**
   * useEditorState — subscribe to specific editor state for toolbar buttons.
   *
   * LEARNING NOTES - SELECTIVE RE-RENDERING:
   * By default, Tiptap doesn't re-render React components when editor state
   * changes (like cursor moving into bold text). useEditorState is Tiptap's
   * official solution — it subscribes to specific parts of the state and
   * only re-renders when those values change.
   *
   * This is more efficient than forcing re-renders on every transaction.
   */
  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      isBold: e?.isActive('bold') ?? false,
      isBulletList: e?.isActive('bulletList') ?? false,
      isOrderedList: e?.isActive('orderedList') ?? false,
    }),
  });

  // Editor might not be ready immediately (SSR safety)
  if (!editor) {
    return null;
  }

  return (
    <div className="space-y-1">
      {/* Label (passed as children for simpler API) */}
      {children && (
        <label id={labelId} className="mb-1 block text-sm font-medium text-foreground">
          {children}
        </label>
      )}

      {/* Toolbar — our custom UI calling Tiptap commands */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editorState.isBold}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editorState.isBulletList}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editorState.isOrderedList}
          title="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">Ctrl+B for bold</span>
      </div>

      {/* Editor content area with placeholder overlay */}
      <div className="relative">
        <EditorContent editor={editor} />
        {/* Placeholder positioned to match where cursor appears (py-2 + p margin) */}
        {editor.isEmpty && placeholder && (
          <div className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

export default RichTextEditor;
