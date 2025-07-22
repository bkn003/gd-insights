
import React from 'react';

export const ReactTest = () => {
  const [test, setTest] = React.useState('React is working');
  
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">{test}</h2>
      <button 
        onClick={() => setTest('useState is working!')}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Test useState
      </button>
    </div>
  );
};
