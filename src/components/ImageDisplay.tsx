
import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <div className="relative">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Main Image */}
            <div className="relative">
              <img
                src={images[selectedImageIndex]?.image_url}
                alt={`Image ${selectedImageIndex + 1}`}
                className="w-full max-h-[80vh] object-contain"
              />
              
              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                    onClick={handlePrevious}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                    onClick={handleNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Image Counter */}
            {images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {selectedImageIndex + 1} / {images.length}
              </div>
            )}

            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <div className="flex gap-2 p-4 justify-center overflow-x-auto">
                {images.map((image, index) => (
                  <img
                    key={image.id}
                    src={image.image_url}
                    alt={`Thumbnail ${index + 1}`}
                    className={`w-16 h-16 object-cover rounded cursor-pointer transition-all ${
                      index === selectedImageIndex
                        ? 'ring-2 ring-blue-500 opacity-100'
                        : 'opacity-60 hover:opacity-80'
                    }`}
                    onClick={() => setSelectedImageIndex(index)}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
