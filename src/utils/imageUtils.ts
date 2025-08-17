
export const compressImage = (file: File, maxSizeKB: number = 200): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      const MAX_WIDTH = 1024;
      const MAX_HEIGHT = 1024;
      
      let { width, height } = img;
      
      if (width > height) {
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = (width * MAX_HEIGHT) / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx!.drawImage(img, 0, 0, width, height);
      
      // Start with high quality and reduce until size is acceptable
      let quality = 0.9;
      const compress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Compression failed'));
              return;
            }

            const sizeKB = blob.size / 1024;
            
            if (sizeKB <= maxSizeKB || quality <= 0.1) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              quality -= 0.1;
              compress();
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      compress();
    };

    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
};

export const uploadImageToSupabase = async (
  file: File,
  userId: string,
  entryId: string
): Promise<string> => {
  const { supabase } = await import('@/integrations/supabase/client');
  
  // Compress image first
  const compressedFile = await compressImage(file);
  
  const fileName = `${userId}/${entryId}_${Date.now()}.jpg`;
  
  const { data, error } = await supabase.storage
    .from('gd-images')
    .upload(fileName, compressedFile);

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('gd-images')
    .getPublicUrl(fileName);

  return publicUrl;
};
