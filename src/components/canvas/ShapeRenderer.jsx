import React from 'react';

export default function ShapeRenderer({ item, onContentChange, onContentBlur }) {
  const shapeType = item.type;
  const borderColor = item.borderColor || '#374151';
  const bgColor = item.color || '#ffffff';

  const TextInput = ({ className = "", style = {} }) => (
    <div
      contentEditable
      className={`bg-transparent focus:outline-none text-slate-800 text-center pointer-events-auto flex items-center justify-center overflow-hidden break-words ${className}`}
      style={{ 
        fontSize: `${Math.max(10, 14 - (item.content?.length || 0) / 20)}px`,
        wordBreak: 'break-word',
        ...style
      }}
      onInput={(e) => onContentChange(item.id, e.currentTarget.textContent)}
      onBlur={() => onContentBlur(item.id)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      suppressContentEditableWarning
    >
      {item.content || ''}
    </div>
  );

  switch (shapeType) {
    case 'rectangle':
      return (
        <div 
          style={{ 
            width: '100%', 
            height: '100%', 
            border: `3px solid ${borderColor}`, 
            backgroundColor: bgColor,
            borderRadius: '12px',
          }} 
          className="flex items-center justify-center p-3 shadow-lg"
        >
          <TextInput className="w-full h-full" />
        </div>
      );
    
    case 'circle':
      return (
        <div 
          style={{ 
            width: '100%', 
            height: '100%', 
            border: `3px solid ${borderColor}`, 
            backgroundColor: bgColor,
            borderRadius: '50%',
          }} 
          className="flex items-center justify-center p-4 shadow-lg"
        >
          <TextInput className="w-full h-full" />
        </div>
      );
    
    case 'triangle':
      return (
        <div className="relative w-full h-full">
          <svg 
            width="100%" 
            height="100%" 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none" 
            className="absolute inset-0"
            style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}
          >
            <polygon 
              points="50,2 98,98 2,98" 
              fill={bgColor}
              stroke={borderColor}
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-end justify-center pb-[15%]">
            <TextInput className="w-2/3 h-1/3" />
          </div>
        </div>
      );
    
    case 'diamond':
      return (
        <div className="relative w-full h-full">
          <svg 
            width="100%" 
            height="100%" 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none" 
            className="absolute inset-0"
            style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}
          >
            <polygon 
              points="50,2 98,50 50,98 2,50" 
              fill={bgColor}
              stroke={borderColor}
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <TextInput className="w-1/2 h-1/2" />
          </div>
        </div>
      );
    
    case 'hexagon':
      return (
        <div className="relative w-full h-full">
          <svg 
            width="100%" 
            height="100%" 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none" 
            className="absolute inset-0"
            style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}
          >
            <polygon 
              points="25,3 75,3 97,50 75,97 25,97 3,50" 
              fill={bgColor}
              stroke={borderColor}
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <TextInput className="w-1/2 h-1/2" />
          </div>
        </div>
      );
    
    default:
      return null;
  }
}