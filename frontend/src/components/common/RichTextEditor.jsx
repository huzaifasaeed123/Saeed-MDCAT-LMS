// File: components/common/RichTextEditor.jsx

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { FiBold, FiItalic, FiUnderline, FiList, FiCheckSquare, FiImage, FiLink, FiCornerUpLeft, FiCornerUpRight, FiType, FiInfo, FiHelpCircle } from 'react-icons/fi';
import apiClient from '../../utils/axiosConfig';

// Helper function to get backend URL
const getBackendUrl = () => {
  return import.meta.env.BACKEND_URL || 'http://localhost:5000';
};

// Custom Image extension to handle relative URLs from backend
const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        renderHTML: attributes => {
          // For HTML rendering, prepend the backend URL if the src is a relative path
          if (attributes.src && attributes.src.startsWith('/')) {
            return {
              src: `${getBackendUrl()}${attributes.src}`
            };
          }
          return { src: attributes.src };
        },
      },
    };
  },
});

const MenuBar = ({ editor }) => {
  if (!editor) {
    return null;
  }

  const addImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const formData = new FormData();
          formData.append('image', file);
          
          const response = await apiClient.post('/upload-image', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });

          if (response.data.url) {
            // Use the relative path returned from the backend
            editor.chain().focus().setImage({ src: response.data.url }).run();
          }
        } catch (error) {
          console.error('Error uploading image:', error);
        }
      }
    };
    input.click();
  };

  const setLink = () => {
    const url = window.prompt('Enter URL');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-2 p-2 bg-gray-50">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Bold (Ctrl+B)"
      >
        <FiBold className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Italic (Ctrl+I)"
      >
        <FiItalic className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('underline') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Underline (Ctrl+U)"
      >
        <FiUnderline className="w-4 h-4" />
      </button>
      
      {/* Add Superscript button */}
      <button
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('superscript') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Superscript (Ctrl+.)"
      >
        <span className="text-xs font-bold">X²</span>
      </button>
      
      {/* Add Subscript button */}
      <button
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('subscript') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Subscript (Ctrl+,)"
      >
        <span className="text-xs font-bold">X₂</span>
      </button>
      
      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}`}
        type="button"
        title="Heading"
      >
        <FiType className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Bullet List"
      >
        <FiList className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Numbered List"
      >
        <FiCheckSquare className="w-4 h-4" />
      </button>
      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
      <button
        onClick={addImage}
        className="p-2 rounded hover:bg-gray-200"
        type="button"
        title="Add Image"
      >
        <FiImage className="w-4 h-4" />
      </button>
      <button
        onClick={setLink}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('link') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Add Link"
      >
        <FiLink className="w-4 h-4" />
      </button>
      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={`p-2 rounded hover:bg-gray-200 ${!editor.can().undo() ? 'opacity-50 cursor-not-allowed' : ''}`}
        type="button"
        title="Undo (Ctrl+Z)"
      >
        <FiCornerUpLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={`p-2 rounded hover:bg-gray-200 ${!editor.can().redo() ? 'opacity-50 cursor-not-allowed' : ''}`}
        type="button"
        title="Redo (Ctrl+Shift+Z)"
      >
        <FiCornerUpRight className="w-4 h-4" />
      </button>
    </div>
  );
};

const EditorTips = ({ showTips }) => {
  if (!showTips) return null;
  
  return (
    <div className="bg-blue-50 p-3 border-t border-blue-100 text-xs text-gray-600">
      <div className="font-medium text-blue-700 mb-1 flex items-center">
        <FiHelpCircle className="mr-1" /> Editor Keyboard Shortcuts
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
        <div><span className="font-medium">Bold:</span> Ctrl+B</div>
        <div><span className="font-medium">Italic:</span> Ctrl+I</div>
        <div><span className="font-medium">Underline:</span> Ctrl+U</div>
        <div><span className="font-medium">Superscript:</span> Ctrl+.</div>
        <div><span className="font-medium">Subscript:</span> Ctrl+,</div>
        <div><span className="font-medium">Undo/Redo:</span> Ctrl+Z / Ctrl+Shift+Z</div>
      </div>
    </div>
  );
};

const RichTextEditor = ({ value, onChange, placeholder, minimal = false, showTips = false }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Superscript,
      Subscript,
      CustomImage.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline hover:text-blue-700',
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: `prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none p-4 min-h-[${minimal ? '100px' : '200px'}] max-w-none`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Handle paste event for images
  React.useEffect(() => {
    if (editor) {
      editor.view.dom.addEventListener('paste', async (event) => {
        const items = event.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              event.preventDefault();
              
              try {
                const formData = new FormData();
                formData.append('image', file);
                
                const response = await apiClient.post('/upload-image', formData, {
                  headers: {
                    'Content-Type': 'multipart/form-data'
                  }
                });

                if (response.data.url) {
                  // Use the relative path
                  editor.chain().focus().setImage({ src: response.data.url }).run();
                }
              } catch (error) {
                console.error('Error uploading pasted image:', error);
              }
            }
          }
        }
      });
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-gray-300 rounded-lg shadow-sm">
      {!minimal && <MenuBar editor={editor} />}
      <EditorContent editor={editor} />
      <EditorTips showTips={showTips || !minimal} />
    </div>
  );
};

export default RichTextEditor;