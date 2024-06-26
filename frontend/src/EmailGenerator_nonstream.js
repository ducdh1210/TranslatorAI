import React, { useState, useEffect } from 'react';

const AgentWindow = ({ title, content, isActive }) => (
  <div className={`mb-4 p-4 rounded ${isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
    <h2 className="text-lg font-semibold mb-2">{title}</h2>
    <pre className="whitespace-pre-wrap">{content}</pre>
  </div>
);

const EmailGenerator = () => {
  const [instruction, setInstruction] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [writerContent, setWriterContent] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [translatorContent, setTranslatorContent] = useState('');
  const [currentAgent, setCurrentAgent] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStreaming(true);
    setWriterContent('');
    setEditorContent('');
    setTranslatorContent('');
    setCurrentAgent('');

    try {
      const response = await fetch('http://localhost:8000/generate_email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instruction }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setStreaming(false);
              break;
            }
            try {
              const parsedData = JSON.parse(data);
              handleEventData(parsedData);
            } catch (error) {
              console.error('Error parsing event data:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setStreaming(false);
    }
  };

  const handleEventData = (data) => {
    switch (data.type) {
      case 'agent_start':
        setCurrentAgent(data.agent);
        break;
      case 'agent_end':
        if (data.output) {
          // eslint-disable-next-line default-case
          switch (data.agent) {
            case 'writer':
              setWriterContent(data.output.draft);
              break;
            case 'editor':
              setEditorContent(data.output.edited_draft);
              break;
            case 'translator':
              setTranslatorContent(data.output.vietnamese_translation);
              break;
          }
        }
        break;
      case 'stream':
        // eslint-disable-next-line default-case
        switch (currentAgent) {
          case 'writer':
            setWriterContent(prev => prev + data.content);
            break;
          case 'editor':
            setEditorContent(prev => prev + data.content);
            break;
          case 'translator':
            setTranslatorContent(prev => prev + data.content);
            break;
        }
        break;
      default:
        console.log('Unknown event type:', data);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Email Generator</h1>
      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Enter email instruction"
          className="w-full p-2 border border-gray-300 rounded"
        />
        <button
          type="submit"
          disabled={streaming}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {streaming ? 'Generating...' : 'Generate Email'}
        </button>
      </form>
      <AgentWindow title="Writer" content={writerContent} isActive={currentAgent === 'writer'} />
      <AgentWindow title="Editor" content={editorContent} isActive={currentAgent === 'editor'} />
      <AgentWindow title="Translator" content={translatorContent} isActive={currentAgent === 'translator'} />
    </div>
  );
};

export default EmailGenerator;