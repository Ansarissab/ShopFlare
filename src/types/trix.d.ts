declare module 'trix' {
  const trix: unknown
  export default trix
}

declare module 'trix/dist/trix.css' {
  const content: string
  export default content
}

// Trix attachment object passed in trix-attachment-add event
interface TrixAttachment {
  file?: File
  setAttributes(attrs: { url: string; href: string }): void
  setUploadProgress(progress: number): void
}

// Extend CustomEvent to carry Trix attachment
interface TrixAttachmentEvent extends Event {
  attachment: TrixAttachment
}

// Extend HTMLElement for <trix-editor>
interface TrixEditorElement extends HTMLElement {
  value: string
  editor: {
    insertString(s: string): void
    loadJSON(json: unknown): void
    getDocument(): unknown
  }
}

// Teach React's JSX about <trix-editor>
declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      'trix-editor': React.DetailedHTMLProps<
        React.HTMLAttributes<TrixEditorElement> & {
          input?: string
          toolbar?: string
        },
        TrixEditorElement
      >
    }
  }
}
