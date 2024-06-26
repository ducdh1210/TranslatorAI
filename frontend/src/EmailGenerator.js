import React, { useState, useEffect, useRef } from 'react';

const AgentWindow = ({ title, content, isActive }) => {
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <div className={`mb-6 rounded-lg shadow-md overflow-hidden ${isActive ? 'ring-2 ring-blue-500' : ''}`}>
      <div className={`p-3 ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="bg-white p-4">
        <pre ref={contentRef} className="whitespace-pre-wrap h-48 overflow-auto text-sm font-mono">{content}</pre>
      </div>
    </div>
  );
};

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
              setCurrentAgent('');
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
      setCurrentAgent('');
    }
  };

  const handleEventData = (data) => {
    switch (data.type) {
      case 'agent_start':
        setCurrentAgent(data.agent);
        break;
      case 'agent_end':
        // We might want to do something here, like marking the agent as complete
        break;
      case 'stream':
        updateAgentContent(data.agent, data.content);
        break;
      default:
        console.log('Unknown event type:', data.type);
    }
  };

  const updateAgentContent = (agent, content) => {
    switch (agent) {
      case 'writer':
        setWriterContent(prev => prev + content);
        break;
      case 'editor':
        setEditorContent(prev => prev + content);
        break;
      case 'translator':
        setTranslatorContent(prev => prev + content);
        break;
      default:
        console.log('Unknown agent:', agent);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Email Generator</h1>
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex items-center border-b border-gray-300 py-2">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Enter email instruction"
              className="appearance-none bg-transparent border-none w-full text-gray-700 mr-3 py-1 px-2 leading-tight focus:outline-none"
            />
            <button
              type="submit"
              disabled={streaming}
              className={`flex-shrink-0 ${
                streaming
                  ? 'bg-gray-500 hover:bg-gray-700'
                  : 'bg-blue-500 hover:bg-blue-700'
              } text-sm text-white py-2 px-4 rounded`}
            >
              {streaming ? 'Generating...' : 'Generate Email'}
            </button>
          </div>
        </form>
        {streaming && (
          <div className="text-center text-sm font-medium text-blue-600 mb-6">
            {currentAgent ? `${currentAgent.charAt(0).toUpperCase() + currentAgent.slice(1)} is running...` : 'Initializing...'}
          </div>
        )}
        <div className="space-y-6">
          <AgentWindow title="Writer" content={writerContent} isActive={currentAgent === 'writer'} />
          <AgentWindow title="Editor" content={editorContent} isActive={currentAgent === 'editor'} />
          <AgentWindow title="Translator" content={translatorContent} isActive={currentAgent === 'translator'} />
        </div>
      </div>
    </div>
  );
};

export default EmailGenerator;