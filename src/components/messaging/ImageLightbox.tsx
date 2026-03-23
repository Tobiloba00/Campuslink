import { useEffect, useCallback, useState } from "react";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export const ImageLightbox = ({ src, alt = "Image", onClose }: ImageLightboxProps) => {
  const [scale, setScale] = useState(1);
  const [loaded, setLoaded] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + 0.25, 3));
    if (e.key === '-') setScale(s => Math.max(s - 0.25, 0.5));
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `campuslink-image-${Date.now()}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Controls */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(s + 0.25, 3)); }}
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors backdrop-blur-sm"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(s - 0.25, 0.5)); }}
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors backdrop-blur-sm"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors backdrop-blur-sm"
          >
            <Download className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors backdrop-blur-sm"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Image */}
      <div
        className="relative z-[1] max-w-[90vw] max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {!loaded && (
          <div className="w-16 h-16 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        )}
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          className={`max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-all duration-300 select-none ${
            loaded ? 'opacity-100' : 'opacity-0 absolute'
          }`}
          style={{ transform: `scale(${scale})` }}
          draggable={false}
        />
      </div>

      {/* Scale indicator */}
      {scale !== 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm z-10">
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
};
