<?php

namespace App\Http\Controllers\Api\Dv2;

use App\Http\Controllers\Controller;
use App\Models\Dv2\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class MediaController extends Controller
{
    /**
     * POST /api/dashboard/v2/media/upload - رفع ملف
     */
    public function upload(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'file' => 'required|file|max:102400', // 100MB
                'mediaable_id' => 'required|integer',
                'mediaable_type' => 'required|string',
                'note' => 'nullable|string',
            ]);

            $file = $request->file('file');
            
            // إنشاء اسم فريد للملف
            $filename = Str::random(16) . '_' . time() . '.' . $file->extension();
            
            // حفظ الملف في storage/app/public/dash-v2/
            $path = $file->storeAs('dash-v2', $filename, 'public');

            // إنشاء سجل الملف في قاعدة البيانات
            $media = Media::create([
                'mediaable_id' => $request->input('mediaable_id'),
                'mediaable_type' => $request->input('mediaable_type'),
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
                'note' => $request->input('note'),
                'file_status' => 'uploaded',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'File uploaded successfully',
                'data' => [
                    'id' => $media->id,
                    'original_name' => $media->original_name,
                    'path' => asset('storage/' . $media->path),
                    'size' => $media->size,
                ],
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * GET /api/dashboard/v2/media/{id}/download - تحميل ملف
     */
    public function download(Media $media)
    {
        try {
            if (!Storage::disk('public')->exists($media->path)) {
                return response()->json([
                    'success' => false,
                    'message' => 'File not found',
                ], 404);
            }

            return Storage::disk('public')->download($media->path, $media->original_name);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * DELETE /api/dashboard/v2/media/{id} - حذف ملف
     */
    public function destroy(Media $media): JsonResponse
    {
        try {
            // حذف الملف من storage
            if (Storage::disk('public')->exists($media->path)) {
                Storage::disk('public')->delete($media->path);
            }

            // حذف السجل من قاعدة البيانات
            $media->delete();

            return response()->json([
                'success' => true,
                'message' => 'File deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/dashboard/v2/media/by-entity/{type}/{id} - جلب ملفات الكائن
     */
    public function byEntity($type, $id): JsonResponse
    {
        try {
            $media = Media::where('mediaable_type', $type)
                ->where('mediaable_id', $id)
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'original_name' => $item->original_name,
                        'path' => asset('storage/' . $item->path),
                        'size' => $item->size,
                        'mime_type' => $item->mime_type,
                        'created_at' => $item->created_at,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $media,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}