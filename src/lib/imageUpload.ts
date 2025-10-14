import { supabase } from "@/integrations/supabase/client";

export interface ImageUploadResult {
  url: string;
  path: string;
}

export async function uploadImage(
  file: File,
  bucket: string,
  folder: string
): Promise<ImageUploadResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Please upload a JPG, PNG, or WebP image.');
  }

  // Validate file size (5MB for posts/profile, 10MB for messages)
  const maxSize = bucket === 'message-images' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
  }

  // Compress image if needed
  const compressedFile = await compressImage(file);

  // Generate unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/${folder}/${Date.now()}.${fileExt}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, compressedFile, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    path: data.path,
  };
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if too large
        const maxDimension = 1920;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.8
        );
      };
    };
  });
}

export async function deleteImage(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
