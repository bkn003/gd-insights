
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Image, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage } from '@/utils/imageUtils';

interface MultiImageUploadProps {
  onImagesChange: (images: File[]) => void;
  maxImages?: number;
  maxSizeKB?: number;
}

export const MultiImageUpload: React.FC<MultiImageUploadProps> = ({
  onImagesChange,
  maxImages = 5,
  maxSizeKB = 200
}) => {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (files: FileList | null, fromCamera: boolean = false) => {
    if (!files) return;

    try {
      const fileArray = Array.from(files);
      const maxAllowed = fromCamera ? 1 : maxImages;
      
      if (fileArray.length > maxAllowed) {
        toast.error(`You can only select ${maxAllowed} image${maxAllowed > 1 ? 's' : ''} ${fromCamera ? 'from camera' : 'from gallery'}`);
        return;
      }

      const processedFiles: File[] = [];
      const newPreviews: string[] = [];

      for (const file of fileArray) {
        // Check file type
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image file`);
          continue;
        }

        // Compress image
        const compressedFile = await compressImage(file, maxSizeKB);
        processedFiles.push(compressedFile);

        // Create preview
        const previewUrl = URL.createObjectURL(compressedFile);
        newPreviews.push(previewUrl);
      }

      if (fromCamera) {
        // Replace all images for camera
        // Clean up old previews
        previews.forEach(url => URL.revokeObjectURL(url));
        setSelectedImages(processedFiles);
        setPreviews(newPreviews);
        onImagesChange(processedFiles);
      } else {
        // Add to existing images for gallery
        const totalImages = selectedImages.length + processedFiles.length;
        if (totalImages > maxImages) {
          toast.error(`Maximum ${maxImages} images allowed`);
          // Clean up new previews
          newPreviews.forEach(url => URL.revokeObjectURL(url));
          return;
        }

        const updatedImages = [...selectedImages, ...processedFiles];
        const updatedPreviews = [...previews, ...newPreviews];
        
        setSelectedImages(updatedImages);
        setPreviews(updatedPreviews);
        onImagesChange(updatedImages);
      }

      toast.success(`${processedFiles.length} image${processedFiles.length > 1 ? 's' : ''} added successfully`);
    } catch (error) {
      console.error('Error processing images:', error);
      toast.error('Failed to process images');
    }
  };

  const removeImage = (index: number) => {
    // Clean up preview URL
    URL.revokeObjectURL(previews[index]);
    
    const updatedImages = selectedImages.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);
    
    setSelectedImages(updatedImages);
    setPreviews(updatedPreviews);
    onImagesChange(updatedImages);
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    galleryInputRef.current?.click();
  };

  const clearAllImages = () => {
    // Clean up all preview URLs
    previews.forEach(url => URL.revokeObjectURL(url));
    setSelectedImages([]);
    setPreviews([]);
    onImagesChange([]);
    toast.success('All images cleared');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleCameraClick}
          className="flex items-center gap-2"
        >
          <Camera className="h-4 w-4" />
          Upload from Camera
        </Button>
        
        <Button
          type="button"
          variant="outline"
          onClick={handleGalleryClick}
          className="flex items-center gap-2"
        >
          <Image className="h-4 w-4" />
          Upload from Gallery
        </Button>

        {selectedImages.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={clearAllImages}
            className="flex items-center gap-2 text-red-600 hover:text-red-700"
          >
            <X className="h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleImageSelect(e.target.files, true)}
        className="hidden"
      />
      
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleImageSelect(e.target.files, false)}
        className="hidden"
      />

      {/* Image previews */}
      {selectedImages.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Selected images ({selectedImages.length}/{maxImages}):
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {previews.map((preview, index) => (
              <Card key={index} className="relative">
                <CardContent className="p-2">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-20 object-cover rounded"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <p className="text-xs text-center mt-1 truncate">
                    {selectedImages[index]?.name}
                  </p>
                  <p className="text-xs text-center text-muted-foreground">
                    {Math.round(selectedImages[index]?.size / 1024)}KB
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        <p>• Camera: Upload 1 image only</p>
        <p>• Gallery: Upload up to {maxImages} images</p>
        <p>• Each image will be compressed to ≤{maxSizeKB}KB</p>
      </div>
    </div>
  );
};
