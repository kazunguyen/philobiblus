import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { imageService } from '../../services/imageService';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const CoverImageField = ({
    id,
    value,
    onUrlChange,
    onError,
    onUploadingChange,
}) => {
    const [isUploading, setIsUploading] = useState(false);

    const handleUpload = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            onError('Please choose an image file.');
            return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            onError('Image must be 10 MB or smaller.');
            return;
        }

        setIsUploading(true);
        onUploadingChange?.(true);
        onError(null);

        try {
            const result = await imageService.uploadCover(file);
            onUrlChange(result.url);
        } catch (uploadError) {
            onError(uploadError.message);
        } finally {
            setIsUploading(false);
            onUploadingChange?.(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <Label htmlFor={id}>Cover image URL</Label>
                <Input
                    id={id}
                    name="cover_url"
                    value={value}
                    onChange={(event) => onUrlChange(event.target.value)}
                    placeholder="https://example.com/cover.jpg"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor={`${id}-file`}>Or upload from your device</Label>
                <Input
                    id={`${id}-file`}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleUpload}
                    disabled={isUploading}
                />
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Upload className="size-3" />
                    {isUploading ? 'Uploading to ImgBB...' : 'JPEG, PNG, GIF, or WebP up to 10 MB'}
                </p>
            </div>
        </div>
    );
};

export default CoverImageField;
