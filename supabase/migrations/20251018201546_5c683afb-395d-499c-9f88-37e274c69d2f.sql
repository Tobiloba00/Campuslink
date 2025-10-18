-- Make message-images bucket public so images display in chat
UPDATE storage.buckets 
SET public = true 
WHERE id = 'message-images';