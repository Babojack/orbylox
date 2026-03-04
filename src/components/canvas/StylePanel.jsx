import React from 'react';
import { Button } from "@/components/ui/button";
import { Palette, X } from 'lucide-react';

export default function StylePanel({ selectedItem, onUpdate, onClose }) {
  const borderColors = [
    { name: 'Slate', value: '#334155' },
    { name: 'Red', value: '#dc2626' },
    { name: 'Orange', value: '#ea580c' },
    { name: 'Green', value: '#16a34a' },
    { name: 'Blue', value: '#2563eb' },
    { name: 'Purple', value: '#9333ea' },
    { name: 'Pink', value: '#db2777' },
  ];

  const bgColors = [
    { name: 'White', value: '#ffffff' },
    { name: 'Yellow', value: '#fef08a' },
    { name: 'Blue', value: '#bfdbfe' },
    { name: 'Green', value: '#bbf7d0' },
    { name: 'Pink', value: '#fbcfe8' },
    { name: 'Purple', value: '#e9d5ff' },
  ];

  if (!selectedItem) return null;

  return (
    <div className="absolute top-20 left-4 bg-white/95 backdrop-blur-sm shadow-2xl border border-slate-200/80 rounded-2xl p-4 z-50 w-64 max-w-[calc(100vw-2rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Palette className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="font-semibold text-slate-900">Stil</h3>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {selectedItem.type !== 'text' && selectedItem.type !== 'note' && (
        <>
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-500 mb-2 block uppercase tracking-wider">Rahmenfarbe</label>
            <div className="grid grid-cols-7 gap-2">
              {borderColors.map((color) => (
                <button
                  key={color.value}
                  className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${
                    selectedItem.borderColor === color.value ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => onUpdate({ borderColor: color.value })}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block uppercase tracking-wider">Hintergrund</label>
            <div className="grid grid-cols-6 gap-2">
              {bgColors.map((color) => (
                <button
                  key={color.value}
                  className={`w-7 h-7 rounded-lg border-2 border-slate-200 transition-all hover:scale-110 ${
                    selectedItem.color === color.value ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => onUpdate({ color: color.value })}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {selectedItem.type === 'note' && (
        <div>
          <label className="text-xs font-medium text-slate-500 mb-2 block uppercase tracking-wider">Notizfarbe</label>
          <div className="grid grid-cols-4 gap-2">
            {['bg-yellow-200', 'bg-orange-200', 'bg-pink-200', 'bg-purple-200', 'bg-blue-200', 'bg-teal-200', 'bg-green-200', 'bg-slate-200'].map((colorClass) => (
              <button
                key={colorClass}
                className={`w-12 h-10 rounded-lg border-2 transition-all hover:scale-105 ${colorClass} ${
                  selectedItem.color === colorClass ? 'ring-2 ring-offset-2 ring-indigo-500 scale-105' : 'border-white/50'
                }`}
                onClick={() => onUpdate({ color: colorClass })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}