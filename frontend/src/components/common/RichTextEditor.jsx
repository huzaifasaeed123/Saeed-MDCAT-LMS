// // Place this file in: components/common/RichTextEditor.js

// import React, { useEffect, useRef } from 'react';
// import { 
//   BlockEditorProvider, 
//   BlockCanvas, 
//   WritingFlow, 
//   ObserveTyping,
//   BlockTools
// } from '@wordpress/block-editor';
// import { 
//   getDefaultBlockName, 
//   createBlock, 
//   serialize, 
//   parse 
// } from '@wordpress/blocks';
// import '@wordpress/block-library/build-style/style.css';
// import '@wordpress/components/build-style/style.css';
// import axios from 'axios';

// const RichTextEditor = ({ value, onChange, placeholder, minimal = false }) => {
//   const blocks = value ? parse(value) : [createBlock(getDefaultBlockName())];
//   const ref = useRef(null);

//   const settings = {
//     mediaUpload: async ({ filesList, onFileChange }) => {
//       try {
//         const formData = new FormData();
//         formData.append('image', filesList[0]);
        
//         // Use axios directly for image upload to send proper multipart/form-data
//         const response = await axios.post(`${import.meta.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/upload-image`, formData, {
//           headers: {
//             'Content-Type': 'multipart/form-data',
//             'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
//           }
//         });
        
//         onFileChange([{
//           id: response.data.id,
//           url: response.data.url
//         }]);
//       } catch (error) {
//         console.error('Error uploading image:', error);
//       }
//     }
//   };

//   const handleChange = (newBlocks) => {
//     const html = serialize(newBlocks);
//     onChange(html);
//   };

//   return (
//     <div 
//       className={`editor-wrapper border rounded-lg p-4 ${
//         minimal ? 'min-h-[100px]' : 'min-h-[200px]'
//       }`}
//       ref={ref}
//     >
//       <BlockEditorProvider
//         value={blocks}
//         onInput={handleChange}
//         onChange={handleChange}
//         settings={settings}
//       >
//         <BlockTools>
//           <WritingFlow>
//             <ObserveTyping>
//               <BlockCanvas height={minimal ? '100px' : '200px'} />
//             </ObserveTyping>
//           </WritingFlow>
//         </BlockTools>
//       </BlockEditorProvider>
//     </div>
//   );
// };

// export default RichTextEditor;


// components/common/RichTextEditor.jsx
import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { FaBold, FaItalic, FaUnderline, FaListUl, FaListOl, FaImage, FaLink, FaUndo, FaRedo, FaHeading } from 'react-icons/fa';
import apiClient from '../../utils/axiosConfig';

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
        title="Bold"
      >
        <FaBold className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Italic"
      >
        <FaItalic className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('underline') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Underline"
      >
        <FaUnderline className="w-4 h-4" />
      </button>
      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}`}
        type="button"
        title="Heading"
      >
        <FaHeading className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Bullet List"
      >
        <FaListUl className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Numbered List"
      >
        <FaListOl className="w-4 h-4" />
      </button>
      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
      <button
        onClick={addImage}
        className="p-2 rounded hover:bg-gray-200"
        type="button"
        title="Add Image"
      >
        <FaImage className="w-4 h-4" />
      </button>
      <button
        onClick={setLink}
        className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('link') ? 'bg-gray-200' : ''}`}
        type="button"
        title="Add Link"
      >
        <FaLink className="w-4 h-4" />
      </button>
      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={`p-2 rounded hover:bg-gray-200 ${!editor.can().undo() ? 'opacity-50 cursor-not-allowed' : ''}`}
        type="button"
        title="Undo"
      >
        <FaUndo className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={`p-2 rounded hover:bg-gray-200 ${!editor.can().redo() ? 'opacity-50 cursor-not-allowed' : ''}`}
        type="button"
        title="Redo"
      >
        <FaRedo className="w-4 h-4" />
      </button>
    </div>
  );
};

const RichTextEditor = ({ value, onChange, placeholder, minimal = false }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({
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
      {minimal && (
        <div className="text-xs text-gray-500 text-right p-2 border-t">
          <span>Tip: You can use Ctrl+B for bold, Ctrl+I for italic</span>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;