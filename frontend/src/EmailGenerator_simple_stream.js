import React, { useState, useEffect, useRef } from 'react';

const EmailGenerator = () => {
  const [instruction, setInstruction] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState('');
  const [currentAgent, setCurrentAgent] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStreaming(true);
    setResult('');
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
      case 'start':
        setCurrentAgent(`Starting ${data.agent}...`);
        break;
      case 'end':
        setCurrentAgent(`Finished ${data.agent}`);
        if (data.output) {
          setResult(prevResult => prevResult + JSON.stringify(data.output, null, 2) + '\n\n');
        }
        break;
      case 'stream':
        setResult(prevResult => prevResult + data.content);
        break;
      case 'tool_start':
        setCurrentAgent(`Starting tool: ${data.tool}...`);
        break;
      case 'tool_end':
        setCurrentAgent(`Finished tool: ${data.tool}`);
        if (data.output) {
          setResult(prevResult => prevResult + `Tool output: ${JSON.stringify(data.output, null, 2)}\n\n`);
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
      {currentAgent && (
        <div className="mb-2 text-sm text-gray-600">{currentAgent}</div>
      )}
      <div className="bg-gray-100 p-4 rounded">
        <pre className="whitespace-pre-wrap">{result}</pre>
      </div>
    </div>
  );
};

export default EmailGenerator;