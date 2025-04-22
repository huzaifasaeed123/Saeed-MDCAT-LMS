// Place this file in: components/common/RichTextEditor.js

import React, { useEffect, useRef } from 'react';
import { 
  BlockEditorProvider, 
  BlockCanvas, 
  WritingFlow, 
  ObserveTyping,
  BlockTools
} from '@wordpress/block-editor';
import { 
  getDefaultBlockName, 
  createBlock, 
  serialize, 
  parse 
} from '@wordpress/blocks';
import '@wordpress/block-library/build-style/style.css';
import '@wordpress/components/build-style/style.css';
import axios from 'axios';

const RichTextEditor = ({ value, onChange, placeholder, minimal = false }) => {
  const blocks = value ? parse(value) : [createBlock(getDefaultBlockName())];
  const ref = useRef(null);

  const settings = {
    mediaUpload: async ({ filesList, onFileChange }) => {
      try {
        const formData = new FormData();
        formData.append('image', filesList[0]);
        
        // Use axios directly for image upload to send proper multipart/form-data
        const response = await axios.post(`${import.meta.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/upload-image`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        });
        
        onFileChange([{
          id: response.data.id,
          url: response.data.url
        }]);
      } catch (error) {
        console.error('Error uploading image:', error);
      }
    }
  };

  const handleChange = (newBlocks) => {
    const html = serialize(newBlocks);
    onChange(html);
  };

  return (
    <div 
      className={`editor-wrapper border rounded-lg p-4 ${
        minimal ? 'min-h-[100px]' : 'min-h-[200px]'
      }`}
      ref={ref}
    >
      <BlockEditorProvider
        value={blocks}
        onInput={handleChange}
        onChange={handleChange}
        settings={settings}
      >
        <BlockTools>
          <WritingFlow>
            <ObserveTyping>
              <BlockCanvas height={minimal ? '100px' : '200px'} />
            </ObserveTyping>
          </WritingFlow>
        </BlockTools>
      </BlockEditorProvider>
    </div>
  );
};

export default RichTextEditor;