import React, { useState } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function ImageCollage({ images = [] }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const openLightbox = (index) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const goNext = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  const renderLightbox = () => (
    <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl w-full max-h-[90vh] p-0 bg-black/95 border-0 overflow-hidden">
        <div className="relative w-full h-[80vh] sm:h-[85vh] flex items-center justify-center p-2 sm:p-4">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 z-50 bg-white/10 hover:bg-white/20 text-white rounded-full p-2"
          >
            <X className="w-5 h-5" />
          </button>
          
          <img 
            src={images[currentIndex]} 
            alt="Full size" 
            className="max-w-full max-h-full object-contain"
          />
          
          {images.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-2"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button
                onClick={goNext}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-2"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                {currentIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  // Single image
  if (images.length === 1) {
    return (
      <>
        <img 
          src={images[0]} 
          alt="Post" 
          className="mt-3 rounded-lg max-h-48 border border-slate-200 object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => openLightbox(0)}
        />
        {renderLightbox()}
      </>
    );
  }

  // Two images
  if (images.length === 2) {
    return (
      <>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
          {images.map((img, i) => (
            <img 
              key={i}
              src={img} 
              alt={`Post ${i + 1}`} 
              className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => openLightbox(i)}
            />
          ))}
        </div>
        {renderLightbox()}
      </>
    );
  }

  // Three images
  if (images.length === 3) {
    return (
      <>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
          <img 
            src={images[0]} 
            alt="Post 1" 
            className="w-full h-[calc(8rem+0.25rem)] object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => openLightbox(0)}
          />
          <div className="grid grid-rows-2 gap-1">
            <img 
              src={images[1]} 
              alt="Post 2" 
              className="w-full h-16 object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => openLightbox(1)}
            />
            <img 
              src={images[2]} 
              alt="Post 3" 
              className="w-full h-16 object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => openLightbox(2)}
            />
          </div>
        </div>
        {renderLightbox()}
      </>
    );
  }

  // Four images - 2x2 grid
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
        {images.slice(0, 4).map((img, i) => (
          <img 
            key={i}
            src={img} 
            alt={`Post ${i + 1}`} 
            className="w-full h-24 object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => openLightbox(i)}
          />
        ))}
      </div>
      {renderLightbox()}
    </>
  );
}