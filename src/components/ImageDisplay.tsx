
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface ImageDisplayProps {
  images: Array<{
    id: string;
    image_url: string;
    image_name?: string;
  }>;
  className?: string;
}

export const ImageDisplay = ({ images, className = "" }: ImageDisplayProps) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Horizontal swipe support
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  if (!images || images.length === 0) {
    return null;
  }

  const handlePrevious = () => {
    setSelectedImageIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setSelectedImageIndex((prev) =>
      prev === images.length - 1 ? 0 : prev + 1
    );
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) handleNext();
    if (isRightSwipe) handlePrevious();
  };

  const handleDownload = async () => {
    const currentImage = images[selectedImageIndex];
    if (!currentImage) return;

    try {
      const response = await fetch(currentImage.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = currentImage.image_name || `image-${selectedImageIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const renderThumbnails = () => {
    if (images.length === 1) {
      return (
        <img
          src={images[0].image_url}
          alt="GD Entry"
          className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setIsOpen(true)}
        />
      );
    }

    return (
      <div className="flex gap-1">
        <img
          src={images[0].image_url}
          alt="GD Entry"
          className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setIsOpen(true)}
        />
        {images.length > 1 && (
          <div
            className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors text-xs font-medium"
            onClick={() => setIsOpen(true)}
          >
            +{images.length - 1}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      {renderThumbnails()}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl w-full h-[90vh] p-0 flex flex-col bg-black/95 border-none">
          <div
            className="relative flex-1 flex items-center justify-center overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Download Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-16 z-50 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
              onClick={handleDownload}
              title="Download Image"
            >
              <Download className="h-6 w-6" />
            </Button>

            {/* Main Image */}
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={images[selectedImageIndex]?.image_url}
                alt={`Image ${selectedImageIndex + 1}`}
                className="max-h-full max-w-full object-contain"
              />

              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full h-10 w-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevious();
                    }}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full h-10 w-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNext();
                    }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}
            </div>

            {/* Image Counter */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {selectedImageIndex + 1} / {images.length}
              </div>
            )}
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="flex gap-2 p-4 justify-center overflow-x-auto bg-black/90">
              {images.map((image, index) => (
                <img
                  key={image.id}
                  src={image.image_url}
                  alt={`Thumbnail ${index + 1}`}
                  className={`w-12 h-12 object-cover rounded cursor-pointer transition-all ${index === selectedImageIndex
                      ? 'ring-2 ring-blue-500 opacity-100'
                      : 'opacity-50 hover:opacity-80'
                    }`}
                  onClick={() => setSelectedImageIndex(index)}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
