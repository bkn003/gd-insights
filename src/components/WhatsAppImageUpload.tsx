
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, ImageIcon, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

interface ImagePreview {
  id: string;
  file: File;
  url: string;
}

interface WhatsAppImageUploadProps {
  onImagesChange: (images: File[]) => void;
  maxImages?: number;
}

export const WhatsAppImageUpload = ({ onImagesChange, maxImages = 10 }: WhatsAppImageUploadProps) => {
  const [images, setImages] = useState<ImagePreview[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const compressImage = async (file: File): Promise<File> => {
    try {
      const options = {
        maxSizeMB: 0.05, // 50KB
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: 'image/jpeg',
        quality: 0.85,
        initialQuality: 0.85
      };
      
      const compressedFile = await imageCompression(file, options);
      
      // Ensure it's under 50KB
      if (compressedFile.size > 50 * 1024) {
        const stricterOptions = {
          ...options,
          quality: 0.75,
          maxSizeMB: 0.048,
          maxWidthOrHeight: 1024
        };
        return await imageCompression(file, stricterOptions);
      }
      
      return compressedFile;
    } catch (error) {
      console.error('Error compressing image:', error);
      throw new Error('Failed to compress image');
    }
  };

  const handleImageSelect = async (files: FileList | null, source: 'camera' | 'gallery') => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    
    // For camera, limit to 1 additional image at a time
    if (source === 'camera' && fileArray.length > 1) {
      toast.error('Camera can only capture one image at a time');
      return;
    }
    
    // Check total image limit
    if (images.length + fileArray.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }
    
    try {
      const newImages: ImagePreview[] = [];
      
      for (const file of fileArray) {
        if (!file.type.startsWith('image/')) {
          toast.error('Please select only image files');
          continue;
        }
        
        toast.info(`Compressing ${file.name}...`);
        const compressedFile = await compressImage(file);
        
        const preview: ImagePreview = {
          id: Math.random().toString(36).substr(2, 9),
          file: compressedFile,
          url: URL.createObjectURL(compressedFile)
        };
        newImages.push(preview);
      }
      
      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);
      onImagesChange(updatedImages.map(img => img.file));
      
      toast.success(`${newImages.length} image(s) added and compressed to ${newImages.map(img => `${(img.file.size / 1024).toFixed(0)}KB`).join(', ')}`);
    } catch (error) {
      console.error('Error processing images:', error);
      toast.error('Failed to process images');
    }
  };

  const removeImage = (id: string) => {
    const imageToRemove = images.find(img => img.id === id);
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    
    const updatedImages = images.filter(img => img.id !== id);
    setImages(updatedImages);
    onImagesChange(updatedImages.map(img => img.file));
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    galleryInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      {/* Upload Buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCameraClick}
          className="flex items-center gap-2"
        >
          <Camera className="h-4 w-4" />
          Camera
        </Button>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGalleryClick}
          className="flex items-center gap-2"
        >
          <ImageIcon className="h-4 w-4" />
          Gallery
        </Button>
        
        {images.length > 0 && (
          <span className="text-sm text-muted-foreground self-center">
            {images.length}/{maxImages} images
          </span>
        )}
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleImageSelect(e.target.files, 'camera')}
        className="hidden"
      />
      
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleImageSelect(e.target.files, 'gallery')}
        className="hidden"
      />

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((image) => (
            <div key={image.id} className="relative aspect-square">
              <img
                src={image.url}
                alt="Preview"
                className="w-full h-full object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => removeImage(image.id)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                {(image.file.size / 1024).toFixed(0)}KB
              </div>
            </div>
          ))}
          
          {/* Add More Button */}
          {images.length < maxImages && (
            <button
              type="button"
              onClick={handleGalleryClick}
              className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 transition-colors"
            >
              <Plus className="h-6 w-6 text-gray-400" />
            </button>
          )}
        </div>
      )}
      
      {images.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Total size: {((images.reduce((sum, img) => sum + img.file.size, 0)) / 1024).toFixed(0)}KB
        </div>
      )}
    </div>
  );
};
